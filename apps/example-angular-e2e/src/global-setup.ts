/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');
const SERVER_BINARY = path.join(WORKSPACE_ROOT, 'dist/apps/example-angular/server/server.mjs');

const PG_CONNECTION =
	process.env['PG_CONNECTION'] ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

/**
 * Simplified global setup — precondition checks only.
 *
 * The per-worker fixture (worker-server.fixture.ts) handles:
 * - Database creation per worker
 * - Server process spawn on random port
 * - Health check
 * - User creation and role sync
 *
 * This global setup just fails fast if prerequisites are missing.
 */
async function globalSetup(): Promise<void> {
	console.log('[Global Setup] Running precondition checks...');

	// 1. Check build artifact exists
	if (!fs.existsSync(SERVER_BINARY)) {
		throw new Error(
			`[Global Setup] Server binary not found at ${SERVER_BINARY}.\n` +
				'Run: nx build example-angular',
		);
	}
	console.log('[Global Setup] Build artifact found.');

	// 2. Check PostgreSQL is reachable
	const client = new Client({ connectionString: PG_CONNECTION });
	try {
		await client.connect();
		await client.query('SELECT 1');
		console.log('[Global Setup] PostgreSQL is reachable.');
	} catch (error) {
		throw new Error(
			`[Global Setup] Cannot connect to PostgreSQL at ${PG_CONNECTION}.\n` +
				`Ensure PostgreSQL is running. Error: ${error instanceof Error ? error.message : error}`,
		);
	} finally {
		await client.end();
	}

	console.log('[Global Setup] All preconditions met.');
}

export default globalSetup;
