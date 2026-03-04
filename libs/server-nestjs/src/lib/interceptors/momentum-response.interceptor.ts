import {
	Injectable,
	type NestInterceptor,
	type ExecutionContext,
	type CallHandler,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';
import { sanitizeErrorMessage } from '@momentumcms/server-core';

/**
 * Interceptor that reads the `status` field from MomentumResponse
 * and sets it on the HTTP response. NestJS defaults to 200, but
 * create operations should return 201, etc.
 */
@Injectable()
export class MomentumResponseInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(
			map((data: unknown) => {
				if (data && typeof data === 'object' && 'status' in data) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe after typeof + 'in' check
					const record = data as Record<string, unknown>;
					if (typeof record['status'] === 'number') {
						const response = context.switchToHttp().getResponse();
						response.status(record['status']);
					}
				}

				// Sanitize error messages for 5xx responses to prevent information leaks
				if (data && typeof data === 'object' && 'error' in data && 'status' in data) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe after typeof + 'in' check
					const record = data as Record<string, unknown>;
					if (
						typeof record['status'] === 'number' &&
						record['status'] >= 500 &&
						typeof record['error'] === 'string'
					) {
						record['error'] = sanitizeErrorMessage(
							new Error(record['error']),
							'Internal server error',
						);
					}
				}

				return data;
			}),
		);
	}
}
