/**
 * Seed Tracker
 *
 * Manages the internal seed tracking collection (_momentum_seeds).
 * Tracks seeded entities to ensure idempotency across server restarts.
 */

import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@momentumcms/core';
import { SEED_TRACKING_COLLECTION_SLUG } from '@momentumcms/core';
import type { SeedTrackingDocument } from '@momentumcms/core';

/**
 * Data required to create a new seed tracking record.
 */
export interface CreateSeedTrackingData {
	seedId: string;
	collection: string;
	documentId: string;
	checksum: string;
}

/**
 * Seed tracker interface for managing seed tracking records.
 */
export interface SeedTracker {
	/**
	 * Find a seed tracking record by its seedId.
	 *
	 * @param seedId - The unique seed identifier
	 * @returns The tracking record or null if not found
	 */
	findBySeedId(seedId: string): Promise<SeedTrackingDocument | null>;

	/**
	 * Create a new seed tracking record.
	 *
	 * @param data - The tracking data
	 * @returns The created tracking record
	 */
	create(data: CreateSeedTrackingData): Promise<SeedTrackingDocument>;

	/**
	 * Update the checksum of an existing seed tracking record.
	 *
	 * @param seedId - The unique seed identifier
	 * @param checksum - The new checksum
	 * @returns The updated tracking record
	 */
	updateChecksum(seedId: string, checksum: string): Promise<SeedTrackingDocument>;

	/**
	 * Delete a seed tracking record by its seedId.
	 *
	 * @param seedId - The unique seed identifier
	 * @returns True if deleted, false if not found
	 */
	delete(seedId: string): Promise<boolean>;
}

/**
 * Creates a seed tracker instance for managing seed tracking records.
 *
 * @param adapter - The database adapter to use
 * @returns Seed tracker instance
 *
 * @example
 * ```typescript
 * const tracker = createSeedTracker(adapter);
 * const existing = await tracker.findBySeedId('admin-user');
 * if (!existing) {
 *   await tracker.create({
 *     seedId: 'admin-user',
 *     collection: 'user',
 *     documentId: 'uuid-here',
 *     checksum: 'sha256-hash',
 *   });
 * }
 * ```
 */
export function createSeedTracker(adapter: DatabaseAdapter): SeedTracker {
	const collectionSlug = SEED_TRACKING_COLLECTION_SLUG;

	return {
		async findBySeedId(seedId: string): Promise<SeedTrackingDocument | null> {
			const results = await adapter.find(collectionSlug, { seedId });

			if (results.length === 0) {
				return null;
			}

			// Return first match (seedId should be unique)
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast
			return results[0] as unknown as SeedTrackingDocument;
		},

		async create(data: CreateSeedTrackingData): Promise<SeedTrackingDocument> {
			const now = new Date().toISOString();
			const doc = await adapter.create(collectionSlug, {
				id: randomUUID(),
				seedId: data.seedId,
				collection: data.collection,
				documentId: data.documentId,
				checksum: data.checksum,
				createdAt: now,
				updatedAt: now,
			});

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast
			return doc as unknown as SeedTrackingDocument;
		},

		async updateChecksum(seedId: string, checksum: string): Promise<SeedTrackingDocument> {
			const existing = await this.findBySeedId(seedId);

			if (!existing) {
				throw new Error(`Seed tracking record not found for seedId: ${seedId}`);
			}

			const now = new Date().toISOString();
			const updated = await adapter.update(collectionSlug, existing.id, {
				checksum,
				updatedAt: now,
			});

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast
			return updated as unknown as SeedTrackingDocument;
		},

		async delete(seedId: string): Promise<boolean> {
			const existing = await this.findBySeedId(seedId);

			if (!existing) {
				return false;
			}

			return adapter.delete(collectionSlug, existing.id);
		},
	};
}
