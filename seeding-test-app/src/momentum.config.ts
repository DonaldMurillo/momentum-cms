import { defineMomentumConfig } from '@momentum-cms/core';
import { postgresAdapter } from '@momentum-cms/db-drizzle';
import { Categories, Articles, Users } from './collections';

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

/**
 * Momentum CMS Configuration for E2E Tests
 *
 * This app tests:
 * - Seeding feature with default and custom seeds
 * - Authentication with Better Auth
 * - Password reset flow
 * - Admin UI functionality
 *
 * Note: Admin users are created via the setup page flow (not seeded)
 * because Better Auth handles password hashing internally.
 * Collection data is seeded for consistent test state.
 */
export default defineMomentumConfig({
	db: {
		adapter: postgresAdapter({
			connectionString:
				process.env['DATABASE_URL'] ??
				'postgresql://postgres:postgres@localhost:5434/momentum_seeding_test',
		}),
	},
	collections: [Categories, Articles, Users],
	admin: {
		basePath: '/admin',
		branding: {
			title: 'Seeding Test App',
		},
	},
	server: {
		port: 4001,
		cors: {
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization'],
		},
	},
	seeding: {
		defaults: ({ collection }) => [
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
			// Seed articles for testing
			collection<ArticleDoc>('articles').create('article-welcome', {
				title: 'Welcome Article',
				content: 'This is a seeded welcome article for E2E testing.',
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
						content: 'Article about technology for E2E testing.',
						category: techCategory.id,
					},
				});

				await ctx.seed<ArticleDoc>({
					seedId: 'article-tech-2',
					collection: 'articles',
					data: {
						title: 'Second Tech Article',
						content: 'Another tech article for testing pagination.',
						category: techCategory.id,
					},
				});
			}

			if (newsCategory) {
				await ctx.seed<ArticleDoc>({
					seedId: 'article-news-1',
					collection: 'articles',
					data: {
						title: 'Breaking News',
						content: 'Important news article for testing.',
						category: newsCategory.id,
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
