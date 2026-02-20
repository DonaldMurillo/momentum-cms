/**
 * Test collections for migration integration tests.
 * Re-exports shared collections and defines mutation scenarios.
 */
import { collections } from '@momentumcms/example-config/collections';
import { defineCollection, text, number, select, relationship } from '@momentumcms/core';

/**
 * All shared example collections.
 */
export { collections };

/**
 * A simple test collection used as a "before" state for diff testing.
 */
export const SimpleBeforeCollection = defineCollection({
	slug: 'diff-test',
	fields: [text('title', { required: true }), text('description'), number('order')],
});

/**
 * The same collection with modifications — "after" state for diff testing.
 * Changes: added 'status' field, removed 'order', changed 'description' to required.
 */
export const SimpleAfterCollection = defineCollection({
	slug: 'diff-test',
	fields: [
		text('title', { required: true }),
		text('description', { required: true }),
		select('status', { options: ['draft', 'published', 'archived'] }),
	],
});

/**
 * Collection with relationships for FK testing.
 */
export const RelTestParent = defineCollection({
	slug: 'rel-parent',
	fields: [text('name', { required: true })],
});

export const RelTestChild = defineCollection({
	slug: 'rel-child',
	fields: [
		text('label', { required: true }),
		relationship('parent', { collection: () => RelTestParent }),
	],
});
