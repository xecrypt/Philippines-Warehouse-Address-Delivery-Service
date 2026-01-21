import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Transform all successful responses to a consistent format:
 * { success: true, data: <response> }
 *
 * This ensures the frontend receives a predictable response structure.
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If response already has success property, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Wrap response in standard format
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
