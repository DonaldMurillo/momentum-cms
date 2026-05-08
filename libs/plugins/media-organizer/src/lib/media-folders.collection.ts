import { defineCollection, text, relationship } from '@momentumcms/core';
import type { HookFunction } from '@momentumcms/core';

const ROOT_FOLDER_PARENT = '__root__';

interface CollectionFindResult<T> {
	docs: T[];
}

interface CollectionApiLike {
	collection<T extends Record<string, unknown>>(
		slug: string,
	): {
		find(options?: Record<string, unknown>): Promise<CollectionFindResult<T>>;
	};
}

function isCollectionApiLike(value: unknown): value is CollectionApiLike {
	if (!value || typeof value !== 'object') {
		return false;
	}

	return 'collection' in value && typeof value.collection === 'function';
}

function resolveFolderId(originalDoc: Record<string, unknown> | undefined): string | undefined {
	const rawId = originalDoc?.['id'];
	return typeof rawId === 'string' ? rawId : undefined;
}

function resolveParentValue(
	data: Record<string, unknown> | undefined,
	originalDoc: Record<string, unknown> | undefined,
): string | null {
	const rawParent = data?.['parent'] !== undefined ? data['parent'] : originalDoc?.['parent'];

	if (rawParent == null || rawParent === '') {
		return null;
	}

	return String(rawParent);
}

const MAX_ANCESTOR_DEPTH = 50;

/**
 * Prevents a folder from being set as its own parent or any of its descendants
 * (transitive cycle detection). Walks the ancestor chain via req.api when available.
 */
export const preventFolderCycle: HookFunction = async ({ data, originalDoc, req }) => {
	const parentId = resolveParentValue(data, originalDoc);
	if (!parentId) return data;

	const folderId = resolveFolderId(originalDoc);
	if (folderId && parentId === folderId) {
		throw new Error('A folder cannot be its own parent');
	}

	// Deep cycle detection: walk the ancestor chain if API is available
	if (folderId && isCollectionApiLike(req.api)) {
		let currentParentId: string | null = parentId;

		for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && currentParentId; depth++) {
			const result = await req.api
				.collection<{ id?: string; parent?: string | null }>('media-folders')
				.find({ where: { id: { equals: currentParentId } }, limit: 1 });

			const ancestor = result.docs[0];
			if (!ancestor) break;

			const ancestorParent = ancestor.parent ?? null;
			if (ancestorParent === folderId) {
				throw new Error('Setting this parent would create a cycle in the folder hierarchy');
			}

			currentParentId = typeof ancestorParent === 'string' ? ancestorParent : null;
		}

		if (currentParentId) {
			throw new Error('Folder hierarchy is too deep or contains a cycle');
		}
	}

	return data;
};

/**
 * Reject duplicate sibling folder names, including root folders where SQL UNIQUE
 * indexes allow multiple NULL parent values.
 */
export const preventDuplicateSiblingFolderName: HookFunction = async ({
	data,
	originalDoc,
	req,
}) => {
	if (!data?.['name']) return data;

	if (!isCollectionApiLike(req.api)) return data;

	const folderId = resolveFolderId(originalDoc);
	const parentId = resolveParentValue(data, originalDoc);
	const existing = await req.api
		.collection<{ id?: string; parent?: string | null }>('media-folders')
		.find({
			where: {
				name: { equals: data['name'] },
			},
			limit: 10,
		});

	const duplicate = existing.docs.some((folder) => {
		if (!folder.id || folder.id === folderId) return false;
		return (folder.parent ?? null) === parentId;
	});

	if (duplicate) {
		throw new Error('A folder with this name already exists in the selected parent');
	}

	return {
		...data,
		parentKey: parentId ?? ROOT_FOLDER_PARENT,
	};
};

/**
 * Media Folders collection for organizing media assets into a tree structure.
 */
export const MediaFoldersCollection = defineCollection({
	slug: 'media-folders',
	labels: {
		singular: 'Media Folder',
		plural: 'Media Folders',
	},
	admin: {
		useAsTitle: 'name',
		group: 'Media',
		hidden: true,
	},
	fields: [
		text('name', { required: true, label: 'Folder Name' }),
		relationship('parent', {
			collection: () => MediaFoldersCollection,
			onDelete: 'set-null',
			label: 'Parent Folder',
		}),
		text('parentKey', {
			defaultValue: ROOT_FOLDER_PARENT,
			admin: { hidden: true },
		}),
	],
	indexes: [{ columns: ['name', 'parentKey'], unique: true }],
	hooks: {
		beforeChange: [preventFolderCycle, preventDuplicateSiblingFolderName],
	},
	access: {
		read: () => true,
		create: ({ req }) => !!req?.user,
		update: ({ req }) => !!req?.user,
		delete: ({ req }) => !!req?.user,
	},
});
