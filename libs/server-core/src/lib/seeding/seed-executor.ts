/**
 * Seed Executor
 *
 * Main execution logic for the Momentum CMS seeding system.
 * Handles processing seed entities, idempotency, and change detection.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions are necessary for generic type handling with DatabaseAdapter */

import { createHash } from 'node:crypto';
import type {
	DatabaseAdapter,
	SeedingConfig,
	SeedEntity,
	SeedEntityOptions,
	SeededDocument,
	SeedContext,
	SeedingOptions,
	RolledBackSeed,
} from '@momentum-cms/core';
import { createSeedHelpers, SeedConflictError, SeedRollbackError } from '@momentum-cms/core';
import { createSeedTracker, type SeedTracker } from './seed-tracker';

/**
 * Result of a seeding run.
 */
export interface SeedingResult {
	/**
	 * Total number of seed entities processed.
	 */
	total: number;

	/**
	 * Number of new documents created.
	 */
	created: number;

	/**
	 * Number of documents updated (data changed).
	 */
	updated: number;

	/**
	 * Number of seeds skipped (already exist, no changes).
	 */
	skipped: number;

	/**
	 * All seeded documents (for reference).
	 */
	seeds: SeededDocument[];
}

/**
 * Calculate SHA-256 checksum of seed data for change detection.
 * Normalizes the JSON to ensure consistent checksums.
 *
 * @param data - The data to hash
 * @returns SHA-256 hex string
 */
export function calculateChecksum(data: Record<string, unknown>): string {
	// Sort keys for consistent JSON representation
	const sortedKeys = Object.keys(data).sort();
	const normalized: Record<string, unknown> = {};

	for (const key of sortedKeys) {
		normalized[key] = data[key];
	}

	const json = JSON.stringify(normalized);
	return createHash('sha256').update(json).digest('hex');
}

/**
 * Process a single seed entity.
 *
 * @param entity - The seed entity to process
 * @param tracker - The seed tracker instance
 * @param adapter - The database adapter
 * @param globalOptions - Global seeding options
 * @returns The seeded document result
 */
async function processSeedEntity<T = Record<string, unknown>>(
	entity: SeedEntity<T>,
	tracker: SeedTracker,
	adapter: DatabaseAdapter,
	globalOptions: SeedingOptions,
): Promise<SeededDocument<T>> {
	const options: SeedEntityOptions = {
		onConflict: globalOptions.onConflict,
		skipAccessControl: true,
		...entity.options,
	};

	const dataRecord = entity.data as Record<string, unknown>;
	const checksum = calculateChecksum(dataRecord);

	// Check if already seeded
	const existing = await tracker.findBySeedId(entity.seedId);

	if (existing) {
		switch (options.onConflict) {
			case 'skip': {
				// Return existing document
				const existingDoc = await adapter.findById(existing.collection, existing.documentId);
				return {
					id: existing.documentId,
					seedId: entity.seedId,
					collection: entity.collection,
					data: (existingDoc ?? {}) as T,
					action: 'skipped',
				};
			}

			case 'update': {
				// Only update if data changed
				if (existing.checksum !== checksum) {
					const updated = await adapter.update(
						existing.collection,
						existing.documentId,
						dataRecord,
					);
					await tracker.updateChecksum(entity.seedId, checksum);
					return {
						id: existing.documentId,
						seedId: entity.seedId,
						collection: entity.collection,
						data: updated as T,
						action: 'updated',
					};
				}
				// No changes, skip
				const existingDoc = await adapter.findById(existing.collection, existing.documentId);
				return {
					id: existing.documentId,
					seedId: entity.seedId,
					collection: entity.collection,
					data: (existingDoc ?? {}) as T,
					action: 'skipped',
				};
			}

			case 'error': {
				throw new SeedConflictError(entity.seedId, entity.collection);
			}

			default: {
				// Unknown onConflict value - throw descriptive error
				throw new Error(
					`Invalid onConflict value: "${options.onConflict}". Expected "skip", "update", or "error".`,
				);
			}
		}
	}

	// Create new document
	const doc = await adapter.create(entity.collection, dataRecord);
	const docId = doc['id'];
	if (typeof docId !== 'string') {
		throw new Error(
			`Database adapter did not return a valid document ID for seed "${entity.seedId}"`,
		);
	}

	// Track the seed
	await tracker.create({
		seedId: entity.seedId,
		collection: entity.collection,
		documentId: docId,
		checksum,
	});

	return {
		id: docId,
		seedId: entity.seedId,
		collection: entity.collection,
		data: doc as T,
		action: 'created',
	};
}

