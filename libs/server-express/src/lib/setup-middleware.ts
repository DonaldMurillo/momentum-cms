import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import type { Pool } from 'pg';
import type { Database } from 'better-sqlite3';
import type { MomentumAuth } from '@momentumcms/auth';
import { MIN_PASSWORD_LENGTH } from '@momentumcms/core';

/**
 * Response type for the setup status endpoint.
 */
export interface SetupStatus {
	/** True if no users exist and setup is required */
	needsSetup: boolean;
	/** True if at least one user exists */
	hasUsers: boolean;
}

/**
 * Database result for user count query.
 */
interface UserCountResult {
	count: number | string;
}

/**
 * Database result for user query.
 */
interface UserRow {
	id: string;
	name: string;
	email: string;
	role: string;
	emailVerified: boolean | number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Database configuration - supports both SQLite and PostgreSQL.
 */
export type DatabaseConfig =
	| { type: 'sqlite'; database: Database }
	| { type: 'postgres'; pool: Pool };

/**
 * Type guard for user count result.
 */
function isUserCountResult(value: unknown): value is UserCountResult {
	if (value === null || typeof value !== 'object') return false;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const record = value as Record<string, unknown>;
	return (
		'count' in record &&
		(typeof record['count'] === 'number' || typeof record['count'] === 'string')
	);
}

/**
 * Type guard for user row result.
 */
function isUserRow(value: unknown): value is UserRow {
	if (value === null || typeof value !== 'object') return false;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const record = value as Record<string, unknown>;
	return (
		'id' in record &&
		typeof record['id'] === 'string' &&
		'name' in record &&
		typeof record['name'] === 'string' &&
		'email' in record &&
		typeof record['email'] === 'string' &&
		'role' in record &&
		typeof record['role'] === 'string'
	);
}

/**
 * Type guard for create admin request body.
 */
function isCreateAdminRequest(
	value: unknown,
): value is { name: string; email: string; password: string } {
	if (value === null || typeof value !== 'object') return false;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	const record = value as Record<string, unknown>;
	return (
		'name' in record &&
		typeof record['name'] === 'string' &&
		'email' in record &&
		typeof record['email'] === 'string' &&
		'password' in record &&
		typeof record['password'] === 'string'
	);
}

/**
 * Check if any users exist in the database (SQLite).
 */
function hasExistingUsersSqlite(database: Database): boolean {
	try {
		const result: unknown = database.prepare('SELECT COUNT(*) as count FROM "user"').get();
		if (isUserCountResult(result)) {
			return Number(result.count) > 0;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Check if any users exist in the database (PostgreSQL).
 */
async function hasExistingUsersPostgres(pool: Pool): Promise<boolean> {
	try {
		const result = await pool.query('SELECT COUNT(*) as count FROM "user"');
		if (result.rows[0] && isUserCountResult(result.rows[0])) {
			return Number(result.rows[0].count) > 0;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Update user role (SQLite).
 */
function updateUserRoleSqlite(database: Database, userId: string, role: string): void {
	database.prepare('UPDATE "user" SET role = ? WHERE id = ?').run(role, userId);
}

/**
 * Update user role (PostgreSQL).
 */
async function updateUserRolePostgres(pool: Pool, userId: string, role: string): Promise<void> {
	await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [role, userId]);
}

/**
 * Get user by ID (SQLite).
 */
function getUserByIdSqlite(database: Database, userId: string): UserRow | null {
	const userRow: unknown = database
		.prepare(
			'SELECT id, name, email, role, "emailVerified", "createdAt", "updatedAt" FROM "user" WHERE id = ?',
		)
		.get(userId);

	return isUserRow(userRow) ? userRow : null;
}

/**
 * Get user by ID (PostgreSQL).
 */
async function getUserByIdPostgres(pool: Pool, userId: string): Promise<UserRow | null> {
	const result = await pool.query(
		'SELECT id, name, email, role, "emailVerified", "createdAt", "updatedAt" FROM "user" WHERE id = $1',
		[userId],
	);

	return result.rows[0] && isUserRow(result.rows[0]) ? result.rows[0] : null;
}

/**
 * Configuration for the setup middleware.
 */
export interface SetupMiddlewareConfig {
	/** Database configuration - supports SQLite or PostgreSQL */
	db: DatabaseConfig;
	/** The Better Auth instance for user creation */
	auth: MomentumAuth;
}

/**
 * Legacy configuration for backwards compatibility.
 */
export interface SetupMiddlewareConfigLegacy {
	/** The SQLite database instance (deprecated, use db instead) */
	database: Database;
	/** The Better Auth instance for user creation */
	auth: MomentumAuth;
}

/**
 * Type guard to check if config uses the legacy format.
 */
function isLegacyConfig(
	config: SetupMiddlewareConfig | SetupMiddlewareConfigLegacy,
): config is SetupMiddlewareConfigLegacy {
	return 'database' in config && !('db' in config);
}

/**
 * Creates Express middleware for setup-related endpoints.
 *
 * Provides endpoints to:
 * - Check if the application needs initial setup (no users exist)
 * - Create the first admin user during setup
 *
 * @example
 * ```typescript
 * import { createSetupMiddleware } from '@momentumcms/server-express';
 * import { createMomentumAuth } from '@momentumcms/auth';
 *
 * // With PostgreSQL
 * const auth = createMomentumAuth({ db: { type: 'postgres', pool } });
 * app.use('/api', createSetupMiddleware({ db: { type: 'postgres', pool }, auth }));
 *
 * // With SQLite (legacy)
 * const auth = createMomentumAuth({ database: sqliteDb });
 * app.use('/api', createSetupMiddleware({ database: sqliteDb, auth }));
 * ```
 */
export function createSetupMiddleware(
	config: SetupMiddlewareConfig | SetupMiddlewareConfigLegacy,
): Router {
	// Handle legacy config format
	const dbConfig: DatabaseConfig = isLegacyConfig(config)
		? { type: 'sqlite', database: config.database }
		: config.db;

	const { auth } = config;
	const router = createRouter();

	/**
	 * GET /setup/status
	 *
	 * Returns whether the application needs initial setup (no users exist).
	 * Used by the frontend to redirect to the setup page on first visit.
	 */
	router.get('/setup/status', async (_req: Request, res: Response): Promise<void> => {
		let hasUsers: boolean;

		if (dbConfig.type === 'sqlite') {
			hasUsers = hasExistingUsersSqlite(dbConfig.database);
		} else {
			hasUsers = await hasExistingUsersPostgres(dbConfig.pool);
		}

		const status: SetupStatus = {
			needsSetup: !hasUsers,
			hasUsers,
		};

		res.json(status);
	});

	/**
	 * POST /setup/create-admin
	 *
	 * Creates the first admin user using Better Auth's API.
	 * Only works when no users exist. The created user gets admin role.
	 */
	router.post('/setup/create-admin', async (req: Request, res: Response): Promise<void> => {
		try {
			// Verify no users exist yet
			let hasUsers: boolean;
			if (dbConfig.type === 'sqlite') {
				hasUsers = hasExistingUsersSqlite(dbConfig.database);
			} else {
				hasUsers = await hasExistingUsersPostgres(dbConfig.pool);
			}

			if (hasUsers) {
				res.status(403).json({
					error: { message: 'Setup already completed. Users already exist.' },
				});
				return;
			}

			// Validate request body
			if (!isCreateAdminRequest(req.body)) {
				res.status(400).json({
					error: { message: 'Name, email, and password are required.' },
				});
				return;
			}

			const { name, email, password } = req.body;

			// Validate required fields (redundant check for empty strings)
			if (!name || !email || !password) {
				res.status(400).json({
					error: { message: 'Name, email, and password are required.' },
				});
				return;
			}

			// Validate password length
			if (password.length < MIN_PASSWORD_LENGTH) {
				res.status(400).json({
					error: { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
				});
				return;
			}

			// Validate email format
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				res.status(400).json({
					error: { message: 'Invalid email format.' },
				});
				return;
			}

			// Use Better Auth's signUpEmail API to create the user with proper password hashing
			const result = await auth.api.signUpEmail({
				body: { name, email, password },
			});

			if (!result || !result.user) {
				res.status(500).json({
					error: { message: 'Failed to create user' },
				});
				return;
			}

			// Update the user's role to admin directly in the database
			// Better Auth doesn't expose role updates through its API
			if (dbConfig.type === 'sqlite') {
				updateUserRoleSqlite(dbConfig.database, result.user.id, 'admin');
			} else {
				await updateUserRolePostgres(dbConfig.pool, result.user.id, 'admin');
			}

			// Fetch the updated user
			let userRow: UserRow | null;
			if (dbConfig.type === 'sqlite') {
				userRow = getUserByIdSqlite(dbConfig.database, result.user.id);
			} else {
				userRow = await getUserByIdPostgres(dbConfig.pool, result.user.id);
			}

			if (!userRow) {
				res.status(500).json({
					error: { message: 'Failed to fetch created user' },
				});
				return;
			}

			res.status(201).json({
				user: {
					id: userRow.id,
					name: userRow.name,
					email: userRow.email,
					role: userRow.role,
					emailVerified: Boolean(userRow.emailVerified),
					createdAt: userRow.createdAt,
					updatedAt: userRow.updatedAt,
				},
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to create admin user';
			res.status(500).json({ error: { message } });
		}
	});

	return router;
}
