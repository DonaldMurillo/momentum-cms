import { describe, it, expect } from 'vitest';
import { generateTypes } from '../generate-types';

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

	it('should generate global with empty fields containing only updatedAt', () => {
		const config = {
			collections: [],
			globals: [
				{
					slug: 'empty-global',
					fields: [],
				},
			],
		};
		const output = generateTypes(config);
		expect(output).toContain('export interface EmptyGlobalGlobal {');
		expect(output).toContain('updatedAt: string;');
		// The interface should close right after updatedAt (no data fields)
		const interfaceMatch = output.match(/export interface EmptyGlobalGlobal \{([\s\S]*?)\}/);
		expect(interfaceMatch).toBeDefined();
		const body = (interfaceMatch as RegExpMatchArray)[1];
		// Should only contain updatedAt, no other field properties
		expect(body.trim()).toBe('updatedAt: string;');
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

	// Security: softDelete.field sanitization (defense in depth)
	it('should quote softDelete.field values that need quoting', () => {
		const config = {
			collections: [
				{
					slug: 'items',
					fields: [{ name: 'title', type: 'text' }],
					softDelete: { field: 'deleted-at' },
				},
			],
		};
		const output = generateTypes(config);
		// Hyphenated name should be quoted in the output
		expect(output).toContain('"deleted-at"?: string | null;');
		// Should NOT appear unquoted
		expect(output).not.toMatch(/\s+deleted-at\?:/);
	});
});