/**
 * Create the SeedContext for the custom seed function.
 *
 * @param tracker - The seed tracker instance
 * @param adapter - The database adapter
 * @param globalOptions - Global seeding options
 * @param seededMap - Map of seedId to SeededDocument for lookups
 * @returns SeedContext instance
 */
function createSeedContext(
	tracker: SeedTracker,
	adapter: DatabaseAdapter,
	globalOptions: SeedingOptions,
	seededMap: Map<string, SeededDocument>,
): SeedContext {
	return {
		async getSeeded<T = Record<string, unknown>>(
			seedId: string,
		): Promise<SeededDocument<T> | null> {
			// First check in-memory map (for seeds created in this run)
			const inMemory = seededMap.get(seedId);
			if (inMemory) {
				return inMemory as SeededDocument<T>;
			}

			// Check in database
			const tracked = await tracker.findBySeedId(seedId);
			if (!tracked) {
				return null;
			}

			const doc = await adapter.findById(tracked.collection, tracked.documentId);
			if (!doc) {
				return null;
			}

			return {
				id: tracked.documentId,
				seedId: tracked.seedId,
				collection: tracked.collection,
				data: doc as T,
				action: 'skipped', // Already existed
			};
		},

		async seed<T = Record<string, unknown>>(entity: SeedEntity<T>): Promise<SeededDocument<T>> {
			const result = await processSeedEntity(entity, tracker, adapter, globalOptions);
			seededMap.set(entity.seedId, result as SeededDocument);
			return result;
		},

		log(message: string): void {
			if (!globalOptions.quiet) {
				// eslint-disable-next-line no-console -- Intentional logging for seeding
				console.log(`[Momentum Seeding] ${message}`);
			}
		},
	};
}

/**
 * Rollback created seeds by deleting them from their collections and removing tracking records.
 *
 * @param createdSeeds - Array of seeds that were created in this run
 * @param adapter - The database adapter
 * @param tracker - The seed tracker instance
 * @param log - Logging function
 * @returns Object containing rolled back seeds and any failures
 */
async function rollbackSeeds(
	createdSeeds: SeededDocument[],
	adapter: DatabaseAdapter,
	tracker: SeedTracker,
	log: (message: string) => void,
): Promise<{
	rolledBackSeeds: RolledBackSeed[];
	rollbackFailures: Array<{ seed: RolledBackSeed; error: Error }>;
}> {
	const rolledBackSeeds: RolledBackSeed[] = [];
	const rollbackFailures: Array<{ seed: RolledBackSeed; error: Error }> = [];

	log(`Rolling back ${createdSeeds.length} created seeds...`);

	// Rollback in reverse order (last created first)
	for (const seed of [...createdSeeds].reverse()) {
		const seedInfo: RolledBackSeed = {
			seedId: seed.seedId,
			collection: seed.collection,
			documentId: seed.id,
		};

		try {
			// Delete the document from the collection
			await adapter.delete(seed.collection, seed.id);
			// Delete the tracking record
			await tracker.delete(seed.seedId);
			rolledBackSeeds.push(seedInfo);
			log(`Rolled back: ${seed.seedId} from ${seed.collection}`);
		} catch (error) {
			rollbackFailures.push({
				seed: seedInfo,
				error: error instanceof Error ? error : new Error(String(error)),
			});
			log(`Failed to rollback: ${seed.seedId} - ${error}`);
		}
	}

	return { rolledBackSeeds, rollbackFailures };
}

/**
 * Check if seeding should run based on configuration.
 *
 * @param runOnStart - The runOnStart option value
 * @returns True if seeding should run
 */
