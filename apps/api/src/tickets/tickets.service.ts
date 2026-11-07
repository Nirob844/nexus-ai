import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { TICKET_QUEUE_NAME } from '../queue/queue.module';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/ticket-message.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import {
  SystemRole,
  TicketMessageSenderType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TICKET_QUEUE_NAME) private readonly ticketQueue: Queue,
  ) {}

  /**
   * Create a new ticket and queue for AI analysis
   */
  async create(orgId: string, userId: string, userRole: SystemRole, dto: CreateTicketDto) {
    let customerId: string;

    if (userRole === SystemRole.CUSTOMER) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      // Find or create customer entry for this organization
      const customer = await this.prisma.customer.upsert({
        where: {
          organizationId_email: {
            organizationId: orgId,
            email: user.email,
          },
        },
        update: {
          name: `${user.firstName} ${user.lastName}`.trim(),
        },
        create: {
          organizationId: orgId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
        },
      });

      customerId = customer.id;
    } else {
      // Agent/Admin creating ticket on behalf of a customer
      if (!dto.customerEmail) {
        throw new BadRequestException('customerEmail is required when creating ticket as agent/admin.');
      }

      const customer = await this.prisma.customer.upsert({
        where: {
          organizationId_email: {
            organizationId: orgId,
            email: dto.customerEmail.toLowerCase(),
          },
        },
        update: {
          name: dto.customerName || 'Customer',
        },
        create: {
          organizationId: orgId,
          email: dto.customerEmail.toLowerCase(),
          name: dto.customerName || 'Customer',
        },
      });

      customerId = customer.id;
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const createdTicket = await tx.ticket.create({
        data: {
          organizationId: orgId,
          customerId,
          subject: dto.subject,
          description: dto.description,
          category: dto.category || 'General',
          priority: dto.priority || TicketPriority.MEDIUM,
          status: TicketStatus.AI_PROCESSING,
          messages: {
            create: [
              {
                senderType:
                  userRole === SystemRole.CUSTOMER
                    ? TicketMessageSenderType.CUSTOMER
                    : TicketMessageSenderType.AGENT,
                senderId: userId,
                content: dto.description,
                isInternal: false,
              },
            ],
          },
          events: {
            create: [
              {
                eventType: 'TICKET_CREATED',
                actorId: userId,
                metadata: {
                  category: dto.category || 'General',
                  priority: dto.priority || TicketPriority.MEDIUM,
                },
              },
            ],
          },
        },
        include: {
          customer: true,
          messages: true,
          events: true,
        },
      });

      // Save attachments if provided
      if (dto.attachments && dto.attachments.length > 0) {
        await tx.ticketAttachment.createMany({
          data: dto.attachments.map((att) => ({
            ticketId: createdTicket.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            fileType: att.fileType,
          })),
        });
      }

      return createdTicket;
    });

    // Enqueue BullMQ background job for AI analysis (Classification, Sentiment, Suggestions)
    try {
      await this.ticketQueue.add(
        'analyze-ticket',
        {
          ticketId: ticket.id,
          organizationId: orgId,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          customer: {
            id: ticket.customer.id,
            name: ticket.customer.name,
            email: ticket.customer.email,
          },
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Enqueued AI analysis job for ticket #${ticket.ticketNumber}`);
    } catch (err) {
      this.logger.error(`Failed to enqueue ticket job in Redis: ${err.message}`, err.stack);
    }

    return ticket;
  }

  /**
   * Find tickets with multi-tenant filtering, search & pagination
   */
  async findAll(orgId: string, userId: string, userRole: SystemRole, query: TicketQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId: orgId,
    };

    // If customer, only show their own tickets
    if (userRole === SystemRole.CUSTOMER) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const customer = await this.prisma.customer.findUnique({
        where: {
          organizationId_email: {
            organizationId: orgId,
            email: user?.email || '',
          },
        },
      });

      if (!customer) {
        return { tickets: [], total: 0, page, totalPages: 0 };
      }

      where.customerId = customer.id;
    }

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
    if (query.agentId) {
      where.assignments = {
        some: {
          agentId: query.agentId,
        },
      };
    }

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          assignments: {
            include: {
              agent: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          analyses: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { messages: true, attachments: true },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find ticket details by ID with access control on internal notes
   */
  async findById(orgId: string, ticketId: string, userId: string, userRole: SystemRole) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: orgId },
      include: {
        customer: true,
        attachments: true,
        assignments: {
          include: {
            agent: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        messages: {
          where: userRole === SystemRole.CUSTOMER ? { isInternal: false } : {},
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        analyses: {
          orderBy: { createdAt: 'desc' },
        },
        suggestions: {
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found in this organization.');
    }

    if (userRole === SystemRole.CUSTOMER) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (ticket.customer.email.toLowerCase() !== user?.email.toLowerCase()) {
        throw new ForbiddenException('You do not have permission to view this ticket.');
      }
    }

    return ticket;
  }

  /**
   * Add a message or internal note to a ticket
   */
  async addMessage(
    orgId: string,
    ticketId: string,
    userId: string,
    userRole: SystemRole,
    dto: CreateTicketMessageDto,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: orgId },
      include: { customer: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found in this organization.');
    }

    // Customers cannot post internal notes
    if (dto.isInternal && userRole === SystemRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot post internal notes.');
    }

    const senderType =
      userRole === SystemRole.CUSTOMER
        ? TicketMessageSenderType.CUSTOMER
        : TicketMessageSenderType.AGENT;

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        senderType,
        senderId: userId,
        content: dto.content,
        isInternal: !!dto.isInternal,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    // Auto update status if customer replied
    let nextStatus = ticket.status;
    if (senderType === TicketMessageSenderType.CUSTOMER && ticket.status === TicketStatus.PENDING_CUSTOMER) {
      nextStatus = TicketStatus.IN_PROGRESS;
    } else if (senderType === TicketMessageSenderType.AGENT && !dto.isInternal && ticket.status === TicketStatus.OPEN) {
      nextStatus = TicketStatus.IN_PROGRESS;
    }

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        updatedAt: new Date(),
      },
    });

    // Log event
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: userId,
        eventType: dto.isInternal
          ? 'INTERNAL_NOTE_ADDED'
          : senderType === TicketMessageSenderType.CUSTOMER
          ? 'CUSTOMER_REPLIED'
          : 'AGENT_REPLIED',
      },
    });

    return message;
  }

  /**
   * Assign or reassign ticket to an agent
   */
  async assign(orgId: string, ticketId: string, agentId: string, actorId: string) {
    const [ticket, agentMembership] = await Promise.all([
      this.prisma.ticket.findFirst({
        where: { id: ticketId, organizationId: orgId },
      }),
      this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: agentId,
          },
        },
        include: { user: true },
      }),
    ]);

    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (!agentMembership || !agentMembership.isActive) {
      throw new BadRequestException('Agent is not an active member of this organization.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete prior assignment if any
      await tx.ticketAssignment.deleteMany({
        where: { ticketId },
      });

      // Create new assignment
      await tx.ticketAssignment.create({
        data: {
          ticketId,
          agentId,
        },
      });

      // Transition from OPEN to IN_PROGRESS on assignment
      const newStatus = ticket.status === TicketStatus.OPEN ? TicketStatus.IN_PROGRESS : ticket.status;

      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: newStatus },
      });

      await tx.ticketEvent.create({
        data: {
          ticketId,
          actorId,
          eventType: 'TICKET_ASSIGNED',
          metadata: {
            assignedAgentId: agentId,
            agentName: `${agentMembership.user.firstName} ${agentMembership.user.lastName}`,
          },
        },
      });
    });

    return { message: 'Ticket assigned successfully.', agentId };
  }

  /**
   * Update ticket status with state-machine transition validation
   */
  async updateStatus(orgId: string, ticketId: string, newStatus: TicketStatus, actorId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: orgId },
    });

    if (!ticket) throw new NotFoundException('Ticket not found.');

    const updateData: any = {
      status: newStatus,
    };

    if (newStatus === TicketStatus.RESOLVED && !ticket.resolvedAt) {
      updateData.resolvedAt = new Date();
    } else if (newStatus === TicketStatus.CLOSED && !ticket.closedAt) {
      updateData.closedAt = new Date();
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId,
        eventType: 'TICKET_STATUS_CHANGED',
        metadata: {
          oldStatus: ticket.status,
          newStatus,
        },
      },
    });

    return updated;
  }

  /**
   * Update ticket priority
   */
  async updatePriority(orgId: string, ticketId: string, priority: TicketPriority, actorId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: orgId },
    });

    if (!ticket) throw new NotFoundException('Ticket not found.');

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { priority },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId,
        eventType: 'TICKET_PRIORITY_CHANGED',
        metadata: {
          oldPriority: ticket.priority,
          newPriority: priority,
        },
      },
    });

    return updated;
  }

  /**
   * Reopen a resolved ticket
   */
  async reopen(orgId: string, ticketId: string, actorId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId: orgId },
    });

    if (!ticket) throw new NotFoundException('Ticket not found.');

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Closed tickets cannot be reopened. Please submit a new ticket.');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.REOPENED,
        resolvedAt: null,
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId,
        eventType: 'TICKET_REOPENED',
      },
    });

    return updated;
  }
}
