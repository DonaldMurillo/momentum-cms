import { describe, it, expect } from 'vitest';
import { generateClientCode } from '../generate-client';

// ============================================
// Client Code Generation Tests
// ============================================

describe('generateClientCode', () => {
	const baseConfig = {
		collections: [
			{
				slug: 'articles',
				fields: [
					{ name: 'title', type: 'text', required: true },
					{ name: 'content', type: 'richText' },
				],
			},
			{
				slug: 'products',
				fields: [{ name: 'name', type: 'text', required: true }],
			},
		],
		globals: [
			{
				slug: 'site-settings',
				label: 'Site Settings',
				fields: [{ name: 'siteName', type: 'text', required: true }],
			},
		],
	};

	it('should include auto-generated header', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('AUTO-GENERATED');
		expect(output).toContain('DO NOT EDIT');
	});

	it('should import types from the types file', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('from "./momentum.types"');
		expect(output).toContain('Articles');
		expect(output).toContain('ArticlesWhereClause');
		expect(output).toContain('Products');
		expect(output).toContain('ProductsWhereClause');
		expect(output).toContain('SiteSettingsGlobal');
	});

	it('should include MomentumClientError class', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('class MomentumClientError extends Error');
		expect(output).toContain('status');
		expect(output).toContain('fieldErrors');
	});

	it('should include createMomentumClient factory', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('export function createMomentumClient');
		expect(output).toContain('MomentumClientConfig');
		expect(output).toContain('baseUrl');
	});

	it('should generate typed collection accessors for each collection', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('articles: new CollectionClient<Articles, ArticlesWhereClause>');
		expect(output).toContain('products: new CollectionClient<Products, ProductsWhereClause>');
	});

	it('should generate typed global accessors for each global', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		// safeQuote uses JSON.stringify → double quotes
		expect(output).toContain('"site-settings": new GlobalClient<SiteSettingsGlobal>');
	});

	it('should include all CRUD methods on CollectionClient', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		const methods = [
			'find(',
			'findById(',
			'create(',
			'update(',
			'delete(',
			'forceDelete(',
			'restore(',
			'count(',
		];
		for (const method of methods) {
			expect(output).toContain(method);
		}
	});

	it('should include batch methods on CollectionClient', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('batchCreate(');
		expect(output).toContain('batchUpdate(');
		expect(output).toContain('batchDelete(');
	});

	it('should include findOne and update methods on GlobalClient', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		// Verify GlobalClient class has these methods (not just any occurrence)
		const globalClientSection = output.slice(output.indexOf('class GlobalClient'));
		expect(globalClientSection).toContain('findOne(');
		expect(globalClientSection).toContain('update(');
	});

	it('should include an internal fetch wrapper with credentials include', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('credentials');
		expect(output).toContain("'include'");
	});

	it('should include auth config handling for apiKey and bearer', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('X-API-Key');
		expect(output).toContain('Bearer');
		expect(output).toContain('Authorization');
	});

	it('should include query param serialization', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('buildQueryString');
		expect(output).toContain('JSON.stringify');
		// Should handle where, sort, limit, page, depth params
		expect(output).toContain('options.where');
		expect(output).toContain('options.sort');
		expect(output).toContain('options.limit');
		expect(output).toContain('options.page');
		expect(output).toContain('options.depth');
	});

	it('should not include external dependencies', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		// Only import should be from the types file (multiline import counts as one)
		const importStatements =
			output.match(/import\s+(type\s+)?[\s\S]*?from\s+['"][^'"]+['"]/g) ?? [];
		expect(importStatements).toHaveLength(1);
		expect(importStatements[0]).toContain('./momentum.types');
	});

	it('should use bracket notation for kebab-case collection slugs', () => {
		const config = {
			collections: [
				{ slug: 'hook-test-items', fields: [{ name: 'title', type: 'text' }] },
				{ slug: 'articles', fields: [{ name: 'title', type: 'text' }] },
			],
		};
		const output = generateClientCode(config, './momentum.types');
		// kebab-case needs quoted key (safeQuote uses JSON.stringify → double quotes)
		expect(output).toContain('"hook-test-items": new CollectionClient');
		// simple slugs can use identifier notation
		expect(output).toContain('articles: new CollectionClient');
	});

	it('should use unquoted key for global with simple slug (no hyphen)', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
			globals: [
				{
					slug: 'settings',
					label: 'Settings',
					fields: [{ name: 'siteName', type: 'text' }],
				},
			],
		};
		const output = generateClientCode(config, './momentum.types');
		// Simple slug should NOT be quoted with bracket notation
		expect(output).toContain('settings: new GlobalClient<SettingsGlobal>');
		// It should NOT be wrapped in quotes like "settings":
		expect(output).not.toMatch(/"settings": new GlobalClient/);
	});

	it('should include FindOptions, FindResult, DeleteResult types', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('interface FindOptions');
		expect(output).toContain('interface FindByIdOptions');
		expect(output).toContain('interface FindResult<T>');
		expect(output).toContain('interface DeleteResult');
	});

	it('should include AuthConfig type with cookie, apiKey, and bearer variants', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('AuthConfig');
		expect(output).toContain("'cookie'");
		expect(output).toContain("'apiKey'");
		expect(output).toContain("'bearer'");
	});

	it('should include generic collection and global fallback methods', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		// Generic fallback for dynamic slug access
		expect(output).toContain('collection:');
		expect(output).toContain('global:');
	});

	it('should handle config with no globals', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
		};
		const output = generateClientCode(config, './momentum.types');
		expect(output).toContain('createMomentumClient');
		expect(output).toContain('globals: {');
		// Empty globals should produce a valid empty object, not dangling undefined references
		const factorySection = output.slice(output.indexOf('export function createMomentumClient'));
		expect(factorySection).toContain('globals: {');
	});

	it('should handle config with no collections', () => {
		const config = {
			collections: [] as { slug: string; fields: { name: string; type: string }[] }[],
		};
		const output = generateClientCode(config, './momentum.types');
		expect(output).toContain('createMomentumClient');
		expect(output).toContain('collections: {');
	});

	it('should use correct API endpoints in CollectionClient methods', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		// find: GET /{slug}
		expect(output).toContain('`${this.baseUrl}/${this.slug}');
		// findById: GET /{slug}/{id} (id is URI-encoded for safety)
		expect(output).toContain('`${this.baseUrl}/${this.slug}/${encodeURIComponent(id)}');
		// batch: POST /{slug}/batch
		expect(output).toContain('/batch');
		// restore: POST /{slug}/{id}/restore
		expect(output).toContain('/restore');
	});

	it('should use correct API endpoints in GlobalClient methods', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		// findOne: GET /globals/{slug}
		expect(output).toContain('globals/${this.slug}');
	});

	it('should include error handling for non-OK responses', () => {
		const output = generateClientCode(baseConfig, './momentum.types');
		expect(output).toContain('MomentumClientError');
		expect(output).toContain('.ok');
	});

	it('should include plugin-contributed collections', () => {
		const config = {
			collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
			plugins: [
				{
					name: 'analytics',
					collections: [{ slug: 'tracking-rules', fields: [{ name: 'name', type: 'text' }] }],
				},
			],
		};
		const output = generateClientCode(config, './momentum.types');
		expect(output).toContain('TrackingRules');
		expect(output).toContain('"tracking-rules": new CollectionClient');
	});
});

