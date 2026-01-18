import { IsString, IsNotEmpty, Matches, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for admin parcel ownership override.
 *
 * PRD Section 12: "Ownership changes require admin override"
 */
export class OverrideOwnershipDto {
  /**
   * New owner's member code.
   * Must be a valid member code format (PHW-XXXXXX).
   * If the member code doesn't match any user, parcel becomes orphan.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^PHW-[A-Z0-9]{6}$/, {
    message: 'Member code must be in format PHW-XXXXXX (6 alphanumeric characters)',
  })
  memberCode: string;

  /**
   * Reason for the ownership change.
   * Required for audit trail.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason: string;
}
