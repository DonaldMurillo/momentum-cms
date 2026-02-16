import { defineEventHandler } from 'h3';
import type { PostgresAdapterWithRaw } from '@momentumcms/db-drizzle';
import { ensureInitialized } from '../../../utils/momentum-init';
import momentumConfig from '../../../../momentum.config';

/**
 * GET /api/setup/status
 *
 * Returns whether the application needs initial setup (no users exist).
 * Used by the admin frontend to redirect to the setup page on first visit.
 * Queries the Better Auth "user" table directly (same as the Express setup middleware).
 */
export default defineEventHandler(async () => {
	await ensureInitialized();

	try {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
		const pool = (momentumConfig.db.adapter as PostgresAdapterWithRaw).getPool();
		const result = await pool.query('SELECT COUNT(*) as count FROM "user"');
		const count = Number(result.rows[0]?.count ?? 0);
		const hasUsers = count > 0;

		return {
			needsSetup: !hasUsers,
			hasUsers,
		};
	} catch {
		// If checking fails, assume setup is needed for safety
		return {
			needsSetup: true,
			hasUsers: false,
		};
	}
});
