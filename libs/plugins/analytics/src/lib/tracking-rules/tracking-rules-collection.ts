/**
 * Tracking Rules Collection
 *
 * Collection definition for admin-managed element tracking rules.
 * Injected into the collections array by the analytics plugin during onInit.
 */

import {
	defineCollection,
	text,
	select,
	json,
	checkbox,
	number,
	hasRole,
} from '@momentum-cms/core';

/**
 * Tracking Rules collection config.
 * Defines the schema for admin-managed CSS selector tracking rules.
 */
export const TrackingRules = defineCollection({
	slug: 'tracking-rules',
	labels: {
		singular: 'Tracking Rule',
		plural: 'Tracking Rules',
	},
	admin: {
		useAsTitle: 'name',
		group: 'Analytics',
		defaultColumns: ['name', 'selector', 'eventType', 'urlPattern', 'active'],
	},
	fields: [
		text('name', { required: true, label: 'Rule Name' }),
		text('selector', {
			required: true,
			label: 'CSS Selector',
			description:
				'CSS selector to match elements (e.g., ".cta-button", "#signup-form"). ' +
				'Selectors targeting password, hidden, or credit card fields are blocked.',
		}),
		select('eventType', {
			required: true,
			label: 'Event Type',
			options: [
				{ label: 'Click', value: 'click' },
				{ label: 'Submit', value: 'submit' },
				{ label: 'Scroll Into View', value: 'scroll-into-view' },
				{ label: 'Hover', value: 'hover' },
				{ label: 'Focus', value: 'focus' },
			],
			defaultValue: 'click',
		}),
		text('eventName', {
			required: true,
			label: 'Event Name',
			description: 'Analytics event name to fire (e.g., "cta_click", "form_submit")',
		}),
		text('urlPattern', {
			required: true,
			label: 'URL Pattern',
			description: 'URL pattern to match pages. Use * for wildcards (e.g., "/blog/*", "*" for all)',
			defaultValue: '*',
		}),
		json('properties', {
			label: 'Static Properties',
			description: 'Key-value pairs attached to every event',
		}),
		json('extractProperties', {
			label: 'Extract Properties',
			description:
				'Extract dynamic values from matched DOM elements. ' +
				'Extraction of "value", "password", and "autocomplete" attributes is blocked. ' +
				'Values are truncated to 200 characters.',
		}),
		checkbox('active', { label: 'Active', defaultValue: true }),
		number('rateLimit', {
			label: 'Rate Limit',
			description: 'Max events per minute per visitor (leave empty for unlimited)',
			admin: { position: 'sidebar' },
		}),
	],
	access: {
		read: () => true, // Public: client-side rule engine fetches rules without auth
		create: hasRole('admin'),
		update: hasRole('admin'),
		delete: hasRole('admin'),
		admin: hasRole('admin'),
	},
});
