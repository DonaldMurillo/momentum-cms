/* eslint-disable no-console */
import { Client } from 'pg';

/**
 * PostgreSQL connection string for the maintenance database.
 * Used for DDL operations (CREATE/DROP DATABASE).
 * Override via PG_CONNECTION env var if your local PG is on a different host/port.
 */
const PG_CONNECTION =
	process.env['PG_CONNECTION'] ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

/**
 * Derive the connection string for a specific database name
 * by replacing the database segment of PG_CONNECTION.
 */
export function getDatabaseUrl(dbName: string): string {
	const base = PG_CONNECTION.replace(/\/[^/]*$/, '');
	return `${base}/${dbName}`;
}

/**
 * Build a deterministic database name for a worker.
 * Format: e2e_{appName}_w{workerIndex}
 */
export function getDatabaseName(appName: string, workerIndex: number): string {
	if (!/^[a-zA-Z0-9_-]+$/.test(appName)) {
		throw new Error(
			`Invalid appName "${appName}": must contain only alphanumeric characters, underscores, and hyphens`,
		);
	}
	return `e2e_${appName}_w${workerIndex}`;
}

/**
 * Create a fresh database for a worker.
 * Force-drops any existing database with the same name first.
 */
export async function createDatabase(dbName: string): Promise<void> {
	const client = new Client({ connectionString: PG_CONNECTION });
	await client.connect();
	try {
		// Force-drop handles orphaned connections from crashed previous runs
		await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
		await client.query(`CREATE DATABASE "${dbName}"`);
		console.log(`[DB] Created database: ${dbName}`);
	} finally {
		await client.end();
	}
}

/**
 * Drop a worker database during teardown.
 */
export async function dropDatabase(dbName: string): Promise<void> {
	const client = new Client({ connectionString: PG_CONNECTION });
	await client.connect();
	try {
		await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
		console.log(`[DB] Dropped database: ${dbName}`);
	} finally {
		await client.end();
	}
}
