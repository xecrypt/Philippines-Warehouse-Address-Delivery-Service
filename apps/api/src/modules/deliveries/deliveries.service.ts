import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ParcelState, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditActions } from '../audit/audit.service';
import { RequestDeliveryDto } from './dto';

@Injectable()
export class DeliveriesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Calculate delivery fee based on weight.
   * Uses FeeConfiguration from database.
   * Rounds up to nearest kg per PRD decision.
   *
   * @param weightKg - Parcel weight in kg
   */
  async calculateFee(weightKg: number): Promise<{
    baseFee: number;
    weightFee: number;
    totalFee: number;
  }> {
    // Get active fee configuration
    const feeConfig = await this.prisma.feeConfiguration.findFirst({
      where: {
        isActive: true,
        minWeight: { lte: weightKg },
        OR: [{ maxWeight: null }, { maxWeight: { gte: weightKg } }],
      },
      orderBy: { minWeight: 'desc' },
    });

    // Default fee if no configuration found
    const baseFee = feeConfig?.baseFee ?? 50;
    const perKgRate = feeConfig?.perKgRate ?? 20;

    // Round up to nearest kg
    const roundedWeight = Math.ceil(weightKg);
    const weightFee = roundedWeight * perKgRate;
    const totalFee = baseFee + weightFee;

    return { baseFee, weightFee, totalFee };
  }

  /**
   * Request delivery for a parcel.
   *
   * - Validates parcel ownership
   * - Validates parcel is in STORED state
   * - Calculates fee
   * - Creates Delivery record
   * - Updates parcel state to DELIVERY_REQUESTED
   *
   * @param dto - Delivery request data
   * @param userId - User requesting delivery
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async requestDelivery(
    dto: RequestDeliveryDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Get parcel
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: dto.parcelId },
      include: { delivery: true },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    // Validate ownership
    if (parcel.ownerId !== userId) {
      throw new ForbiddenException('You do not own this parcel');
    }

    // Validate state
    if (parcel.state !== ParcelState.STORED) {
      throw new BadRequestException(
        `Parcel must be in STORED state to request delivery. Current state: ${parcel.state}`,
      );
    }

    // Check for existing delivery
    if (parcel.delivery) {
      throw new BadRequestException('Delivery already requested for this parcel');
    }

    // Check for exception
    if (parcel.hasException) {
      throw new ForbiddenException(
        'Cannot request delivery: parcel has unresolved exception',
      );
    }

    // Calculate fee
    const { baseFee, weightFee, totalFee } = await this.calculateFee(parcel.weight);

    // Get user info for audit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    // Create delivery and update parcel in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create delivery
      const delivery = await tx.delivery.create({
        data: {
          parcelId: dto.parcelId,
          recipientId: userId,
          deliveryStreet: dto.deliveryStreet,
          deliveryCity: dto.deliveryCity,
          deliveryProvince: dto.deliveryProvince,
          deliveryZipCode: dto.deliveryZipCode,
          weightKg: parcel.weight,
          baseFee,
          weightFee,
          totalFee,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      // Update parcel state
      const updatedParcel = await tx.parcel.update({
        where: { id: dto.parcelId },
        data: { state: ParcelState.DELIVERY_REQUESTED },
      });

      // Create state history
      await tx.parcelStateHistory.create({
        data: {
          parcelId: dto.parcelId,
          fromState: ParcelState.STORED,
          toState: ParcelState.DELIVERY_REQUESTED,
          changedById: userId,
          notes: 'Delivery requested by user',
        },
      });

      // Update user's delivery address if not set
      await tx.user.update({
        where: { id: userId },
        data: {
          deliveryStreet: dto.deliveryStreet,
          deliveryCity: dto.deliveryCity,
          deliveryProvince: dto.deliveryProvince,
          deliveryZipCode: dto.deliveryZipCode,
        },
      });

      return { delivery, parcel: updatedParcel };
    });

    // Audit log
    await this.auditService.log({
      actorId: userId,
      actorEmail: user?.email,
      actorRole: user?.role,
      action: AuditActions.DELIVERY_REQUESTED,
      entityType: 'Delivery',
      entityId: result.delivery.id,
      newData: {
        parcelId: dto.parcelId,
        totalFee,
        deliveryAddress: `${dto.deliveryStreet}, ${dto.deliveryCity}`,
      },
      parcelId: dto.parcelId,
      deliveryId: result.delivery.id,
      ipAddress,
      userAgent,
    });

    return result;
  }

  /**
   * Confirm payment for a delivery.
   * Staff only.
   *
   * @param deliveryId - Delivery ID
   * @param staffId - Staff confirming payment
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async confirmPayment(
    deliveryId: string,
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { parcel: true },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    if (delivery.paymentStatus === PaymentStatus.CONFIRMED) {
      throw new BadRequestException('Payment already confirmed');
    }

    if (delivery.paymentStatus === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Cannot confirm refunded payment');
    }

    // Get staff info for audit
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { email: true, role: true },
    });

    const updatedDelivery = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        paymentStatus: PaymentStatus.CONFIRMED,
        paymentConfirmedAt: new Date(),
        paymentConfirmedById: staffId,
      },
    });

    // Audit log
    await this.auditService.log({
      actorId: staffId,
      actorEmail: staff?.email,
      actorRole: staff?.role,
      action: AuditActions.DELIVERY_PAYMENT_CONFIRMED,
      entityType: 'Delivery',
      entityId: deliveryId,
      previousData: { paymentStatus: delivery.paymentStatus },
      newData: { paymentStatus: PaymentStatus.CONFIRMED },
      parcelId: delivery.parcelId,
      deliveryId,
      ipAddress,
      userAgent,
    });

    return updatedDelivery;
  }

  /**
   * Dispatch a delivery (mark as out for delivery).
   * Staff only. Requires payment to be confirmed.
   *
   * @param deliveryId - Delivery ID
   * @param staffId - Staff dispatching
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async dispatch(
    deliveryId: string,
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { parcel: true },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    // Validate payment is confirmed
    if (delivery.paymentStatus !== PaymentStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cannot dispatch: payment not confirmed',
      );
    }

    // Validate parcel state
    if (delivery.parcel.state !== ParcelState.DELIVERY_REQUESTED) {
      throw new BadRequestException(
        `Cannot dispatch: parcel is in ${delivery.parcel.state} state`,
      );
    }

    // Get staff info for audit
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { email: true, role: true },
    });

    // Update delivery and parcel in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: { dispatchedAt: new Date() },
      });

      const updatedParcel = await tx.parcel.update({
        where: { id: delivery.parcelId },
        data: { state: ParcelState.OUT_FOR_DELIVERY },
      });

      await tx.parcelStateHistory.create({
        data: {
          parcelId: delivery.parcelId,
          fromState: ParcelState.DELIVERY_REQUESTED,
          toState: ParcelState.OUT_FOR_DELIVERY,
          changedById: staffId,
          notes: 'Parcel dispatched for delivery',
        },
      });

      return { delivery: updatedDelivery, parcel: updatedParcel };
    });

    // Audit log
    await this.auditService.log({
      actorId: staffId,
      actorEmail: staff?.email,
      actorRole: staff?.role,
      action: AuditActions.DELIVERY_DISPATCHED,
      entityType: 'Delivery',
      entityId: deliveryId,
      newData: { dispatchedAt: result.delivery.dispatchedAt },
      parcelId: delivery.parcelId,
      deliveryId,
      ipAddress,
      userAgent,
    });

    return result;
  }

  /**
   * Complete a delivery (mark as delivered).
   * Staff only.
   *
   * @param deliveryId - Delivery ID
   * @param staffId - Staff completing delivery
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async complete(
    deliveryId: string,
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { parcel: true },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    // Validate parcel state
    if (delivery.parcel.state !== ParcelState.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Cannot complete: parcel is in ${delivery.parcel.state} state`,
      );
    }

    // Get staff info for audit
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      select: { email: true, role: true },
    });

    // Update delivery and parcel in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data: { deliveredAt: new Date() },
      });

      const updatedParcel = await tx.parcel.update({
        where: { id: delivery.parcelId },
        data: { state: ParcelState.DELIVERED },
      });

      await tx.parcelStateHistory.create({
        data: {
          parcelId: delivery.parcelId,
          fromState: ParcelState.OUT_FOR_DELIVERY,
          toState: ParcelState.DELIVERED,
          changedById: staffId,
          notes: 'Parcel delivered to recipient',
        },
      });

      return { delivery: updatedDelivery, parcel: updatedParcel };
    });

    // Audit log
    await this.auditService.log({
      actorId: staffId,
      actorEmail: staff?.email,
      actorRole: staff?.role,
      action: AuditActions.DELIVERY_COMPLETED,
      entityType: 'Delivery',
      entityId: deliveryId,
      newData: { deliveredAt: result.delivery.deliveredAt },
      parcelId: delivery.parcelId,
      deliveryId,
      ipAddress,
      userAgent,
    });

    return result;
  }

  /**
   * Get delivery by ID.
   *
   * @param deliveryId - Delivery ID
   */
  async findById(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        parcel: {
          select: {
            id: true,
            trackingNumber: true,
            state: true,
            weight: true,
            description: true,
          },
        },
        recipient: {
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

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    return delivery;
  }

  /**
   * Get deliveries for a user.
   *
   * @param userId - User ID
   * @param status - Optional payment status filter
   */
  async findByUser(userId: string, status?: PaymentStatus) {
    const where: Record<string, unknown> = { recipientId: userId };

    if (status) {
      where.paymentStatus = status;
    }

    return this.prisma.delivery.findMany({
      where,
      include: {
        parcel: {
          select: {
            id: true,
            trackingNumber: true,
            state: true,
            weight: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all deliveries (staff/admin).
   *
   * @param status - Optional payment status filter
   * @param page - Page number
   * @param limit - Items per page
   */
  async findAll(
    status?: PaymentStatus,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.paymentStatus = status;
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        skip,
        take: limit,
        include: {
          parcel: {
            select: {
              id: true,
              trackingNumber: true,
              state: true,
              weight: true,
            },
          },
          recipient: {
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
      this.prisma.delivery.count({ where }),
    ]);

    return {
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get fee estimate for a parcel.
   * Public endpoint for users to see fee before requesting.
   *
   * @param parcelId - Parcel ID
   * @param userId - User requesting estimate
   */
  async getFeeEstimate(parcelId: string, userId: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
    });

    if (!parcel || parcel.isDeleted) {
      throw new NotFoundException('Parcel not found');
    }

    if (parcel.ownerId !== userId) {
      throw new ForbiddenException('You do not own this parcel');
    }

    const fee = await this.calculateFee(parcel.weight);

    return {
      parcelId,
      weight: parcel.weight,
      roundedWeight: Math.ceil(parcel.weight),
      ...fee,
    };
  }
}
