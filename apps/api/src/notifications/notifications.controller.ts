import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@ApiTags('In-App Notifications')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-ID', description: 'Active Organization ID', required: true })
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications with unread count' })
  @ApiResponse({ status: 200, description: 'Paginated user notifications' })
  async findAll(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(orgId, userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count badge' })
  @ApiResponse({ status: 200, description: 'Unread notification count' })
  async getUnreadCount(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.getUnreadCount(orgId, userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark specific notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(orgId, userId, notificationId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all organization notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @CurrentTenant('id') orgId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAllAsRead(orgId, userId);
  }
}
