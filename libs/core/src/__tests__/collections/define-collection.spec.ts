import { describe, it, expect, vi } from 'vitest';
import { defineCollection, defineGlobal } from '../../lib/collections';
import { text, email, password, richText, relationship, checkbox } from '../../lib/fields';

describe('defineCollection()', () => {
	describe('Basic Configuration', () => {
		it('should create collection with required slug', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
			});

			expect(Posts.slug).toBe('posts');
		});

		it('should throw if slug is missing', () => {
			expect(() =>
				defineCollection({
					slug: '',
					fields: [text('title')],
				}),
			).toThrow('Collection must have a slug');
		});

		it('should throw if fields array is empty', () => {
			expect(() =>
				defineCollection({
					slug: 'posts',
					fields: [],
				}),
			).toThrow('must have at least one field');
		});

		it('should throw if fields array is missing', () => {
			expect(() =>
				defineCollection({
					slug: 'posts',
					// @ts-expect-error - testing runtime validation
					fields: undefined,
				}),
			).toThrow('must have at least one field');
		});
	});

	describe('Slug Validation', () => {
		it('should enforce kebab-case slug', () => {
			expect(() =>
				defineCollection({
					slug: 'MyPosts',
					fields: [text('title')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should reject slugs starting with numbers', () => {
			expect(() =>
				defineCollection({
					slug: '123posts',
					fields: [text('title')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should reject slugs with underscores', () => {
			expect(() =>
				defineCollection({
					slug: 'my_posts',
					fields: [text('title')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should accept valid kebab-case slugs', () => {
			const collection = defineCollection({
				slug: 'blog-posts',
				fields: [text('title')],
			});
			expect(collection.slug).toBe('blog-posts');
		});

		it('should accept single word slugs', () => {
			const collection = defineCollection({
				slug: 'posts',
				fields: [text('title')],
			});
			expect(collection.slug).toBe('posts');
		});

		it('should accept slugs with numbers after letters', () => {
			const collection = defineCollection({
				slug: 'posts2024',
				fields: [text('title')],
			});
			expect(collection.slug).toBe('posts2024');
		});
	});

	describe('Timestamps', () => {
		it('should enable timestamps by default', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
			});
			expect(Posts.timestamps).toBe(true);
		});

		it('should allow disabling timestamps', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				timestamps: false,
			});
			expect(Posts.timestamps).toBe(false);
		});

		it('should allow custom timestamps configuration', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				timestamps: {
					createdAt: true,
					updatedAt: false,
				},
			});
			expect(Posts.timestamps).toEqual({
				createdAt: true,
				updatedAt: false,
			});
		});
	});

	describe('Labels', () => {
		it('should accept custom labels', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				labels: {
					singular: 'Blog Post',
					plural: 'Blog Posts',
				},
			});
			expect(Posts.labels?.singular).toBe('Blog Post');
			expect(Posts.labels?.plural).toBe('Blog Posts');
		});
	});

	describe('Access Control', () => {
		it('should accept access control functions', () => {
			const readFn = vi.fn(() => true);
			const createFn = vi.fn(({ req }) => !!req.user);

			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				access: {
					read: readFn,
					create: createFn,
				},
			});

			expect(Posts.access?.read).toBe(readFn);
			expect(Posts.access?.create).toBe(createFn);
		});

		it('should support async access functions', async () => {
			const asyncAccessFn = vi.fn(async () => {
				await Promise.resolve();
				return true;
			});

			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				access: {
					read: asyncAccessFn,
				},
			});

			const result = await Posts.access?.read?.({ req: {} });
			expect(result).toBe(true);
		});
	});

	describe('Hooks', () => {
		it('should accept lifecycle hooks', () => {
			const beforeChangeFn = vi.fn();
			const afterChangeFn = vi.fn();

			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				hooks: {
					beforeChange: [beforeChangeFn],
					afterChange: [afterChangeFn],
				},
			});

			expect(Posts.hooks?.beforeChange).toHaveLength(1);
			expect(Posts.hooks?.afterChange).toHaveLength(1);
		});
	});

	describe('Admin Configuration', () => {
		it('should accept admin configuration', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title'), text('slug')],
				admin: {
					useAsTitle: 'title',
					defaultColumns: ['title', 'createdAt'],
					group: 'Content',
					description: 'Blog posts collection',
				},
			});

			expect(Posts.admin?.useAsTitle).toBe('title');
			expect(Posts.admin?.defaultColumns).toEqual(['title', 'createdAt']);
			expect(Posts.admin?.group).toBe('Content');
		});

		it('should accept pagination settings', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				admin: {
					pagination: {
						defaultLimit: 25,
						limits: [10, 25, 50, 100],
					},
				},
			});

			expect(Posts.admin?.pagination?.defaultLimit).toBe(25);
			expect(Posts.admin?.pagination?.limits).toEqual([10, 25, 50, 100]);
		});
	});

	describe('Auth Configuration', () => {
		it('should support auth-enabled collections', () => {
			const Users = defineCollection({
				slug: 'users',
				fields: [email('email'), password('password')],
				auth: true,
			});

			expect(Users.auth).toBe(true);
		});

		it('should support detailed auth configuration', () => {
			const Users = defineCollection({
				slug: 'users',
				fields: [email('email'), password('password')],
				auth: {
					tokenExpiration: 3600,
					verify: true,
					maxLoginAttempts: 5,
					lockTime: 300000,
				},
			});

			const authConfig = Users.auth;
			expect(typeof authConfig).toBe('object');
			if (typeof authConfig === 'object' && authConfig !== null) {
				expect(authConfig.tokenExpiration).toBe(3600);
				expect(authConfig.verify).toBe(true);
			}
		});
	});

	describe('Versioning', () => {
		it('should support versioning configuration', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				versions: true,
			});

			expect(Posts.versions).toBe(true);
		});

		it('should support detailed versioning configuration', () => {
			const Posts = defineCollection({
				slug: 'posts',
				fields: [text('title')],
				versions: {
					drafts: true,
					maxPerDoc: 10,
				},
			});

			const versionsConfig = Posts.versions;
			expect(typeof versionsConfig).toBe('object');
			if (typeof versionsConfig === 'object' && versionsConfig !== null) {
				expect(versionsConfig.drafts).toBe(true);
				expect(versionsConfig.maxPerDoc).toBe(10);
			}
		});
	});

	describe('Real-world Collection Examples', () => {
		it('should define a blog posts collection', () => {
			const mockUsers = { slug: 'users', fields: [] };

			const Posts = defineCollection({
				slug: 'posts',
				labels: { singular: 'Post', plural: 'Posts' },
				fields: [
					text('title', { required: true }),
					richText('content'),
					checkbox('published'),
					relationship('author', { collection: () => mockUsers }),
				],
				admin: {
					useAsTitle: 'title',
					defaultColumns: ['title', 'author', 'published'],
				},
				access: {
					read: () => true,
					create: ({ req }) => !!req.user,
					update: ({ req }) => !!req.user,
					delete: ({ req }) => req.user?.role === 'admin',
				},
			});

			expect(Posts.slug).toBe('posts');
			expect(Posts.fields).toHaveLength(4);
			expect(Posts.admin?.useAsTitle).toBe('title');
		});
	});
});

