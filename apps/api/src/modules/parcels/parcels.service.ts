import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ParcelState, ExceptionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditActions } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IntakeParcelDto, UpdateParcelStateDto } from './dto';

/**
 * Valid state transitions for parcels.
 * Key = current state, Value = array of valid next states.
 */
const STATE_TRANSITIONS: Record<ParcelState, ParcelState[]> = {
  [ParcelState.EXPECTED]: [ParcelState.ARRIVED],
  [ParcelState.ARRIVED]: [ParcelState.STORED],
  [ParcelState.STORED]: [ParcelState.DELIVERY_REQUESTED],
  [ParcelState.DELIVERY_REQUESTED]: [ParcelState.OUT_FOR_DELIVERY],
  [ParcelState.OUT_FOR_DELIVERY]: [ParcelState.DELIVERED],
  [ParcelState.DELIVERED]: [], // Terminal state
};

@Injectable()
export class ParcelsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Register a new parcel (staff intake).
   *
   * Looks up owner by member code.
   * If member code is invalid, creates orphan parcel with exception.
   *
   * @param dto - Intake data
   * @param staffId - ID of staff registering the parcel
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async intake(
    dto: IntakeParcelDto,
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Check for duplicate tracking number
    const existingParcel = await this.prisma.parcel.findUnique({
      where: { trackingNumber: dto.trackingNumber },
    });

    if (existingParcel) {
      throw new BadRequestException(
        `Parcel with tracking number ${dto.trackingNumber} already exists`,
      );
    }

    // Look up owner by member code
    const owner = await this.prisma.user.findUnique({
      where: { memberCode: dto.memberCode },
      select: { id: true, email: true, isDeleted: true, isActive: true },
    });

    // Get staff info for audit
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { email: true, role: true },
    });

    // Create parcel with transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const isOrphan = !owner || owner.isDeleted || !owner.isActive;

      // Create parcel
      const parcel = await tx.parcel.create({
        data: {
          trackingNumber: dto.trackingNumber,
          memberCode: dto.memberCode,
          weight: dto.weight,
          description: dto.description,
          state: ParcelState.ARRIVED,
          ownerId: isOrphan ? null : owner.id,
          registeredById: staffId,
          hasException: isOrphan,
        },
      });

      // Create initial state history
      await tx.parcelStateHistory.create({
        data: {
          parcelId: parcel.id,
          fromState: null,
          toState: ParcelState.ARRIVED,
          changedById: staffId,
          notes: 'Parcel registered at intake',
        },
      });

      // If orphan, create exception
      let exception = null;
      if (isOrphan) {
        // Determine specific reason for exception description
        const reason = !owner
          ? 'does not match any registered user'
          : owner.isDeleted
            ? 'belongs to a deleted user'
            : 'belongs to an inactive user';

        exception = await tx.exception.create({
          data: {
            parcelId: parcel.id,
            type: ExceptionType.INVALID_MEMBER_CODE,
            description: `Member code ${dto.memberCode} ${reason}`,
            createdById: staffId,
          },
        });
      }

      return { parcel, exception };
    });

    // Audit log
    await this.auditService.log({
      actorId: staffId,
      actorEmail: staff?.email,
      actorRole: staff?.role,
      action: AuditActions.PARCEL_REGISTERED,
      entityType: 'Parcel',
      entityId: result.parcel.id,
      newData: {
        trackingNumber: dto.trackingNumber,
        memberCode: dto.memberCode,
        weight: dto.weight,
        ownerId: result.parcel.ownerId,
        hasException: result.parcel.hasException,
      },
      parcelId: result.parcel.id,
      ipAddress,
      userAgent,
    });

    // Notify owner if parcel has owner (not orphan)
    if (result.parcel.ownerId) {
      await this.notificationsService.notifyParcelArrived(
        result.parcel.ownerId,
        result.parcel.id,
        dto.trackingNumber,
      );
    }

    return result;
  }

  /**
   * Update parcel state (staff/admin).
   *
   * Validates state transition.
   * Rejects if parcel has unresolved exception.
   *
   * @param parcelId - Parcel ID
   * @param dto - New state data
   * @param userId - ID of user making the change
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async updateState(
    parcelId: string,
    dto: UpdateParcelStateDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    // Check if parcel has unresolved exception
    if (parcel.hasException) {
      throw new ForbiddenException(
        'Cannot change state: parcel has unresolved exception',
      );
    }

    // Validate state transition
    const validNextStates = STATE_TRANSITIONS[parcel.state];
    if (!validNextStates.includes(dto.newState)) {
      throw new BadRequestException(
        `Invalid state transition: ${parcel.state} -> ${dto.newState}`,
      );
    }

    // Get user info for audit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    const previousState = parcel.state;

    // Update in transaction
    const updatedParcel = await this.prisma.$transaction(async (tx) => {
      // Update parcel state
      const updated = await tx.parcel.update({
        where: { id: parcelId },
        data: {
          state: dto.newState,
          storedAt:
            dto.newState === ParcelState.STORED ? new Date() : parcel.storedAt,
        },
      });

      // Create state history
      await tx.parcelStateHistory.create({
        data: {
          parcelId: parcelId,
          fromState: previousState,
          toState: dto.newState,
          changedById: userId,
          notes: dto.notes,
        },
      });

      return updated;
    });

    // Audit log
    await this.auditService.log({
      actorId: userId,
      actorEmail: user?.email,
      actorRole: user?.role,
      action: AuditActions.PARCEL_STATE_CHANGED,
      entityType: 'Parcel',
      entityId: parcelId,
      previousData: { state: previousState },
      newData: { state: dto.newState },
      parcelId: parcelId,
      ipAddress,
      userAgent,
    });

    // Notify owner on state changes
    if (updatedParcel.ownerId) {
      if (dto.newState === ParcelState.STORED) {
        await this.notificationsService.notifyParcelStored(
          updatedParcel.ownerId,
          parcelId,
          updatedParcel.trackingNumber,
        );
      }
    }

    return updatedParcel;
  }

  /**
   * Get parcel by ID.
   *
   * @param parcelId - Parcel ID
   */
  async findById(parcelId: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            memberCode: true,
          },
        },
        registeredBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        stateHistory: {
          orderBy: { createdAt: 'desc' },
        },
        exceptions: {
          orderBy: { createdAt: 'desc' },
        },
        delivery: true,
      },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    return parcel;
  }

  /**
   * Get parcel by tracking number.
   *
   * @param trackingNumber - External tracking number
   */
  async findByTrackingNumber(trackingNumber: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { trackingNumber },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            memberCode: true,
          },
        },
        stateHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    return parcel;
  }

  /**
   * Get parcels by member code.
   * Used by staff to search parcels during intake.
   *
   * @param memberCode - Member code (PHW-XXXXXX)
   */
  async findByMemberCode(memberCode: string) {
    return this.prisma.parcel.findMany({
      where: {
        memberCode,
        isDeleted: false,
      },
      include: {
        owner: {
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

  /**
   * Get parcels owned by a user.
   *
   * @param userId - User ID
   * @param state - Optional state filter
   */
  async findByOwner(userId: string, state?: ParcelState) {
    const where: Record<string, unknown> = {
      ownerId: userId,
      isDeleted: false,
    };

    if (state) {
      where.state = state;
    }

    const [parcels, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        include: {
          delivery: true,
          stateHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parcel.count({ where }),
    ]);

    return {
      data: parcels,
      meta: {
        total,
        page: 1,
        limit: total,
        totalPages: 1,
      },
    };
  }

  /**
   * Get all parcels (staff/admin).
   * Supports filtering by state.
   *
   * @param state - Optional state filter
   * @param hasException - Optional exception filter
   * @param page - Page number
   * @param limit - Items per page
   */
  async findAll(
    state?: ParcelState,
    hasException?: boolean,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isDeleted: false,
    };

    if (state) {
      where.state = state;
    }

    if (hasException !== undefined) {
      where.hasException = hasException;
    }

    const [parcels, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              memberCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parcel.count({ where }),
    ]);

    return {
      data: parcels,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get parcel state history.
   *
   * @param parcelId - Parcel ID
   */
  async getStateHistory(parcelId: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    return this.prisma.parcelStateHistory.findMany({
      where: { parcelId },
      orderBy: { createdAt: 'desc' },
      include: {
        parcel: {
          select: {
            trackingNumber: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a parcel (admin only).
   *
   * @param parcelId - Parcel ID
   * @param adminId - Admin user ID
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async softDelete(
    parcelId: string,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    const deleted = await this.prisma.parcel.update({
      where: { id: parcelId },
      data: { isDeleted: true },
    });

    await this.auditService.log({
      actorId: adminId,
      actorEmail: admin?.email,
      actorRole: admin?.role,
      action: AuditActions.PARCEL_DELETED,
      entityType: 'Parcel',
      entityId: parcelId,
      previousData: { isDeleted: false },
      newData: { isDeleted: true },
      parcelId: parcelId,
      ipAddress,
      userAgent,
    });

    return deleted;
  }

  /**
   * Override parcel ownership (admin only).
   *
   * PRD Section 12: "Ownership changes require admin override"
   * This allows admin to reassign a parcel to a different owner,
   * typically used to resolve orphan parcels or correct intake errors.
   *
   * @param parcelId - Parcel ID
   * @param newOwnerMemberCode - New owner's member code (required)
   * @param adminId - Admin user ID performing the override
   * @param reason - Reason for the ownership change (required for audit)
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async overrideOwnership(
    parcelId: string,
    newOwnerMemberCode: string,
    adminId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Validate parcel exists
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      include: {
        owner: {
          select: { id: true, email: true, memberCode: true },
        },
      },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    // Look up new owner by member code
    const newOwner = await this.prisma.user.findUnique({
      where: { memberCode: newOwnerMemberCode },
      select: { id: true, email: true, memberCode: true, isActive: true, isDeleted: true },
    });

    // If member code matches but user is inactive/deleted, reject
    if (newOwner && (newOwner.isDeleted || !newOwner.isActive)) {
      throw new BadRequestException('Cannot assign parcel to inactive or deleted user');
    }

    // Get admin info for audit
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });

    const previousOwnerId = parcel.ownerId;
    const previousMemberCode = parcel.memberCode;

    // Update parcel ownership
    // If newOwner is null, parcel becomes orphan (memberCode updated but no owner)
    const updated = await this.prisma.parcel.update({
      where: { id: parcelId },
      data: {
        ownerId: newOwner?.id || null,
        memberCode: newOwnerMemberCode,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            memberCode: true,
          },
        },
      },
    });

    // Audit log: Admin override - ownership change
    await this.auditService.log({
      actorId: adminId,
      actorEmail: admin?.email,
      actorRole: admin?.role,
      action: AuditActions.PARCEL_OWNER_ASSIGNED,
      entityType: 'Parcel',
      entityId: parcelId,
      previousData: {
        ownerId: previousOwnerId,
        memberCode: previousMemberCode,
        ownerEmail: parcel.owner?.email,
      },
      newData: {
        ownerId: newOwner?.id || null,
        memberCode: newOwnerMemberCode,
        ownerEmail: newOwner?.email || null,
        reason,
      },
      parcelId,
      ipAddress,
      userAgent,
    });

    // Notify new owner if assigned
    if (newOwner) {
      await this.notificationsService.notifyParcelArrived(
        newOwner.id,
        parcelId,
        parcel.trackingNumber,
      );
    }

    return updated;
  }
}
