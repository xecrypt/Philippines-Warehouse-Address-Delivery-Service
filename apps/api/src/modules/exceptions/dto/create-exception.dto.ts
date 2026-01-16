import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ExceptionType } from '@prisma/client';

/**
 * DTO for creating an exception (staff only).
 *
 * Per PRD Section 8: Exception Triggers include missing/invalid member code,
 * illegible label, damaged parcel, duplicate tracking, conflicting ownership.
 */
export class CreateExceptionDto {
  @IsUUID()
  @IsNotEmpty()
  parcelId: string;

  @IsEnum(ExceptionType)
  @IsNotEmpty()
  type: ExceptionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;
}
