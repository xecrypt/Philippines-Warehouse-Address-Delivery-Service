import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /**
   * Get current user's notifications.
   * GET /api/notifications
   *
   * All authenticated users.
   */
  @Get()
  async findMyNotifications(
    @CurrentUser('id') userId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findByUser(
      userId,
      unreadOnly === 'true',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Get unread notification count.
   * GET /api/notifications/unread-count
   *
   * All authenticated users.
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * Mark a notification as read.
   * PATCH /api/notifications/:id/read
   *
   * All authenticated users (own notifications only).
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseUUIDPipe) notificationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read.
   * PATCH /api/notifications/read-all
   *
   * All authenticated users.
   */
  @Patch('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
