/* eslint-disable no-console */
import { test as base } from '@playwright/test';
import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import * as fs from 'node:fs';
import { Pool } from 'pg';
import { createDatabase, dropDatabase, getDatabaseName, getDatabaseUrl } from './db-helpers';
import { getWorkerAuthDir, type TestUserCredentials } from './auth-helpers';

/**
 * Configuration for the worker server fixture factory.
 */
export interface WorkerServerConfig {
	/** Short app name used for database naming (e.g. 'seeding', 'angular') */
	appName: string;
	/** Path to the server binary relative to workspace root */
	serverBinary: string;
	/** Health endpoint path to poll (e.g. '/api/health?checkSeeds=true') */
	healthEndpoint: string;
	/** Whether to wait for seed completion via health endpoint */
	waitForSeeds: boolean;
	/** Admin user to create during setup */
	adminUser: TestUserCredentials;
	/** Additional test users to create via sign-up API */
	additionalUsers?: TestUserCredentials[];
	/** Whether to pass SMTP env vars for email testing */
	smtpEnv?: boolean;
	/** Absolute path to the E2E project directory (for auth file storage) */
	projectDir: string;
	/** Absolute path to the workspace root */
	workspaceRoot: string;
}

/**
 * Find a free port by binding to port 0 and reading the assigned port.
 */
async function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, () => {
			const addr = server.address();
			if (addr && typeof addr !== 'string') {
				const port = addr.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error('Could not determine free port')));
			}
		});
		server.on('error', reject);
	});
}

/**
 * Poll a health endpoint until the server is ready.
 */
async function waitForHealth(
	baseURL: string,
	healthEndpoint: string,
	waitForSeeds: boolean,
	timeout = 120000,
): Promise<void> {
	const startTime = Date.now();
	let lastError = '';

	while (Date.now() - startTime < timeout) {
		try {
			const response = await fetch(`${baseURL}${healthEndpoint}`);
			if (response.ok) {
				if (waitForSeeds) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Health endpoint response
					const data = (await response.json()) as {
						seeds?: { ready: boolean; completed: number; expected: number };
					};
					if (data.seeds?.ready) {
						console.log(`[Health] Seeds ready: ${data.seeds.completed}/${data.seeds.expected}`);
						return;
					}
					lastError = `Seeds not ready: ${data.seeds?.completed ?? 0}/${data.seeds?.expected ?? 0}`;
				} else {
					return;
				}
			} else {
				lastError = `Status ${response.status}`;
			}
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}

		await new Promise((r) => setTimeout(r, 1000));
	}

	throw new Error(`Health check timed out after ${timeout}ms. Last: ${lastError}`);
}

/**
 * Sign up a user via Better Auth's sign-up API.
 * Returns the Better Auth user ID if available.
 */
async function signUpUser(
	baseURL: string,
	credentials: TestUserCredentials,
): Promise<string | undefined> {
	const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: baseURL },
		body: JSON.stringify({
			name: credentials.name,
			email: credentials.email,
			password: credentials.password,
		}),
	});

	if (response.ok) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth response
		const data = (await response.json()) as { user?: { id?: string } };
		return data.user?.id;
	}

	// User might already exist (e.g. from a previous partial run)
	// Try to sign in to verify they exist
	const signInResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: baseURL },
		body: JSON.stringify({
			email: credentials.email,
			password: credentials.password,
		}),
	});

	if (signInResponse.ok) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth response
		const data = (await signInResponse.json()) as { user?: { id?: string } };
		return data.user?.id;
	}

	console.warn(`[Setup] Failed to create/verify user ${credentials.email}: ${response.status}`);
	return undefined;
}

/**
 * Ensure a user exists in the Momentum users collection with the correct role.
 * Uses direct database access to bypass API access control.
 */
async function ensureMomentumUser(
	pool: Pool,
	credentials: TestUserCredentials,
	authUserId?: string,
): Promise<void> {
	// Also set the role on the Better Auth "user" table so the session always
	// reflects the correct role (the session resolver's getRoleByEmail may not
	// be ready immediately after server boot)
	await pool.query('UPDATE "user" SET role = $1 WHERE email = $2', [
		credentials.role,
		credentials.email,
	]);

	const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [
		credentials.email,
	]);

	if (existing.rows.length > 0) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row
		const row = existing.rows[0] as { id: string; role: string };
		if (row.role !== credentials.role) {
			await pool.query('UPDATE users SET role = $1 WHERE id = $2', [credentials.role, row.id]);
			console.log(`[Setup] Fixed ${credentials.email} role: ${row.role} → ${credentials.role}`);
		}
	} else {
		// Look up Better Auth user ID if not provided
		let resolvedAuthId = authUserId;
		if (!resolvedAuthId) {
			const authLookup = await pool.query('SELECT id FROM "user" WHERE email = $1', [
				credentials.email,
			]);
			if (authLookup.rows.length > 0) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- pg row
				resolvedAuthId = (authLookup.rows[0] as { id: string }).id;
			}
		}

		await pool.query(
			`INSERT INTO users (id, name, email, role, "authId", active, "createdAt", "updatedAt")
			 VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())`,
			[credentials.name, credentials.email, credentials.role, resolvedAuthId ?? ''],
		);
		console.log(`[Setup] Created Momentum user: ${credentials.email} (${credentials.role})`);
	}
}

/**
 * Set up all users for a worker: sign up via API, then sync roles via DB.
 */
