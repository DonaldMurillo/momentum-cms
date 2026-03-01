import { defineCollection, text, json } from '@momentumcms/core';
import { hasRole } from '@momentumcms/core';

/**
 * Form submissions collection.
 *
 * Stores individual submission records for forms.
 * Public users can create submissions (via the submit endpoint),
 * but only admins can read/update/delete them.
 */
export const FormSubmissionsCollection = defineCollection({
	slug: 'form-submissions',
	labels: { singular: 'Submission', plural: 'Submissions' },
	admin: {
		group: 'Content',
		useAsTitle: 'formSlug',
		defaultColumns: ['formSlug', 'formTitle', 'createdAt'],
		pagination: { defaultLimit: 50 },
	},
	fields: [
		text('formId', { required: true, label: 'Form ID' }),
		text('formSlug', { required: true, label: 'Form Slug' }),
		text('formTitle', { label: 'Form Title' }),
		json('data', {
			required: true,
			label: 'Submission Data',
			description: 'The submitted form field values',
		}),
		json('metadata', {
			label: 'Metadata',
			description: 'Request metadata (IP, user-agent, etc.)',
		}),
	],
	indexes: [
		{ columns: ['formId'], name: 'idx_form_submissions_form_id' },
		{ columns: ['formSlug'], name: 'idx_form_submissions_form_slug' },
	],
	access: {
		read: hasRole('admin'),
		create: () => true, // Public: submissions are created via the submit endpoint
		update: hasRole('admin'),
		delete: hasRole('admin'),
	},
});
