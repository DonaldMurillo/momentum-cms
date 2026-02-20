import type { SeedingConfig } from '@momentumcms/core';

/**
 * Document types for type-safe seeding.
 * Index signatures make them compatible with Record<string, unknown>.
 */
interface CategoryDoc {
	[key: string]: unknown;
	name: string;
	slug: string;
}

interface ArticleDoc {
	[key: string]: unknown;
	title: string;
	slug?: string;
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
	notifications?: {
		emailEnabled?: boolean;
		emailFrom?: string;
	};
}

/**
 * Shared seeding configuration for E2E test data.
 *
 * Seeds admin user, categories, articles, pages, products, and settings.
 * Used by both example-angular and example-analog apps.
 */
export const exampleSeedingConfig: SeedingConfig = {
	defaults: ({ authUser, collection }) => [
		// Seed admin user first for E2E tests (created via Better Auth signup API)
		authUser('user-admin', {
			name: 'Test Admin',
			email: 'admin@test.com',
			password: 'TestPassword123!',
			role: 'admin',
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
			slug: 'welcome-article',
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
		collection<PageDoc>('pages').create('page-empty', {
			title: 'Empty Page',
			slug: 'empty',
			content: [],
		}),
		// Showcase pages with distinctive block combinations
		collection<PageDoc>('pages').create('page-services', {
			title: 'Services Page',
			slug: 'services',
			content: [
				{
					blockType: 'hero',
					heading: 'Our Services',
					subheading: 'Delivering excellence across every project.',
					ctaText: 'Get in Touch',
					ctaLink: '/contact',
				},
				{
					blockType: 'imageText',
					heading: 'Custom Development',
					body: 'We build tailor-made solutions designed to scale with your business needs. From content management to full-stack applications.',
					imageUrl: 'https://placehold.co/600x400/1e3a5f/ffffff?text=Development',
					imageAlt: 'Custom development illustration',
					imagePosition: 'left',
				},
				{
					blockType: 'stats',
					heading: 'By the Numbers',
					description: 'Our track record speaks for itself.',
					items: [
						{ value: '150', label: 'Projects Delivered', suffix: '+' },
						{ value: '99', label: 'Client Satisfaction', suffix: '%' },
						{ value: '24', label: 'Support Available', suffix: '/7' },
						{ value: '10', label: 'Years Experience', suffix: '+' },
					],
				},
				{
					blockType: 'callToAction',
					heading: 'Ready to Get Started?',
					description: 'Let us help you build something great.',
					primaryButtonText: 'Contact Us',
					primaryButtonLink: '/contact',
					secondaryButtonText: 'View Portfolio',
					secondaryButtonLink: '/showcase',
				},
			],
		}),
		collection<PageDoc>('pages').create('page-showcase', {
			title: 'Showcase Page',
			slug: 'showcase',
			content: [
				{
					blockType: 'hero',
					heading: 'Our Work',
					subheading: 'See what we have built for our clients.',
				},
				{
					blockType: 'testimonial',
					quote:
						'Momentum CMS transformed how we manage our content. The Angular integration is seamless.',
					authorName: 'Jane Smith',
					authorRole: 'CTO',
					authorCompany: 'TechForward Inc.',
				},
				{
					blockType: 'featureGrid',
					heading: 'Why Choose Us',
					description: 'Our platform stands out in every dimension.',
					features: [
						{
							title: 'Type-Safe',
							description: 'Full TypeScript from schema to UI.',
							icon: 'shield',
						},
						{ title: 'Fast', description: 'SSR and edge-ready deployment.', icon: 'bolt' },
						{
							title: 'Extensible',
							description: 'Plugin system for custom functionality.',
							icon: 'puzzle',
						},
						{ title: 'Modern', description: 'Built on Angular 21 with signals.', icon: 'sparkles' },
						{ title: 'Accessible', description: 'WCAG 2.1 compliant components.', icon: 'eye' },
						{ title: 'Open Source', description: 'Community-driven development.', icon: 'heart' },
					],
				},
				{
					blockType: 'testimonial',
					quote:
						'The developer experience is outstanding. We shipped our redesign in half the time.',
					authorName: 'Alex Chen',
					authorRole: 'Engineering Lead',
					authorCompany: 'DataFlow Labs',
				},
			],
		}),
		collection<PageDoc>('pages').create('page-contact', {
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
					blockType: 'callToAction',
					heading: 'Send Us a Message',
					description: 'Fill out the form in the admin panel to get started.',
					primaryButtonText: 'Open Admin',
					primaryButtonLink: '/admin',
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
			notifications: {
				emailEnabled: true,
				emailFrom: 'noreply@test.com',
			},
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
					slug: 'first-tech-article',
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
					slug: 'second-tech-article',
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
					slug: 'breaking-news',
					content: '<p>Important news article for testing.</p>',
					category: newsCategory.id,
					_status: 'published',
				},
			});

			await ctx.seed<ArticleDoc>({
				seedId: 'article-news-cms',
				collection: 'articles',
				data: {
					title: 'The Future of CMS Platforms',
					slug: 'the-future-of-cms-platforms',
					content:
						'<p>The CMS landscape is evolving rapidly with headless architectures leading the charge.</p><h2>What to Expect</h2><p>AI-powered content workflows, composable architectures, and developer-first tooling are redefining how teams build digital experiences.</p>',
					category: newsCategory.id,
					_status: 'published',
				},
			});
		}

		if (techCategory) {
			await ctx.seed<ArticleDoc>({
				seedId: 'article-tech-angular',
				collection: 'articles',
				data: {
					title: 'Getting Started with Angular 21',
					slug: 'getting-started-with-angular-21',
					content:
						'<p>Angular 21 brings exciting new features including improved signal-based reactivity and streamlined SSR.</p><h2>Key Features</h2><p>Signal inputs, the new control flow syntax, and incremental hydration make Angular faster and more ergonomic than ever.</p>',
					category: techCategory.id,
					_status: 'published',
				},
			});
		}

		ctx.log('Custom seeding complete - created category-linked articles');
	},
	options: {
		runOnStart: 'always', // Always run for E2E testing
		onConflict: 'update', // Update existing seeds when fields are added (e.g., slugs)
		quiet: false, // Show seeding logs for debugging
	},
};
