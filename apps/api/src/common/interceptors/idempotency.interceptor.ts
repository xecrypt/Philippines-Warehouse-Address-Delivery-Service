import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '../../modules/prisma/prisma.service';

/**
 * IdempotencyInterceptor
 *
 * Prevents duplicate execution of critical operations per PRD Section 12:
 * "Idempotency for critical actions"
 *
 * How it works:
 * 1. Client sends request with `Idempotency-Key` header (UUID recommended)
 * 2. Interceptor checks if key exists in database
 * 3. If exists and not expired: return cached response
 * 4. If not exists: execute request, cache response, return response
 * 5. Keys expire after 24 hours (configurable)
 *
 * Usage:
 * - Add `@UseInterceptors(IdempotencyInterceptor)` to endpoints that need idempotency
 * - Applies to POST, PUT, PATCH methods only
 * - Client must send unique `Idempotency-Key` header per distinct request
 *
 * Example:
 * ```
 * POST /api/deliveries
 * Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
 * ```
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // TTL for idempotency keys: 24 hours
  private readonly TTL_HOURS = 24;

  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only apply to state-changing methods
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    // Get idempotency key from header
    const idempotencyKey = request.headers['idempotency-key'] as string;

    // If no key provided, proceed without idempotency (backwards compatible)
    if (!idempotencyKey) {
      return next.handle();
    }

    // Validate key format (should be UUID-like)
    if (idempotencyKey.length < 16 || idempotencyKey.length > 64) {
      throw new ConflictException(
        'Idempotency-Key must be between 16 and 64 characters',
      );
    }

    // Get user ID from request (if authenticated)
    const user = request.user as { id?: string } | undefined;
    const userId = user?.id || null;

    // Check if key already exists
    const existingKey = await this.prisma.idempotencyKey.findUnique({
      where: { id: idempotencyKey },
    });

    // If key exists and not expired, return cached response
    if (existingKey) {
      if (existingKey.expiresAt > new Date()) {
        // Set the original status code
        response.status(existingKey.statusCode);
        // Return cached response
        return of(existingKey.response);
      } else {
        // Key expired, delete it and proceed with new request
        await this.prisma.idempotencyKey.delete({
          where: { id: idempotencyKey },
        });
      }
    }

    // Execute the request and cache the response
    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          // Calculate expiration time
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + this.TTL_HOURS);

          // Store the idempotency key with response
          await this.prisma.idempotencyKey.create({
            data: {
              id: idempotencyKey,
              userId,
              endpoint: request.path,
              method: request.method,
              statusCode: response.statusCode,
              response: responseBody as object,
              expiresAt,
            },
          });
        } catch (error) {
          // If we fail to store the key (e.g., race condition), log but don't fail
          // This handles the edge case where two identical requests come in simultaneously
          console.warn(
            `Failed to store idempotency key ${idempotencyKey}:`,
            error,
          );
        }
      }),
    );
  }
}
