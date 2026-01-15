import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Audit log creation parameters
 */
export interface AuditLogParams {
  actorId?: string;
  actorRole?: Role;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  parcelId?: string;
  deliveryId?: string;
  exceptionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit log query filters
 */
export interface AuditQueryFilters {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  parcelId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * AuditService
 *
 * Handles immutable audit logging for all critical system actions.
 *
 * Logged actions include:
 * - User authentication (login, logout, register)
 * - Parcel state changes
 * - Delivery requests and status updates
 * - Exception creation and resolution
 * - Admin overrides
 *
 * Features:
 * - Immutable records (no update/delete)
 * - Actor denormalization (email stored for historical record)
 * - Related entity linking (parcel, delivery, exception)
 * - Request context (IP, user agent)
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create an audit log entry.
   *
   * @param params - Audit log parameters
   * @returns Created audit log
   */
  async log(params: AuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        actorEmail: params.actorEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousData: params.previousData,
        newData: params.newData,
        metadata: params.metadata,
        parcelId: params.parcelId,
        deliveryId: params.deliveryId,
        exceptionId: params.exceptionId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  /**
   * Get audit logs with filters (paginated).
   * Admin only.
   *
   * @param filters - Query filters
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated audit logs
   */
  async getLogs(
    filters: AuditQueryFilters,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.parcelId) {
      where.parcelId = filters.parcelId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit logs for a specific entity.
   *
   * @param entityType - Type of entity (e.g., 'Parcel', 'User')
   * @param entityId - ID of the entity
   * @returns Audit logs for the entity
   */
  async getLogsForEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs for a specific parcel.
   * Includes all related actions (state changes, deliveries, exceptions).
   *
   * @param parcelId - Parcel ID
   * @returns Audit logs for the parcel
   */
  async getLogsForParcel(parcelId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { parcelId },
          { entityType: 'Parcel', entityId: parcelId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs by actor.
   *
   * @param actorId - User ID of the actor
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated audit logs
   */
  async getLogsByActor(actorId: string, page: number = 1, limit: number = 50) {
    return this.getLogs({ actorId }, page, limit);
  }
}

/**
 * Predefined audit action types.
 * Use these constants for consistency.
 */
export const AuditActions = {
  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_TOKEN_REFRESHED: 'USER_TOKEN_REFRESHED',

  // User management
  USER_UPDATED: 'USER_UPDATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_DELETED: 'USER_DELETED',
  USER_ADDRESS_UPDATED: 'USER_ADDRESS_UPDATED',

  // Parcel
  PARCEL_REGISTERED: 'PARCEL_REGISTERED',
  PARCEL_STATE_CHANGED: 'PARCEL_STATE_CHANGED',
  PARCEL_OWNER_ASSIGNED: 'PARCEL_OWNER_ASSIGNED',
  PARCEL_DELETED: 'PARCEL_DELETED',

  // Delivery
  DELIVERY_REQUESTED: 'DELIVERY_REQUESTED',
  DELIVERY_PAYMENT_CONFIRMED: 'DELIVERY_PAYMENT_CONFIRMED',
  DELIVERY_DISPATCHED: 'DELIVERY_DISPATCHED',
  DELIVERY_COMPLETED: 'DELIVERY_COMPLETED',

  // Exception
  EXCEPTION_CREATED: 'EXCEPTION_CREATED',
  EXCEPTION_ASSIGNED: 'EXCEPTION_ASSIGNED',
  EXCEPTION_RESOLVED: 'EXCEPTION_RESOLVED',
  EXCEPTION_CANCELLED: 'EXCEPTION_CANCELLED',

  // Admin
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
} as const;
