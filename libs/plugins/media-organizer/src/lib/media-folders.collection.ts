import { defineCollection, text, relationship } from '@momentumcms/core';
import type { HookFunction } from '@momentumcms/core';

/**
 * Prevents a folder from being set as its own parent.
 * Deep cycle detection (A→B→C→A) requires DB access which hooks don't have —
 * that's enforced client-side by excluding descendants from the parent dropdown.
 */
export const preventFolderCycle: HookFunction = ({ data, doc }) => {
	if (!data || !data['parent']) return data;

	const rawId = doc?.['id'];
	const folderId = typeof rawId === 'string' ? rawId : undefined;
	if (!folderId) return data; // new folder, no cycle possible

	const parentId = String(data['parent']);

	if (parentId === folderId) {
		throw new Error('A folder cannot be its own parent');
	}

	return data;
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
	],
	indexes: [{ columns: ['name', 'parent'], unique: true }],
	hooks: {
		beforeChange: [preventFolderCycle],
	},
	access: {
		read: () => true,
		create: ({ req }) => !!req?.user,
		update: ({ req }) => !!req?.user,
		delete: ({ req }) => !!req?.user,
	},
});
