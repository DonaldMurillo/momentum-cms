/**
 * Momentum CMS Unified Code Generator
 *
 * Single-pass generator that reads momentum.config.ts and produces two output files:
 * 1. Types file (--types): TypeScript interfaces for all collections + globals
 * 2. Admin config file (--config): Browser-safe Angular config with inlined, stripped collections
 *
 * Usage:
 *   npx tsx generator.ts <configPath> --types <typesOutput> --config <configOutput> [--watch]
 */

/* eslint-disable no-console, local/no-direct-browser-apis -- CLI tool: console output and Node.js setTimeout are legitimate */
import { writeFileSync, mkdirSync, watch } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	slugToPascalCase,
	fieldTypeToTS,
	generateFieldsInterface,
	generateBlockTypes,
	generateWhereClauseInterface,
	safeQuote,
} from './field-to-typescript';
import { flattenDataFields } from '../lib/fields/field.types';
import type { Field } from '../lib/fields/field.types';

// ============================================
// Minimal interfaces for config loading
// (avoids importing full types that pull in server deps)
// ============================================

interface FieldDefinition {
	name: string;
	type: string;
	required?: boolean;
	unique?: boolean;
	hasMany?: boolean;
	label?: string;
	description?: string;
	options?: Array<{ value: string | number; label?: string }>;
	fields?: FieldDefinition[];
	blocks?: Array<{
		slug: string;
		fields: FieldDefinition[];
		labels?: { singular?: string; plural?: string };
		editor?: Record<string, unknown>;
	}>;
	tabs?: Array<{ name?: string; label: string; description?: string; fields: FieldDefinition[] }>;
	collection?: () => unknown;
	relationTo?: string | Array<() => unknown>;
	from?: string;
	defaultValue?: unknown;
	defaultOpen?: boolean;
	onDelete?: string;
	filterOptions?: unknown;
	admin?: Record<string, unknown>;
	access?: unknown;
	hooks?: unknown;
	validate?: unknown;
	// Number/date display
	displayFormat?: Record<string, unknown>;
	// Constraints
	minLength?: number;
	maxLength?: number;
	rows?: number;
	min?: number;
	max?: number;
	step?: number;
	minRows?: number;
	maxRows?: number;
	displayField?: string;
	// Upload
	mimeTypes?: string[];
	maxSize?: number;
}

interface CollectionDefinition {
	slug: string;
	labels?: { singular?: string; plural?: string };
	fields: FieldDefinition[];
	admin?: Record<string, unknown>;
	access?: unknown;
	hooks?: unknown;
	auth?: unknown;
	timestamps?: boolean | { createdAt?: boolean; updatedAt?: boolean };
	versions?: boolean | { drafts?: boolean; maxPerDoc?: number };
	softDelete?: boolean | { field?: string; retentionDays?: number };
	managed?: boolean;
	dbName?: string;
	indexes?: unknown[];
	defaultSort?: string;
	graphQL?: unknown;
	defaultWhere?: unknown;
	endpoints?: unknown[];
	webhooks?: unknown[];
	upload?: {
		mimeTypes?: string[];
		maxFileSize?: number;
		directory?: string;
		filenameField?: string;
		mimeTypeField?: string;
		filesizeField?: string;
		pathField?: string;
		urlField?: string;
	};
}

interface GlobalDefinition {
	slug: string;
	label?: string;
	fields: FieldDefinition[];
	admin?: Record<string, unknown>;
	access?: unknown;
	hooks?: unknown;
	versions?: boolean | { drafts?: boolean };
}

interface PluginBrowserImport {
	path: string;
	exportName: string;
}

interface PluginBrowserImports {
	collections?: PluginBrowserImport;
	adminRoutes?: PluginBrowserImport;
	modifyCollections?: PluginBrowserImport;
}

interface PluginDescriptor {
	name: string;
	collections?: Array<{ slug: string; fields?: FieldDefinition[] }>;
	adminRoutes?: Array<{
		path: string;
		loadComponent: unknown;
		data?: Record<string, unknown>;
		label: string;
		icon: string;
		group?: string;
	}>;
	modifyCollections?(collections: unknown[]): void;
	browserImports?: PluginBrowserImports;
}

interface MomentumConfig {
	collections: CollectionDefinition[];
	globals?: GlobalDefinition[];
	admin?: {
		basePath?: string;
		branding?: { logo?: string; title?: string };
		toasts?: boolean;
		components?: Record<string, unknown>;
	};
	plugins?: PluginDescriptor[];
}

interface GeneratorOptions {
	configPath: string;
	typesOutputPath: string;
	configOutputPath: string;
	clientOutputPath?: string;
	watch?: boolean;
}

// ============================================
// Config Loading
// ============================================

/**
 * Load config dynamically using dynamic import.
 */
async function loadConfig(configPath: string): Promise<MomentumConfig> {
	try {
		const configUrl = pathToFileURL(configPath).href;
		const configModule = await import(configUrl);
		return configModule.default || configModule;
	} catch (error) {
		throw new Error(`Failed to load config from ${configPath}: ${error}`);
	}
}

/**
 * Resolve all collections including plugin-contributed ones.
 * Applies modifyCollections at build time.
 */
function resolveAllCollections(config: MomentumConfig): CollectionDefinition[] {
	const allCollections = [...config.collections];
	for (const plugin of config.plugins ?? []) {
		if (plugin.collections) {
			for (const col of plugin.collections) {
				// Deduplicate by slug
				if (!allCollections.some((c) => c.slug === col.slug)) {
					allCollections.push({ ...col, fields: col.fields ?? [] });
				}
			}
		}
	}
	// Apply modifyCollections at build time
	for (const plugin of config.plugins ?? []) {
		if (plugin.modifyCollections) {
			plugin.modifyCollections(allCollections);
		}
	}
	return allCollections;
}

// ============================================
// Types Generation
// ============================================

/**
 * Generate TypeScript types from collection and global definitions.
 */