export function shouldRunSeeding(runOnStart: boolean | 'development' | 'always'): boolean {
	if (runOnStart === false) {
		return false;
	}

	if (runOnStart === true || runOnStart === 'always') {
		return true;
	}

	if (runOnStart === 'development') {
		return process.env['NODE_ENV'] === 'development' || !process.env['NODE_ENV'];
	}

	return false;
}

/**
 * Run the seeding process.
 *
 * @param config - The seeding configuration
 * @param adapter - The database adapter
 * @returns Seeding result summary
 *
 * @example
 * ```typescript
 * const result = await runSeeding(config.seeding, config.db.adapter);
 * console.log(`Seeded ${result.created} new documents`);
 * ```
 */
export async function runSeeding(
	config: SeedingConfig,
	adapter: DatabaseAdapter,
): Promise<SeedingResult> {
	const options: SeedingOptions = {
		onConflict: config.options?.onConflict ?? 'skip',
		runOnStart: config.options?.runOnStart ?? 'development',
		quiet: config.options?.quiet ?? false,
	};

	const tracker = createSeedTracker(adapter);
	const seededMap = new Map<string, SeededDocument>();
	const results: SeededDocument[] = [];

	const log = (message: string): void => {
		if (!options.quiet) {
			// eslint-disable-next-line no-console -- Intentional logging for seeding
			console.log(`[Momentum Seeding] ${message}`);
		}
	};

	log('Starting seeding process...');

	// Track seeds created in this run (for rollback on failure)
	const createdInThisRun: SeededDocument[] = [];

	try {
		// Process defaults array first (in order)
		if (config.defaults) {
			const helpers = createSeedHelpers();
			const defaultEntities = config.defaults(helpers);

			log(`Processing ${defaultEntities.length} default entities...`);

			for (const entity of defaultEntities) {
				const result = await processSeedEntity(entity, tracker, adapter, options);
				seededMap.set(entity.seedId, result);
				results.push(result);

				// Track newly created seeds for potential rollback
				if (result.action === 'created') {
					createdInThisRun.push(result);
					log(`Created: ${entity.seedId} in ${entity.collection}`);
				} else if (result.action === 'updated') {
					log(`Updated: ${entity.seedId} in ${entity.collection}`);
				}
			}
		}

		// Run custom seed function
		if (config.seed) {
			log('Running custom seed function...');
			const ctx = createSeedContext(tracker, adapter, options, seededMap);

			// Wrap the custom seed function to track created seeds
			const originalSeed = ctx.seed.bind(ctx);
			ctx.seed = async <T = Record<string, unknown>>(
				entity: SeedEntity<T>,
			): Promise<SeededDocument<T>> => {
				const result = await originalSeed(entity);
				if (result.action === 'created') {
					createdInThisRun.push(result as SeededDocument);
				}
				return result;
			};

			await config.seed(ctx);

			// Add any seeds created in custom function to results
			for (const [seedId, seeded] of seededMap.entries()) {
				if (!results.some((r) => r.seedId === seedId)) {
					results.push(seeded);
				}
			}
		}
	} catch (error) {
		// Rollback all created seeds on failure
		if (createdInThisRun.length > 0) {
			log(`Seeding failed, rolling back ${createdInThisRun.length} created seeds...`);
			const { rolledBackSeeds, rollbackFailures } = await rollbackSeeds(
				createdInThisRun,
				adapter,
				tracker,
				log,
			);

			throw new SeedRollbackError(
				error instanceof Error ? error : new Error(String(error)),
				rolledBackSeeds,
				rollbackFailures,
			);
		}

		// No seeds to rollback, just rethrow
		throw error;
	}

	// Calculate summary
	const summary: SeedingResult = {
		total: results.length,
		created: results.filter((r) => r.action === 'created').length,
		updated: results.filter((r) => r.action === 'updated').length,
		skipped: results.filter((r) => r.action === 'skipped').length,
		seeds: results,
	};

	log(
		`Seeding complete: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped`,
	);

	return summary;
}
