import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser Decorator
 *
 * Extracts the current user from the request.
 * Cleaner alternative to @Request() req then req.user.
 *
 * Usage:
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user) {
 *   return user;
 * }
 *
 * // Or extract specific field
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If specific field requested, return that field
    if (data) {
      return user?.[data];
    }

    // Otherwise return full user object
    return user;
  },
);
