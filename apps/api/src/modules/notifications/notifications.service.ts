import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto';

/**
 * NotificationsService
 *
 * Handles in-app notifications per PRD.
 * MVP scope: In-app notifications only (no email/SMS).
 *
 * Features:
 * - Create notifications (called by other services)
 * - Get user's notifications (paginated)
 * - Mark as read
 * - Get unread count
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a notification for a user.
   * Called internally by other services (parcels, deliveries, exceptions).
   *
   * @param dto - Notification details
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        parcelId: dto.parcelId,
        deliveryId: dto.deliveryId,
      },
    });
  }

  /**
   * Get notifications for a user (paginated).
   *
   * @param userId - User ID
   * @param unreadOnly - Filter to unread only
   * @param page - Page number
   * @param limit - Items per page
   */
  async findByUser(
    userId: string,
    unreadOnly: boolean = false,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread notification count for a user.
   *
   * @param userId - User ID
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  /**
   * Mark a notification as read.
   *
   * @param notificationId - Notification ID
   * @param userId - User making the request (for ownership check)
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only mark your own notifications as read');
    }

    if (notification.isRead) {
      return notification; // Already read
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user.
   *
   * @param userId - User ID
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  /**
   * Helper: Create notification when parcel arrives.
   */
  async notifyParcelArrived(userId: string, parcelId: string, trackingNumber: string) {
    return this.create({
      userId,
      type: NotificationType.PARCEL_ARRIVED,
      title: 'Parcel Arrived',
      message: `Your parcel ${trackingNumber} has arrived at the warehouse.`,
      parcelId,
    });
  }

  /**
   * Helper: Create notification when parcel is stored.
   */
  async notifyParcelStored(userId: string, parcelId: string, trackingNumber: string) {
    return this.create({
      userId,
      type: NotificationType.PARCEL_STORED,
      title: 'Parcel Ready',
      message: `Your parcel ${trackingNumber} is stored and ready for delivery request.`,
      parcelId,
    });
  }

  /**
   * Helper: Create notification when delivery is requested.
   */
  async notifyDeliveryRequested(
    userId: string,
    parcelId: string,
    deliveryId: string,
    trackingNumber: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.DELIVERY_REQUESTED,
      title: 'Delivery Requested',
      message: `Delivery requested for parcel ${trackingNumber}. Please confirm payment.`,
      parcelId,
      deliveryId,
    });
  }

  /**
   * Helper: Create notification when payment is confirmed.
   */
  async notifyPaymentConfirmed(
    userId: string,
    parcelId: string,
    deliveryId: string,
    trackingNumber: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.PAYMENT_CONFIRMED,
      title: 'Payment Confirmed',
      message: `Payment confirmed for parcel ${trackingNumber}. Your parcel will be dispatched soon.`,
      parcelId,
      deliveryId,
    });
  }

  /**
   * Helper: Create notification when parcel is out for delivery.
   */
  async notifyOutForDelivery(
    userId: string,
    parcelId: string,
    deliveryId: string,
    trackingNumber: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.OUT_FOR_DELIVERY,
      title: 'Out for Delivery',
      message: `Your parcel ${trackingNumber} is on its way!`,
      parcelId,
      deliveryId,
    });
  }

  /**
   * Helper: Create notification when parcel is delivered.
   */
  async notifyDelivered(
    userId: string,
    parcelId: string,
    deliveryId: string,
    trackingNumber: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.DELIVERED,
      title: 'Parcel Delivered',
      message: `Your parcel ${trackingNumber} has been delivered. Thank you!`,
      parcelId,
      deliveryId,
    });
  }

  /**
   * Helper: Create notification when exception is created.
   */
  async notifyExceptionCreated(
    userId: string,
    parcelId: string,
    trackingNumber: string,
    exceptionType: string,
  ) {
    return this.create({
      userId,
      type: NotificationType.EXCEPTION_CREATED,
      title: 'Parcel Issue',
      message: `There's an issue with your parcel ${trackingNumber}: ${exceptionType}. Our team is working on it.`,
      parcelId,
    });
  }

  /**
   * Helper: Create notification when exception is resolved.
   */
  async notifyExceptionResolved(userId: string, parcelId: string, trackingNumber: string) {
    return this.create({
      userId,
      type: NotificationType.EXCEPTION_RESOLVED,
      title: 'Issue Resolved',
      message: `The issue with your parcel ${trackingNumber} has been resolved.`,
      parcelId,
    });
  }
}
