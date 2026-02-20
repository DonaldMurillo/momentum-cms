/**
 * Test database helpers for migration integration tests.
 * Creates and destroys test databases for each test suite.
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * PostgreSQL connection string for the maintenance database.
 */
const PG_CONNECTION =
	process.env['PG_CONNECTION'] ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

/**
 * Derive connection string for a specific database.
 */
export function getDatabaseUrl(dbName: string): string {
	const base = PG_CONNECTION.replace(/\/[^/]*$/, '');
	return `${base}/${dbName}`;
}

/**
 * Generate a unique test database name.
 */
export function generateTestDbName(): string {
	const id = randomUUID().slice(0, 8);
	return `mig_test_${id}`;
}

/**
 * Create a fresh PostgreSQL test database.
 * Returns the database name and connection string.
 */
export async function createTestPgDb(): Promise<{ dbName: string; connectionString: string }> {
	const dbName = generateTestDbName();
	const client = new Client({ connectionString: PG_CONNECTION });
	await client.connect();
	try {
		await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
		await client.query(`CREATE DATABASE "${dbName}"`);
	} finally {
		await client.end();
	}
	return { dbName, connectionString: getDatabaseUrl(dbName) };
}

/**
 * Drop a PostgreSQL test database.
 */
export async function dropTestPgDb(dbName: string): Promise<void> {
	const client = new Client({ connectionString: PG_CONNECTION });
	await client.connect();
	try {
		await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
	} finally {
		await client.end();
	}
}

/**
 * Create a temporary SQLite database file.
 * Returns the file path for the database.
 */
export async function createTestSqliteDb(): Promise<{ dbPath: string; tempDir: string }> {
	const tempDir = await mkdtemp(join(tmpdir(), 'mig-test-'));
	const dbPath = join(tempDir, 'test.db');
	return { dbPath, tempDir };
}

/**
 * Clean up a temporary SQLite database.
 */
export async function dropTestSqliteDb(tempDir: string): Promise<void> {
	await rm(tempDir, { recursive: true, force: true });
}
