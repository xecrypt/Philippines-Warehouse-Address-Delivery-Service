import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtRefreshGuard
 *
 * Used only on the token refresh endpoint.
 * Uses the 'jwt-refresh' strategy defined in JwtRefreshStrategy.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
