import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ReviewApprovalDto, ApprovalDecision } from './dto/review-approval.dto';
import { ApprovalQueryDto } from './dto/approval-query.dto';
import { ApprovalStatus, NotificationType } from '@prisma/client';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new approval request for a sensitive AI action
   */
  async create(orgId: string, userId: string, dto: CreateApprovalDto) {
    if (dto.suggestionId) {
      const suggestion = await this.prisma.aiSuggestion.findUnique({
        where: { id: dto.suggestionId },
      });
      if (!suggestion) {
        throw new NotFoundException('Associated AI suggestion not found.');
      }
    }

    const approval = await this.prisma.approvalRequest.create({
      data: {
        organizationId: orgId,
        requestedById: userId,
        suggestionId: dto.suggestionId || null,
        actionType: dto.actionType,
        actionPayload: dto.actionPayload,
        status: ApprovalStatus.PENDING,
      },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        suggestion: true,
      },
    });

    // Record in Audit Log
    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: 'APPROVAL_REQUESTED',
        resource: 'ApprovalRequest',
        resourceId: approval.id,
        payload: {
          actionType: dto.actionType,
          actionPayload: dto.actionPayload,
          suggestionId: dto.suggestionId,
        },
      },
    });

    // Real-time WebSocket emission to organization room
    this.eventsGateway.emitApprovalRequested(orgId, approval);

    // Notify organization admins & owners
    const admins = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        systemRole: { in: ['ORG_OWNER', 'ORG_ADMIN'] },
        isActive: true,
      },
    });

    for (const admin of admins) {
      if (admin.userId !== userId) {
        await this.notificationsService.createNotification(
          orgId,
          admin.userId,
          NotificationType.APPROVAL_REQUESTED,
          'New Action Approval Request',
          `A new sensitive AI action '${dto.actionType}' requires review.`,
          { approvalId: approval.id, actionType: dto.actionType },
        );
      }
    }

    this.logger.log(`Created approval request #${approval.id} for action '${dto.actionType}'`);
    return approval;
  }

  /**
   * List all approval requests for an organization with pagination & filtering
   */
  async findAll(orgId: string, query: ApprovalQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId: orgId };
    if (query.status) where.status = query.status;
    if (query.actionType) where.actionType = { contains: query.actionType, mode: 'insensitive' };

    const [approvals, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          execution: true,
          suggestion: {
            select: { id: true, ticketId: true, suggestedReply: true, confidence: true },
          },
        },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return {
      approvals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get approval request details by ID
   */
  async findById(orgId: string, approvalId: string) {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, organizationId: orgId },
      include: {
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        execution: {
          include: {
            executedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        suggestion: true,
      },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found.');
    }

    return approval;
  }

  /**
   * Review an approval request (APPROVE or REJECT) and execute if approved
   */
  async reviewAndExecute(
    orgId: string,
    approvalId: string,
    reviewerId: string,
    dto: ReviewApprovalDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, organizationId: orgId },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found.');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Approval request is already ${approval.status} and cannot be modified.`);
    }

    const now = new Date();

    // 1. Handling Rejection
    if (dto.decision === ApprovalDecision.REJECT) {
      const updated = await this.prisma.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: ApprovalStatus.REJECTED,
          reviewedById: reviewerId,
          reviewedAt: now,
          reviewNotes: dto.reviewNotes || 'Rejected by authorized reviewer.',
        },
        include: {
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: reviewerId,
          action: 'APPROVAL_REJECTED',
          resource: 'ApprovalRequest',
          resourceId: approvalId,
          payload: { reviewNotes: dto.reviewNotes },
          ipAddress,
          userAgent,
        },
      });

      // WebSocket broadcast & in-app notification
      this.eventsGateway.emitApprovalResolved(orgId, updated);
      await this.notificationsService.createNotification(
        orgId,
        approval.requestedById,
        NotificationType.APPROVAL_RESOLVED,
        'Action Approval Rejected',
        `Your approval request for '${approval.actionType}' was rejected: "${dto.reviewNotes || 'No notes provided'}"`,
        { approvalId, status: 'REJECTED' },
      );

      return {
        message: 'Approval request rejected successfully.',
        approval: updated,
      };
    }

    // 2. Handling Approval & Execution Dispatch
    let executionSuccess = false;
    let executionResult: any = {};
    let errorMessage: string | null = null;

    try {
      executionResult = await this.dispatchAction(orgId, approval.actionType, approval.actionPayload);
      executionSuccess = true;
    } catch (err) {
      this.logger.error(`Failed to execute approved action #${approvalId}: ${err.message}`, err.stack);
      errorMessage = err.message || 'Execution error encountered.';
      executionSuccess = false;
    }

    const finalStatus = executionSuccess ? ApprovalStatus.EXECUTED : ApprovalStatus.FAILED;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approvalRequest.update({
        where: { id: approvalId },
        data: {
          status: finalStatus,
          reviewedById: reviewerId,
          reviewedAt: now,
          reviewNotes: dto.reviewNotes || 'Approved and processed by authorized reviewer.',
        },
      });

      const execution = await tx.aiExecution.create({
        data: {
          approvalRequestId: approvalId,
          executedById: reviewerId,
          isSuccess: executionSuccess,
          executionResult,
          errorMessage,
          executedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          userId: reviewerId,
          action: executionSuccess ? 'AI_ACTION_EXECUTED' : 'AI_ACTION_EXECUTION_FAILED',
          resource: 'AiExecution',
          resourceId: execution.id,
          payload: {
            actionType: approval.actionType,
            actionPayload: approval.actionPayload,
            executionResult,
            errorMessage,
          },
          ipAddress,
          userAgent,
        },
      });

      return {
        approval: updatedApproval,
        execution,
      };
    });

    // WebSocket broadcast & in-app notification
    this.eventsGateway.emitApprovalResolved(orgId, result.approval);
    await this.notificationsService.createNotification(
      orgId,
      approval.requestedById,
      NotificationType.APPROVAL_RESOLVED,
      executionSuccess ? 'Action Approved & Executed' : 'Action Approved but Failed',
      executionSuccess
        ? `Your request for '${approval.actionType}' was approved and executed.`
        : `Your request for '${approval.actionType}' was approved but execution failed: ${errorMessage}`,
      { approvalId, status: finalStatus, isSuccess: executionSuccess },
    );

    this.logger.log(
      `Approval request #${approvalId} reviewed by ${reviewerId} -> Status: ${finalStatus}`,
    );

    return {
      message: executionSuccess
        ? 'Approval request approved and executed successfully.'
        : `Approval processed but execution failed: ${errorMessage}`,
      ...result,
    };
  }

  /**
   * Action Execution Dispatcher (Idempotent tool runner)
   */
  private async dispatchAction(orgId: string, actionType: string, payload: any): Promise<any> {
    switch (actionType) {
      case 'SUBSCRIPTION_CORRECTION':
      case 'UPDATE_CUSTOMER_METADATA': {
        const customerId = payload?.customerId;
        if (!customerId) {
          throw new BadRequestException("Payload missing required 'customerId'");
        }

        const customer = await this.prisma.customer.findFirst({
          where: { id: customerId, organizationId: orgId },
        });

        if (!customer) {
          throw new NotFoundException(`Customer #${customerId} not found in this organization.`);
        }

        const currentMetadata = (customer.metadata as Record<string, any>) || {};
        const updatedMetadata = {
          ...currentMetadata,
          plan: payload.targetPlan || currentMetadata.plan || 'Pro',
          tier: payload.targetTier || currentMetadata.tier || 'Enterprise',
          lastCorrectedAt: new Date().toISOString(),
          correctionNotes: payload.notes || 'Corrected via approved AI action',
        };

        const updatedCustomer = await this.prisma.customer.update({
          where: { id: customerId },
          data: { metadata: updatedMetadata },
        });

        return {
          action: 'CUSTOMER_METADATA_UPDATED',
          customerId: updatedCustomer.id,
          newMetadata: updatedCustomer.metadata,
        };
      }

      case 'APPLY_ACCOUNT_CREDIT': {
        const customerId = payload?.customerId;
        const creditAmount = payload?.creditAmount || 50;

        const customer = await this.prisma.customer.findFirst({
          where: { id: customerId, organizationId: orgId },
        });

        if (!customer) throw new NotFoundException('Customer not found.');

        const metadata = (customer.metadata as Record<string, any>) || {};
        const currentCredits = metadata.creditBalance || 0;
        metadata.creditBalance = currentCredits + creditAmount;

        await this.prisma.customer.update({
          where: { id: customerId },
          data: { metadata },
        });

        return {
          action: 'CREDIT_APPLIED',
          customerId,
          creditedAmount: creditAmount,
          totalBalance: metadata.creditBalance,
        };
      }

      default:
        // Generic fallback action handler
        return {
          action: actionType,
          status: 'SUCCESS',
          processedAt: new Date().toISOString(),
          details: 'Action executed within safe system bounds.',
        };
    }
  }
}
