/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { ensureMailpit } from '@momentum-cms/e2e-fixtures';
import { getFlavorConfig, getServerFlavor } from './fixtures/worker-config';

const WORKSPACE_ROOT = process.env['E2E_WORKSPACE_ROOT']
	? path.resolve(process.env['E2E_WORKSPACE_ROOT'])
	: path.resolve(__dirname, '..', '..', '..');

const PG_CONNECTION =
	process.env['PG_CONNECTION'] ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

/**
 * Unified global setup for E2E tests.
 *
 * Runs precondition checks based on E2E_SERVER_FLAVOR:
 * - Verifies build artifact exists for the target app
 * - Checks PostgreSQL connectivity
 * - Ensures Mailpit is running for email tests
 */
async function globalSetup(): Promise<void> {
	const flavor = getServerFlavor();
	const config = getFlavorConfig();

	console.log(`[Global Setup] Server flavor: ${flavor}`);
	console.log('[Global Setup] Running precondition checks...');

	// 1. Check build artifact exists
	const serverBinaryPath = path.join(WORKSPACE_ROOT, config.serverBinary);
	if (!fs.existsSync(serverBinaryPath)) {
		throw new Error(
			`[Global Setup] Server binary not found at ${serverBinaryPath}.\n` +
				`Run: ${config.buildCommand}`,
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

	// 3. Ensure Mailpit is running (starts via Docker if not)
	await ensureMailpit();

	console.log('[Global Setup] All preconditions met.');
}

export default globalSetup;