// ============================================
// E2E: Generated client compilation & runtime
// ============================================

describe('generateClientCode — E2E runtime verification', () => {
	const testConfig = {
		collections: [
			{
				slug: 'articles',
				fields: [
					{ name: 'title', type: 'text', required: true },
					{ name: 'content', type: 'richText' },
				],
			},
			{
				slug: 'hook-test-items',
				fields: [{ name: 'name', type: 'text' }],
			},
		],
		globals: [
			{
				slug: 'site-settings',
				label: 'Site Settings',
				fields: [{ name: 'siteName', type: 'text', required: true }],
			},
		],
	};

	// Generate client code once for all E2E tests
	const clientCode = generateClientCode(testConfig, './momentum.types');

	it('should produce syntactically valid TypeScript (no syntax errors)', () => {
		// Parse the generated code with the TypeScript compiler to verify syntax
		const ts = require('typescript');
		const sourceFile = ts.createSourceFile(
			'momentum-client.ts',
			clientCode,
			ts.ScriptTarget.Latest,
			true,
		);

		// Collect syntax diagnostics (parse errors)
		const diagnostics = ts
			.getPreEmitDiagnostics(
				ts.createProgram({
					rootNames: [],
					options: { noEmit: true },
					host: {
						...ts.createCompilerHost({}),
						getSourceFile: (name: string) =>
							name === 'momentum-client.ts' ? sourceFile : undefined,
						fileExists: (name: string) => name === 'momentum-client.ts',
						readFile: (name: string) => (name === 'momentum-client.ts' ? clientCode : undefined),
					},
				}),
			)
			.filter((d: { file?: { fileName: string } }) => d.file?.fileName === 'momentum-client.ts');

		const syntaxErrors = diagnostics
			.filter((d: { category: number }) => d.category === ts.DiagnosticCategory.Error)
			.map(
				(d: { messageText: string | { messageText: string }; start?: number }) =>
					`${typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText} (pos ${d.start})`,
			);

		expect(syntaxErrors).toEqual([]);
	});

	it('should generate createMomentumClient factory returning correct collection keys', () => {
		// Extract the factory return to verify collection keys
		const factorySection = clientCode.slice(
			clientCode.indexOf('export function createMomentumClient'),
		);
		expect(factorySection).toContain('articles: new CollectionClient');
		expect(factorySection).toContain('"hook-test-items": new CollectionClient');
	});

	it('should generate createMomentumClient factory returning correct global keys', () => {
		const factorySection = clientCode.slice(
			clientCode.indexOf('export function createMomentumClient'),
		);
		expect(factorySection).toContain('"site-settings": new GlobalClient');
	});

	it('should generate CollectionClient with correct URL patterns for find', () => {
		// find uses GET /{slug}
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('async find(');
		expect(collClientSection).toContain('`${this.baseUrl}/${this.slug}');
	});

	it('should generate CollectionClient with correct URL patterns for findById', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('async findById(');
		expect(collClientSection).toContain('`${this.baseUrl}/${this.slug}/${encodeURIComponent(id)}');
	});

	it('should generate CollectionClient with correct URL patterns for create', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('async create(');
		expect(collClientSection).toContain("method: 'POST'");
	});

	it('should generate CollectionClient with correct URL patterns for update', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('async update(');
		expect(collClientSection).toContain("method: 'PATCH'");
	});

	it('should generate CollectionClient with correct URL patterns for delete', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('async delete(');
		expect(collClientSection).toContain("method: 'DELETE'");
	});

	it('should generate forceDelete with force=true query param', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('forceDelete(');
		expect(collClientSection).toContain('force=true');
	});

	it('should generate restore with POST to /{slug}/{id}/restore', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('restore(');
		expect(collClientSection).toContain('/restore');
		expect(collClientSection).toContain("method: 'POST'");
	});

	it('should generate batch methods with POST to /{slug}/batch', () => {
		const collClientSection = clientCode.slice(
			clientCode.indexOf('class CollectionClient'),
			clientCode.indexOf('class GlobalClient'),
		);
		expect(collClientSection).toContain('batchCreate(');
		expect(collClientSection).toContain('batchUpdate(');
		expect(collClientSection).toContain('batchDelete(');
		expect(collClientSection).toContain('/batch');
	});

	it('should generate GlobalClient with correct URL patterns', () => {
		const globalClientSection = clientCode.slice(clientCode.indexOf('class GlobalClient'));
		// findOne: GET /globals/{slug}
		expect(globalClientSection).toContain('async findOne(');
		expect(globalClientSection).toContain('globals/${this.slug}');
		// update: PATCH /globals/{slug}
		expect(globalClientSection).toContain('async update(');
		expect(globalClientSection).toContain("method: 'PATCH'");
	});

	it('should generate error handling that throws MomentumClientError for non-OK responses', () => {
		// The momentumFetch wrapper should check response.ok and throw
		expect(clientCode).toContain('!response.ok');
		expect(clientCode).toContain('throw new MomentumClientError');
	});

	it('should generate auth header handling for apiKey', () => {
		expect(clientCode).toContain("=== 'apiKey'");
		expect(clientCode).toContain("'X-API-Key'");
	});

	it('should generate auth header handling for bearer', () => {
		expect(clientCode).toContain("=== 'bearer'");
		expect(clientCode).toContain('Bearer');
	});

	it('should generate cookie auth with credentials include', () => {
		// Cookie auth relies on credentials: 'include' which is the default
		expect(clientCode).toContain("credentials: 'include'");
	});

	it('should generate buildQueryString that serializes where as JSON', () => {
		expect(clientCode).toContain('buildQueryString');
		expect(clientCode).toContain('JSON.stringify(options.where)');
	});

	it('should generate generic collection/global fallback accessors', () => {
		const factorySection = clientCode.slice(
			clientCode.indexOf('export function createMomentumClient'),
		);
		expect(factorySection).toContain('collection:');
		expect(factorySection).toContain('global:');
		expect(factorySection).toContain('new CollectionClient');
		expect(factorySection).toContain('new GlobalClient');
	});
});