export function generateTypes(config: MomentumConfig): string {
	const allCollections = resolveAllCollections(config);
	const globals = config.globals ?? [];
	const lines: string[] = [];

	// Header
	lines.push('/**');
	lines.push(' * AUTO-GENERATED by @momentumcms/core');
	lines.push(' * DO NOT EDIT - regenerate with: nx run <app>:generate');
	lines.push(' */');
	lines.push('');

	// Collect block type declarations that need to appear before their parent interface
	const blockDeclarations: string[] = [];

	// Generate interface for each collection
	for (const collection of allCollections) {
		const interfaceName = slugToPascalCase(collection.slug);
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- boundary: local FieldDefinition[] → library Field[]
		const dataFields = flattenDataFields(collection.fields as Field[]);
		const hasVersionsDrafts = hasVersionsWithDrafts(collection);
		const hasSoftDelete = !!collection.softDelete;
		const hasTimestamps = collection.timestamps !== false;

		// Pre-generate block types for any blocks fields
		for (const field of dataFields) {
			if (field.type === 'blocks') {
				const blockResult = generateBlockTypes(collection.slug, field.name, field);
				blockDeclarations.push(blockResult.declarations);
			}
		}

		// Output any pending block declarations before this interface
		if (blockDeclarations.length > 0) {
			lines.push(blockDeclarations.join('\n'));
			blockDeclarations.length = 0;
		}

		lines.push(`export interface ${interfaceName} {`);
		lines.push(`  id: string;`);

		// Generate fields
		for (const field of dataFields) {
			const optional = field.required ? '' : '?';
			const propName = needsQuoting(field.name) ? safeQuote(field.name) : field.name;

			if (field.type === 'blocks') {
				// Use the generated union type name
				const blockResult = generateBlockTypes(collection.slug, field.name, field);
				lines.push(`  ${propName}${optional}: ${blockResult.unionTypeName}[];`);
			} else {
				const tsType = fieldTypeToTS(field);
				lines.push(`  ${propName}${optional}: ${tsType};`);
			}
		}

		// Version status field
		if (hasVersionsDrafts) {
			lines.push(`  _status?: 'draft' | 'published';`);
		}

		// Soft delete field
		if (hasSoftDelete) {
			const fieldName =
				typeof collection.softDelete === 'object' && collection.softDelete.field
					? collection.softDelete.field
					: 'deletedAt';
			lines.push(`  ${fieldName}?: string | null;`);
		}

		// Timestamps
		if (hasTimestamps) {
			lines.push(`  createdAt: string;`);
			lines.push(`  updatedAt: string;`);
		}

		lines.push(`}`);
		lines.push('');
	}

	// Generate global types
	if (globals.length > 0) {
		lines.push('// ── Global Types ───────────────────────────────');
		lines.push('');

		for (const global of globals) {
			const interfaceName = slugToPascalCase(global.slug) + 'Global';
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- boundary: local FieldDefinition[] → library Field[]
			const fieldsCode = generateFieldsInterface(global.fields as Field[]);

			lines.push(`export interface ${interfaceName} {`);
			if (fieldsCode) {
				lines.push(fieldsCode);
			}
			lines.push(`  updatedAt: string;`);
			lines.push(`}`);
			lines.push('');
		}
	}

	// Generate where clause interfaces
	lines.push('// ── Where Clauses ──────────────────────────────');
	lines.push('');

	for (const collection of allCollections) {
		const hasTimestamps = collection.timestamps !== false;
		lines.push(
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- boundary: local FieldDefinition[] → library Field[]
			generateWhereClauseInterface(collection.slug, collection.fields as Field[], hasTimestamps),
		);
		lines.push('');
	}

	// Collection slug union
	const slugs = allCollections.map((c) => safeQuote(c.slug)).join(' | ');
	lines.push(`export type CollectionSlug = ${slugs || 'never'};`);
	lines.push('');

	// Global slug union
	if (globals.length > 0) {
		const globalSlugs = globals.map((g) => safeQuote(g.slug)).join(' | ');
		lines.push(`export type GlobalSlug = ${globalSlugs};`);
		lines.push('');
	}

	// MomentumCollections mapping
	lines.push(`export interface MomentumCollections {`);
	for (const collection of allCollections) {
		const interfaceName = slugToPascalCase(collection.slug);
		lines.push(`  ${safeQuote(collection.slug)}: ${interfaceName};`);
	}
	lines.push(`}`);
	lines.push('');

	// MomentumGlobals mapping
	if (globals.length > 0) {
		lines.push(`export interface MomentumGlobals {`);
		for (const global of globals) {
			const interfaceName = slugToPascalCase(global.slug) + 'Global';
			lines.push(`  ${safeQuote(global.slug)}: ${interfaceName};`);
		}
		lines.push(`}`);
		lines.push('');
	}

	// TypedMomentumCollections
	lines.push(`export type TypedMomentumCollections = {`);
	for (const collection of allCollections) {
		const interfaceName = slugToPascalCase(collection.slug);
		lines.push(
			`  ${safeQuote(collection.slug)}: { doc: ${interfaceName}; where: ${interfaceName}WhereClause };`,
		);
	}
	lines.push(`};`);
	lines.push('');

	// Helper types
	lines.push(`export type DocumentType<S extends CollectionSlug> = MomentumCollections[S];`);
	lines.push('');
	lines.push(
		`export type WhereClauseType<S extends CollectionSlug> = TypedMomentumCollections[S]['where'];`,
	);
	lines.push('');

	return lines.join('\n');
}

// ============================================
// Client Code Generation
// ============================================

/**
 * Generate a self-contained, framework-agnostic TypeScript API client.
 *
 * The output file imports types from the generated types file and inlines
 * all runtime code (fetch wrapper, error class, collection/global clients).
 * Only the factory's typed accessor map is project-specific.
 */
