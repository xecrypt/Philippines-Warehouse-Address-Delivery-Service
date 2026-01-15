import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
}

/**
 * JwtStrategy
 *
 * Validates JWT access tokens on protected routes.
 *
 * How it works:
 * 1. Extracts JWT from Authorization header (Bearer token)
 * 2. Verifies signature using JWT_SECRET
 * 3. Calls validate() with decoded payload
 * 4. Returns user object that gets attached to request.user
 *
 * Usage with guards:
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@Request() req) {
 *   return req.user; // User object from validate()
 * }
 * ```
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Reject expired tokens
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Called after JWT is verified.
   * Loads full user from database and attaches to request.
   *
   * @param payload - Decoded JWT payload
   * @returns User object (without sensitive fields)
   * @throws UnauthorizedException if user not found or inactive
   */
  async validate(payload: JwtPayload) {
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
      },
    });

    if (!user || !user.isActive || user.isDeleted) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
