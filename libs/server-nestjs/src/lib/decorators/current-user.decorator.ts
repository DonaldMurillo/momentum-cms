import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the current user from the request.
 * The user is attached to req.user by the SessionMiddleware or ApiKeyGuard.
 *
 * @example
 * ```typescript
 * @Get()
 * findAll(@CurrentUser() user?: UserContext) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
	const request = ctx.switchToHttp().getRequest();
	return request.user;
});