export function generateClientCode(config: MomentumConfig, typesImportPath: string): string {
	const allCollections = resolveAllCollections(config);
	const globals = config.globals ?? [];
	const lines: string[] = [];

	// Header
	lines.push('/**');
	lines.push(' * AUTO-GENERATED by @momentumcms/core');
	lines.push(' * DO NOT EDIT - regenerate with: nx run <app>:generate');
	lines.push(' */');
	lines.push('');

	// Collect all type names needed for the import
	const typeImports: string[] = [];
	for (const col of allCollections) {
		const name = slugToPascalCase(col.slug);
		typeImports.push(name);
		typeImports.push(`${name}WhereClause`);
	}
	for (const global of globals) {
		typeImports.push(slugToPascalCase(global.slug) + 'Global');
	}

	lines.push(`import type {`);
	for (const t of typeImports) {
		lines.push(`\t${t},`);
	}
	lines.push(`} from '${typesImportPath}';`);
	lines.push('');

	// Error class
	lines.push(`// ── Error ──────────────────────────────────────`);
	lines.push('');
	lines.push(`export class MomentumClientError extends Error {`);
	lines.push(`\treadonly status: number;`);
	lines.push(`\treadonly fieldErrors: Array<{ field: string; message: string }>;`);
	lines.push('');
	lines.push(`\tconstructor(`);
	lines.push(`\t\tmessage: string,`);
	lines.push(`\t\tstatus = 500,`);
	lines.push(`\t\tfieldErrors: Array<{ field: string; message: string }> = [],`);
	lines.push(`\t) {`);
	lines.push(`\t\tsuper(message);`);
	lines.push(`\t\tthis.name = 'MomentumClientError';`);
	lines.push(`\t\tthis.status = status;`);
	lines.push(`\t\tthis.fieldErrors = fieldErrors;`);
	lines.push(`\t}`);
	lines.push(`}`);
	lines.push('');

	// Types
	lines.push(`// ── Types ──────────────────────────────────────`);
	lines.push('');
	lines.push(`export type AuthConfig =`);
	lines.push(`\t| { type: 'cookie' }`);
	lines.push(`\t| { type: 'apiKey'; key: string }`);
	lines.push(`\t| { type: 'bearer'; token: string };`);
	lines.push('');
	lines.push(`export interface MomentumClientConfig {`);
	lines.push(`\tbaseUrl: string;`);
	lines.push(`\tauth?: AuthConfig;`);
	lines.push(`\theaders?: Record<string, string>;`);
	lines.push(`\tfetch?: typeof globalThis.fetch;`);
	lines.push(`}`);
	lines.push('');
	lines.push(`export interface FindOptions {`);
	lines.push(`\twhere?: Record<string, unknown>;`);
	lines.push(`\tsort?: string;`);
	lines.push(`\tlimit?: number;`);
	lines.push(`\tpage?: number;`);
	lines.push(`\tdepth?: number;`);
	lines.push(`\twithDeleted?: boolean;`);
	lines.push(`\tonlyDeleted?: boolean;`);
	lines.push(`}`);
	lines.push('');
	lines.push(`export interface FindByIdOptions {`);
	lines.push(`\tdepth?: number;`);
	lines.push(`\twithDeleted?: boolean;`);
	lines.push(`}`);
	lines.push('');
	lines.push(`export interface FindResult<T> {`);
	lines.push(`\tdocs: T[];`);
	lines.push(`\ttotalDocs: number;`);
	lines.push(`\ttotalPages: number;`);
	lines.push(`\tpage: number;`);
	lines.push(`\tlimit: number;`);
	lines.push(`\thasNextPage: boolean;`);
	lines.push(`\thasPrevPage: boolean;`);
	lines.push(`\tnextPage?: number;`);
	lines.push(`\tprevPage?: number;`);
	lines.push(`}`);
	lines.push('');
	lines.push(`export interface DeleteResult {`);
	lines.push(`\tid: string;`);
	lines.push(`\tdeleted: boolean;`);
	lines.push(`}`);
	lines.push('');

	// Internal config type
	lines.push(`// ── Internals ──────────────────────────────────`);
	lines.push('');
	lines.push(`interface InternalConfig {`);
	lines.push(`\tbaseUrl: string;`);
	lines.push(`\theaders: Record<string, string>;`);
	lines.push(`\tfetchFn: typeof globalThis.fetch;`);
	lines.push(`}`);
	lines.push('');

	// Resolve config helper
	lines.push(`function resolveConfig(config: MomentumClientConfig): InternalConfig {`);
	lines.push(
		`\tconst headers: Record<string, string> = { 'Content-Type': 'application/json', ...config.headers };`,
	);
	lines.push(`\tif (config.auth?.type === 'apiKey') {`);
	lines.push(`\t\theaders['X-API-Key'] = config.auth.key;`);
	lines.push(`\t} else if (config.auth?.type === 'bearer') {`);
	lines.push(`\t\theaders['Authorization'] = \`Bearer \${config.auth.token}\`;`);
	lines.push(`\t}`);
	lines.push(`\treturn {`);
	lines.push(`\t\tbaseUrl: config.baseUrl.replace(/\\/+$/, ''),`);
	lines.push(`\t\theaders,`);
	lines.push(`\t\tfetchFn: config.fetch ?? globalThis.fetch.bind(globalThis),`);
	lines.push(`\t};`);
	lines.push(`}`);
	lines.push('');

	// Fetch wrapper
	lines.push(
		`async function momentumFetch<T>(url: string, init: RequestInit, config: InternalConfig): Promise<T> {`,
	);
	lines.push(`\tlet response: Response;`);
	lines.push(`\ttry {`);
	lines.push(`\t\tresponse = await config.fetchFn(url, {`);
	lines.push(`\t\t\t...init,`);
	lines.push(`\t\t\theaders: { ...config.headers, ...init.headers as Record<string, string> },`);
	lines.push(`\t\t\tcredentials: 'include',`);
	lines.push(`\t\t});`);
	lines.push(`\t} catch {`);
	lines.push(`\t\tthrow new MomentumClientError('Network error', 0);`);
	lines.push(`\t}`);
	lines.push(`\tif (!response.ok) {`);
	lines.push(
		`\t\tlet body: { error?: string; errors?: Array<{ field: string; message: string }> } = {};`,
	);
	lines.push(`\t\ttry { body = await response.json(); } catch { /* non-JSON error */ }`);
	lines.push(`\t\tthrow new MomentumClientError(`);
	lines.push(`\t\t\tbody.error ?? \`HTTP \${response.status}\`,`);
	lines.push(`\t\t\tresponse.status,`);
	lines.push(`\t\t\tbody.errors ?? [],`);
	lines.push(`\t\t);`);
	lines.push(`\t}`);
	lines.push(`\treturn response.json() as Promise<T>;`);
	lines.push(`}`);
	lines.push('');

	// Query string builder
	lines.push(
		`function buildQueryString(options?: FindOptions & Record<string, unknown>): string {`,
	);
	lines.push(`\tif (!options) return '';`);
	lines.push(`\tconst params: string[] = [];`);
	lines.push(`\tif (options.limit !== undefined) params.push(\`limit=\${options.limit}\`);`);
	lines.push(`\tif (options.page !== undefined) params.push(\`page=\${options.page}\`);`);
	lines.push(
		`\tif (options.sort !== undefined) params.push(\`sort=\${encodeURIComponent(options.sort)}\`);`,
	);
	lines.push(`\tif (options.depth !== undefined) params.push(\`depth=\${options.depth}\`);`);
	lines.push(`\tif (options.withDeleted) params.push('withDeleted=true');`);
	lines.push(`\tif (options.onlyDeleted) params.push('onlyDeleted=true');`);
	lines.push(
		`\tif (options.where !== undefined) params.push(\`where=\${encodeURIComponent(JSON.stringify(options.where))}\`);`,
	);
	lines.push(`\treturn params.length > 0 ? \`?\${params.join('&')}\` : '';`);
	lines.push(`}`);
	lines.push('');

	// CollectionClient class
	lines.push(`// ── Collection Client ──────────────────────────`);
	lines.push('');
	lines.push(`class CollectionClient<T, W = Record<string, unknown>> {`);
	lines.push(
		`\tconstructor(private readonly config: InternalConfig, private readonly baseUrl: string, private readonly slug: string) {}`,
	);
	lines.push('');
	lines.push(`\tasync find(options?: FindOptions & { where?: W }): Promise<FindResult<T>> {`);
	lines.push(`\t\tconst qs = buildQueryString(options as FindOptions & Record<string, unknown>);`);
	lines.push(
		`\t\tconst res = await momentumFetch<FindResult<T>>(\`\${this.baseUrl}/\${this.slug}\${qs}\`, { method: 'GET' }, this.config);`,
	);
	lines.push(`\t\treturn res;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync findById(id: string, options?: FindByIdOptions): Promise<T> {`);
	lines.push(`\t\tconst params: string[] = [];`);
	lines.push(`\t\tif (options?.depth !== undefined) params.push(\`depth=\${options.depth}\`);`);
	lines.push(`\t\tif (options?.withDeleted) params.push('withDeleted=true');`);
	lines.push(`\t\tconst qs = params.length > 0 ? \`?\${params.join('&')}\` : '';`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ doc: T }>(\`\${this.baseUrl}/\${this.slug}/\${id}\${qs}\`, { method: 'GET' }, this.config);`,
	);
	lines.push(`\t\treturn res.doc;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync create(data: Partial<T>): Promise<T> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ doc: T }>(\`\${this.baseUrl}/\${this.slug}\`, { method: 'POST', body: JSON.stringify(data) }, this.config);`,
	);
	lines.push(`\t\treturn res.doc;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync update(id: string, data: Partial<T>): Promise<T> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ doc: T }>(\`\${this.baseUrl}/\${this.slug}/\${id}\`, { method: 'PATCH', body: JSON.stringify(data) }, this.config);`,
	);
	lines.push(`\t\treturn res.doc;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync delete(id: string): Promise<DeleteResult> {`);
	lines.push(
		`\t\treturn momentumFetch<DeleteResult>(\`\${this.baseUrl}/\${this.slug}/\${id}\`, { method: 'DELETE' }, this.config);`,
	);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync forceDelete(id: string): Promise<DeleteResult> {`);
	lines.push(
		`\t\treturn momentumFetch<DeleteResult>(\`\${this.baseUrl}/\${this.slug}/\${id}?force=true\`, { method: 'DELETE' }, this.config);`,
	);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync restore(id: string): Promise<T> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ doc: T }>(\`\${this.baseUrl}/\${this.slug}/\${id}/restore\`, { method: 'POST', body: '{}' }, this.config);`,
	);
	lines.push(`\t\treturn res.doc;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync count(where?: W): Promise<number> {`);
	lines.push(`\t\tconst options: FindOptions = { limit: 0 };`);
	lines.push(`\t\tif (where) (options as Record<string, unknown>).where = where;`);
	lines.push(`\t\tconst res = await this.find(options as FindOptions & { where?: W });`);
	lines.push(`\t\treturn res.totalDocs;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync batchCreate(items: Partial<T>[]): Promise<T[]> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ docs: T[] }>(\`\${this.baseUrl}/\${this.slug}/batch\`, { method: 'POST', body: JSON.stringify({ operation: 'create', items }) }, this.config);`,
	);
	lines.push(`\t\treturn res.docs;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync batchUpdate(items: { id: string; data: Partial<T> }[]): Promise<T[]> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ docs: T[] }>(\`\${this.baseUrl}/\${this.slug}/batch\`, { method: 'POST', body: JSON.stringify({ operation: 'update', items }) }, this.config);`,
	);
	lines.push(`\t\treturn res.docs;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync batchDelete(ids: string[]): Promise<DeleteResult[]> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ results: DeleteResult[] }>(\`\${this.baseUrl}/\${this.slug}/batch\`, { method: 'POST', body: JSON.stringify({ operation: 'delete', ids }) }, this.config);`,
	);
	lines.push(`\t\treturn res.results;`);
	lines.push(`\t}`);
	lines.push(`}`);
	lines.push('');

	// GlobalClient class
	lines.push(`// ── Global Client ─────────────────────────────`);
	lines.push('');
	lines.push(`class GlobalClient<T> {`);
	lines.push(
		`\tconstructor(private readonly config: InternalConfig, private readonly baseUrl: string, private readonly slug: string) {}`,
	);
	lines.push('');
	lines.push(`\tasync findOne(options?: { depth?: number }): Promise<T> {`);
	lines.push(`\t\tconst qs = options?.depth !== undefined ? \`?depth=\${options.depth}\` : '';`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ doc: T }>(\`\${this.baseUrl}/globals/\${this.slug}\${qs}\`, { method: 'GET' }, this.config);`,
	);
	lines.push(`\t\treturn res.doc;`);
	lines.push(`\t}`);
	lines.push('');
	lines.push(`\tasync update(data: Partial<T>): Promise<T> {`);
	lines.push(
		`\t\tconst res = await momentumFetch<{ doc: T }>(\`\${this.baseUrl}/globals/\${this.slug}\`, { method: 'PATCH', body: JSON.stringify(data) }, this.config);`,
	);
	lines.push(`\t\treturn res.doc;`);
	lines.push(`\t}`);
	lines.push(`}`);
	lines.push('');

	// Factory function
	lines.push(`// ── Factory ───────────────────────────────────`);
	lines.push('');
	lines.push(`export function createMomentumClient(config: MomentumClientConfig) {`);
	lines.push(`\tconst ic = resolveConfig(config);`);
	lines.push(`\treturn {`);

	// Collections object
	lines.push(`\t\tcollections: {`);
	for (const col of allCollections) {
		const name = slugToPascalCase(col.slug);
		const key = needsQuoting(col.slug) ? safeQuote(col.slug) : col.slug;
		lines.push(
			`\t\t\t${key}: new CollectionClient<${name}, ${name}WhereClause>(ic, ic.baseUrl, ${safeQuote(col.slug)}),`,
		);
	}
	lines.push(`\t\t},`);

	// Globals object
	lines.push(`\t\tglobals: {`);
	for (const global of globals) {
		const name = slugToPascalCase(global.slug) + 'Global';
		const key = needsQuoting(global.slug) ? safeQuote(global.slug) : global.slug;
		lines.push(
			`\t\t\t${key}: new GlobalClient<${name}>(ic, ic.baseUrl, ${safeQuote(global.slug)}),`,
		);
	}
	lines.push(`\t\t},`);

	// Generic fallback methods
	lines.push(
		`\t\tcollection: <T = Record<string, unknown>>(slug: string) => new CollectionClient<T>(ic, ic.baseUrl, slug),`,
	);
	lines.push(
		`\t\tglobal: <T = Record<string, unknown>>(slug: string) => new GlobalClient<T>(ic, ic.baseUrl, slug),`,
	);
	lines.push(`\t};`);
	lines.push(`}`);
	lines.push('');

	return lines.join('\n');
}

