/**
 * Database schema synchronization helper.
 *
 * Conditionally runs `adapter.initialize()` and `adapter.initializeGlobals()`
 * based on `db.syncSchema` and `migrations.mode` configuration.
 */
import {
	shouldSyncSchema,
	type MomentumConfig,
	type ResolvedMomentumConfig,
} from '@momentumcms/core';

export interface SchemaLogger {
	info(msg: string): void;
}

/**
 * Sync the database schema if the config allows it.
 *
 * Call this during server initialization to create/update tables.
 * Respects `db.syncSchema` and `migrations.mode`:
 * - auto (default): sync in push mode, skip in migrate mode
 * - true: always sync
 * - false: never sync
 */
export async function syncDatabaseSchema(
	config: MomentumConfig | ResolvedMomentumConfig,
	log: SchemaLogger,
): Promise<void> {
	if (shouldSyncSchema(config)) {
		if (config.db.adapter.initialize) {
			log.info('Initializing database schema...');
			await config.db.adapter.initialize(config.collections);
		}
		if (config.db.adapter.initializeGlobals && config.globals && config.globals.length > 0) {
			log.info(`Initializing globals table for ${config.globals.length} global(s)...`);
			await config.db.adapter.initializeGlobals(config.globals);
		}
	} else {
		log.info('Skipping automatic schema sync (migration mode). Run migrations separately.');
	}
}
