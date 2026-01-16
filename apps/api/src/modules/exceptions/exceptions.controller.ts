import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ExceptionStatus, ExceptionType, Role } from '@prisma/client';
import { ExceptionsService } from './exceptions.service';
import { CreateExceptionDto, ResolveExceptionDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';

@Controller('exceptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExceptionsController {
  constructor(private exceptionsService: ExceptionsService) {}

  /**
   * Create an exception for a parcel.
   * POST /api/exceptions
   *
   * Staff/Admin only.
   */
  @Post()
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async create(
    @Body() dto: CreateExceptionDto,
    @CurrentUser('id') staffId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.exceptionsService.create(dto, staffId, ipAddress, userAgent);
  }

  /**
   * Get open exceptions (exception queue).
   * GET /api/exceptions/open
   *
   * Staff/Admin can view.
   */
  @Get('open')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findOpen(
    @Query('status') status?: ExceptionStatus,
    @Query('type') type?: ExceptionType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exceptionsService.findOpen(
      status,
      type,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Get all exceptions (with filters).
   * GET /api/exceptions
   *
   * Admin only.
   */
  @Get()
  @Roles(Role.ADMIN)
  async findAll(
    @Query('status') status?: ExceptionStatus,
    @Query('type') type?: ExceptionType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exceptionsService.findAll(
      status,
      type,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Get exception by ID.
   * GET /api/exceptions/:id
   *
   * Staff/Admin can view.
   */
  @Get(':id')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findById(@Param('id', ParseUUIDPipe) exceptionId: string) {
    return this.exceptionsService.findById(exceptionId);
  }

  /**
   * Get exceptions for a parcel.
   * GET /api/exceptions/parcel/:parcelId
   *
   * Staff/Admin can view.
   */
  @Get('parcel/:parcelId')
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findByParcel(@Param('parcelId', ParseUUIDPipe) parcelId: string) {
    return this.exceptionsService.findByParcel(parcelId);
  }

  /**
   * Assign exception to self (start working on it).
   * PATCH /api/exceptions/:id/assign
   *
   * Admin only.
   */
  @Patch(':id/assign')
  @Roles(Role.ADMIN)
  async assign(
    @Param('id', ParseUUIDPipe) exceptionId: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.exceptionsService.assign(exceptionId, adminId, ipAddress, userAgent);
  }

  /**
   * Resolve an exception.
   * PATCH /api/exceptions/:id/resolve
   *
   * Admin only.
   */
  @Patch(':id/resolve')
  @Roles(Role.ADMIN)
  async resolve(
    @Param('id', ParseUUIDPipe) exceptionId: string,
    @Body() dto: ResolveExceptionDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.exceptionsService.resolve(
      exceptionId,
      dto,
      adminId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Cancel an exception.
   * PATCH /api/exceptions/:id/cancel
   *
   * Admin only.
   */
  @Patch(':id/cancel')
  @Roles(Role.ADMIN)
  async cancel(
    @Param('id', ParseUUIDPipe) exceptionId: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.exceptionsService.cancel(exceptionId, adminId, ipAddress, userAgent);
  }
}
