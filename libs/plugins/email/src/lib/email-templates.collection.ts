import { defineCollection, text, json, checkbox, hasRole } from '@momentumcms/core';

/**
 * Email Templates collection — stores email templates as JSON block arrays
 * that can be edited with the visual email builder.
 *
 * System templates (isSystem: true) are seeded on first run and cannot be deleted.
 */
export const EmailTemplatesCollection = defineCollection({
	slug: 'email-templates',
	labels: {
		singular: 'Email Template',
		plural: 'Email Templates',
	},
	admin: {
		group: 'Settings',
		useAsTitle: 'name',
		defaultColumns: ['name', 'slug', 'isSystem', 'updatedAt'],
		preview: true,
	},
	fields: [
		text('name', {
			required: true,
			label: 'Template Name',
		}),
		text('slug', {
			required: true,
			unique: true,
			label: 'Template Slug',
			description: 'System identifier (e.g., "password-reset", "verification")',
		}),
		text('subject', {
			required: true,
			label: 'Email Subject',
			description: 'Supports {{variables}} — e.g., "Reset your password - {{appName}}"',
		}),
		json('emailBlocks', {
			label: 'Email Content',
			admin: { editor: 'email-builder' },
		}),
		checkbox('isSystem', {
			label: 'System Template',
			defaultValue: false,
			admin: { readOnly: true },
			description: 'System templates are seeded by the platform and cannot be deleted.',
		}),
	],
	access: {
		read: hasRole('admin'),
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
	},
});
