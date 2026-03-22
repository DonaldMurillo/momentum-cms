import { describe, it, expect } from 'vitest';
import {
	serializeValue,
	serializeField,
	serializeCollection,
	serializeGlobal,
} from '../serialization';
import { generateTypes } from '../generate-types';

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

	it('should serialize block editor property when defined', () => {
		const result = serializeField({
			name: 'content',
			type: 'blocks',
			blocks: [
				{
					slug: 'richContent',
					fields: [{ name: 'body', type: 'text' }],
					editor: { type: 'lexical', features: ['bold', 'italic'] },
				},
			],
		});
		expect(result).toContain('slug: "richContent"');
		expect(result).toContain('editor:');
		expect(result).toContain('type: "lexical"');
		expect(result).toContain('"bold"');
		expect(result).toContain('"italic"');
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

	it('should serialize tab description when present', () => {
		const result = serializeField({
			name: 'settings',
			type: 'tabs',
			tabs: [
				{
					label: 'General',
					description: 'General configuration options',
					fields: [{ name: 'siteName', type: 'text' }],
				},
			],
		});
		expect(result).toContain('tabs:');
		expect(result).toContain('label: "General"');
		expect(result).toContain('description: "General configuration options"');
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

	it('should serialize admin.preview with package-style import (no rewriting needed)', () => {
		const configPath = '/project/src/momentum.config.ts';
		const outputPath = '/project/src/generated/momentum.config.ts';
		const result = serializeCollection(
			{
				slug: 'pages',
				fields: [{ name: 'slug', type: 'text' }],
				admin: {
					useAsTitle: 'title',
					preview: {
						component: () => import('@test-app/previews').then((m) => m.serializeValue),
					},
				},
			},
			'\t',
			configPath,
			outputPath,
		);
		expect(result).toContain('useAsTitle');
		expect(result).toContain('preview');
		expect(result).toContain('component:');
		// Package path should be preserved as-is
		expect(result).toContain('@test-app/previews');
		expect(result).toMatch(/component:\s*\(\)\s*=>\s*import\(/);
	});

	it('should serialize admin.preview with relative import (path rewriting)', () => {
		const configPath = '/project/src/collections/pages.collection.ts';
		const outputPath = '/project/src/generated/momentum.config.ts';
		const result = serializeCollection(
			{
				slug: 'pages',
				fields: [{ name: 'slug', type: 'text' }],
				admin: {
					useAsTitle: 'title',
					preview: {
						component: () => import('../serialization').then((m) => m.serializeValue),
					},
				},
			},
			'\t',
			configPath,
			outputPath,
		);
		expect(result).toContain('preview');
		expect(result).toMatch(/component:\s*\(\)\s*=>\s*import\(/);
	});

	it('should serialize admin.preview with providers loader', () => {
		const configPath = '/project/src/momentum.config.ts';
		const outputPath = '/project/src/generated/momentum.config.ts';
		const result = serializeCollection(
			{
				slug: 'pages',
				fields: [{ name: 'slug', type: 'text' }],
				admin: {
					preview: {
						component: () => import('@test-app/previews').then((m) => m.PagePreviewComponent),
						providers: () => import('@test-app/pages').then((m) => m.providePageBlocks()),
					},
				},
			},
			'\t',
			configPath,
			outputPath,
		);
		expect(result).toContain('preview');
		expect(result).toContain('component:');
		expect(result).toContain('providers:');
		// providers should call the factory function with ()
		expect(result).toMatch(/providePageBlocks\(\)/);
	});

	it('should strip admin.preview when no configPath/outputPath provided', () => {
		const result = serializeCollection({
			slug: 'pages',
			fields: [{ name: 'slug', type: 'text' }],
			admin: {
				useAsTitle: 'title',
				preview: { component: () => Promise.resolve({}) },
			},
		});
		expect(result).toContain('useAsTitle');
		// Without paths, can't rewrite imports, so preview is stripped
		expect(result).not.toContain('preview');
	});

	it('should serialize upload config on collection', () => {
		const result = serializeCollection({
			slug: 'media',
			fields: [{ name: 'alt', type: 'text' }],
			upload: {
				mimeTypes: ['image/*', 'application/pdf'],
				maxFileSize: 10000000,
			},
		});
		expect(result).toContain('slug: "media"');
		expect(result).toContain('upload:');
		expect(result).toContain('"image/*"');
		expect(result).toContain('"application/pdf"');
		expect(result).toContain('maxFileSize: 10000000');
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

// ============================================
// Security: Object key quoting in serializeField / serializeFieldAdmin
// ============================================

describe('security: object key injection in serializeField', () => {
	it('should quote keys with special characters in generic field properties', () => {
		// A field with a crafted property name that could break out of the object literal
		const field = {
			name: 'title',
			type: 'text',
			'foo: 1 }; console.log("injected"); const x = { a': 'gotcha',
		};
		const result = serializeField(field);
		// The malicious key must be quoted, not interpolated raw
		expect(result).not.toContain('foo: 1 }; console.log("injected")');
		// It should appear as a safely quoted key
		expect(result).toContain('"foo: 1 }; console.log(\\"injected\\"); const x = { a"');
	});

	it('should quote keys with single quotes in generic field properties', () => {
		const field = {
			name: 'test',
			type: 'text',
			"it's-broken": true,
		};
		const result = serializeField(field);
		// Key must not be emitted raw (would be invalid TS identifier)
		expect(result).toContain('"it\'s-broken"');
	});

	it('should quote keys with special characters in field admin config', () => {
		const field = {
			name: 'title',
			type: 'text',
			admin: {
				'evil: 1 }; hack();//': 'payload',
				position: 'main',
			},
		};
		const result = serializeField(field);
		// The malicious admin key must NOT appear as a raw unquoted key
		// (an unquoted key would look like: \tevil: 1 }; hack();//: "payload")
		expect(result).not.toMatch(/\tevil: 1 \}/);
		// It should appear as a safely JSON-quoted key
		expect(result).toContain('"evil: 1 }; hack();//": "payload"');
		// Normal key should still work
		expect(result).toContain('position: "main"');
	});
});
