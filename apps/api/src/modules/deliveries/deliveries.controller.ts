import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentStatus, Role } from '@prisma/client';
import { DeliveriesService } from './deliveries.service';
import { RequestDeliveryDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { IdempotencyInterceptor } from '../../common/interceptors';

@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveriesController {
  constructor(private deliveriesService: DeliveriesService) {}

  /**
   * Request delivery for a parcel.
   * POST /api/deliveries
   *
   * User only (for their own parcels).
   * Supports idempotency via Idempotency-Key header.
   */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async requestDelivery(
    @Body() dto: RequestDeliveryDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.deliveriesService.requestDelivery(
      dto,
      userId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get fee estimate for a parcel.
   * GET /api/deliveries/estimate/:parcelId
   *
   * User only (for their own parcels).
   */
  @Get('estimate/:parcelId')
  async getFeeEstimate(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.deliveriesService.getFeeEstimate(parcelId, userId);
  }

  /**
   * Get current user's deliveries.
   * GET /api/deliveries/my
   *
   * User only.
   */
  @Get('my')
  async getMyDeliveries(
    @CurrentUser('id') userId: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.deliveriesService.findByUser(userId, status);
  }

  /**
   * Get all deliveries (paginated).
   * GET /api/deliveries
   *
   * Staff/Admin only.
   */
  @Get()
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findAll(
    @Query('status') status?: PaymentStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.deliveriesService.findAll(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Get delivery by ID.
   * GET /api/deliveries/:id
   *
   * Users can only view their own deliveries.
   * Staff/Admin can view all.
   */
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    const delivery = await this.deliveriesService.findById(deliveryId);

    // Users can only view their own deliveries
    if (user.role === Role.USER && delivery.recipientId !== user.id) {
      throw new ForbiddenException('You can only view your own deliveries');
    }

    return delivery;
  }

  /**
   * Confirm payment for a delivery.
   * PATCH /api/deliveries/:id/confirm-payment
   *
   * Staff/Admin only.
   * Supports idempotency via Idempotency-Key header.
   */
  @Patch(':id/confirm-payment')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  @UseInterceptors(IdempotencyInterceptor)
  async confirmPayment(
    @Param('id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser('id') staffId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.deliveriesService.confirmPayment(
      deliveryId,
      staffId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Dispatch a delivery.
   * PATCH /api/deliveries/:id/dispatch
   *
   * Staff/Admin only.
   */
  @Patch(':id/dispatch')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async dispatch(
    @Param('id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser('id') staffId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.deliveriesService.dispatch(
      deliveryId,
      staffId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Complete a delivery.
   * PATCH /api/deliveries/:id/complete
   *
   * Staff/Admin only.
   */
  @Patch(':id/complete')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async complete(
    @Param('id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser('id') staffId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.deliveriesService.complete(
      deliveryId,
      staffId,
      ipAddress,
      userAgent,
    );
  }
}
