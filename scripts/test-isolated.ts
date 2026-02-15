#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Isolated Test Runner for Seeding E2E Tests
 *
 * Based on patterns from metacollector repo:
 * - Dynamic port allocation (10000-65535)
 * - Unique database per run (momentum_test_{timestamp}_{random})
 * - Automatic cleanup after tests
 * - Seed completion polling
 * - Dual mode: dev (faster iteration) vs prod (realistic)
 *
 * Usage:
 *   npx ts-node scripts/test-isolated.ts            # Run all seeding E2E tests
 *   npx ts-node scripts/test-isolated.ts --prod     # Against production build
 *   npx ts-node scripts/test-isolated.ts --grep @seed # Filter by tag
 *   npx ts-node scripts/test-isolated.ts --project seeding-basic # Specific project
 */

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

// ESM compatibility - get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const MIN_PORT = 10000;
const MAX_PORT = 65535;
const MAX_WAIT_TIME = 120000; // 2 minutes
const POLL_INTERVAL = 2000; // 2 seconds
const DB_HOST = 'localhost';
const DB_PORT = 5434;
const DB_USER = 'postgres';
const DB_PASSWORD = 'postgres';
const _TEMPLATE_DB = 'momentum_seeding_test';

interface TestConfig {
	prod: boolean;
	grep?: string;
	project?: string;
	verbose: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): TestConfig {
	const args = process.argv.slice(2);
	return {
		prod: args.includes('--prod'),
		grep: args.find((a, i) => args[i - 1] === '--grep'),
		project: args.find((a, i) => args[i - 1] === '--project'),
		verbose: args.includes('--verbose') || args.includes('-v'),
	};
}

/**
 * Find an available port in the range
 */
async function findAvailablePort(): Promise<number> {
	for (let attempt = 0; attempt < 100; attempt++) {
		const port = Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT;
		const isAvailable = await new Promise<boolean>((resolve) => {
			const server = net.createServer();
			server.once('error', () => resolve(false));
			server.once('listening', () => {
				server.close(() => resolve(true));
			});
			server.listen(port);
		});

		if (isAvailable) {
			return port;
		}
	}
	throw new Error('Could not find available port after 100 attempts');
}

/**
 * Generate a unique database name
 */
function generateDatabaseName(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `momentum_test_${timestamp}_${random}`;
}

/**
 * Create a new database
 */
async function createDatabase(dbName: string): Promise<void> {
	const client = new Client({
		host: DB_HOST,
		port: DB_PORT,
		user: DB_USER,
		password: DB_PASSWORD,
		database: 'postgres', // Connect to default database to create new one
	});

	try {
		await client.connect();
		// Drop if exists (from previous failed run)
		await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
		// Create new database
		await client.query(`CREATE DATABASE "${dbName}"`);
		console.log(`[Isolated Test] Created database: ${dbName}`);
	} finally {
		await client.end();
	}
}

/**
 * Drop a database
 */
async function dropDatabase(dbName: string): Promise<void> {
	const client = new Client({
		host: DB_HOST,
		port: DB_PORT,
		user: DB_USER,
		password: DB_PASSWORD,
		database: 'postgres',
	});

	try {
		await client.connect();
		// Terminate all connections to the database
		await client.query(`
			SELECT pg_terminate_backend(pg_stat_activity.pid)
			FROM pg_stat_activity
			WHERE pg_stat_activity.datname = '${dbName}'
			AND pid <> pg_backend_pid()
		`);
		// Drop the database
		await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
		console.log(`[Isolated Test] Dropped database: ${dbName}`);
	} finally {
		await client.end();
	}
}

/**
 * Build the app if needed
 */
