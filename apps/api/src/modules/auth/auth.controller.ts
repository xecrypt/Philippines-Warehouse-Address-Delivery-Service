import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { JwtAuthGuard, JwtRefreshGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

/**
 * AuthController
 *
 * Handles authentication endpoints:
 * - POST /api/auth/register - Create new user
 * - POST /api/auth/login - Login and get tokens
 * - POST /api/auth/refresh - Refresh access token
 * - POST /api/auth/logout - Invalidate tokens
 * - GET /api/auth/me - Get current user profile
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register a new user.
   *
   * Public endpoint - no authentication required.
   *
   * @param dto - Registration data
   * @returns { user, tokens }
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Login with email and password.
   *
   * Public endpoint - no authentication required.
   *
   * @param dto - Login credentials
   * @returns { user, tokens }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Refresh access token using refresh token.
   *
   * Uses JwtRefreshGuard which validates the refresh token.
   *
   * @param dto - Contains refreshToken
   * @param user - User from validated refresh token
   * @returns { accessToken, refreshToken }
   */
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: { id: string; refreshToken: string },
  ) {
    return this.authService.refreshTokens(user.id, user.refreshToken);
  }

  /**
   * Logout - invalidate refresh token.
   *
   * Requires valid access token.
   *
   * @param userId - Current user's ID
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string) {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  /**
   * Get current user profile.
   *
   * Requires valid access token.
   * Returns user profile with warehouse address.
   *
   * @param userId - Current user's ID
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }
}
