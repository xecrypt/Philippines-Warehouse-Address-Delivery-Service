import { IsNotEmpty, IsString } from 'class-validator';

/**
 * RefreshTokenDto
 *
 * Validation rules for token refresh.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}
