import { defineCollection, text, json, select, number, checkbox, tabs } from '@momentumcms/core';
import { hasRole } from '@momentumcms/core';

/**
 * Forms collection.
 *
 * Stores form definitions (schema, settings, webhooks) that power
 * both the headless API and the headed form-block rendering.
 */
export const FormsCollection = defineCollection({
	slug: 'forms',
	labels: { singular: 'Form', plural: 'Forms' },
	admin: {
		group: 'Content',
		useAsTitle: 'title',
		defaultColumns: ['title', 'slug', 'status', 'submissionCount', 'updatedAt'],
		pagination: { defaultLimit: 25 },
	},
	fields: [
		tabs('formTabs', {
			tabs: [
				{
					label: 'Form',
					fields: [
						text('title', { required: true, label: 'Title' }),
						text('slug', {
							required: true,
							unique: true,
							label: 'Slug',
							description: 'URL-friendly identifier used in the API (e.g. contact-us)',
							admin: { placeholder: 'contact-us' },
						}),
						select('status', {
							required: true,
							defaultValue: 'draft',
							label: 'Status',
							options: [
								{ label: 'Draft', value: 'draft' },
								{ label: 'Published', value: 'published' },
								{ label: 'Archived', value: 'archived' },
							],
						}),
						json('schema', {
							required: true,
							label: 'Form Schema',
							description: 'JSON schema that defines form fields, steps, and settings',
							admin: { editor: 'form-builder' },
						}),
					],
				},
				{
					label: 'Settings',
					fields: [
						text('description', { label: 'Description' }),
						text('successMessage', {
							label: 'Success Message',
							defaultValue: 'Thank you for your submission!',
						}),
						text('redirectUrl', {
							label: 'Redirect URL',
							description: 'Optional URL to redirect to after submission',
						}),
						checkbox('honeypot', {
							defaultValue: true,
							label: 'Enable Honeypot',
							description: 'Adds an invisible anti-spam field to the form',
						}),
						json('webhooks', {
							label: 'Webhooks',
							description: 'Array of webhook URLs to notify on form submission',
							defaultValue: [],
						}),
						number('submissionCount', {
							defaultValue: 0,
							label: 'Submission Count',
							admin: { readOnly: true },
						}),
					],
				},
			],
		}),
	],
	indexes: [
		{ columns: ['slug'], name: 'idx_forms_slug', unique: true },
		{ columns: ['status'], name: 'idx_forms_status' },
	],
	access: {
		read: hasRole('admin'),
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
	},
});
