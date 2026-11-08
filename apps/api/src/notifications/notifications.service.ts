import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Create an in-app notification and broadcast real-time over WebSocket
   */
  async createNotification(
    orgId: string,
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata: Record<string, any> = {},
  ) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          organizationId: orgId,
          userId,
          type,
          title,
          message,
          metadata,
        },
      });

      // Broadcast real-time event to user's private socket room
      this.eventsGateway.emitNotification(userId, notification);

      this.logger.log(`Notification dispatched to user #${userId} [${type}]`);
      return notification;
    } catch (err) {
      this.logger.error(`Failed to create notification: ${err.message}`, err.stack);
    }
  }

  /**
   * Get user notifications with filtering and pagination
   */
  async findAll(orgId: string, userId: string, query: NotificationQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId: orgId,
      userId,
    };

    if (typeof query.isRead === 'boolean') {
      where.isRead = query.isRead;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { organizationId: orgId, userId, isRead: false },
      }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get total unread count for badge indicators
   */
  async getUnreadCount(orgId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { organizationId: orgId, userId, isRead: false },
    });
    return { unreadCount: count };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(orgId: string, userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, organizationId: orgId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications in an organization as read
   */
  async markAllAsRead(orgId: string, userId: string) {
    await this.prisma.notification.updateMany({
      where: { organizationId: orgId, userId, isRead: false },
      data: { isRead: true },
    });

    return { message: 'All notifications marked as read.' };
  }
}
