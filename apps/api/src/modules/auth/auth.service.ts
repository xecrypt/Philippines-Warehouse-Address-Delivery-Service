import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, AuditActions } from '../audit/audit.service';
import { RegisterDto, LoginDto } from './dto';

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * AuthService
 *
 * Handles all authentication-related business logic:
 * - User registration with member code generation
 * - Login with password verification
 * - JWT token generation and refresh
 * - Logout (token invalidation)
 *
 * Security features:
 * - Passwords hashed with bcrypt (10 rounds)
 * - Refresh tokens hashed with bcrypt before storage
 * - Short-lived access tokens (15 min default)
 * - Longer-lived refresh tokens (7 days default)
 * - Single device login (one refresh token per user)
 * - Rate limiting: 5 failed attempts per 15 min locks account
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Register a new user.
   *
   * Steps:
   * 1. Check if email already exists
   * 2. Hash password with bcrypt
   * 3. Generate unique member code
   * 4. Create user in database
   * 5. Generate and return tokens
   * 6. Log registration in audit
   *
   * @param dto - Registration data
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   * @returns User object and tokens
   */
  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    // Check if email already taken
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Generate unique member code
    const memberCode = await this.generateUniqueMemberCode();

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        memberCode,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberCode: true,
        role: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Hash refresh token before storing
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);

    // Save hashed refresh token to user
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    // Audit log: User registered
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: Role.USER,
      action: AuditActions.USER_REGISTERED,
      entityType: 'User',
      entityId: user.id,
      newData: { email: user.email, memberCode: user.memberCode },
      ipAddress,
      userAgent,
    });

    return {
      user,
      tokens,
    };
  }

  /**
   * Login with email and password.
   *
   * Includes rate limiting:
   * - 5 failed attempts in 15 minutes locks the account
   * - Successful login resets the counter
   *
   * @param dto - Login credentials
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   * @returns User object and tokens
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive || user.isDeleted) {
      throw new UnauthorizedException('Account is inactive or deleted');
    }

    // Check if account is locked due to rate limiting
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Record failed login attempt
      await this.recordFailedLoginAttempt(user.id);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Hash refresh token before storing
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);

    // Update refresh token hash, reset failed attempts, and update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash,
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      },
    });

    // Audit log: User logged in
    await this.auditService.log({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AuditActions.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        memberCode: user.memberCode,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token.
   *
   * @param userId - User ID from refresh token
   * @param refreshToken - Current refresh token (plain text from request)
   * @returns New tokens
   */
  async refreshTokens(userId: string, refreshToken: string) {
    // Get user with current refresh token hash
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify refresh token matches stored hash
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Hash new refresh token before storing
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);

    // Update refresh token hash
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return tokens;
  }

  /**
   * Logout - invalidate refresh token.
   *
   * @param userId - User ID
   * @param ipAddress - Request IP for audit
   * @param userAgent - Request user agent for audit
   */
  async logout(userId: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    // Audit log: User logged out
    if (user) {
      await this.auditService.log({
        actorId: userId,
        actorEmail: user.email,
        actorRole: user.role,
        action: AuditActions.USER_LOGOUT,
        entityType: 'User',
        entityId: userId,
        ipAddress,
        userAgent,
      });
    }
  }

  /**
   * Get current user profile.
   *
   * @param userId - User ID
   * @returns User profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        memberCode: true,
        role: true,
        deliveryStreet: true,
        deliveryCity: true,
        deliveryProvince: true,
        deliveryZipCode: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Build warehouse address
    const warehouseAddress = this.buildWarehouseAddress(
      user.firstName,
      user.lastName,
      user.memberCode,
    );

    return {
      ...user,
      warehouseAddress,
    };
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  /**
   * Record a failed login attempt and lock account if threshold reached.
   */
  private async recordFailedLoginAttempt(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true, lastFailedLoginAt: true },
    });

    if (!user) return;

    const now = new Date();
    const windowStart = new Date(now.getTime() - LOCKOUT_DURATION_MINUTES * 60000);

    // Reset counter if last failed attempt was outside the window
    let newFailedAttempts: number;
    if (!user.lastFailedLoginAt || user.lastFailedLoginAt < windowStart) {
      newFailedAttempts = 1;
    } else {
      newFailedAttempts = user.failedLoginAttempts + 1;
    }

    // Lock account if threshold reached
    const lockedUntil =
      newFailedAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: newFailedAttempts,
        lastFailedLoginAt: now,
        lockedUntil,
      },
    });
  }

  /**
   * Generate JWT access and refresh tokens.
   */
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Generate a unique member code.
   *
   * Format: PHW-XXXXXX (6 alphanumeric characters)
   * Excludes ambiguous characters: I, O, 0, 1
   *
   * Collision-resistant: retries up to 10 times if code exists.
   */
  private async generateUniqueMemberCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let code = 'PHW-';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check if code already exists
      const existing = await this.prisma.user.findUnique({
        where: { memberCode: code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new Error('Failed to generate unique member code after max attempts');
  }

  /**
   * Build formatted warehouse address for user.
   */
  private buildWarehouseAddress(
    firstName: string,
    lastName: string,
    memberCode: string,
  ) {
    const warehouseName = this.configService.get<string>(
      'WAREHOUSE_NAME',
      'Philippines Warehouse',
    );
    const warehouseStreet = this.configService.get<string>(
      'WAREHOUSE_STREET',
      '123 Warehouse Street',
    );
    const warehouseCity = this.configService.get<string>(
      'WAREHOUSE_CITY',
      'Manila',
    );
    const warehouseCountry = this.configService.get<string>(
      'WAREHOUSE_COUNTRY',
      'Philippines',
    );
    const warehousePhone = this.configService.get<string>(
      'WAREHOUSE_PHONE',
      '+63 XXX XXX XXXX',
    );

    const formatted = [
      `${firstName} ${lastName}`,
      warehouseName,
      `Unit ${memberCode}`,
      warehouseStreet,
      `${warehouseCity}, ${warehouseCountry}`,
      warehousePhone,
    ].join('\n');

    return {
      name: `${firstName} ${lastName}`,
      warehouse: warehouseName,
      unit: memberCode,
      street: warehouseStreet,
      city: warehouseCity,
      country: warehouseCountry,
      phone: warehousePhone,
      formatted,
    };
  }
}
