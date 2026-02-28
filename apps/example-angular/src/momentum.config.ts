import { defineMomentumConfig } from '@momentumcms/core';
import { postgresAdapter } from '@momentumcms/db-drizzle';
import type { PostgresAdapterWithRaw } from '@momentumcms/db-drizzle';
import { momentumAuth } from '@momentumcms/auth';
import { localStorageAdapter } from '@momentumcms/storage';
import { eventBusPlugin } from '@momentumcms/plugins/core';
import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentumcms/plugins/analytics';
import { seoPlugin } from '@momentumcms/plugins/seo';
import { redirectsPlugin } from '@momentumcms/plugins/redirects';
import {
	emailPlugin,
	createFindEmailTemplate,
	emailTemplateSeedData,
} from '@momentumcms/plugins/email';
import { postgresQueueAdapter } from '@momentumcms/queue';
import { queuePlugin } from '@momentumcms/plugins/queue';
import { cronPlugin } from '@momentumcms/plugins/cron';
import { formBuilderPlugin } from '@momentumcms/plugins-form-builder';
import { join } from 'node:path';
import { collections } from '@momentumcms/example-config/collections';
import { globals } from '@momentumcms/example-config/globals';
import { exampleSeedingConfig } from '@momentumcms/example-config';

/**
 * Database adapter — shared between Momentum and the auth plugin.
 */