describe('defineGlobal()', () => {
	describe('Basic Configuration', () => {
		it('should create global with required slug', () => {
			const SiteSettings = defineGlobal({
				slug: 'site-settings',
				fields: [text('siteName')],
			});

			expect(SiteSettings.slug).toBe('site-settings');
		});

		it('should throw if slug is missing', () => {
			expect(() =>
				defineGlobal({
					slug: '',
					fields: [text('siteName')],
				}),
			).toThrow('Global must have a slug');
		});

		it('should throw if fields array is empty', () => {
			expect(() =>
				defineGlobal({
					slug: 'site-settings',
					fields: [],
				}),
			).toThrow('must have at least one field');
		});
	});

	describe('Slug Validation', () => {
		it('should enforce kebab-case slug', () => {
			expect(() =>
				defineGlobal({
					slug: 'SiteSettings',
					fields: [text('siteName')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should reject slugs starting with numbers', () => {
			expect(() =>
				defineGlobal({
					slug: '123settings',
					fields: [text('siteName')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should reject slugs with underscores', () => {
			expect(() =>
				defineGlobal({
					slug: 'site_settings',
					fields: [text('siteName')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should reject slugs with spaces', () => {
			expect(() =>
				defineGlobal({
					slug: 'site settings',
					fields: [text('siteName')],
				}),
			).toThrow('must be kebab-case');
		});

		it('should accept valid kebab-case slugs', () => {
			const global = defineGlobal({
				slug: 'site-settings',
				fields: [text('siteName')],
			});
			expect(global.slug).toBe('site-settings');
		});

		it('should accept single word slugs', () => {
			const global = defineGlobal({
				slug: 'navigation',
				fields: [text('title')],
			});
			expect(global.slug).toBe('navigation');
		});

		it('should accept slugs with numbers after letters', () => {
			const global = defineGlobal({
				slug: 'settings2024',
				fields: [text('siteName')],
			});
			expect(global.slug).toBe('settings2024');
		});
	});

	describe('Global Features', () => {
		it('should accept label', () => {
			const SiteSettings = defineGlobal({
				slug: 'site-settings',
				label: 'Site Settings',
				fields: [text('siteName')],
			});

			expect(SiteSettings.label).toBe('Site Settings');
		});

		it('should accept access control for read and update', () => {
			const readFn = vi.fn(() => true);
			const updateFn = vi.fn(() => true);

			const SiteSettings = defineGlobal({
				slug: 'site-settings',
				fields: [text('siteName')],
				access: {
					read: readFn,
					update: updateFn,
				},
			});

			expect(SiteSettings.access?.read).toBe(readFn);
			expect(SiteSettings.access?.update).toBe(updateFn);
		});
	});
});