async function setupUsers(
	baseURL: string,
	dbUrl: string,
	config: WorkerServerConfig,
): Promise<void> {
	const allUsers = [config.adminUser, ...(config.additionalUsers ?? [])];
	const authUserIds = new Map<string, string>();

	// Sign up all users via Better Auth API
	for (const user of allUsers) {
		const authId = await signUpUser(baseURL, user);
		if (authId) {
			authUserIds.set(user.email, authId);
		}
		console.log(`[Setup] User ${user.email} (${user.role}) registered`);
	}

	// Sync Momentum users collection with correct roles
	const pool = new Pool({ connectionString: dbUrl });
	try {
		for (const user of allUsers) {
			await ensureMomentumUser(pool, user, authUserIds.get(user.email));
		}
	} catch (error) {
		console.warn('[Setup] Momentum user sync failed:', error);
	} finally {
		await pool.end();
	}
}

/**
 * Create a worker-scoped Playwright fixture that manages:
 * - A fresh PostgreSQL database per worker
 * - A server process on a random port per worker
 * - User setup (sign-up + role sync)
 * - Automatic baseURL override for all tests in the worker
 *
 * Usage in an E2E app:
 * ```typescript
 * const workerTest = createWorkerFixture({ appName: 'seeding', ... });
 * export const test = workerTest.extend<{ authenticatedPage: Page }>({ ... });
 * ```
 */
export function createWorkerFixture(config: WorkerServerConfig): ReturnType<typeof base.extend> {
	return base.extend<object, { workerBaseURL: string }>({
		workerBaseURL: [
			async (_deps, use, workerInfo) => {
				const workerIndex = workerInfo.workerIndex;
				const dbName = getDatabaseName(config.appName, workerIndex);
				const dbUrl = getDatabaseUrl(dbName);
				let serverProcess: ChildProcess | undefined;

				try {
					// 1. Create fresh database
					console.log(`[Worker ${workerIndex}] Creating database ${dbName}...`);
					await createDatabase(dbName);

					// 2. Find free port
					const port = await findFreePort();
					console.log(`[Worker ${workerIndex}] Starting server on port ${port}...`);

					// 3. Spawn server process
					const env: Record<string, string> = Object.fromEntries(
						Object.entries(process.env).filter(
							(entry): entry is [string, string] => entry[1] != null,
						),
					);
					env['PORT'] = String(port);
					env['DATABASE_URL'] = dbUrl;
					// Override Better Auth's baseURL to match actual port
					env['BETTER_AUTH_URL'] = `http://localhost:${port}`;
					// Webhook receiver URL for webhook tests (same server)
					env['WEBHOOK_RECEIVER_URL'] = `http://localhost:${port}/api/test-webhook-receiver`;

					if (config.smtpEnv) {
						env['SMTP_HOST'] = process.env['SMTP_HOST'] ?? 'localhost';
						env['SMTP_PORT'] = process.env['SMTP_PORT'] ?? '1025';
						env['SMTP_FROM'] = process.env['SMTP_FROM'] ?? 'noreply@momentum.local';
					}

					// Allow localhost webhooks for E2E testing
					env['MOMENTUM_ALLOW_PRIVATE_WEBHOOKS'] = 'true';

					serverProcess = spawn('node', [config.serverBinary], {
						env,
						cwd: config.workspaceRoot,
						stdio: ['pipe', 'pipe', 'pipe'],
					});

					// Forward server output
					serverProcess.stdout?.on('data', (data: Buffer) => {
						const msg = data.toString().trim();
						if (msg) console.log(`[Server:w${workerIndex}] ${msg}`);
					});
					serverProcess.stderr?.on('data', (data: Buffer) => {
						const msg = data.toString().trim();
						if (msg) console.error(`[Server:w${workerIndex}:err] ${msg}`);
					});

					// Handle unexpected server exit
					serverProcess.on('exit', (code, signal) => {
						if (code !== null && code !== 0) {
							console.error(
								`[Worker ${workerIndex}] Server exited with code ${code} signal ${signal}`,
							);
						}
					});

					const workerBaseURL = `http://localhost:${port}`;

					// 4. Wait for health
					console.log(
						`[Worker ${workerIndex}] Waiting for server health at ${config.healthEndpoint}...`,
					);
					await waitForHealth(workerBaseURL, config.healthEndpoint, config.waitForSeeds);
					console.log(`[Worker ${workerIndex}] Server ready!`);

					// 5. Create auth directory
					const authDir = getWorkerAuthDir(config.projectDir, workerIndex);
					fs.mkdirSync(authDir, { recursive: true });

					// 6. Set up users
					console.log(`[Worker ${workerIndex}] Setting up test users...`);
					await setupUsers(workerBaseURL, dbUrl, config);
					console.log(`[Worker ${workerIndex}] Users ready!`);

					await use(workerBaseURL);
				} finally {
					// 7. Teardown
					console.log(`[Worker ${workerIndex}] Shutting down...`);

					if (serverProcess) {
						serverProcess.kill('SIGTERM');
						// Wait for graceful shutdown
						await new Promise<void>((resolve) => {
							const timeout = setTimeout(() => {
								serverProcess?.kill('SIGKILL');
								resolve();
							}, 5000);
							serverProcess?.on('exit', () => {
								clearTimeout(timeout);
								resolve();
							});
						});
					}

					try {
						await dropDatabase(dbName);
					} catch (err) {
						console.warn(`[Worker ${workerIndex}] DB cleanup failed:`, err);
					}
					console.log(`[Worker ${workerIndex}] Cleanup complete`);
				}
			},
			{ scope: 'worker', auto: true },
		],

		// Override Playwright's built-in baseURL to use the worker's server
		baseURL: async ({ workerBaseURL }, use) => {
			await use(workerBaseURL);
		},
	});
}
