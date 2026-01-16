import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO for resolving an exception (admin only).
 *
 * Per PRD Section 8: All resolutions are audited.
 */
export class ResolveExceptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolution: string;
}
