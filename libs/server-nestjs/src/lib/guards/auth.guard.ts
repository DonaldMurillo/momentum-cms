import {
	Injectable,
	type CanActivate,
	type ExecutionContext,
	UnauthorizedException,
} from '@nestjs/common';

/**
 * Guard that requires an authenticated user on the request.
 * Throws UnauthorizedException (401) if req.user is missing.
 */
@Injectable()
export class MomentumAuthGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		if (!request.user) {
			throw new UnauthorizedException('Authentication required');
		}
		return true;
	}
}