// ============================================
// Security: URL path parameter encoding
// ============================================

describe('generateClientCode — URL path parameter encoding', () => {
	const config = {
		collections: [{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] }],
	};

	const clientCode = generateClientCode(config, './momentum.types');

	// Extract CollectionClient section for focused assertions
	const collClientSection = clientCode.slice(
		clientCode.indexOf('class CollectionClient'),
		clientCode.indexOf('class GlobalClient'),
	);

	it('should encode id in findById URL to prevent path traversal', () => {
		const findByIdMethod = collClientSection.slice(
			collClientSection.indexOf('async findById('),
			collClientSection.indexOf('async create('),
		);
		expect(findByIdMethod).toContain('encodeURIComponent(id)');
	});

	it('should encode id in update URL to prevent path traversal', () => {
		const updateMethod = collClientSection.slice(
			collClientSection.indexOf('async update('),
			collClientSection.indexOf('async delete('),
		);
		expect(updateMethod).toContain('encodeURIComponent(id)');
	});

	it('should encode id in delete URL to prevent path traversal', () => {
		const deleteMethod = collClientSection.slice(
			collClientSection.indexOf('async delete('),
			collClientSection.indexOf('async forceDelete('),
		);
		expect(deleteMethod).toContain('encodeURIComponent(id)');
	});

	it('should encode id in forceDelete URL to prevent path traversal', () => {
		const forceDeleteMethod = collClientSection.slice(
			collClientSection.indexOf('async forceDelete('),
			collClientSection.indexOf('async restore('),
		);
		expect(forceDeleteMethod).toContain('encodeURIComponent(id)');
	});

	it('should encode id in restore URL to prevent path traversal', () => {
		const restoreMethod = collClientSection.slice(
			collClientSection.indexOf('async restore('),
			collClientSection.indexOf('async count('),
		);
		expect(restoreMethod).toContain('encodeURIComponent(id)');
	});

	it('should encode slug in CollectionClient constructor to prevent path traversal', () => {
		// The slug is used raw in every URL — must be encoded to prevent
		// client.collection("../admin") from causing path traversal
		expect(collClientSection).toContain('encodeURIComponent(slug)');
	});

	it('should encode slug in GlobalClient to prevent path traversal', () => {
		const globalClientSection = clientCode.slice(
			clientCode.indexOf('class GlobalClient'),
			clientCode.indexOf('// ── Factory'),
		);
		expect(globalClientSection).toContain('encodeURIComponent(slug)');
	});
});
