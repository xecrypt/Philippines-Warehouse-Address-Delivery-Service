import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ParcelState, Role } from '@prisma/client';
import { ParcelsService } from './parcels.service';
import { IntakeParcelDto, UpdateParcelStateDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';

@Controller('parcels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParcelsController {
  constructor(private parcelsService: ParcelsService) {}

  /**
   * Register a new parcel (staff intake).
   * POST /api/parcels/intake
   *
   * Staff only.
   */
  @Post('intake')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async intake(
    @Body() dto: IntakeParcelDto,
    @CurrentUser('id') staffId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.parcelsService.intake(dto, staffId, ipAddress, userAgent);
  }

  /**
   * Update parcel state.
   * PATCH /api/parcels/:id/state
   *
   * Staff/Admin only.
   */
  @Patch(':id/state')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async updateState(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @Body() dto: UpdateParcelStateDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.parcelsService.updateState(
      parcelId,
      dto,
      userId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get parcel by ID.
   * GET /api/parcels/:id
   *
   * Users can only view their own parcels.
   * Staff/Admin can view all parcels.
   */
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    const parcel = await this.parcelsService.findById(parcelId);

    // Users can only view their own parcels
    if (user.role === Role.USER && parcel.ownerId !== user.id) {
      throw new Error('You can only view your own parcels');
    }

    return parcel;
  }

  /**
   * Get parcel by tracking number.
   * GET /api/parcels/tracking/:trackingNumber
   *
   * Staff/Admin only.
   */
  @Get('tracking/:trackingNumber')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findByTrackingNumber(
    @Param('trackingNumber') trackingNumber: string,
  ) {
    return this.parcelsService.findByTrackingNumber(trackingNumber);
  }

  /**
   * Search parcels by member code.
   * GET /api/parcels/search/member-code?code=PHW-XXXXXX
   *
   * Staff/Admin only.
   */
  @Get('search/member-code')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findByMemberCode(@Query('code') memberCode: string) {
    return this.parcelsService.findByMemberCode(memberCode);
  }

  /**
   * Get current user's parcels.
   * GET /api/parcels/my
   *
   * User only.
   */
  @Get('my/list')
  async getMyParcels(
    @CurrentUser('id') userId: string,
    @Query('state') state?: ParcelState,
  ) {
    return this.parcelsService.findByOwner(userId, state);
  }

  /**
   * Get all parcels (paginated).
   * GET /api/parcels
   *
   * Staff/Admin only.
   */
  @Get()
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findAll(
    @Query('state') state?: ParcelState,
    @Query('hasException') hasException?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.parcelsService.findAll(
      state,
      hasException === 'true' ? true : hasException === 'false' ? false : undefined,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Get parcel state history.
   * GET /api/parcels/:id/history
   *
   * Users can view history of their own parcels.
   * Staff/Admin can view all.
   */
  @Get(':id/history')
  async getStateHistory(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    // First check ownership for users
    if (user.role === Role.USER) {
      const parcel = await this.parcelsService.findById(parcelId);
      if (parcel.ownerId !== user.id) {
        throw new Error('You can only view history of your own parcels');
      }
    }

    return this.parcelsService.getStateHistory(parcelId);
  }

  /**
   * Soft delete a parcel.
   * DELETE /api/parcels/:id
   *
   * Admin only.
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  async softDelete(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.parcelsService.softDelete(
      parcelId,
      adminId,
      ipAddress,
      userAgent,
    );
  }
}
