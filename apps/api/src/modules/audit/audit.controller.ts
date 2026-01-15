import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

/**
 * AuditController
 *
 * Audit log viewing endpoints (Admin only).
 *
 * - GET /api/audit - List audit logs with filters
 * - GET /api/audit/entity/:type/:id - Get logs for specific entity
 * - GET /api/audit/parcel/:id - Get all logs for a parcel
 * - GET /api/audit/actor/:id - Get logs by actor
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private auditService: AuditService) {}

  /**
   * List audit logs with filters.
   */
  @Get()
  async getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('parcelId') parcelId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getLogs(
      {
        actorId,
        entityType,
        entityId,
        action,
        parcelId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      page,
      limit,
    );
  }

  /**
   * Get audit logs for a specific entity.
   */
  @Get('entity/:type/:id')
  async getLogsForEntity(
    @Param('type') entityType: string,
    @Param('id') entityId: string,
  ) {
    return this.auditService.getLogsForEntity(entityType, entityId);
  }

  /**
   * Get all audit logs for a parcel.
   */
  @Get('parcel/:id')
  async getLogsForParcel(@Param('id', ParseUUIDPipe) parcelId: string) {
    return this.auditService.getLogsForParcel(parcelId);
  }

  /**
   * Get audit logs by actor.
   */
  @Get('actor/:id')
  async getLogsByActor(
    @Param('id', ParseUUIDPipe) actorId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.auditService.getLogsByActor(actorId, page, limit);
  }
}