function hasVersionsWithDrafts(collection: CollectionDefinition): boolean {
	if (!collection.versions) return false;
	if (collection.versions === true) return false;
	return !!collection.versions.drafts;
}

function needsQuoting(name: string): boolean {
	return /[^a-zA-Z0-9_$]/.test(name) || /^\d/.test(name);
}

// ============================================
// Serialization Helpers
// ============================================

/** Properties to strip from collections (server-only). Referenced by serializeCollection comments. */
const _COLLECTION_STRIP_KEYS = new Set([
	'access',
	'hooks',
	'endpoints',
	'webhooks',
	'defaultWhere',
	'dbName',
	'indexes',
	'graphQL',
]);

/** Properties to strip from fields (server-only / non-serializable) */
const FIELD_STRIP_KEYS = new Set(['access', 'hooks', 'validate', 'filterOptions']);

/** Properties to strip from globals (server-only). Referenced by serializeGlobal comments. */
const _GLOBAL_STRIP_KEYS = new Set(['access', 'hooks']);

/** Properties to strip from field admin config */
const FIELD_ADMIN_STRIP_KEYS = new Set(['condition']);

/** Type guard: narrows unknown to Record<string, unknown>. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively collect all data field names from a fields array,
 * descending into tabs (unnamed), collapsible, and row layout wrappers.
 * Named tabs produce a synthetic field name (e.g. 'seo') to match the
 * data nesting at runtime.
 */
