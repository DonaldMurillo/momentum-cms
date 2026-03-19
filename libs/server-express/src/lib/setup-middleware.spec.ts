import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createSetupMiddleware } from './setup-middleware';
import type { SetupMiddlewareConfig } from './setup-middleware';

/**
 * Creates a mock PostgreSQL pool that simulates an empty database (no users).
 */
function createMockPool(options?: { userCount?: number }) {
	const userCount = options?.userCount ?? 0;
	return {
		query: vi.fn().mockImplementation((sql: string) => {
			if (sql.includes('COUNT')) {
				return Promise.resolve({ rows: [{ count: userCount }] });
			}
			if (sql.includes('SELECT') && sql.includes('FROM "user"')) {
				return Promise.resolve({
					rows:
						userCount > 0
							? [
									{
										id: 'existing-user',
										name: 'Existing',
										email: 'existing@test.com',
										role: 'admin',
										emailVerified: true,
										createdAt: '2024-01-01',
										updatedAt: '2024-01-01',
									},
								]
							: [],
				});
			}
			if (sql.includes('UPDATE')) {
				return Promise.resolve({ rowCount: 1 });
			}
			return Promise.resolve({ rows: [] });
		}),
	};
}

/**
 * Creates a mock auth instance.
 */
function createMockAuth(options?: { shouldFail?: boolean }) {
	let callCount = 0;
	return {
		api: {
			signUpEmail: vi.fn().mockImplementation(() => {
				if (options?.shouldFail) {
					return Promise.reject(new Error('DETAIL: Key (email)=(test@test.com) already exists.'));
				}
				callCount++;
				return Promise.resolve({
					user: {
						id: `user-${callCount}`,
						name: 'Test Admin',
						email: 'admin@test.com',
					},
				});
			}),
		},
	};
}

function createApp(config: SetupMiddlewareConfig) {
	const app = express();
	app.use(express.json());
	app.use('/api', createSetupMiddleware(config));
	return app;
}

const validAdminBody = {
	name: 'Test Admin',
	email: 'admin@test.com',
	password: 'securePassword123!',
};

describe('setup-middleware security', () => {
	describe('race condition protection on /setup/create-admin', () => {
		it('concurrent create-admin requests should only create one admin', async () => {
			// Pool starts with 0 users. After first signUp, subsequent checks should find users.
			let usersCreated = 0;
			const pool = createMockPool();

			pool.query = vi.fn().mockImplementation((sql: string) => {
				if (sql.includes('COUNT')) {
					// After first user is created, return count > 0
					return Promise.resolve({ rows: [{ count: usersCreated }] });
				}
				if (sql.includes('SELECT') && sql.includes('FROM "user"')) {
					return Promise.resolve({
						rows: [
							{
								id: `user-${usersCreated}`,
								name: 'Test Admin',
								email: 'admin@test.com',
								role: 'admin',
								emailVerified: true,
								createdAt: '2024-01-01',
								updatedAt: '2024-01-01',
							},
						],
					});
				}
				if (sql.includes('UPDATE')) {
					return Promise.resolve({ rowCount: 1 });
				}
				return Promise.resolve({ rows: [] });
			}) as typeof pool.query;

			const auth = createMockAuth();
			// Track when signUpEmail resolves to increment user count
			const originalSignUp = auth.api.signUpEmail;
			auth.api.signUpEmail = vi.fn().mockImplementation(async (...args: unknown[]) => {
				const result = await originalSignUp(...args);
				usersCreated++;
				return result;
			});

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			// Fire 5 concurrent requests
			const results = await Promise.all(
				Array.from({ length: 5 }, () =>
					request(app).post('/api/setup/create-admin').send(validAdminBody),
				),
			);

			const statuses = results.map((r) => r.status);
			const successes = statuses.filter((s) => s === 201);
			const rejections = statuses.filter((s) => s === 409 || s === 403);

			// Exactly 1 should succeed, rest should be rejected
			expect(successes).toHaveLength(1);
			expect(rejections).toHaveLength(4);
			// signUpEmail should only be called once
			expect(auth.api.signUpEmail).toHaveBeenCalledTimes(1);
		});
	});

	describe('error message sanitization', () => {
		it('should not leak internal error details on auth failure', async () => {
			const pool = createMockPool({ userCount: 0 });
			const auth = createMockAuth({ shouldFail: true });

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			const res = await request(app).post('/api/setup/create-admin').send(validAdminBody);

			expect(res.status).toBe(500);
			// Should NOT contain SQL-like details
			expect(res.body.error.message).not.toContain('DETAIL');
			expect(res.body.error.message).not.toContain('Key (email)');
			// Should be a generic message
			expect(res.body.error.message).toBe('Failed to create admin user');
		});
	});

	describe('existing functionality preserved', () => {
		it('should return 403 when users already exist', async () => {
			const pool = createMockPool({ userCount: 1 });
			const auth = createMockAuth();

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			const res = await request(app).post('/api/setup/create-admin').send(validAdminBody);

			expect(res.status).toBe(403);
		});

		it('should return 400 for missing fields', async () => {
			const pool = createMockPool({ userCount: 0 });
			const auth = createMockAuth();

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			const res = await request(app).post('/api/setup/create-admin').send({ name: 'Test' });

			expect(res.status).toBe(400);
		});

		it('should return 400 for password too short', async () => {
			const pool = createMockPool({ userCount: 0 });
			const auth = createMockAuth();

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			const res = await request(app)
				.post('/api/setup/create-admin')
				.send({ name: 'Admin', email: 'admin@test.com', password: '123' });

			expect(res.status).toBe(400);
			expect(res.body.error.message).toContain('Password must be at least');
			expect(auth.api.signUpEmail).not.toHaveBeenCalled();
		});

		it('should return 400 for invalid email format', async () => {
			const pool = createMockPool({ userCount: 0 });
			const auth = createMockAuth();

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			const res = await request(app)
				.post('/api/setup/create-admin')
				.send({ name: 'Admin', email: 'not-an-email', password: 'securePassword123!' });

			expect(res.status).toBe(400);
			expect(res.body.error.message).toContain('Invalid email');
			expect(auth.api.signUpEmail).not.toHaveBeenCalled();
		});

		it('should return setup status correctly', async () => {
			const pool = createMockPool({ userCount: 0 });
			const auth = createMockAuth();

			const config: SetupMiddlewareConfig = {
				db: { type: 'postgres', pool: pool as any },

				auth: auth as any,
			};
			const app = createApp(config);

			const res = await request(app).get('/api/setup/status');

			expect(res.status).toBe(200);
			expect(res.body.needsSetup).toBe(true);
			expect(res.body.hasUsers).toBe(false);
		});
	});
});
