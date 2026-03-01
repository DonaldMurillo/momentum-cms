import { Catch, HttpException, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	GlobalNotFoundError,
	ReferentialIntegrityError,
	MomentumValidationError,
	sanitizeErrorMessage,
} from '@momentumcms/server-core';

/**
 * Global exception filter that maps server-core error types to HTTP responses.
 * Mirrors the error handling in server-express's route handlers.
 */
@Catch()
export class MomentumExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse();

		if (
			exception instanceof CollectionNotFoundError ||
			exception instanceof DocumentNotFoundError ||
			exception instanceof GlobalNotFoundError
		) {
			response.status(404).json({ error: exception.message });
			return;
		}

		if (exception instanceof AccessDeniedError) {
			response.status(403).json({ error: exception.message });
			return;
		}

		if (exception instanceof ReferentialIntegrityError) {
			response.status(409).json({ error: exception.message });
			return;
		}

		if (exception instanceof MomentumValidationError) {
			response.status(400).json({
				error: 'Validation failed',
				errors: exception.errors,
			});
			return;
		}

		// Handle NestJS HttpException (UnauthorizedException, BadRequestException, etc.)
		if (exception instanceof HttpException) {
			const status = exception.getStatus();
			const exceptionResponse = exception.getResponse();
			let msg: unknown;
			if (typeof exceptionResponse === 'string') {
				msg = exceptionResponse;
			} else if (
				typeof exceptionResponse === 'object' &&
				exceptionResponse !== null &&
				'message' in exceptionResponse
			) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- NestJS HttpException.getResponse() returns string | object
				msg = (exceptionResponse as Record<string, unknown>)['message'];
			} else {
				msg = exception.message;
			}
			const error = Array.isArray(msg) ? msg.join(', ') : String(msg);
			response.status(status).json({ error });
			return;
		}

		// Unknown error — sanitize to prevent information leaks
		const message =
			exception instanceof Error
				? sanitizeErrorMessage(exception, 'Internal server error')
				: 'Internal server error';
		response.status(500).json({ error: message });
	}
}
