import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  Max,
  Matches,
} from 'class-validator';

/**
 * DTO for staff parcel intake.
 *
 * Used when warehouse staff registers a new parcel.
 * Member code is used to look up the owner.
 * If member code is invalid/missing, parcel becomes an orphan with exception.
 */
export class IntakeParcelDto {
  @IsString()
  @IsNotEmpty()
  trackingNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^PHW-[A-Z0-9]{6}$/, {
    message: 'Member code must be in format PHW-XXXXXX',
  })
  memberCode: string;

  @IsNumber()
  @IsPositive()
  @Max(50) // Max 50kg per PRD constraint
  weight: number;

  @IsString()
  @IsOptional()
  description?: string;
}
