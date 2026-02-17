import {
	defineCollection,
	text,
	textarea,
	checkbox,
	tabs,
	collapsible,
	row,
	allowAll,
} from '@momentumcms/core';

/**
 * Settings collection for testing layout field renderers (tabs, collapsible, row).
 *
 * Layout fields organize form UI but don't store data themselves.
 * Unnamed tabs hoist data fields to the top level.
 * Named tabs (with a `name` property) create nested data, like group fields.
 */
export const Settings = defineCollection({
	slug: 'settings',
	labels: {
		singular: 'Setting',
		plural: 'Settings',
	},
	fields: [
		tabs('settingsTabs', {
			label: 'Site Settings',
			tabs: [
				{
					label: 'General',
					fields: [
						text('siteName', { required: true, label: 'Site Name' }),
						textarea('siteDescription', { label: 'Site Description' }),
					],
				},
				{
					label: 'Social',
					fields: [
						row('socialRow', {
							label: 'Social Profiles',
							fields: [
								text('twitterHandle', { label: 'Twitter Handle' }),
								text('facebookUrl', { label: 'Facebook URL' }),
							],
						}),
						text('linkedinUrl', { label: 'LinkedIn URL' }),
					],
				},
				{
					name: 'notifications',
					label: 'Notifications',
					description: 'Configure notification preferences.',
					fields: [
						checkbox('emailEnabled', { label: 'Email Notifications Enabled' }),
						text('emailFrom', { label: 'Sender Email Address' }),
					],
				},
			],
		}),
		collapsible('advanced', {
			label: 'Advanced Settings',
			description: 'These settings are for advanced users.',
			fields: [
				text('analyticsId', { label: 'Analytics ID' }),
				checkbox('maintenanceMode', { label: 'Maintenance Mode' }),
			],
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