function collectFieldNames(fields: FieldDefinition[]): string[] {
	const names: string[] = [];
	for (const field of fields) {
		if (field.type === 'tabs' && field.tabs) {
			for (const tab of field.tabs) {
				if (tab.name) {
					// Named tab stores data under tab.name — treat as a group
					names.push(tab.name);
				} else {
					// Unnamed tab is layout-only — hoist children
					names.push(...collectFieldNames(tab.fields));
				}
			}
		} else if ((field.type === 'collapsible' || field.type === 'row') && field.fields) {
			names.push(...collectFieldNames(field.fields));
		} else {
			names.push(field.name);
		}
	}
	return names;
}

/**
 * Convert a preview function to a URL template string by evaluating it with
 * sentinel placeholder values and replacing them with {fieldName} tokens.
 * Falls back to `true` if the function can't be converted.
 *
 * Example: `(doc) => '/' + String(doc['slug'] ?? '')` → `'/{slug}'`
 */
function previewFunctionToTemplate(
	fn: (...args: unknown[]) => unknown,
	fields: FieldDefinition[],
): string | true {
	try {
		const sentinel = '__MCMS_FIELD_';
		const mockDoc: Record<string, string> = {};
		// Flatten layout wrappers (tabs, collapsible, row) to find actual data field names
		for (const name of collectFieldNames(fields)) {
			mockDoc[name] = `${sentinel}${name}__`;
		}
		const result = fn(mockDoc);
		if (typeof result !== 'string') return true;

		// Replace sentinel placeholders with {fieldName} template tokens
		const template = result.replace(
			new RegExp(`${sentinel}(\\w+)__`, 'g'),
			(_match, fieldName: string) => `{${fieldName}}`,
		);
		return template;
	} catch {
		return true;
	}
}

/**
 * Serialize a value to a TypeScript literal string.
 * Skips functions and undefined values.
 */
export function serializeValue(value: unknown, indent = '\t'): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (typeof value === 'function') return 'undefined';

	if (Array.isArray(value)) {
		if (value.length === 0) return '[]';
		const items = value
			.map((item) => `${indent}\t${serializeValue(item, indent + '\t')}`)
			.join(',\n');
		return `[\n${items},\n${indent}]`;
	}

	if (typeof value === 'object') {
		const entries = Object.entries(value).filter(
			([, v]) => v !== undefined && typeof v !== 'function',
		);
		if (entries.length === 0) return '{}';
		const props = entries
			.map(([k, v]) => {
				const key = needsQuoting(k) ? safeQuote(k) : k;
				return `${indent}\t${key}: ${serializeValue(v, indent + '\t')}`;
			})
			.join(',\n');
		return `{\n${props},\n${indent}}`;
	}

	return 'undefined';
}

/**
 * Serialize component loader functions by extracting the import path and
 * exported member name, then reconstructing a clean dynamic import expression.
 *
 * Uses Function.toString() to parse the import path and member name, then
 * rewrites the import path to be relative to the output file.
 *
 * This reconstructs a clean function rather than emitting raw toString() output,
 * which may contain bundler transforms (e.g., esbuild interop wrappers) that
 * cause TypeScript compilation errors.
 */
