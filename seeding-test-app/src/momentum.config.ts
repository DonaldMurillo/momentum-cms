import { defineMomentumConfig } from '@momentum-cms/core';
import { postgresAdapter } from '@momentum-cms/db-drizzle';
import { localStorageAdapter } from '@momentum-cms/storage';
import {
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaCollection,
	Users,
	HookTestItems,
} from './collections';
import { join } from 'node:path';

/**
 * Document types for type-safe seeding
 * Index signatures make them compatible with Record<string, unknown>
 */
interface CategoryDoc {
	[key: string]: unknown;
	name: string;
	slug: string;
}

interface ArticleDoc {
	[key: string]: unknown;
	title: string;
	content?: string;
	category?: string;
}

interface PageDoc {
	[key: string]: unknown;
	title: string;
	slug: string;
	content?: Array<{ blockType: string; [key: string]: unknown }>;
}

interface ProductDoc {
	[key: string]: unknown;
	name: string;
	description?: string;
	price?: number;
	seo?: {
		metaTitle?: string;
		metaDescription?: string;
		ogImage?: string;
	};
	features?: Array<{
		label: string;
		description?: string;
		highlighted?: boolean;
	}>;
}

interface SettingsDoc {
	[key: string]: unknown;
	siteName: string;
	siteDescription?: string;
	twitterHandle?: string;
	facebookUrl?: string;
	linkedinUrl?: string;
	analyticsId?: string;
	maintenanceMode?: boolean;
}

/**
 * Momentum CMS Configuration for E2E Tests
 *
 * This app tests:
 * - Seeding feature with default and custom seeds
 * - Authentication with Better Auth
 * - Password reset flow
 * - Admin UI functionality
 *
 * Note: Admin user is seeded as the first user for consistent test state.
 * User password hashing is handled by Better Auth hooks in server.ts.
 */
export default defineMomentumConfig({
	db: {
		adapter: postgresAdapter({
			connectionString:
				process.env['DATABASE_URL'] ??
				'postgresql://postgres:postgres@localhost:5432/momentum_seeding_test',
		}),
	},
	collections: [
		Categories,
		Articles,
		Products,
		Pages,
		Settings,
		Events,
		MediaCollection,
		Users,
		HookTestItems,
	],
	storage: {
		adapter: localStorageAdapter({
			directory: join(process.cwd(), 'data', 'uploads'),
		}),
	},
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Seeding Test App',
		},
	},
	server: {
		port: 4001,
		cors: {
			// WARNING: Use specific origins in production (e.g. process.env['CORS_ORIGIN'])
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization'],
		},
	},
	seeding: {
		defaults: ({ authUser, collection }) => [
			// Seed admin user first for E2E tests (synced with Better Auth)
			authUser('user-admin', {
				name: 'Test Admin',
				email: 'admin@test.com',
				password: 'TestPassword123!',
				role: 'admin',
				active: true,
			}),
			// Seed categories for testing
			collection<CategoryDoc>('categories').create('cat-tech', {
				name: 'Technology',
				slug: 'technology',
			}),
			collection<CategoryDoc>('categories').create('cat-news', {
				name: 'News',
				slug: 'news',
			}),
			collection<CategoryDoc>('categories').create('cat-sports', {
				name: 'Sports',
				slug: 'sports',
			}),
			// Seed articles for testing (published so they appear in default list queries)
			collection<ArticleDoc>('articles').create('article-welcome', {
				title: 'Welcome Article',
				content: '<p>This is a seeded <strong>welcome article</strong> for E2E testing.</p>',
				_status: 'published',
			}),
			// Seed products for group/array field testing
			collection<ProductDoc>('products').create('product-laptop', {
				name: 'Test Laptop',
				description: 'A laptop for E2E testing.',
				price: 999,
				seo: {
					metaTitle: 'Buy Test Laptop',
					metaDescription: 'The best test laptop for E2E testing.',
					ogImage: 'https://example.com/laptop.jpg',
				},
				features: [
					{ label: 'Fast Processor', description: 'Very fast CPU', highlighted: true },
					{ label: 'Lightweight', description: 'Only 2 lbs', highlighted: false },
				],
			}),
			// Seed pages for blocks field testing
			collection<PageDoc>('pages').create('page-home', {
				title: 'Home Page',
				slug: 'home',
				content: [
					{
						blockType: 'hero',
						heading: 'Welcome to Our Site',
						subheading: 'The best place for E2E testing.',
						ctaText: 'Get Started',
						ctaLink: '/getting-started',
					},
					{
						blockType: 'textBlock',
						heading: 'About Us',
						body: 'We are a test company that exists for E2E testing purposes.',
					},
					{
						blockType: 'feature',
						title: 'Fast Testing',
						description: 'Run tests at lightning speed.',
						icon: 'bolt',
					},
				],
			}),
			collection<PageDoc>('pages').create('page-about', {
				title: 'About Page',
				slug: 'about',
				content: [
					{
						blockType: 'textBlock',
						heading: 'Our Story',
						body: 'Founded in testing, built for reliability.',
					},
				],
			}),
			collection<ProductDoc>('products').create('product-phone', {
				name: 'Test Phone',
				description: 'A phone for E2E testing.',
				price: 599,
				seo: {
					metaTitle: 'Buy Test Phone',
					metaDescription: 'The best test phone.',
				},
				features: [{ label: 'Great Camera', description: '48MP sensor', highlighted: true }],
			}),
			// Seed settings for layout field testing (tabs, collapsible, row)
			collection<SettingsDoc>('settings').create('settings-main', {
				siteName: 'Test CMS Site',
				siteDescription: 'A test site for E2E layout field testing.',
				twitterHandle: '@testcms',
				facebookUrl: 'https://facebook.com/testcms',
				linkedinUrl: 'https://linkedin.com/company/testcms',
				analyticsId: 'GA-12345',
				maintenanceMode: false,
			}),
			collection<SettingsDoc>('settings').create('settings-minimal', {
				siteName: 'Minimal Site',
			}),
		],
		seed: async (ctx) => {
			// Create articles with category relationships
			const techCategory = await ctx.getSeeded<{ id: string } & CategoryDoc>('cat-tech');
			const newsCategory = await ctx.getSeeded<{ id: string } & CategoryDoc>('cat-news');

			if (techCategory) {
				await ctx.seed<ArticleDoc>({
					seedId: 'article-tech-1',
					collection: 'articles',
					data: {
						title: 'First Tech Article',
						content: '<p>Article about <em>technology</em> for E2E testing.</p>',
						category: techCategory.id,
						_status: 'published',
					},
				});

				await ctx.seed<ArticleDoc>({
					seedId: 'article-tech-2',
					collection: 'articles',
					data: {
						title: 'Second Tech Article',
						content: '<p>Another tech article for testing pagination.</p>',
						category: techCategory.id,
						_status: 'published',
					},
				});
			}

			if (newsCategory) {
				await ctx.seed<ArticleDoc>({
					seedId: 'article-news-1',
					collection: 'articles',
					data: {
						title: 'Breaking News',
						content: '<p>Important news article for testing.</p>',
						category: newsCategory.id,
						_status: 'published',
					},
				});
			}

			ctx.log('Custom seeding complete - created category-linked articles');
		},
		options: {
			runOnStart: 'always', // Always run for E2E testing
			onConflict: 'skip', // Idempotent by default
			quiet: false, // Show seeding logs for debugging
		},
	},
});