const dbAdapter = postgresAdapter({
	connectionString:
		process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/momentum',
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PostgresAdapter implements PostgresAdapterWithRaw
const pool = (dbAdapter as PostgresAdapterWithRaw).getPool();

const authBaseURL =
	process.env['BETTER_AUTH_URL'] || `http://localhost:${process.env['PORT'] || 4000}`;

/**
 * Email template management plugin.
 */
export const email = emailPlugin();

/**
 * Auth plugin — manages Better Auth integration, user tables, and middleware.
 */
export const authPlugin = momentumAuth({
	db: { type: 'postgres', pool },
	baseURL: authBaseURL,
	trustedOrigins: ['http://localhost:4200', authBaseURL],
	email: {
		appName: 'Momentum CMS',
		findEmailTemplate: createFindEmailTemplate(email),
	},
});

/**
 * Plugin instances — exported for test endpoint wiring in server.ts.
 */
export const analyticsAdapter = new MemoryAnalyticsAdapter();
export const events = eventBusPlugin();
export const analytics = analyticsPlugin({
	adapter: analyticsAdapter,
	trackCollections: true,
	trackApi: true,
	trackPageViews: {
		contentRoutes: {
			articles: '/articles/:slug',
			categories: '/categories/:slug',
			pages: '/:slug',
		},
	},
	flushInterval: 1000, // 1s for fast E2E feedback
	flushBatchSize: 10,
	ingestRateLimit: 10, // Low for rate-limiting E2E test
	excludeCollections: ['_seed_tracking'],
	adminDashboard: true,
	trackingRules: { cacheTtl: 0 }, // No cache for E2E testing
});

export const redirects = redirectsPlugin({
	cacheTtl: 0, // No cache for E2E testing
});

/**
 * Queue plugin — persistent job queue with PostgreSQL SKIP LOCKED.
 */
export const queue = queuePlugin({
	adapter: postgresQueueAdapter({ pool }),
	workers: { default: { concurrency: 2 } },
});

/**
 * Cron plugin — recurring job scheduler.
 */
export const cron = cronPlugin({
	queue,
	schedules: [],
	checkInterval: 60000,
});

/**
 * Form builder plugin — dynamic forms, submissions, and webhooks.
 */
export const forms = formBuilderPlugin({
	honeypot: true,
	rateLimitPerMinute: 10,
});

export const seo = seoPlugin({
	collections: ['categories', 'articles', 'pages'],
	siteUrl: `http://localhost:${process.env['PORT'] || 4000}`,
	analysis: true,
	sitemap: true,
	robots: true,
	metaApi: true,
	adminDashboard: true,
});

/**
 * Momentum CMS configuration.
 *
 * Collections, globals, and seeding data are imported from @momentumcms/example-config.
 * DB adapter, auth, and plugins are configured here since they depend on runtime env vars.
 */
const config = defineMomentumConfig({
	db: { adapter: dbAdapter },
	collections,
	globals,
	storage: {
		adapter: localStorageAdapter({
			directory: join(process.cwd(), 'data', 'uploads'),
		}),
	},
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Momentum CMS',
		},
	},
	server: {
		port: Number(process.env['PORT']) || 4000,
		cors: {
			// WARNING: Use specific origins in production (e.g. process.env['CORS_ORIGIN'])
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization', 'X-API-Key'],
		},
	},
	logging: {
		level: 'debug',
		format: 'pretty',
	},
	plugins: [events, analytics, seo, redirects, email, authPlugin, queue, cron, forms],
	seeding: {
		...exampleSeedingConfig,
		defaults: (helpers) => [
			...(exampleSeedingConfig.defaults?.(helpers) ?? []),
			...emailTemplateSeedData.map((data) =>
				helpers
					.collection<Record<string, unknown>>('email-templates')
					.create(`email-tpl-${data['slug']}`, data, { onConflict: 'skip' }),
			),
			// Seed a contact form for E2E testing
			helpers.collection<Record<string, unknown>>('forms').create(
				'form-contact',
				{
					title: 'Contact Us',
					slug: 'contact-us',
					description: 'Get in touch with our team.',
					status: 'published',
					schema: {
						id: 'contact-us',
						title: 'Contact Us',
						description: 'Get in touch with our team.',
						fields: [
							{
								name: 'name',
								type: 'text',
								label: 'Full Name',
								required: true,
								placeholder: 'Your name',
							},
							{
								name: 'email',
								type: 'email',
								label: 'Email Address',
								required: true,
								placeholder: 'your@email.com',
							},
							{
								name: 'subject',
								type: 'select',
								label: 'Subject',
								required: true,
								options: [
									{ label: 'General Inquiry', value: 'general' },
									{ label: 'Support', value: 'support' },
									{ label: 'Feedback', value: 'feedback' },
								],
							},
							{
								name: 'message',
								type: 'textarea',
								label: 'Message',
								required: true,
								placeholder: 'Tell us more...',
								rows: 5,
							},
						],
						settings: {
							submitLabel: 'Send Message',
							successMessage: 'Thank you for contacting us! We will get back to you soon.',
						},
					},
					webhooks: [],
					honeypot: true,
					successMessage: 'Thank you for contacting us!',
					submissionCount: 0,
				},
				{ onConflict: 'skip' },
			),
		],
		seed: async (ctx) => {
			// Run existing example seed function first (creates articles with category relationships)
			await exampleSeedingConfig.seed?.(ctx);

			// Seed the /contact page with all blocks (hero + textBlock + form + callToAction)
			const contactForm = await ctx.getSeeded('form-contact');
			if (contactForm) {
				await ctx.seed({
					seedId: 'page-contact',
					collection: 'pages',
					data: {
						title: 'Contact Page',
						slug: 'contact',
						content: [
							{
								blockType: 'hero',
								heading: 'Get in Touch',
								subheading: 'We would love to hear from you.',
							},
							{
								blockType: 'textBlock',
								heading: 'Contact Information',
								body: 'Reach out to us via email at hello@momentum-cms.dev or visit our offices during business hours. We typically respond within 24 hours.',
							},
							{
								blockType: 'form',
								form: contactForm.id,
								showHoneypot: true,
							},
							{
								blockType: 'callToAction',
								heading: 'Send Us a Message',
								description: 'Have a specific project in mind? Let us know the details.',
								primaryButtonText: 'View Services',
								primaryButtonLink: '/services',
							},
						],
					},
				});
			}
		},
	},
});

export default config;
