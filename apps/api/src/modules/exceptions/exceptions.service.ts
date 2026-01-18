import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ExceptionStatus, ExceptionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditActions } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExceptionDto, ResolveExceptionDto } from './dto';

/**
 * ExceptionsService
 *
 * Handles exception creation and resolution per PRD Section 8.
 *
 * Rules:
 * - Exception parcels are locked from normal flow (hasException=true)
 * - Appear in dedicated exception queue
 * - Require admin resolution
 * - All resolutions are audited
 */
@Injectable()
export class ExceptionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Create an exception for a parcel (staff only).
   *
   * Sets parcel.hasException = true to lock it from normal flow.
   *
   * @param dto - Exception details
   * @param staffId - Staff creating the exception
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async create(
    dto: CreateExceptionDto,
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Validate parcel exists
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: dto.parcelId },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    // Check for existing open exception of same type
    const existingException = await this.prisma.exception.findFirst({
      where: {
        parcelId: dto.parcelId,
        type: dto.type,
        status: { in: [ExceptionStatus.OPEN, ExceptionStatus.IN_PROGRESS] },
      },
    });

    if (existingException) {
      throw new BadRequestException(
        `An open exception of type ${dto.type} already exists for this parcel`,
      );
    }

    // Get staff info for audit
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { email: true, role: true },
    });

    // Create exception and lock parcel in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const exception = await tx.exception.create({
        data: {
          parcelId: dto.parcelId,
          type: dto.type,
          description: dto.description,
          status: ExceptionStatus.OPEN,
          createdById: staffId,
        },
      });

      // Lock parcel from normal flow
      await tx.parcel.update({
        where: { id: dto.parcelId },
        data: { hasException: true },
      });

      return exception;
    });

    // Audit log
    await this.auditService.log({
      actorId: staffId,
      actorEmail: staff?.email,
      actorRole: staff?.role,
      action: AuditActions.EXCEPTION_CREATED,
      entityType: 'Exception',
      entityId: result.id,
      newData: {
        type: dto.type,
        description: dto.description,
        parcelId: dto.parcelId,
      },
      parcelId: dto.parcelId,
      exceptionId: result.id,
      ipAddress,
      userAgent,
    });

    // Notify parcel owner if exists
    if (parcel.ownerId) {
      await this.notificationsService.notifyExceptionCreated(
        parcel.ownerId,
        parcel.id,
        parcel.trackingNumber,
        dto.type,
      );
    }

    return result;
  }

  /**
   * Assign exception to admin (start working on it).
   * Admin only.
   *
   * @param exceptionId - Exception ID
   * @param adminId - Admin taking the exception
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async assign(
    exceptionId: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const exception = await this.prisma.exception.findUnique({
      where: { id: exceptionId },
    });

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    if (exception.status === ExceptionStatus.RESOLVED) {
      throw new BadRequestException('Exception is already resolved');
    }

    if (exception.status === ExceptionStatus.CANCELLED) {
      throw new BadRequestException('Exception is cancelled');
    }

    // Get admin info for audit
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    const updated = await this.prisma.exception.update({
      where: { id: exceptionId },
      data: {
        status: ExceptionStatus.IN_PROGRESS,
        handledById: adminId,
      },
    });

    // Audit log
    await this.auditService.log({
      actorId: adminId,
      actorEmail: admin?.email,
      actorRole: admin?.role,
      action: AuditActions.EXCEPTION_ASSIGNED,
      entityType: 'Exception',
      entityId: exceptionId,
      previousData: { status: exception.status, handledById: exception.handledById },
      newData: { status: ExceptionStatus.IN_PROGRESS, handledById: adminId },
      parcelId: exception.parcelId,
      exceptionId,
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * Resolve an exception (admin only).
   *
   * Unlocks parcel if no other open exceptions exist.
   *
   * @param exceptionId - Exception ID
   * @param dto - Resolution details
   * @param adminId - Admin resolving
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async resolve(
    exceptionId: string,
    dto: ResolveExceptionDto,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const exception = await this.prisma.exception.findUnique({
      where: { id: exceptionId },
      include: {
        parcel: {
          select: { id: true, ownerId: true, trackingNumber: true },
        },
      },
    });

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    if (exception.status === ExceptionStatus.RESOLVED) {
      throw new BadRequestException('Exception is already resolved');
    }

    if (exception.status === ExceptionStatus.CANCELLED) {
      throw new BadRequestException('Cannot resolve a cancelled exception');
    }

    // Get admin info for audit
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    // Resolve exception and potentially unlock parcel
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.exception.update({
        where: { id: exceptionId },
        data: {
          status: ExceptionStatus.RESOLVED,
          resolution: dto.resolution,
          resolvedAt: new Date(),
          handledById: adminId,
        },
      });

      // Check if parcel has any other open exceptions
      const otherOpenExceptions = await tx.exception.count({
        where: {
          parcelId: exception.parcelId,
          id: { not: exceptionId },
          status: { in: [ExceptionStatus.OPEN, ExceptionStatus.IN_PROGRESS] },
        },
      });

      // Unlock parcel if no other open exceptions
      if (otherOpenExceptions === 0) {
        await tx.parcel.update({
          where: { id: exception.parcelId },
          data: { hasException: false },
        });
      }

      return { exception: updated, parcelUnlocked: otherOpenExceptions === 0 };
    });

    // Audit log
    await this.auditService.log({
      actorId: adminId,
      actorEmail: admin?.email,
      actorRole: admin?.role,
      action: AuditActions.EXCEPTION_RESOLVED,
      entityType: 'Exception',
      entityId: exceptionId,
      previousData: { status: exception.status },
      newData: {
        status: ExceptionStatus.RESOLVED,
        resolution: dto.resolution,
        parcelUnlocked: result.parcelUnlocked,
      },
      parcelId: exception.parcelId,
      exceptionId,
      ipAddress,
      userAgent,
    });

    // Notify parcel owner if exists
    if (exception.parcel.ownerId) {
      await this.notificationsService.notifyExceptionResolved(
        exception.parcel.ownerId,
        exception.parcel.id,
        exception.parcel.trackingNumber,
      );
    }

    return result.exception;
  }

  /**
   * Cancel an exception (admin only).
   *
   * Used when exception was created in error.
   * Unlocks parcel if no other open exceptions exist.
   *
   * @param exceptionId - Exception ID
   * @param adminId - Admin cancelling
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async cancel(
    exceptionId: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const exception = await this.prisma.exception.findUnique({
      where: { id: exceptionId },
    });

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    if (exception.status === ExceptionStatus.RESOLVED) {
      throw new BadRequestException('Cannot cancel a resolved exception');
    }

    if (exception.status === ExceptionStatus.CANCELLED) {
      throw new BadRequestException('Exception is already cancelled');
    }

    // Get admin info for audit
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    // Cancel exception and potentially unlock parcel
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.exception.update({
        where: { id: exceptionId },
        data: {
          status: ExceptionStatus.CANCELLED,
          handledById: adminId,
        },
      });

      // Check if parcel has any other open exceptions
      const otherOpenExceptions = await tx.exception.count({
        where: {
          parcelId: exception.parcelId,
          id: { not: exceptionId },
          status: { in: [ExceptionStatus.OPEN, ExceptionStatus.IN_PROGRESS] },
        },
      });

      // Unlock parcel if no other open exceptions
      if (otherOpenExceptions === 0) {
        await tx.parcel.update({
          where: { id: exception.parcelId },
          data: { hasException: false },
        });
      }

      return { exception: updated, parcelUnlocked: otherOpenExceptions === 0 };
    });

    // Audit log
    await this.auditService.log({
      actorId: adminId,
      actorEmail: admin?.email,
      actorRole: admin?.role,
      action: AuditActions.EXCEPTION_CANCELLED,
      entityType: 'Exception',
      entityId: exceptionId,
      previousData: { status: exception.status },
      newData: {
        status: ExceptionStatus.CANCELLED,
        parcelUnlocked: result.parcelUnlocked,
      },
      parcelId: exception.parcelId,
      exceptionId,
      ipAddress,
      userAgent,
    });

    return result.exception;
  }

  /**
   * Get exception by ID.
   *
   * @param exceptionId - Exception ID
   */
  async findById(exceptionId: string) {
    const exception = await this.prisma.exception.findUnique({
      where: { id: exceptionId },
      include: {
        parcel: {
          select: {
            id: true,
            trackingNumber: true,
            memberCode: true,
            state: true,
            weight: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        handledBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!exception) {
      throw new NotFoundException('Exception not found');
    }

    return exception;
  }

  /**
   * Get open exceptions (exception queue).
   * Staff and Admin can view.
   *
   * @param status - Optional status filter
   * @param type - Optional type filter
   * @param page - Page number
   * @param limit - Items per page
   */
  async findOpen(
    status?: ExceptionStatus,
    type?: ExceptionType,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    } else {
      // Default: show open and in-progress
      where.status = { in: [ExceptionStatus.OPEN, ExceptionStatus.IN_PROGRESS] };
    }

    if (type) {
      where.type = type;
    }

    const [exceptions, total] = await Promise.all([
      this.prisma.exception.findMany({
        where,
        skip,
        take: limit,
        include: {
          parcel: {
            select: {
              id: true,
              trackingNumber: true,
              memberCode: true,
              state: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          handledBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // Oldest first (FIFO queue)
      }),
      this.prisma.exception.count({ where }),
    ]);

    return {
      data: exceptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all exceptions (with filters).
   * Admin only.
   *
   * @param status - Optional status filter
   * @param type - Optional type filter
   * @param page - Page number
   * @param limit - Items per page
   */
  async findAll(
    status?: ExceptionStatus,
    type?: ExceptionType,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [exceptions, total] = await Promise.all([
      this.prisma.exception.findMany({
        where,
        skip,
        take: limit,
        include: {
          parcel: {
            select: {
              id: true,
              trackingNumber: true,
              memberCode: true,
              state: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          handledBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.exception.count({ where }),
    ]);

    return {
      data: exceptions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get exceptions for a specific parcel.
   *
   * @param parcelId - Parcel ID
   */
  async findByParcel(parcelId: string) {
    return this.prisma.exception.findMany({
      where: { parcelId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        handledBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
