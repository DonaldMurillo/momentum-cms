import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { hashApiKey, type ApiKeyStore } from '@momentumcms/server-core';

function createMockContext(headers: Record<string, string> = {}) {
	const req: Record<string, unknown> = {
		headers,
		get: (name: string) => headers[name.toLowerCase()],
	};
	return {
		switchToHttp: () => ({
			getRequest: () => req,
		}),
		req,
	};
}

function createMockStore(overrides: Partial<ApiKeyStore> = {}): ApiKeyStore {
	return {
		create: vi.fn().mockResolvedValue('id'),
		findByHash: vi.fn().mockResolvedValue(null),
		listAll: vi.fn().mockResolvedValue([]),
		listByUser: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		deleteById: vi.fn().mockResolvedValue(true),
		updateLastUsed: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe('ApiKeyGuard', () => {
	it('should pass through when no X-API-Key header', async () => {
		const guard = new ApiKeyGuard(createMockStore());
		const ctx = createMockContext({});
		const result = await guard.canActivate(ctx as never);
		expect(result).toBe(true);
	});

	it('should throw for invalid key format', async () => {
		const guard = new ApiKeyGuard(createMockStore());
		const ctx = createMockContext({ 'x-api-key': 'bad-key' });
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	// mcms_ prefix (5 chars) + 40 hex chars = 45 chars total
	const VALID_KEY = 'mcms_' + 'a'.repeat(40);

	it('should throw when key not found in store', async () => {
		const store = createMockStore({
			findByHash: vi.fn().mockResolvedValue(null),
		});
		const guard = new ApiKeyGuard(store);
		const ctx = createMockContext({ 'x-api-key': VALID_KEY });
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});

	it('should set user context from valid key', async () => {
		const hashed = await hashApiKey(VALID_KEY);
		const store = createMockStore({
			findByHash: vi.fn().mockResolvedValue({
				id: 'key-1',
				createdBy: 'user-1',
				name: 'Test Key',
				role: 'admin',
				keyHash: hashed,
				createdAt: new Date().toISOString(),
			}),
		});
		const guard = new ApiKeyGuard(store);
		const ctx = createMockContext({ 'x-api-key': VALID_KEY });
		const result = await guard.canActivate(ctx as never);
		expect(result).toBe(true);
		expect(ctx.req['user']).toBeDefined();
	});

	it('should throw for expired key', async () => {
		const hashed = await hashApiKey(VALID_KEY);
		const store = createMockStore({
			findByHash: vi.fn().mockResolvedValue({
				id: 'key-1',
				createdBy: 'user-1',
				name: 'Expired Key',
				role: 'admin',
				keyHash: hashed,
				createdAt: new Date().toISOString(),
				expiresAt: new Date('2020-01-01').toISOString(),
			}),
		});
		const guard = new ApiKeyGuard(store);
		const ctx = createMockContext({ 'x-api-key': VALID_KEY });
		await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException);
	});
});
