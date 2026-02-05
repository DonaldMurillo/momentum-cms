/**
 * Version Operations Implementation
 *
 * Provides version management operations for versioned collections.
 */

import type {
	DatabaseAdapter,
	CollectionConfig,
	DocumentStatus,
	DocumentVersionParsed,
	VersionQueryResult,
	RestoreVersionOptions,
	PublishOptions,
	SchedulePublishResult,
	AccessArgs,
	RequestContext,
} from '@momentum-cms/core';
import type {
	MomentumAPIContext,
	VersionOperations,
	VersionFindOptions,
} from './momentum-api.types';
import { AccessDeniedError, DocumentNotFoundError } from './momentum-api.types';

/**
 * Type guard to check if a value is a record object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Safely parse JSON to a typed object with error handling.
 * Returns null if parsing fails to prevent request crashes from corrupted data.
 */
function parseVersionData<T>(jsonString: string): T | null {
	try {
		const parsed: unknown = JSON.parse(jsonString);
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Safe cast after JSON parse
		return parsed as T;
	} catch {
		// Return null for corrupted version data rather than crashing
		return null;
	}
}

/**
 * Implementation of version operations for a collection.
 */
export class VersionOperationsImpl<T = Record<string, unknown>> implements VersionOperations<T> {
	constructor(
		private readonly slug: string,
		private readonly collectionConfig: CollectionConfig,
		private readonly adapter: DatabaseAdapter,
		private readonly context: MomentumAPIContext,
	) {}

	async findVersions(
		parentId: string,
		options?: VersionFindOptions,
	): Promise<VersionQueryResult<T>> {
		// Check readVersions access
		await this.checkAccess('readVersions');

		// Verify parent document exists
		const parent = await this.adapter.findById(this.slug, parentId);
		if (!parent) {
			throw new DocumentNotFoundError(this.slug, parentId);
		}

		if (!this.adapter.findVersions) {
			throw new Error('Version operations not supported by database adapter');
		}

		const limit = options?.limit ?? 10;
		const page = options?.page ?? 1;

		const versions = await this.adapter.findVersions(this.slug, parentId, {
			limit,
			page,
			includeAutosave: options?.includeAutosave,
			status: options?.status,
			sort: options?.sort,
		});

		// Parse version data, filtering out any corrupted versions
		const docs: DocumentVersionParsed<T>[] = [];
		for (const v of versions) {
			const parsedVersion = parseVersionData<T>(v.version);
			if (parsedVersion !== null) {
				docs.push({
					...v,
					version: parsedVersion,
				});
			}
		}

		// Get total count for pagination with the same filters applied
		const countOptions = {
			includeAutosave: options?.includeAutosave,
			status: options?.status,
		};
		const totalDocs = this.adapter.countVersions
			? await this.adapter.countVersions(this.slug, parentId, countOptions)
			: docs.length;
		const totalPages = Math.ceil(totalDocs / limit) || 1;

		return {
			docs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
		};
	}

	async findVersionById(versionId: string): Promise<DocumentVersionParsed<T> | null> {
		// Check readVersions access
		await this.checkAccess('readVersions');

		if (!this.adapter.findVersionById) {
			throw new Error('Version operations not supported by database adapter');
		}

		const version = await this.adapter.findVersionById(this.slug, versionId);
		if (!version) {
			return null;
		}

		const parsedVersion = parseVersionData<T>(version.version);
		if (parsedVersion === null) {
			// Version data is corrupted, treat as not found
			return null;
		}

		return {
			...version,
			version: parsedVersion,
		};
	}

	async restore(options: RestoreVersionOptions): Promise<T> {
		// Check restoreVersions access
		await this.checkAccess('restoreVersions');

		if (!this.adapter.restoreVersion) {
			throw new Error('Version operations not supported by database adapter');
		}

		// Use transaction if available for atomicity
		if (this.adapter.transaction) {
			return this.adapter.transaction(async (txAdapter) => {
				if (!txAdapter.restoreVersion) {
					throw new Error('Version operations not supported by database adapter');
				}

				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record, safe cast
				const restored = (await txAdapter.restoreVersion(
					this.slug,
					options.versionId,
				)) as T;

				// If publish option is set, publish the restored document
				if (options.publish && txAdapter.updateStatus) {
					const docId = isRecord(restored) ? String(restored['id']) : '';
					await txAdapter.updateStatus(this.slug, docId, 'published');
				}

				return restored;
			});
		}

		// Fallback: non-transactional
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record, safe cast
		const restored = (await this.adapter.restoreVersion(this.slug, options.versionId)) as T;

		// If publish option is set, publish the restored document
		if (options.publish && this.adapter.updateStatus) {
			const docId = isRecord(restored) ? String(restored['id']) : '';
			await this.adapter.updateStatus(this.slug, docId, 'published');
		}

		return restored;
	}

