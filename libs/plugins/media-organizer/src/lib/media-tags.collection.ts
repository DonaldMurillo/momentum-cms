import { defineCollection, text } from '@momentumcms/core';
import type { HookFunction } from '@momentumcms/core';

type MediaDoc = Record<string, unknown> & {
	id?: string;
	tags?: unknown[];
};

interface MediaCollectionApiLike {
	collection<T extends Record<string, unknown>>(
		slug: string,
	): {
		find(options?: Record<string, unknown>): Promise<{ docs: T[] }>;
		update(id: string, data: Partial<T>): Promise<T>;
	};
}

function isMediaCollectionApiLike(value: unknown): value is MediaCollectionApiLike {
	if (!value || typeof value !== 'object') {
		return false;
	}

	return 'collection' in value && typeof value.collection === 'function';
}

function resolveTagId(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value;
	}

	if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
		return value.id;
	}

	return undefined;
}

const MAX_CLEANUP_PAGES = 100;

const _uploadCollectionSlugs = new Set<string>(['media']);

/**
 * Register the slugs of all upload collections that have tags fields.
 * Called by the media-organizer plugin during modifyCollections.
 */
export function registerUploadCollectionSlugs(slugs: string[]): void {
	_uploadCollectionSlugs.clear();
	for (const slug of slugs) {
		_uploadCollectionSlugs.add(slug);
	}
}

const removeDeletedTagFromMedia: HookFunction = async ({ doc, req }) => {
	const tagId = typeof doc?.['id'] === 'string' ? doc['id'] : undefined;
	if (!tagId || !isMediaCollectionApiLike(req.api)) return;

	for (const slug of _uploadCollectionSlugs) {
		const collectionApi = req.api.collection<MediaDoc>(slug);
		await cleanupTagFromCollection(collectionApi, tagId);
	}
};

async function cleanupTagFromCollection(
	collectionApi: ReturnType<MediaCollectionApiLike['collection']>,
	tagId: string,
): Promise<void> {
	for (let iteration = 0; iteration < MAX_CLEANUP_PAGES; iteration += 1) {
		const { docs } = await collectionApi.find({
			limit: 100,
			page: 1,
			where: { tags: { in: [tagId] } },
		});
		if (docs.length === 0) {
			return;
		}

		await Promise.all(
			docs
				.filter(
					(media): media is MediaDoc & { id: string } =>
						typeof media['id'] === 'string' && Array.isArray(media['tags']),
				)
				.map((media) =>
					collectionApi.update(media.id, {
						tags: media.tags
							?.map(resolveTagId)
							.filter((value): value is string => value !== undefined && value !== tagId),
					}),
				),
		);
	}
}

/**
 * Media Tags collection for tagging media assets.
 */
export const MediaTagsCollection = defineCollection({
	slug: 'media-tags',
	labels: {
		singular: 'Media Tag',
		plural: 'Media Tags',
	},
	admin: {
		useAsTitle: 'name',
		group: 'Media',
		hidden: true,
	},
	fields: [
		text('name', { required: true, label: 'Tag Name' }),
		text('color', { label: 'Color', description: 'Hex color for visual distinction' }),
	],
	indexes: [{ columns: ['name'], unique: true }],
	hooks: {
		afterDelete: [removeDeletedTagFromMedia],
	},
	access: {
		read: () => true,
		create: ({ req }) => !!req?.user,
		update: ({ req }) => !!req?.user,
		delete: ({ req }) => !!req?.user,
	},
});