async function buildApp(prod: boolean): Promise<void> {
	if (!prod) {
		console.log('[Isolated Test] Skipping build (dev mode)');
		return;
	}

	console.log('[Isolated Test] Building app for production...');
	return new Promise((resolve, reject) => {
		const build = spawn('npx', ['nx', 'build', 'example-angular', '--configuration=production'], {
			cwd: path.resolve(__dirname, '..'),
			stdio: 'inherit',
			shell: true,
		});

		build.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Build failed with code ${code}`));
			}
		});
	});
}

/**
 * Start the server process
 */
function startServer(port: number, dbName: string, prod: boolean): ChildProcess {
	const env = {
		...process.env,
		PORT: String(port),
		DATABASE_URL: `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${dbName}`,
	};

	const command = prod
		? `node dist/apps/example-angular/server/server.mjs`
		: `npx nx serve example-angular`;

	console.log(`[Isolated Test] Starting server on port ${port}...`);

	const server = spawn(command, [], {
		cwd: path.resolve(__dirname, '..'),
		env,
		shell: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	server.stdout?.on('data', (data) => {
		const msg = data.toString().trim();
		if (msg) console.log(`[Server] ${msg}`);
	});

	server.stderr?.on('data', (data) => {
		const msg = data.toString().trim();
		if (msg) console.error(`[Server] ${msg}`);
	});

	return server;
}

/**
 * Wait for server to be ready and seeds to complete
 */
async function waitForServer(port: number): Promise<void> {
	const baseUrl = `http://localhost:${port}`;
	const startTime = Date.now();

	console.log('[Isolated Test] Waiting for server and seeds...');

	while (Date.now() - startTime < MAX_WAIT_TIME) {
		try {
			const response = await fetch(`${baseUrl}/api/health?checkSeeds=true`);
			if (response.ok) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Type assertion needed for response validation
				const data = (await response.json()) as {
					status: string;
					seeds?: { ready: boolean; completed: number };
				};

				if (data.seeds?.ready) {
					console.log(`[Isolated Test] Server ready with ${data.seeds.completed} seeds`);
					return;
				}
			}
		} catch {
			// Server not ready yet
		}

		// eslint-disable-next-line local/no-direct-browser-apis -- Node.js script, not Angular
		await new Promise((r) => setTimeout(r, POLL_INTERVAL));
	}

	throw new Error(`Server did not become ready within ${MAX_WAIT_TIME}ms`);
}

/**
 * Run Playwright tests
 */
async function runPlaywright(port: number, config: TestConfig): Promise<number> {
	const args = ['playwright', 'test', '--config=apps/example-angular-e2e/playwright.config.ts'];

	if (config.project) {
		args.push(`--project=${config.project}`);
	}

	if (config.grep) {
		args.push(`--grep=${config.grep}`);
	}

	console.log(`[Isolated Test] Running Playwright tests...`);

	return new Promise((resolve) => {
		const playwright = spawn('npx', args, {
			cwd: path.resolve(__dirname, '..'),
			env: {
				...process.env,
				BASE_URL: `http://localhost:${port}`,
			},
			stdio: 'inherit',
			shell: true,
		});

		playwright.on('close', (code) => {
			resolve(code ?? 1);
		});
	});
}

/**
 * Kill a process and its children
 */
function killProcess(proc: ChildProcess): void {
	if (proc.pid) {
		try {
			// On macOS/Linux, kill the process group
			process.kill(-proc.pid, 'SIGTERM');
		} catch {
			// Fallback to regular kill
			proc.kill('SIGTERM');
		}
	}
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
	const config = parseArgs();
	let server: ChildProcess | null = null;
	let dbName: string | null = null;
	let exitCode = 1;

	console.log('[Isolated Test] Starting isolated test run...');
	console.log(`[Isolated Test] Mode: ${config.prod ? 'production' : 'development'}`);

	try {
		// 1. Find available port
		const port = await findAvailablePort();
		console.log(`[Isolated Test] Using port: ${port}`);

		// 2. Create unique database
		dbName = generateDatabaseName();
		await createDatabase(dbName);

		// 3. Build app if production mode
		await buildApp(config.prod);

		// 4. Start server
		server = startServer(port, dbName, config.prod);

		// 5. Wait for server and seeds
		await waitForServer(port);

		// 6. Run Playwright tests
		exitCode = await runPlaywright(port, config);

		console.log(`[Isolated Test] Tests completed with exit code: ${exitCode}`);
	} catch (error) {
		console.error('[Isolated Test] Error:', error);
		exitCode = 1;
	} finally {
		// 7. Cleanup
		if (server) {
			console.log('[Isolated Test] Stopping server...');
			killProcess(server);
		}

		if (dbName) {
			try {
				await dropDatabase(dbName);
			} catch (error) {
				console.error('[Isolated Test] Failed to drop database:', error);
			}
		}
	}

	process.exit(exitCode);
}

// Run main function
main();