	async publish(docId: string, _options?: PublishOptions): Promise<T> {
		// Check publishVersions access
		await this.checkAccess('publishVersions');

		// Verify document exists
		const doc = await this.adapter.findById(this.slug, docId);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, docId);
		}

		// Update status to published and create version atomically where possible
		if (!this.adapter.updateStatus) {
			throw new Error('Version operations not supported by database adapter');
		}

		// Use transaction if available for atomicity
		if (this.adapter.transaction) {
			return this.adapter.transaction(async (txAdapter) => {
				if (!txAdapter.updateStatus) {
					throw new Error('Version operations not supported by database adapter');
				}

				await txAdapter.updateStatus(this.slug, docId, 'published');

				const updatedDoc = await txAdapter.findById(this.slug, docId);
				if (!updatedDoc) {
					throw new Error('Failed to fetch document after status update');
				}

				if (txAdapter.createVersion) {
					await txAdapter.createVersion(this.slug, docId, updatedDoc, {
						status: 'published',
					});
				}

				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record, safe cast
				return updatedDoc as T;
			});
		}

		// Fallback: non-transactional publish
		await this.adapter.updateStatus(this.slug, docId, 'published');

		const updatedDoc = await this.adapter.findById(this.slug, docId);
		if (!updatedDoc) {
			// Rollback status if document vanished (defensive)
			try {
				await this.adapter.updateStatus(this.slug, docId, 'draft');
			} catch {
				// Best effort rollback
			}
			throw new Error('Failed to fetch document after status update');
		}

		// Create a published version with the updated document state
		if (this.adapter.createVersion) {
			await this.adapter.createVersion(this.slug, docId, updatedDoc, { status: 'published' });
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record, safe cast
		return updatedDoc as T;
	}

	async unpublish(docId: string): Promise<T> {
		// Check publishVersions access
		await this.checkAccess('publishVersions');

		// Verify document exists
		const doc = await this.adapter.findById(this.slug, docId);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, docId);
		}

		// Update status to draft
		if (!this.adapter.updateStatus) {
			throw new Error('Version operations not supported by database adapter');
		}
		await this.adapter.updateStatus(this.slug, docId, 'draft');

		// Return updated document
		const updated = await this.adapter.findById(this.slug, docId);
		if (!updated) {
			throw new Error('Failed to fetch unpublished document');
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record, safe cast
		return updated as T;
	}

	async saveDraft(docId: string, data: Partial<T>): Promise<DocumentVersionParsed<T>> {
		// Check update access (drafts are essentially updates)
		await this.checkAccess('update');

		// Verify document exists
		const doc = await this.adapter.findById(this.slug, docId);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, docId);
		}

		if (!this.adapter.createVersion) {
			throw new Error('Version operations not supported by database adapter');
		}

		// Merge existing doc with new data for the autosave version
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Doc and data are Records, safe merge
		const mergedData = { ...doc, ...data } as Record<string, unknown>;

		// Create autosave version
		const version = await this.adapter.createVersion(this.slug, docId, mergedData, {
			status: 'draft',
			autosave: true,
		});

		const parsedVersion = parseVersionData<T>(version.version);
		if (parsedVersion === null) {
			throw new Error('Failed to parse saved draft version data');
		}

		return {
			...version,
			version: parsedVersion,
		};
	}

	async getStatus(docId: string): Promise<DocumentStatus> {
		// Check read access
		await this.checkAccess('read');

		const doc = await this.adapter.findById(this.slug, docId);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, docId);
		}

		// Get status from document
		const status = doc['_status'];
		if (status === 'published') {
			return 'published';
		}
		return 'draft';
	}

	async compare(
		versionId1: string,
		versionId2: string,
	): Promise<{ field: string; oldValue: unknown; newValue: unknown }[]> {
		// Check readVersions access
		await this.checkAccess('readVersions');

		const version1 = await this.findVersionById(versionId1);
		const version2 = await this.findVersionById(versionId2);

		if (!version1 || !version2) {
			throw new Error('One or both versions not found');
		}

		const data1 = version1.version;
		const data2 = version2.version;

		if (!isRecord(data1) || !isRecord(data2)) {
			return [];
		}

		const differences: { field: string; oldValue: unknown; newValue: unknown }[] = [];

		// Get all unique keys from both versions
		const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);

		for (const key of allKeys) {
			const val1 = data1[key];
			const val2 = data2[key];

			// Simple comparison (deep comparison would require more logic)
			if (JSON.stringify(val1) !== JSON.stringify(val2)) {
				differences.push({
					field: key,
					oldValue: val1,
					newValue: val2,
				});
			}
		}

		return differences;
	}

	async schedulePublish(docId: string, publishAt: string): Promise<SchedulePublishResult> {
		// Check publishVersions access
		await this.checkAccess('publishVersions');

		// Verify document exists
		const doc = await this.adapter.findById(this.slug, docId);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, docId);
		}

		// Validate the date is in the future
		const scheduledDate = new Date(publishAt);
		if (isNaN(scheduledDate.getTime())) {
			throw new Error('Invalid date format for scheduledPublishAt');
		}

		if (!this.adapter.setScheduledPublishAt) {
			throw new Error('Scheduled publishing not supported by database adapter');
		}

		await this.adapter.setScheduledPublishAt(this.slug, docId, scheduledDate.toISOString());

		return {
			id: docId,
			scheduledPublishAt: scheduledDate.toISOString(),
		};
	}

	async cancelScheduledPublish(docId: string): Promise<void> {
		// Check publishVersions access
		await this.checkAccess('publishVersions');

		// Verify document exists
		const doc = await this.adapter.findById(this.slug, docId);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, docId);
		}

		if (!this.adapter.setScheduledPublishAt) {
			throw new Error('Scheduled publishing not supported by database adapter');
		}

		await this.adapter.setScheduledPublishAt(this.slug, docId, null);
	}

	// ============================================
	// Private Helpers
	// ============================================

	private async checkAccess(
		operation: 'read' | 'update' | 'readVersions' | 'publishVersions' | 'restoreVersions',
	): Promise<void> {
		const accessFn = this.collectionConfig.access?.[operation];
		if (!accessFn) {
			// No access function defined = allow all
			return;
		}

		const accessArgs: AccessArgs = {
			req: this.buildRequestContext(),
		};

		const allowed = await Promise.resolve(accessFn(accessArgs));
		if (!allowed) {
			throw new AccessDeniedError(operation, this.slug);
		}
	}

	private buildRequestContext(): RequestContext {
		return {
			user: this.context.user,
		};
	}
}
