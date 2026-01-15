import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * JwtRefreshStrategy
 *
 * Validates JWT refresh tokens for token refresh endpoint.
 *
 * Differences from JwtStrategy:
 * - Uses JWT_REFRESH_SECRET instead of JWT_SECRET
 * - Extracts refresh token from request body
 * - Compares refresh token against bcrypt hash stored in database
 *
 * Used only on the /auth/refresh endpoint.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // Pass request to validate()
    });
  }

  /**
   * Validates refresh token and returns user with token.
   *
   * @param req - Express request object
   * @param payload - Decoded JWT payload
   * @returns User object with refreshToken attached
   */
  async validate(req: Request, payload: { sub: string; email: string }) {
    const refreshToken = req.body.refreshToken;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberCode: true,
        role: true,
        isActive: true,
        isDeleted: true,
        refreshTokenHash: true,
      },
    });

    if (!user || !user.isActive || user.isDeleted) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify the refresh token matches the stored hash
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Return user with the plain refresh token for the service to use
    return { ...user, refreshToken };
  }
}
