import {
	Injectable,
	Optional,
	Inject,
	type CanActivate,
	type ExecutionContext,
	UnauthorizedException,
} from '@nestjs/common';
import { type ApiKeyStore, hashApiKey, isValidApiKeyFormat } from '@momentumcms/server-core';
import { API_KEY_STORE } from '../momentum-config.token';

/**
 * Guard that resolves API key authentication from the X-API-Key header.
 * If no store is configured, passes through all requests.
 * If no header is present, passes through (lets session auth handle it).
 * If header is present but invalid, throws UnauthorizedException.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
	constructor(@Optional() @Inject(API_KEY_STORE) private readonly store: ApiKeyStore | null) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!this.store) {
			return true; // No API key store configured — pass through
		}

		const request = context.switchToHttp().getRequest();
		const apiKey = request.get?.('x-api-key') ?? request.headers?.['x-api-key'];

		if (!apiKey) {
			return true; // No API key — let other auth handle it
		}

		if (!isValidApiKeyFormat(apiKey)) {
			throw new UnauthorizedException('Invalid API key format');
		}

		// Hash the key and look up by hash
		const hashed = await hashApiKey(apiKey);
		const record = await this.store.findByHash(hashed);

		if (!record) {
			throw new UnauthorizedException('Invalid API key');
		}

		// Check expiration
		if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
			throw new UnauthorizedException('API key has expired');
		}

		// Attach user context from the API key
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation
		(request as any).user = {
			id: record.createdBy,
			role: record.role,
			apiKeyId: record.id,
		};

		return true;
	}
}