function serializeComponentLoaders(
	components: Record<string, unknown>,
	configPath: string,
	outputPath: string,
	indent: string,
): string | null {
	const entries: string[] = [];
	for (const [key, value] of Object.entries(components)) {
		if (typeof value !== 'function') continue;
		const source = value.toString();

		// Extract import path — match both native import() and bundler variants
		const importMatch = /(?:import|__vite_ssr_dynamic_import__)\(\s*['"]([^'"]+)['"]\s*\)/.exec(
			source,
		);
		if (!importMatch) continue;

		const importPath = importMatch[1];
		const abs = resolve(dirname(configPath), importPath);
		const rel = computeRelativeImport(outputPath, abs + '.ts');

		// Extract the exported member name from the final .then() in the chain.
		// Matches dot access: .then((m) => m.MemberName) or .then(m=>m.MemberName)
		// Matches bracket access: .then((m) => m["MemberName"]) (vitest/esbuild transform)
		const memberMatch =
			/\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1(?:\.(\w+)|\[["'](\w+)["']\])\s*\)/.exec(source);
		if (!memberMatch) continue;

		// Group 2 = dot access (.MemberName), Group 3 = bracket access (["MemberName"])
		const memberName = memberMatch[2] || memberMatch[3];
		const safeKey = needsQuoting(key) ? safeQuote(key) : key;
		entries.push(
			`${indent}\t${safeKey}: () => import(${JSON.stringify(rel)}).then((m) => m.${memberName})`,
		);
	}
	if (entries.length === 0) return null;
	return `{\n${entries.join(',\n')},\n${indent}}`;
}

/**
 * Serialize a field definition, stripping server-only properties.
 * For relationship fields, resolves collection() at build time into an inline stub.
 */
export function serializeField(field: FieldDefinition, indent = '\t\t'): string {
	const props: string[] = [];

	// Always emit name and type first
	props.push(`${indent}name: ${JSON.stringify(field.name)}`);
	props.push(`${indent}type: ${JSON.stringify(field.type)}`);

	// Emit remaining data properties, skipping server-only keys
	for (const [key, value] of Object.entries(field)) {
		if (key === 'name' || key === 'type') continue;
		if (FIELD_STRIP_KEYS.has(key)) continue;
		if (value === undefined) continue;

		// Handle relationship collection() before generic function skip
		if (key === 'collection' && field.type === 'relationship' && typeof value === 'function') {
			const stub = resolveRelationshipStub(field);
			props.push(`${indent}collection: () => (${stub})`);
			continue;
		}

		// Skip remaining functions
		if (typeof value === 'function') continue;

		// Special handling for specific keys
		if (key === 'admin' && isRecord(value)) {
			const adminVal = serializeFieldAdmin(value, indent + '\t');
			if (adminVal !== null) {
				props.push(`${indent}admin: ${adminVal}`);
			}
			continue;
		}

		if (key === 'fields' && Array.isArray(value)) {
			props.push(`${indent}fields: ${serializeFieldsArray(value, indent + '\t')}`);
			continue;
		}

		if (key === 'blocks' && Array.isArray(value)) {
			props.push(`${indent}blocks: ${serializeBlocksArray(value, indent + '\t')}`);
			continue;
		}

		if (key === 'tabs' && Array.isArray(value)) {
			props.push(`${indent}tabs: ${serializeTabsArray(value, indent + '\t')}`);
			continue;
		}

		if (key === 'defaultValue') {
			// Only serialize primitive default values
			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
				props.push(`${indent}defaultValue: ${serializeValue(value)}`);
			}
			continue;
		}

		// Generic serialization for remaining props
		props.push(`${indent}${key}: ${serializeValue(value, indent + '\t')}`);
	}

	return `{\n${props.join(',\n')},\n${indent.slice(0, -1)}}`;
}

/**
 * Serialize field admin config, stripping non-serializable function properties.
 */
function serializeFieldAdmin(admin: Record<string, unknown>, indent: string): string | null {
	const entries = Object.entries(admin).filter(
		([k, v]) => v !== undefined && typeof v !== 'function' && !FIELD_ADMIN_STRIP_KEYS.has(k),
	);
	if (entries.length === 0) return null;

	const props = entries
		.map(([k, v]) => `${indent}\t${k}: ${serializeValue(v, indent + '\t')}`)
		.join(',\n');
	return `{\n${props},\n${indent}}`;
}

/**
 * Resolve a relationship field's collection() lazy reference into a serializable stub.
 * Extracts only: slug, labels, admin.useAsTitle
 */
function resolveRelationshipStub(field: FieldDefinition): string {
	if (!field.collection) return '{}';

	try {
		const config = field.collection();
		if (!config || typeof config !== 'object') return '{}';

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- resolved config is dynamic
		const c = config as Record<string, unknown>;
		const parts: string[] = [];

		if (typeof c['slug'] === 'string') {
			parts.push(`slug: ${JSON.stringify(c['slug'])}`);
		}

		const labels = c['labels'];
		if (labels && typeof labels === 'object') {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- labels is a record
			const l = labels as Record<string, unknown>;
			const labelParts: string[] = [];
			if (typeof l['singular'] === 'string')
				labelParts.push(`singular: ${JSON.stringify(l['singular'])}`);
			if (typeof l['plural'] === 'string')
				labelParts.push(`plural: ${JSON.stringify(l['plural'])}`);
			if (labelParts.length > 0) {
				parts.push(`labels: { ${labelParts.join(', ')} }`);
			}
		}

		const admin = c['admin'];
		if (admin && typeof admin === 'object') {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- admin is a record
			const a = admin as Record<string, unknown>;
			if (typeof a['useAsTitle'] === 'string') {
				parts.push(`admin: { useAsTitle: ${JSON.stringify(a['useAsTitle'])} }`);
			}
		}

		return `{ ${parts.join(', ')} }`;
	} catch {
		return '{}';
	}
}

/**
 * Serialize an array of field definitions.
 */
function serializeFieldsArray(fields: FieldDefinition[], indent: string): string {
	if (fields.length === 0) return '[]';
	const items = fields.map((f) => `${indent}\t${serializeField(f, indent + '\t\t')}`).join(',\n');
	return `[\n${items},\n${indent}]`;
}

/**
 * Serialize an array of block definitions.
 */
function serializeBlocksArray(
	blocks: Array<{
		slug: string;
		fields: FieldDefinition[];
		labels?: { singular?: string; plural?: string };
		editor?: Record<string, unknown>;
	}>,
	indent: string,
): string {
	if (blocks.length === 0) return '[]';
	const items = blocks
		.map((block) => {
			const parts: string[] = [];
			parts.push(`${indent}\t\tslug: ${JSON.stringify(block.slug)}`);
			parts.push(`${indent}\t\tfields: ${serializeFieldsArray(block.fields, indent + '\t\t')}`);
			if (block.labels) {
				parts.push(`${indent}\t\tlabels: ${serializeValue(block.labels, indent + '\t\t')}`);
			}
			if (block.editor) {
				const editorStr = serializeValue(block.editor, indent + '\t\t');
				if (editorStr !== 'undefined') {
					parts.push(`${indent}\t\teditor: ${editorStr}`);
				}
			}
			return `${indent}\t{\n${parts.join(',\n')},\n${indent}\t}`;
		})
		.join(',\n');
	return `[\n${items},\n${indent}]`;
}

/**
 * Serialize an array of tab definitions.
 */
function serializeTabsArray(
	tabs: Array<{ name?: string; label: string; description?: string; fields: FieldDefinition[] }>,
	indent: string,
): string {
	if (tabs.length === 0) return '[]';
	const items = tabs
		.map((tab) => {
			const parts: string[] = [];
			if (tab.name) {
				parts.push(`${indent}\t\tname: ${JSON.stringify(tab.name)}`);
			}
			parts.push(`${indent}\t\tlabel: ${JSON.stringify(tab.label)}`);
			if (tab.description) {
				parts.push(`${indent}\t\tdescription: ${JSON.stringify(tab.description)}`);
			}
			parts.push(`${indent}\t\tfields: ${serializeFieldsArray(tab.fields, indent + '\t\t')}`);
			return `${indent}\t{\n${parts.join(',\n')},\n${indent}\t}`;
		})
		.join(',\n');
	return `[\n${items},\n${indent}]`;
}

/**
 * Serialize a collection definition, stripping server-only properties.
 */
export function serializeCollection(
	collection: CollectionDefinition,
	indent = '\t',
	configPath?: string,
	outputPath?: string,
): string {
	const parts: string[] = [];

	// Always emit slug first
	parts.push(`${indent}\tslug: ${JSON.stringify(collection.slug)}`);

	// Labels
	if (collection.labels) {
		parts.push(`${indent}\tlabels: ${serializeValue(collection.labels, indent + '\t')}`);
	}

	// Fields (serialized with stripping)
	parts.push(`${indent}\tfields: ${serializeFieldsArray(collection.fields, indent + '\t')}`);

	// Admin config (convert function-type preview to URL template, strip other functions)
	if (collection.admin) {
		// Extract components before generic serialization (they contain functions we want to preserve)
		const componentsObj = collection.admin['components'];

		const adminEntries = Object.entries(collection.admin)
			.filter(([k, v]) => v !== undefined && k !== 'components')
			.map(([k, v]): [string, unknown] => {
				if (k === 'preview' && typeof v === 'function') {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by typeof check
					const fn = v as (...args: unknown[]) => unknown;
					return [k, previewFunctionToTemplate(fn, collection.fields)];
				}
				return [k, v];
			})
			.filter(([, v]) => typeof v !== 'function');

		// Serialize component loaders with path rewriting
		let componentsStr: string | null = null;
		if (componentsObj && typeof componentsObj === 'object' && configPath && outputPath) {
			const loaders: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(componentsObj)) {
				loaders[k] = v;
			}
			componentsStr = serializeComponentLoaders(loaders, configPath, outputPath, indent + '\t\t');
		}

		if (adminEntries.length > 0 || componentsStr) {
			// Build admin object piece by piece to avoid regex-based injection issues
			const adminProps: string[] = [];
			if (adminEntries.length > 0) {
				const adminObj = Object.fromEntries(adminEntries);
				for (const [k, v] of Object.entries(adminObj)) {
					const key = needsQuoting(k) ? safeQuote(k) : k;
					adminProps.push(`${indent}\t\t${key}: ${serializeValue(v, indent + '\t\t')}`);
				}
			}
			if (componentsStr) {
				adminProps.push(`${indent}\t\tcomponents: ${componentsStr}`);
			}
			parts.push(`${indent}\tadmin: {\n${adminProps.join(',\n')},\n${indent}\t}`);
		}
	}

	// Auth - reduce to boolean
	if (collection.auth) {
		parts.push(`${indent}\tauth: true`);
	}

	// Timestamps
	if (collection.timestamps !== undefined) {
		parts.push(`${indent}\ttimestamps: ${serializeValue(collection.timestamps, indent + '\t')}`);
	}

	// Versions
	if (collection.versions !== undefined) {
		parts.push(`${indent}\tversions: ${serializeValue(collection.versions, indent + '\t')}`);
	}

	// Soft delete
	if (collection.softDelete !== undefined) {
		parts.push(`${indent}\tsoftDelete: ${serializeValue(collection.softDelete, indent + '\t')}`);
	}

	// Managed
	if (collection.managed !== undefined) {
		parts.push(`${indent}\tmanaged: ${String(collection.managed)}`);
	}

	// Default sort
	if (collection.defaultSort) {
		parts.push(`${indent}\tdefaultSort: ${JSON.stringify(collection.defaultSort)}`);
	}

	// Upload config (browser-safe — only contains primitives, no functions)
	if (collection.upload !== undefined) {
		parts.push(`${indent}\tupload: ${serializeValue(collection.upload, indent + '\t')}`);
	}

	// Skip all COLLECTION_STRIP_KEYS: access, hooks, endpoints, webhooks, defaultWhere, dbName, indexes, graphQL

	return `{\n${parts.join(',\n')},\n${indent}}`;
}

/**
 * Serialize a global definition, stripping server-only properties.
 */
export function serializeGlobal(global: GlobalDefinition, indent = '\t'): string {
	const parts: string[] = [];

	parts.push(`${indent}\tslug: ${JSON.stringify(global.slug)}`);

	if (global.label) {
		parts.push(`${indent}\tlabel: ${JSON.stringify(global.label)}`);
	}

	parts.push(`${indent}\tfields: ${serializeFieldsArray(global.fields, indent + '\t')}`);

	if (global.admin) {
		const adminEntries = Object.entries(global.admin).filter(
			([, v]) => v !== undefined && typeof v !== 'function',
		);
		if (adminEntries.length > 0) {
			const adminObj = Object.fromEntries(adminEntries);
			parts.push(`${indent}\tadmin: ${serializeValue(adminObj, indent + '\t')}`);
		}
	}

	if (global.versions !== undefined) {
		parts.push(`${indent}\tversions: ${serializeValue(global.versions, indent + '\t')}`);
	}

	// Skip GLOBAL_STRIP_KEYS: access, hooks

	return `{\n${parts.join(',\n')},\n${indent}}`;
}

// ============================================
// Admin Config Generation
// ============================================

/**
 * Compute a relative import path from one file to another (without .ts extension).
 */
export function computeRelativeImport(fromFile: string, toFile: string): string {
	const fromDir = dirname(fromFile);
	let rel = relative(fromDir, toFile);
	// Remove .ts extension
	rel = rel.replace(/\.ts$/, '');
	// Ensure it starts with ./
	if (!rel.startsWith('.')) {
		rel = './' + rel;
	}
	return rel;
}

/**
 * Generate the browser-safe admin config TypeScript file.
 * Collections and globals are inlined with server-only properties stripped.
 * Only plugin admin routes are still imported (they have loadComponent functions).
 */
export function generateAdminConfig(
	config: MomentumConfig,
	typesRelPath: string,
	configPath?: string,
	outputPath?: string,
): string {
	const lines: string[] = [];
	const allCollections = resolveAllCollections(config);
	const globals = config.globals ?? [];
	const plugins = config.plugins ?? [];

	// Plugins that have admin routes with browser imports (validate exportName is a safe identifier)
	const SAFE_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
	const pluginsWithAdminRoutes = plugins.filter((p) => {
		if (!p.browserImports?.adminRoutes || !p.adminRoutes || p.adminRoutes.length === 0)
			return false;
		const exportName = p.browserImports.adminRoutes.exportName;
		if (!SAFE_IDENTIFIER.test(exportName)) {
			console.warn(
				`[generateAdminConfig] Skipping plugin "${p.name}": exportName "${exportName}" is not a valid identifier`,
			);
			return false;
		}
		return true;
	});

	// Header
	lines.push('/**');
	lines.push(' * AUTO-GENERATED by @momentumcms/core');
	lines.push(' * DO NOT EDIT - regenerate with: nx run <app>:generate');
	lines.push(' */');
	lines.push('');

	// Imports
	lines.push("import type { MomentumAdminConfig } from '@momentumcms/core';");

	// Import slug types from types file
	const typeImports: string[] = ['CollectionSlug'];
	if (globals.length > 0) {
		typeImports.push('GlobalSlug');
	}
	lines.push(`import type { ${typeImports.join(', ')} } from '${typesRelPath}';`);

	// Import plugin admin routes
	for (const plugin of pluginsWithAdminRoutes) {
		const imp = plugin.browserImports?.adminRoutes;
		if (!imp) continue;
		lines.push(`import { ${imp.exportName} } from ${JSON.stringify(imp.path)};`);
	}

	lines.push('');

	// Export typed config
	const genericParams = globals.length > 0 ? '<CollectionSlug, GlobalSlug>' : '<CollectionSlug>';
	lines.push(`export const adminConfig: MomentumAdminConfig${genericParams} = {`);

	// Collections (inlined)
	if (allCollections.length > 0) {
		const collectionItems = allCollections
			.map((c) => `\t\t${serializeCollection(c, '\t\t', configPath, outputPath)}`)
			.join(',\n');
		lines.push(`\tcollections: [\n${collectionItems},\n\t],`);
	} else {
		lines.push('\tcollections: [],');
	}

	// Globals (inlined)
	if (globals.length > 0) {
		const globalItems = globals.map((g) => `\t\t${serializeGlobal(g, '\t\t')}`).join(',\n');
		lines.push(`\tglobals: [\n${globalItems},\n\t],`);
	}

	// Admin settings
	if (config.admin) {
		const adminParts: string[] = [];
		if (config.admin.basePath) {
			adminParts.push(`\t\tbasePath: ${JSON.stringify(config.admin.basePath)}`);
		}
		if (config.admin.branding) {
			adminParts.push(`\t\tbranding: ${serializeValue(config.admin.branding, '\t\t')}`);
		}
		if (config.admin.toasts !== undefined) {
			adminParts.push(`\t\ttoasts: ${String(config.admin.toasts)}`);
		}

		// Serialize component loaders with path rewriting
		if (config.admin.components && configPath && outputPath) {
			const componentsStr = serializeComponentLoaders(
				config.admin.components,
				configPath,
				outputPath,
				'\t\t',
			);
			if (componentsStr) {
				adminParts.push(`\t\tcomponents: ${componentsStr}`);
			}
		}

		if (adminParts.length > 0) {
			lines.push(`\tadmin: {\n${adminParts.join(',\n')},\n\t},`);
		}
	}

	// Plugin descriptors (only those with admin routes)
	if (pluginsWithAdminRoutes.length > 0) {
		const pluginItems = pluginsWithAdminRoutes
			.flatMap((p) => {
				const imp = p.browserImports?.adminRoutes;
				if (!imp) return [];
				return [`\t\t{ name: ${JSON.stringify(p.name)}, adminRoutes: ${imp.exportName} }`];
			})
			.join(',\n');
		lines.push(`\tplugins: [\n${pluginItems},\n\t],`);
	}

	lines.push('};');
	lines.push('');

	return lines.join('\n');
}

// ============================================
// CLI Runner
// ============================================

export function parseArgs(args: string[]): GeneratorOptions {
	const configPath = args[0];
	let typesOutputPath = '';
	let configOutputPath = '';
	let clientOutputPath: string | undefined;
	let watchMode = false;

	for (let i = 1; i < args.length; i++) {
		if (args[i] === '--types' && args[i + 1]) {
			typesOutputPath = args[++i];
		} else if (args[i] === '--config' && args[i + 1]) {
			configOutputPath = args[++i];
		} else if (args[i] === '--client' && args[i + 1]) {
			clientOutputPath = args[++i];
		} else if (args[i] === '--watch') {
			watchMode = true;
		}
	}

	if (!configPath) {
		console.error(
			'Usage: npx tsx generator.ts <config-path> --types <types-output> --config <config-output> [--client <client-output>] [--watch]',
		);
		process.exit(1);
	}

	if (!typesOutputPath) {
		typesOutputPath = 'src/generated/momentum.types.ts';
	}
	if (!configOutputPath) {
		configOutputPath = 'src/generated/momentum.config.ts';
	}

	return { configPath, typesOutputPath, configOutputPath, clientOutputPath, watch: watchMode };
}

/**
 * Format generated files with prettier to match pre-commit hook formatting.
 * Uses the project's .prettierrc so generated output is commit-ready.
 */
function formatWithPrettier(...filePaths: string[]): void {
	try {
		execFileSync('npx', ['prettier', '--write', ...filePaths], {
			stdio: 'pipe',
		});
	} catch {
		console.warn('prettier not available — skipping formatting of generated files');
	}
}

export default async function runGenerator(
	options: GeneratorOptions,
): Promise<{ success: boolean }> {
	const configPath = resolve(options.configPath);
	const typesOutputPath = resolve(options.typesOutputPath);
	const configOutputPath = resolve(options.configOutputPath);
	const clientOutputPath = options.clientOutputPath ? resolve(options.clientOutputPath) : undefined;

	console.info(`Generating from: ${configPath}`);
	console.info(`Types output: ${typesOutputPath}`);
	console.info(`Config output: ${configOutputPath}`);
	if (clientOutputPath) {
		console.info(`Client output: ${clientOutputPath}`);
	}

	// Compute relative import path from config output to types output
	const typesRelPath = computeRelativeImport(configOutputPath, typesOutputPath);

	async function generate(): Promise<void> {
		try {
			const config = await loadConfig(configPath);

			// Generate types
			const typesContent = generateTypes(config);
			mkdirSync(dirname(typesOutputPath), { recursive: true });
			writeFileSync(typesOutputPath, typesContent, 'utf-8');
			console.info(`Types generated: ${typesOutputPath}`);

			// Generate admin config (inlined, stripped)
			const adminConfigContent = generateAdminConfig(
				config,
				typesRelPath,
				configPath,
				configOutputPath,
			);
			mkdirSync(dirname(configOutputPath), { recursive: true });
			writeFileSync(configOutputPath, adminConfigContent, 'utf-8');
			console.info(`Admin config generated: ${configOutputPath}`);

			// Generate client SDK (optional)
			const filesToFormat = [typesOutputPath, configOutputPath];
			if (clientOutputPath) {
				const clientTypesRelPath = computeRelativeImport(clientOutputPath, typesOutputPath);
				const clientContent = generateClientCode(config, clientTypesRelPath);
				mkdirSync(dirname(clientOutputPath), { recursive: true });
				writeFileSync(clientOutputPath, clientContent, 'utf-8');
				console.info(`Client SDK generated: ${clientOutputPath}`);
				filesToFormat.push(clientOutputPath);
			}

			// Format with prettier so output matches pre-commit formatting
			formatWithPrettier(...filesToFormat);
		} catch (error) {
			console.error(`Error generating:`, error);
			throw error;
		}
	}

	await generate();

	if (options.watch) {
		console.info(`Watching for changes...`);
		const configDir = dirname(configPath);

		// Debounce timer to coalesce rapid file changes into a single regeneration
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		watch(configDir, { recursive: true }, (_eventType, filename) => {
			if (!filename?.endsWith('.ts')) return;

			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				console.info(`Change detected: ${filename}`);

				// Spawn a fresh child process so the ESM module cache is clean.
				// Node.js (and tsx) caches ESM modules by URL for the lifetime of a process,
				// so re-importing the same config file in-process always returns the stale module.
				try {
					const childArgs = [
						...process.execArgv,
						process.argv[1],
						configPath,
						'--types',
						typesOutputPath,
						'--config',
						configOutputPath,
					];
					if (clientOutputPath) {
						childArgs.push('--client', clientOutputPath);
					}
					execFileSync(process.execPath, childArgs, { stdio: 'inherit' });
				} catch {
					// Continue watching on error
				}
			}, 100);
		});

		// Keep process alive
		return new Promise(() => {
			// Never resolves in watch mode
		});
	}

	return { success: true };
}

// CLI entry point
if (
	process.argv[1]?.endsWith('generator.ts') ||
	process.argv[1]?.endsWith('generator.js') ||
	process.argv[1]?.endsWith('generator.cjs')
) {
	const options = parseArgs(process.argv.slice(2));

	runGenerator(options)
		.then((result) => {
			if (!result.success) {
				process.exit(1);
			}
		})
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
