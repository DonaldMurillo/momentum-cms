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
 * All data fields (siteName, siteDescription, etc.) are stored at the
 * top level in the database, not nested under layout field names.
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
