import { defineCollection, text, email, number, select, array, allowAll } from '@momentum-cms/core';
import type { FieldHookFunction } from '@momentum-cms/core';

/**
 * In-memory field hook invocation log for E2E testing.
 * Tracks every field-level hook call so tests can verify behavior.
 */
export interface FieldHookInvocation {
	hookType: string;
	fieldName: string;
	operation?: string;
	value?: unknown;
	timestamp: number;
}

const fieldHookInvocations: FieldHookInvocation[] = [];

/** Get the current field hook invocation log. */
export function getFieldHookLog(): FieldHookInvocation[] {
	return fieldHookInvocations;
}

/** Clear all field hook invocations. */
export function clearFieldHookLog(): void {
	fieldHookInvocations.length = 0;
}

/**
 * Field hook: auto-generate slug from title.
 * Only runs if slug is not already set.
 */
const autoSlugFromTitle: FieldHookFunction = ({ value, data }) => {
	if (value) return value; // Don't overwrite explicit slug
	const title = data['title'];
	if (typeof title === 'string') {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}
	return value;
};

/**
 * Field hook: trim whitespace and lowercase.
 */
const trimAndLowercase: FieldHookFunction = ({ value }) => {
	if (typeof value === 'string') {
		return value.trim().toLowerCase();
	}
	return value;
};

/**
 * Field hook: default viewCount to 0 when reading.
 */
const defaultToZero: FieldHookFunction = ({ value }) => {
	if (value === null || value === undefined) {
		return 0;
	}
	return value;
};

/**
 * Helper: check if user is admin from request context.
 */
function isAdmin({ req }: { req: unknown }): boolean {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing untyped request context
	const r = req as { user?: { role?: string } } | undefined;
	return r?.user?.role === 'admin';
}

/**
 * Collection for E2E testing of field-level validation, access control, and hooks.
 *
 * Fields are organized into three groups:
 * 1. Validation fields - test minLength, maxLength, min, max, step, email, select options, array rows
 * 2. Field-level access fields - test create/read/update access per field
 * 3. Field-level hook fields - test beforeValidate, beforeChange, afterRead hooks
 */
export const FieldTestItems = defineCollection({
	slug: 'field-test-items',
	labels: {
		singular: 'Field Test Item',
		plural: 'Field Test Items',
	},
	fields: [
		// === Validation fields ===
		text('title', { required: true, minLength: 3, maxLength: 100 }),
		text('code', { required: true, minLength: 2, maxLength: 10 }),
		email('contactEmail'),
		number('rating', { min: 1, max: 5, step: 1 }),
		number('price', { min: 0 }),
		select('status', {
			options: [
				{ label: 'Active', value: 'active' },
				{ label: 'Draft', value: 'draft' },
				{ label: 'Archived', value: 'archived' },
			],
			required: true,
		}),
		array('tags', {
			fields: [text('label', { required: true })],
			minRows: 1,
			maxRows: 5,
		}),

		// === Field-level access fields ===
		text('adminNotes', {
			access: {
				read: isAdmin,
				create: isAdmin,
				update: isAdmin,
			},
		}),
		text('internalCode', {
			access: {
				read: isAdmin,
				create: () => true,
				update: () => false, // Never updatable
			},
		}),
		number('internalScore', {
			access: {
				read: () => false, // Always hidden from responses
			},
		}),

		// === Field-level hook fields ===
		text('slug', {
			hooks: {
				beforeValidate: [
					(args) => {
						fieldHookInvocations.push({
							hookType: 'beforeValidate',
							fieldName: 'slug',
							operation: args.operation,
							value: args.value,
							timestamp: Date.now(),
						});
						return autoSlugFromTitle(args);
					},
				],
			},
		}),
		text('normalizedTitle', {
			hooks: {
				beforeChange: [
					(args) => {
						fieldHookInvocations.push({
							hookType: 'beforeChange',
							fieldName: 'normalizedTitle',
							operation: args.operation,
							value: args.value,
							timestamp: Date.now(),
						});
						return trimAndLowercase(args);
					},
				],
			},
		}),
		number('viewCount', {
			hooks: {
				afterRead: [
					(args) => {
						fieldHookInvocations.push({
							hookType: 'afterRead',
							fieldName: 'viewCount',
							operation: args.operation,
							value: args.value,
							timestamp: Date.now(),
						});
						return defaultToZero(args);
					},
				],
			},
		}),
	],
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
});
