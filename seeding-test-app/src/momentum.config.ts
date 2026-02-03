import { defineMomentumConfig } from '@momentum-cms/core';
import { postgresAdapter } from '@momentum-cms/db-drizzle';
import { Categories, Articles } from './collections';

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
 * Momentum CMS Configuration for Seeding E2E Tests
 *
 * This app tests the seeding feature with:
 * - Default seeds via helpers
 * - Custom seed function with dependency resolution
 * - Relationship seeding between collections
 */
export default defineMomentumConfig({
	db: {
		adapter: postgresAdapter({
			connectionString:
				process.env['DATABASE_URL'] ??
				'postgresql://postgres:postgres@localhost:5434/momentum_seeding_test',
		}),
	},
	collections: [Categories, Articles],
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
			// Test basic collection seeding
			collection<CategoryDoc>('categories').create('cat-tech', {
				name: 'Technology',
				slug: 'technology',
			}),
			collection<CategoryDoc>('categories').create('cat-news', {
				name: 'News',
				slug: 'news',
			}),
			// Test seeding without relationship (will be linked in custom seed)
			collection<ArticleDoc>('articles').create('article-welcome', {
				title: 'Welcome Article',
				content: 'This is a seeded welcome article.',
			}),
		],
		seed: async (ctx) => {
			// Test getSeeded() dependency resolution
			const techCategory = await ctx.getSeeded<{ id: string } & CategoryDoc>('cat-tech');

			if (techCategory) {
				// Test seeding with relationship
				await ctx.seed<ArticleDoc>({
					seedId: 'article-tech-1',
					collection: 'articles',
					data: {
						title: 'First Tech Article',
						content: 'Article linked to tech category via custom seed function.',
						category: techCategory.id,
					},
				});
			}

			ctx.log('Custom seeding complete');
		},
		options: {
			runOnStart: 'always', // Always run for E2E testing
			onConflict: 'skip', // Idempotent by default
			quiet: false, // Show seeding logs for debugging
		},
	},
});
