import { defineCollection, text, select, checkbox } from '@momentumcms/core';

const UNSAFE_SCHEME_REGEX = /^(javascript|data|vbscript):/i;
const CRLF_REGEX = /[\r\n]/;

function validateFromPath(value: unknown): string | true {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return 'From Path is required';
	}
	if (!value.startsWith('/')) {
		return 'From Path must start with /';
	}
	if (value.includes('?')) {
		return 'From Path must not contain query strings';
	}
	if (value.includes('#')) {
		return 'From Path must not contain fragments';
	}
	return true;
}

function validateToTarget(value: unknown, args: { data: Record<string, unknown> }): string | true {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return 'To Path / URL is required';
	}
	if (UNSAFE_SCHEME_REGEX.test(value)) {
		return 'Unsafe URL scheme — only http://, https://, or relative paths are allowed';
	}
	if (value.startsWith('//')) {
		return 'Protocol-relative URLs are not allowed';
	}
	if (CRLF_REGEX.test(value)) {
		return 'URL must not contain line break characters';
	}
	if (args.data['from'] && value === args.data['from']) {
		return 'To path must differ from From path to prevent redirect loops';
	}
	return true;
}

export const RedirectsCollection = defineCollection({
	slug: 'redirects',
	labels: {
		singular: 'Redirect',
		plural: 'Redirects',
	},
	fields: [
		text('from', { required: true, label: 'From Path', validate: validateFromPath }),
		text('to', { required: true, label: 'To Path / URL', validate: validateToTarget }),
		select('type', {
			label: 'Status Code',
			options: [
				{ label: '301 — Permanent', value: 'permanent' },
				{ label: '302 — Temporary', value: 'temporary' },
				{ label: '307 — Temporary (Preserve Method)', value: 'temporary_preserve' },
				{ label: '308 — Permanent (Preserve Method)', value: 'permanent_preserve' },
			],
			defaultValue: 'permanent',
		}),
		checkbox('active', { label: 'Active', defaultValue: true }),
	],
	indexes: [{ columns: ['from'], unique: true }],
	access: {
		read: () => true,
		create: ({ req }) => req?.user?.role === 'admin',
		update: ({ req }) => req?.user?.role === 'admin',
		delete: ({ req }) => req?.user?.role === 'admin',
	},
	admin: {
		useAsTitle: 'from',
		group: 'Settings',
	},
});
