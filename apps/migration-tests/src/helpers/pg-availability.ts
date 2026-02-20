/**
 * PostgreSQL availability check for integration tests.
 * Caches result so the connection check only happens once per process.
 */
import { Client } from 'pg';

const PG_CONNECTION =
	process.env['PG_CONNECTION'] ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

let _pgAvailable: boolean | null = null;

/**
 * Check if PostgreSQL is reachable.
 * Result is cached for the lifetime of the process.
 */
export async function isPgAvailable(): Promise<boolean> {
	if (_pgAvailable !== null) return _pgAvailable;

	const client = new Client({ connectionString: PG_CONNECTION });
	try {
		await client.connect();
		await client.query('SELECT 1');
		_pgAvailable = true;
	} catch {
		_pgAvailable = false;
	} finally {
		await client.end().catch(() => { /* noop */ });
	}
	return _pgAvailable;
}
