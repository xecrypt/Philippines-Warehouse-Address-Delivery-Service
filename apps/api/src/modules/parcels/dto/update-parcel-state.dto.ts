import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ParcelState } from '@prisma/client';

/**
 * DTO for updating parcel state.
 *
 * State transitions are validated by the service.
 * Invalid transitions are rejected.
 */
export class UpdateParcelStateDto {
  @IsEnum(ParcelState)
  newState: ParcelState;

  @IsString()
  @IsOptional()
  notes?: string;
}
