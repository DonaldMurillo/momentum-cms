import { describe, it, expect } from 'vitest';
import {
	generateTypes,
	generateAdminConfig,
	serializeValue,
	serializeField,
	serializeCollection,
	serializeGlobal,
	computeRelativeImport,
} from '../generator';
import { slugToPascalCase } from '../field-to-typescript';

// ============================================
// Type Generation Tests
// ============================================

describe('generateTypes', () => {
	it('should generate header comment', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateTypes(config);
		expect(output).toContain('AUTO-GENERATED');
		expect(output).toContain('DO NOT EDIT');
	});

	it('should generate interface with id for a simple collection', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text', required: true }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('export interface Posts {');
		expect(output).toContain('id: string;');
		expect(output).toContain('title: string;');
	});

	it('should map text field types to string', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{ name: 'title', type: 'text' },
						{ name: 'body', type: 'textarea' },
						{ name: 'content', type: 'richText' },
						{ name: 'contact', type: 'email' },
						{ name: 'secret', type: 'password' },
						{ name: 'url', type: 'slug' },
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('title?: string;');
		expect(output).toContain('body?: string;');
		expect(output).toContain('content?: string;');
		expect(output).toContain('contact?: string;');
		expect(output).toContain('secret?: string;');
		expect(output).toContain('url?: string;');
	});

	it('should map number to number', () => {
		const config = {
			collections: [{ slug: 'items', fields: [{ name: 'price', type: 'number', required: true }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('price: number;');
	});

	it('should map checkbox to boolean', () => {
		const config = {
			collections: [{ slug: 'items', fields: [{ name: 'active', type: 'checkbox' }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('active?: boolean;');
	});

	it('should map date to string', () => {
		const config = {
			collections: [{ slug: 'items', fields: [{ name: 'publishedAt', type: 'date' }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('publishedAt?: string;');
	});

	it('should generate required fields without optional marker', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{ name: 'title', type: 'text', required: true },
						{ name: 'description', type: 'text' },
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toMatch(/title: string;/);
		expect(output).toMatch(/description\?: string;/);
	});

	it('should generate select with option literal union', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'status',
							type: 'select',
							options: [
								{ label: 'Draft', value: 'draft' },
								{ label: 'Published', value: 'published' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('status?: "draft" | "published";');
	});

	it('should generate select with hasMany as array of union', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'tags',
							type: 'select',
							hasMany: true,
							options: [
								{ label: 'A', value: 'a' },
								{ label: 'B', value: 'b' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('tags?: ("a" | "b")[];');
	});

	it('should generate radio with option literal union', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'priority',
							type: 'radio',
							options: [
								{ label: 'Low', value: 'low' },
								{ label: 'Medium', value: 'medium' },
								{ label: 'High', value: 'high' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('priority?: "low" | "medium" | "high";');
	});

	it('should generate radio without options as string', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'priority', type: 'radio' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('priority?: string;');
	});

	it('should generate upload as string', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'avatar', type: 'upload' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('avatar?: string;');
	});

	it('should generate upload with hasMany as string[]', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'gallery', type: 'upload', hasMany: true }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('gallery?: string[];');
	});

	it('should generate select without options as string', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'category', type: 'select' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('category?: string;');
	});

	it('should generate unknown type for unrecognized field type', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'custom', type: 'nonexistent' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('custom?: unknown;');
	});

	it('should generate relationship as string ID', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'author', type: 'relationship', collection: () => ({}) }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('author?: string;');
	});

	it('should generate relationship with hasMany as string[]', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{ name: 'authors', type: 'relationship', hasMany: true, collection: () => ({}) },
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('authors?: string[];');
	});

	it('should generate array fields as Array of nested object', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'features',
							type: 'array',
							fields: [
								{ name: 'label', type: 'text', required: true },
								{ name: 'value', type: 'number' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('features?: Array<{');
		expect(output).toContain('label: string;');
		expect(output).toContain('value?: number;');
	});

	it('should generate group fields as nested object', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'seo',
							type: 'group',
							fields: [
								{ name: 'metaTitle', type: 'text' },
								{ name: 'metaDescription', type: 'textarea' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('seo?: {');
		expect(output).toContain('metaTitle?: string;');
		expect(output).toContain('metaDescription?: string;');
	});

	it('should generate json as Record<string, unknown>', () => {
		const config = {
			collections: [{ slug: 'items', fields: [{ name: 'data', type: 'json' }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('data?: Record<string, unknown>;');
	});

	it('should generate point as [number, number]', () => {
		const config = {
			collections: [{ slug: 'items', fields: [{ name: 'location', type: 'point' }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('location?: [number, number];');
	});

	it('should flatten layout fields (tabs, collapsible, row)', () => {
		const config = {
			collections: [
				{
					slug: 'settings',
					fields: [
						{
							name: 'settingsTabs',
							type: 'tabs',
							tabs: [
								{
									label: 'General',
									fields: [
										{ name: 'siteName', type: 'text', required: true },
										{ name: 'siteDescription', type: 'textarea' },
									],
								},
								{
									label: 'Social',
									fields: [
										{
											name: 'socialRow',
											type: 'row',
											fields: [
												{ name: 'twitterHandle', type: 'text' },
												{ name: 'facebookUrl', type: 'text' },
											],
										},
										{ name: 'linkedinUrl', type: 'text' },
									],
								},
							],
						},
						{
							name: 'advanced',
							type: 'collapsible',
							fields: [
								{ name: 'analyticsId', type: 'text' },
								{ name: 'maintenanceMode', type: 'checkbox' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);

		// All data fields should be flat in the Settings interface
		expect(output).toContain('export interface Settings {');
		expect(output).toContain('siteName: string;');
		expect(output).toContain('siteDescription?: string;');
		expect(output).toContain('twitterHandle?: string;');
		expect(output).toContain('facebookUrl?: string;');
		expect(output).toContain('linkedinUrl?: string;');
		expect(output).toContain('analyticsId?: string;');
		expect(output).toContain('maintenanceMode?: boolean;');

		// Layout field names should NOT appear as properties
		expect(output).not.toMatch(/settingsTabs\??:/);
		expect(output).not.toMatch(/socialRow\??:/);
		expect(output).not.toMatch(/advanced\??:/);
	});

	it('should generate nested type for named tabs (like a group)', () => {
		const config = {
			collections: [
				{
					slug: 'pages',
					fields: [
						{ name: 'title', type: 'text', required: true },
						{
							name: 'content',
							type: 'tabs',
							tabs: [
								{
									label: 'General',
									fields: [{ name: 'subtitle', type: 'text' }],
								},
								{
									name: 'seo',
									label: 'SEO',
									fields: [
										{ name: 'metaTitle', type: 'text' },
										{ name: 'metaDescription', type: 'textarea' },
									],
								},
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		// Unnamed tab fields should be at root level
		expect(output).toContain('subtitle?: string;');
		// Named tab should produce a nested type (like a group)
		expect(output).toContain('seo?: {');
		expect(output).toContain('metaTitle?: string;');
		expect(output).toContain('metaDescription?: string;');
		// The layout field name should NOT appear
		expect(output).not.toMatch(/content\??:/);
	});

	it('should generate block discriminated union types', () => {
		const config = {
			collections: [
				{
					slug: 'pages',
					fields: [
						{ name: 'title', type: 'text', required: true },
						{
							name: 'content',
							type: 'blocks',
							blocks: [
								{
									slug: 'hero',
									fields: [
										{ name: 'heading', type: 'text', required: true },
										{ name: 'subheading', type: 'textarea' },
									],
								},
								{
									slug: 'text-block',
									fields: [
										{ name: 'heading', type: 'text' },
										{ name: 'body', type: 'textarea', required: true },
									],
								},
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);

		// Block interfaces
		expect(output).toContain('export interface PagesContentHeroBlock {');
		expect(output).toContain('blockType: "hero";');
		expect(output).toContain('heading: string;');
		expect(output).toContain('subheading?: string;');

		expect(output).toContain('export interface PagesContentTextBlockBlock {');
		expect(output).toContain('blockType: "text-block";');
		expect(output).toContain('body: string;');

		// Union type
		expect(output).toContain('export type PagesContentBlock =');
		expect(output).toContain('| PagesContentHeroBlock');
		expect(output).toContain('| PagesContentTextBlockBlock');

		// Parent interface uses the union
		expect(output).toContain('content?: PagesContentBlock[];');
	});

	it('should include plugin collections in output', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
			plugins: [
				{
					name: 'auth',
					collections: [
						{
							slug: 'auth-user',
							fields: [
								{ name: 'name', type: 'text', required: true },
								{ name: 'email', type: 'email', required: true },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('export interface AuthUser {');
		expect(output).toContain('name: string;');
		expect(output).toContain('email: string;');
		expect(output).toContain('"auth-user": AuthUser;');
	});

	it('should deduplicate collections by slug', () => {
		const config = {
			collections: [{ slug: 'users', fields: [{ name: 'name', type: 'text' }] }],
			plugins: [
				{
					name: 'auth',
					collections: [
						{ slug: 'users', fields: [{ name: 'email', type: 'email' }] }, // duplicate
					],
				},
			],
		};
		const output = generateTypes(config);
		// Should only have one Users interface (from app collections, not plugin)
		const matches = output.match(/export interface Users \{/g);
		expect(matches).toHaveLength(1);
	});

	it('should generate global types', () => {
		const config = {
			collections: [],
			globals: [
				{
					slug: 'site-settings',
					fields: [
						{ name: 'site-name', type: 'text', required: true },
						{ name: 'description', type: 'textarea' },
						{ name: 'maintenance-mode', type: 'checkbox' },
					],
				},
			],
		};
		const output = generateTypes(config);

		expect(output).toContain('export interface SiteSettingsGlobal {');
		expect(output).toContain('"site-name": string;');
		expect(output).toContain('description?: string;');
		expect(output).toContain('"maintenance-mode"?: boolean;');
		expect(output).toContain('updatedAt: string;');
		expect(output).toContain('export type GlobalSlug = "site-settings";');
		expect(output).toContain('"site-settings": SiteSettingsGlobal;');
	});

	it('should quote kebab-case field names', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'my-field', type: 'text' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('"my-field"?: string;');
	});

	it('should add _status field for versioned collections with drafts', () => {
		const config = {
			collections: [
				{
					slug: 'articles',
					fields: [{ name: 'title', type: 'text' }],
					versions: { drafts: true, maxPerDoc: 10 },
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain("_status?: 'draft' | 'published';");
	});

	it('should NOT add _status for versions without drafts', () => {
		const config = {
			collections: [
				{
					slug: 'articles',
					fields: [{ name: 'title', type: 'text' }],
					versions: true,
				},
			],
		};
		const output = generateTypes(config);
		expect(output).not.toContain('_status');
	});

	it('should add deletedAt for soft-delete collections', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'title', type: 'text' }],
					softDelete: true,
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('deletedAt?: string | null;');
	});

	it('should use custom field name for soft-delete', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'title', type: 'text' }],
					softDelete: { field: 'removedAt' },
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('removedAt?: string | null;');
	});

	it('should include timestamps by default', () => {
		const config = {
			collections: [{ slug: 'items', fields: [{ name: 'title', type: 'text' }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('createdAt: string;');
		expect(output).toContain('updatedAt: string;');
	});

	it('should exclude timestamps when disabled', () => {
		const config = {
			collections: [
				{ slug: 'items', fields: [{ name: 'title', type: 'text' }], timestamps: false },
			],
		};
		const output = generateTypes(config);
		expect(output).not.toContain('createdAt');
		expect(output).not.toContain('updatedAt');
	});

	it('should generate CollectionSlug union type', () => {
		const config = {
			collections: [
				{ slug: 'posts', fields: [] },
				{ slug: 'users', fields: [] },
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('export type CollectionSlug = "posts" | "users";');
	});

	it('should generate MomentumCollections mapping', () => {
		const config = {
			collections: [
				{ slug: 'posts', fields: [] },
				{ slug: 'auth-user', fields: [] },
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('"posts": Posts;');
		expect(output).toContain('"auth-user": AuthUser;');
	});

	it('should generate TypedMomentumCollections mapping', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('"posts": { doc: Posts; where: PostsWhereClause };');
	});

	it('should generate where clause interfaces', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [
						{ name: 'title', type: 'text' },
						{ name: 'views', type: 'number' },
						{ name: 'active', type: 'checkbox' },
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('export interface PostsWhereClause {');
		expect(output).toContain('title?: string | { equals?: string');
		expect(output).toContain('views?: number | { equals?: number');
		expect(output).toContain('active?: boolean | { equals?: boolean }');
	});

	it('should generate where clause with full text operators', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain(
			'title?: string | { equals?: string; not?: string; contains?: string; in?: string[] }',
		);
	});

	it('should generate where clause with full number operators', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'views', type: 'number' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain(
			'views?: number | { equals?: number; not?: number; gt?: number; gte?: number; lt?: number; lte?: number; in?: number[] }',
		);
	});

	it('should generate where clause for date fields with comparison operators', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'publishedAt', type: 'date' }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain(
			'publishedAt?: string | { equals?: string; not?: string; gt?: string; gte?: string; lt?: string; lte?: string }',
		);
	});

	it('should generate where clause for select fields with option unions', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [
						{
							name: 'status',
							type: 'select',
							options: [
								{ label: 'Draft', value: 'draft' },
								{ label: 'Published', value: 'published' },
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('status?: "draft" | "published" | { equals?: "draft" | "published"');
		expect(output).toContain('in?: ("draft" | "published")[]');
	});

	it('should generate where clause for relationship fields', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'author', type: 'relationship', collection: () => ({}) }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('author?: string | { equals?: string; not?: string; in?: string[] }');
	});

	it('should generate array field with empty sub-fields as unknown[]', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'list', type: 'array', fields: [] }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('list?: unknown[];');
	});

	it('should generate group field with empty sub-fields as Record<string, unknown>', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'meta', type: 'group', fields: [] }],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('meta?: Record<string, unknown>;');
	});

	it('should generate id and timestamps for collection with empty fields', () => {
		const config = {
			collections: [{ slug: 'items', fields: [] }],
		};
		const output = generateTypes(config);
		expect(output).toContain('export interface Items {');
		expect(output).toContain('id: string;');
		expect(output).toContain('createdAt: string;');
		expect(output).toContain('updatedAt: string;');
	});

	it('should generate helper types', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
		};
		const output = generateTypes(config);
		expect(output).toContain(
			'export type DocumentType<S extends CollectionSlug> = MomentumCollections[S];',
		);
		expect(output).toContain(
			"export type WhereClauseType<S extends CollectionSlug> = TypedMomentumCollections[S]['where'];",
		);
	});
});

// ============================================
// serializeValue Tests
// ============================================

describe('serializeValue', () => {
	it('should serialize strings with JSON escaping', () => {
		expect(serializeValue('hello')).toBe('"hello"');
		expect(serializeValue('/admin')).toBe('"/admin"');
	});

	it('should serialize numbers', () => {
		expect(serializeValue(42)).toBe('42');
		expect(serializeValue(0)).toBe('0');
	});

	it('should serialize booleans', () => {
		expect(serializeValue(true)).toBe('true');
		expect(serializeValue(false)).toBe('false');
	});

	it('should serialize null', () => {
		expect(serializeValue(null)).toBe('null');
	});

	it('should return undefined for functions', () => {
		expect(serializeValue(() => true)).toBe('undefined');
	});

	it('should serialize empty arrays', () => {
		expect(serializeValue([])).toBe('[]');
	});

	it('should serialize arrays of primitives', () => {
		const result = serializeValue(['a', 'b']);
		expect(result).toContain('"a"');
		expect(result).toContain('"b"');
	});

	it('should serialize nested objects', () => {
		const result = serializeValue({ title: 'CMS', logo: '/logo.png' });
		expect(result).toContain('title: "CMS"');
		expect(result).toContain('logo: "/logo.png"');
	});

	it('should skip undefined and function values in objects', () => {
		const result = serializeValue({ name: 'test', removed: undefined, fn: () => true });
		expect(result).toContain('name: "test"');
		expect(result).not.toContain('removed');
		expect(result).not.toContain('fn');
	});

	it('should serialize empty objects', () => {
		expect(serializeValue({})).toBe('{}');
	});
});

// ============================================
// serializeField Tests
// ============================================

describe('serializeField', () => {
	it('should serialize a basic text field', () => {
		const result = serializeField({ name: 'title', type: 'text', required: true });
		expect(result).toContain('name: "title"');
		expect(result).toContain('type: "text"');
		expect(result).toContain('required: true');
	});

	it('should strip access, hooks, and validate', () => {
		const result = serializeField({
			name: 'title',
			type: 'text',
			access: { read: () => true },
			hooks: { beforeChange: [() => ({})] },
			validate: () => true,
		});
		expect(result).toContain('name: "title"');
		expect(result).not.toContain('access');
		expect(result).not.toContain('hooks');
		expect(result).not.toContain('validate');
	});

	it('should strip admin.condition (function)', () => {
		const result = serializeField({
			name: 'title',
			type: 'text',
			admin: { position: 'main', condition: () => true, width: 'half' },
		});
		expect(result).toContain('admin:');
		expect(result).toContain('position: "main"');
		expect(result).toContain('width: "half"');
		expect(result).not.toContain('condition');
	});

	it('should strip filterOptions on relationship', () => {
		const result = serializeField({
			name: 'author',
			type: 'relationship',
			collection: () => ({ slug: 'users' }),
			filterOptions: () => ({}),
		});
		expect(result).not.toContain('filterOptions');
	});

	it('should resolve relationship collection() into inline stub', () => {
		const result = serializeField({
			name: 'author',
			type: 'relationship',
			collection: () => ({
				slug: 'users',
				labels: { singular: 'User', plural: 'Users' },
				admin: { useAsTitle: 'name' },
			}),
		});
		expect(result).toContain('collection: () => (');
		expect(result).toContain('slug: "users"');
		expect(result).toContain('singular: "User"');
		expect(result).toContain('plural: "Users"');
		expect(result).toContain('useAsTitle: "name"');
	});

	it('should serialize select with options', () => {
		const result = serializeField({
			name: 'status',
			type: 'select',
			options: [
				{ label: 'Draft', value: 'draft' },
				{ label: 'Published', value: 'published' },
			],
		});
		expect(result).toContain('options:');
		expect(result).toContain('"draft"');
		expect(result).toContain('"published"');
		expect(result).toContain('"Draft"');
	});

	it('should serialize upload with relationTo and mimeTypes', () => {
		const result = serializeField({
			name: 'image',
			type: 'upload',
			relationTo: 'media',
			mimeTypes: ['image/*'],
			maxSize: 5000000,
		});
		expect(result).toContain('relationTo: "media"');
		expect(result).toContain('"image/*"');
		expect(result).toContain('maxSize: 5000000');
	});

	it('should serialize array sub-fields recursively', () => {
		const result = serializeField({
			name: 'items',
			type: 'array',
			fields: [
				{ name: 'label', type: 'text', required: true },
				{ name: 'value', type: 'number' },
			],
		});
		expect(result).toContain('fields:');
		expect(result).toContain('name: "label"');
		expect(result).toContain('name: "value"');
	});

	it('should serialize blocks recursively', () => {
		const result = serializeField({
			name: 'content',
			type: 'blocks',
			blocks: [
				{
					slug: 'hero',
					fields: [{ name: 'heading', type: 'text', required: true }],
					labels: { singular: 'Hero', plural: 'Heroes' },
				},
			],
		});
		expect(result).toContain('blocks:');
		expect(result).toContain('slug: "hero"');
		expect(result).toContain('name: "heading"');
		expect(result).toContain('singular: "Hero"');
	});

	it('should serialize tabs recursively', () => {
		const result = serializeField({
			name: 'settings',
			type: 'tabs',
			tabs: [
				{
					label: 'General',
					fields: [{ name: 'siteName', type: 'text' }],
				},
			],
		});
		expect(result).toContain('tabs:');
		expect(result).toContain('label: "General"');
		expect(result).toContain('name: "siteName"');
	});

	it('should serialize named tabs with name property', () => {
		const result = serializeField({
			name: 'settings',
			type: 'tabs',
			tabs: [
				{
					name: 'seo',
					label: 'SEO',
					fields: [{ name: 'metaTitle', type: 'text' }],
				},
			],
		});
		expect(result).toContain('tabs:');
		expect(result).toContain('name: "seo"');
		expect(result).toContain('label: "SEO"');
		expect(result).toContain('name: "metaTitle"');
	});

	it('should omit name property for unnamed tabs', () => {
		const result = serializeField({
			name: 'settings',
			type: 'tabs',
			tabs: [
				{
					label: 'General',
					fields: [{ name: 'siteName', type: 'text' }],
				},
			],
		});
		// The tab itself should have label but no 'name: "General"' — only the field has 'name: "siteName"'
		const lines = result.split('\n');
		const tabLabelLine = lines.find((l) => l.includes('label: "General"'));
		expect(tabLabelLine).toBeTruthy();
		// The tab name property should NOT appear right before label (it's unnamed)
		const tabNameLine = lines.find(
			(l) => l.includes('name: "General"') || l.includes("name: 'General'"),
		);
		expect(tabNameLine).toBeUndefined();
	});

	it('should keep primitive defaultValue and skip function defaultValue', () => {
		const fieldWithPrimitive = serializeField({
			name: 'status',
			type: 'text',
			defaultValue: 'draft',
		});
		expect(fieldWithPrimitive).toContain('defaultValue: "draft"');

		const fieldWithFn = serializeField({
			name: 'status',
			type: 'text',
			defaultValue: () => 'draft',
		});
		expect(fieldWithFn).not.toContain('defaultValue');
	});

	it('should serialize label and description', () => {
		const result = serializeField({
			name: 'title',
			type: 'text',
			label: 'Article Title',
			description: 'Enter the article title',
		});
		expect(result).toContain('label: "Article Title"');
		expect(result).toContain('description: "Enter the article title"');
	});
});

// ============================================
// serializeCollection Tests
// ============================================

describe('serializeCollection', () => {
	it('should strip server-only properties', () => {
		const result = serializeCollection({
			slug: 'posts',
			fields: [{ name: 'title', type: 'text' }],
			access: { read: () => true, create: () => true },
			hooks: { beforeChange: [() => ({})] },
			endpoints: [
				{
					path: '/custom',
					method: 'get',
					handler: () => Promise.resolve({ status: 200, body: {} }),
				},
			],
			webhooks: [{ url: 'https://example.com/webhook' }],
			defaultWhere: () => ({}),
			dbName: 'custom_table',
			indexes: [{ columns: ['title'] }],
			graphQL: { singularName: 'Post' },
		});
		expect(result).toContain('slug: "posts"');
		expect(result).not.toContain('access');
		expect(result).not.toContain('hooks');
		expect(result).not.toContain('endpoints');
		expect(result).not.toContain('webhooks');
		expect(result).not.toContain('defaultWhere');
		expect(result).not.toContain('dbName');
		expect(result).not.toContain('indexes');
		expect(result).not.toContain('graphQL');
	});

	it('should keep UI-relevant properties', () => {
		const result = serializeCollection({
			slug: 'articles',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [{ name: 'title', type: 'text', required: true }],
			admin: { useAsTitle: 'title', defaultColumns: ['title', 'createdAt'], group: 'Content' },
			timestamps: true,
			versions: { drafts: true },
			softDelete: true,
			managed: false,
			defaultSort: '-createdAt',
		});
		expect(result).toContain('slug: "articles"');
		expect(result).toContain('singular: "Article"');
		expect(result).toContain('useAsTitle: "title"');
		expect(result).toContain('timestamps: true');
		expect(result).toContain('drafts: true');
		expect(result).toContain('softDelete: true');
		expect(result).toContain('managed: false');
		expect(result).toContain('defaultSort: "-createdAt"');
	});

	it('should reduce auth to boolean', () => {
		const result = serializeCollection({
			slug: 'users',
			fields: [],
			auth: { tokenExpiration: 3600, verify: true },
		});
		expect(result).toContain('auth: true');
		expect(result).not.toContain('tokenExpiration');
	});

	it('should convert admin.preview function to URL template string', () => {
		const result = serializeCollection({
			slug: 'pages',
			fields: [{ name: 'slug', type: 'text' }],
			admin: {
				useAsTitle: 'title',
				preview: (doc: Record<string, unknown>) => '/' + String(doc['slug'] ?? ''),
			},
		});
		expect(result).toContain('useAsTitle');
		expect(result).toContain('preview');
		expect(result).toContain('/{slug}');
	});

	it('should fall back to true when preview function cannot be templated', () => {
		const result = serializeCollection({
			slug: 'posts',
			fields: [],
			admin: {
				useAsTitle: 'title',
				preview: () => 'https://example.com',
			},
		});
		expect(result).toContain('useAsTitle');
		// No fields referenced → result is a static URL, stored as-is
		expect(result).toContain('preview');
		expect(result).toContain('https://example.com');
	});

	it('should keep admin.preview when it is a boolean', () => {
		const result = serializeCollection({
			slug: 'posts',
			fields: [],
			admin: { useAsTitle: 'title', preview: true },
		});
		expect(result).toContain('preview: true');
	});

	it('should serialize fields with stripping applied', () => {
		const result = serializeCollection({
			slug: 'posts',
			fields: [
				{
					name: 'title',
					type: 'text',
					access: { read: () => true },
					validate: () => true,
				},
			],
		});
		expect(result).toContain('name: "title"');
		expect(result).not.toContain('access');
		expect(result).not.toContain('validate');
	});
});

// ============================================
// serializeGlobal Tests
// ============================================

describe('serializeGlobal', () => {
	it('should strip access and hooks', () => {
		const result = serializeGlobal({
			slug: 'site-settings',
			label: 'Site Settings',
			fields: [{ name: 'siteName', type: 'text' }],
			access: { read: () => true, update: () => true },
			hooks: { beforeChange: [() => ({})] },
		});
		expect(result).toContain('slug: "site-settings"');
		expect(result).toContain('label: "Site Settings"');
		expect(result).not.toContain('access');
		expect(result).not.toContain('hooks');
	});

	it('should keep slug, label, fields, admin, and versions', () => {
		const result = serializeGlobal({
			slug: 'settings',
			label: 'Settings',
			fields: [{ name: 'siteName', type: 'text' }],
			admin: { description: 'Global settings' },
			versions: { drafts: true },
		});
		expect(result).toContain('slug: "settings"');
		expect(result).toContain('label: "Settings"');
		expect(result).toContain('name: "siteName"');
		expect(result).toContain('description: "Global settings"');
		expect(result).toContain('drafts: true');
	});
});

// ============================================
// computeRelativeImport Tests
// ============================================

describe('computeRelativeImport', () => {
	it('should compute relative path in same directory', () => {
		const result = computeRelativeImport(
			'/app/src/generated/momentum.config.ts',
			'/app/src/generated/momentum.types.ts',
		);
		expect(result).toBe('./momentum.types');
	});

	it('should compute relative path in different directories', () => {
		const result = computeRelativeImport(
			'/app/libs/config/src/momentum.config.ts',
			'/app/libs/types/src/momentum.types.ts',
		);
		expect(result).toBe('../../types/src/momentum.types');
	});
});

// ============================================
// generateAdminConfig Tests (Inlined Output)
// ============================================

describe('generateAdminConfig', () => {
	it('should generate header and MomentumAdminConfig import', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('AUTO-GENERATED');
		expect(output).toContain("import type { MomentumAdminConfig } from '@momentumcms/core';");
	});

	it('should import CollectionSlug from types file', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain("import type { CollectionSlug } from './momentum.types';");
	});

	it('should import GlobalSlug when globals exist', () => {
		const config = {
			collections: [],
			globals: [{ slug: 'settings', fields: [] }],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain("import type { CollectionSlug, GlobalSlug } from './momentum.types';");
	});

	it('should not import GlobalSlug when no globals', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).not.toContain('GlobalSlug');
	});

	it('should export typed MomentumAdminConfig with CollectionSlug', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('export const adminConfig: MomentumAdminConfig<CollectionSlug> = {');
	});

	it('should export typed MomentumAdminConfig with CollectionSlug and GlobalSlug', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			globals: [{ slug: 'settings', fields: [] }],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain(
			'export const adminConfig: MomentumAdminConfig<CollectionSlug, GlobalSlug> = {',
		);
	});

	it('should inline collections as object literals', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [{ name: 'title', type: 'text', required: true }],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('collections: [');
		expect(output).toContain('slug: "posts"');
		expect(output).toContain('name: "title"');
		expect(output).toContain('type: "text"');
		expect(output).toContain('required: true');
	});

	it('should inline globals as object literals', () => {
		const config = {
			collections: [],
			globals: [
				{
					slug: 'site-settings',
					label: 'Site Settings',
					fields: [{ name: 'siteName', type: 'text' }],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('globals: [');
		expect(output).toContain('slug: "site-settings"');
		expect(output).toContain('label: "Site Settings"');
	});

	it('should merge plugin collections into top-level collections', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'auth',
					collections: [{ slug: 'auth-user', fields: [{ name: 'email', type: 'email' }] }],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('slug: "posts"');
		expect(output).toContain('slug: "auth-user"');
		// Both in the collections array, not via plugin imports
		expect(output).not.toContain("from '@momentumcms/auth");
	});

	it('should apply modifyCollections at build time', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
			plugins: [
				{
					name: 'analytics',
					modifyCollections(collections: unknown[]): void {
						for (const c of collections) {
							const col = c as { fields: Array<{ name: string; type: string }> };
							col.fields.push({ name: 'analytics_id', type: 'text' });
						}
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// The injected field should be present in the inlined output
		expect(output).toContain('analytics_id');
	});

	it('should import plugin admin routes via browserImports', () => {
		const config = {
			collections: [],
			plugins: [
				{
					name: 'analytics',
					adminRoutes: [
						{
							path: 'analytics',
							loadComponent: () => Promise.resolve({}),
							label: 'Analytics',
							icon: 'chart',
						},
					],
					browserImports: {
						adminRoutes: {
							path: '@momentumcms/plugins/analytics/admin-routes',
							exportName: 'analyticsAdminRoutes',
						},
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain(
			"import { analyticsAdminRoutes } from '@momentumcms/plugins/analytics/admin-routes';",
		);
		expect(output).toContain('adminRoutes: analyticsAdminRoutes');
	});

	it('should serialize admin settings', () => {
		const config = {
			collections: [],
			admin: { basePath: '/admin', branding: { title: 'My CMS' }, toasts: true },
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('admin: {');
		expect(output).toContain('basePath: "/admin"');
		expect(output).toContain('title: "My CMS"');
		expect(output).toContain('toasts: true');
	});

	it('should skip server-only plugins (no admin routes)', () => {
		const config = {
			collections: [],
			plugins: [{ name: 'server-only-plugin' }],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).not.toContain('server-only-plugin');
		expect(output).not.toContain('plugins:');
	});

	it('should not contain server-only imports', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [] }],
			plugins: [
				{
					name: 'auth',
					collections: [{ slug: 'auth-user', fields: [] }],
					browserImports: {
						collections: {
							path: '@momentumcms/auth/collections',
							exportName: 'AUTH_COLLECTIONS',
						},
					},
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		// Should NOT import user collection files
		expect(output).not.toContain('better-auth');
		expect(output).not.toContain('@momentumcms/db-drizzle');
		expect(output).not.toContain('@momentumcms/storage');
		expect(output).not.toContain("from 'pg'");
		expect(output).not.toContain("from 'node:");
		// Should NOT import plugin collections (they're inlined)
		expect(output).not.toContain('AUTH_COLLECTIONS');
	});

	it('should handle empty config', () => {
		const config = { collections: [] };
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('collections: [],');
		expect(output).not.toContain('globals:');
		expect(output).not.toContain('plugins:');
	});

	it('should handle types file in different directory', () => {
		const config = { collections: [{ slug: 'posts', fields: [] }] };
		const output = generateAdminConfig(config, '../../types/src/momentum.types');
		expect(output).toContain("from '../../types/src/momentum.types';");
	});

	it('should strip server-only field properties in inlined collections', () => {
		const config = {
			collections: [
				{
					slug: 'posts',
					fields: [
						{
							name: 'title',
							type: 'text',
							access: { read: () => true },
							hooks: { beforeChange: [() => ({})] },
							validate: () => true,
						},
					],
				},
			],
		};
		const output = generateAdminConfig(config, './momentum.types');
		expect(output).toContain('name: "title"');
		// Count occurrences - access/hooks/validate should not appear in the inlined fields
		expect(output).not.toMatch(/\baccess\b/);
		expect(output).not.toMatch(/\bhooks\b/);
		expect(output).not.toMatch(/\bvalidate\b/);
	});
});

// ============================================
// slugToPascalCase Tests
// ============================================

describe('slugToPascalCase', () => {
	it('should convert simple slug to PascalCase', () => {
		expect(slugToPascalCase('posts')).toBe('Posts');
	});

	it('should convert kebab-case to PascalCase', () => {
		expect(slugToPascalCase('auth-user')).toBe('AuthUser');
	});

	it('should convert multi-part slug to PascalCase', () => {
		expect(slugToPascalCase('hook-test-items')).toBe('HookTestItems');
	});

	it('should handle single character segments', () => {
		expect(slugToPascalCase('a-b-c')).toBe('ABC');
	});

	it('should handle empty string', () => {
		expect(slugToPascalCase('')).toBe('');
	});
});

// ============================================
// Security: String escaping in generated output
// ============================================

describe('security: string escaping in generated TypeScript', () => {
	it('should escape single quotes in select option values', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'status',
							type: 'select',
							options: [{ label: "It's active", value: "it's-active" }],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		// The generated output must be valid TypeScript — no unescaped single quotes
		// that would break string literal boundaries
		expect(output).not.toContain("'it's-active'"); // broken TS
		expect(output).toContain("it's-active"); // value is preserved
	});

	it('should escape single quotes in radio option values', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'priority',
							type: 'radio',
							options: [{ label: "Can't wait", value: "can't-wait" }],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).not.toContain("'can't-wait'"); // broken TS
		expect(output).toContain("can't-wait"); // value is preserved
	});

	it('should escape single quotes in collection slugs used in type unions', () => {
		const config = {
			collections: [{ slug: "o'reilly", fields: [] }],
		};
		const output = generateTypes(config);
		// Must not produce: 'o'reilly' which breaks the string literal
		expect(output).not.toMatch(/'o'reilly'/);
		// The slug value must still appear somewhere in the output
		expect(output).toContain("o'reilly");
	});

	it('should escape single quotes in block slug discriminants', () => {
		const config = {
			collections: [
				{
					slug: 'pages',
					fields: [
						{
							name: 'content',
							type: 'blocks',
							blocks: [
								{
									slug: "hero's-block",
									fields: [{ name: 'heading', type: 'text' }],
								},
							],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		// Must not produce: blockType: 'hero's-block' (broken TS)
		expect(output).not.toContain("'hero's-block'");
		expect(output).toContain("hero's-block"); // value preserved
	});

	it('should escape single quotes in where clause option unions', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'category',
							type: 'select',
							options: [{ label: "Women's", value: "women's" }],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		// Where clause should also have safe escaping
		expect(output).not.toContain("'women's'");
		expect(output).toContain("women's");
	});

	it('should escape single quotes in global slugs', () => {
		const config = {
			collections: [],
			globals: [{ slug: "ceo's-note", fields: [{ name: 'body', type: 'text' }] }],
		};
		const output = generateTypes(config);
		expect(output).not.toMatch(/'ceo's-note'/);
		expect(output).toContain("ceo's-note");
	});

	it('should escape single quotes in serializeValue object keys', () => {
		const result = serializeValue({ "it's-key": 'value' });
		// Object key with a single quote must be properly escaped
		expect(result).not.toContain("'it's-key'");
		expect(result).toContain("it's-key");
	});

	it('should not allow code injection via malicious option value', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [
						{
							name: 'status',
							type: 'select',
							options: [{ label: 'Injected', value: "'; }; x('bad');//" }],
						},
					],
				},
			],
		};
		const output = generateTypes(config);
		// The original bug wrapped values in single quotes: 'val'
		// A value containing ' would break out: ''; }; x('bad');//'
		// Fix: values are double-quoted via JSON.stringify, preventing breakout
		expect(output).not.toMatch(/status\?: '.*x\(/);
		// Value should be safely inside double quotes
		expect(output).toContain(`"'; }; x('bad');//"`);
	});

	it('should not allow code injection via malicious collection slug', () => {
		const config = {
			collections: [{ slug: "x'; }; x('bad');//", fields: [] }],
		};
		const output = generateTypes(config);
		// Slug should be safely double-quoted in type unions, not single-quoted
		expect(output).toContain(`"x'; }; x('bad');//"`);
		// Interface name must be sanitized — no special characters
		expect(output).not.toMatch(/export interface.*[';]/);
	});
});
