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
	};
	plugins?: PluginDescriptor[];
}

interface GeneratorOptions {
	configPath: string;
	typesOutputPath: string;
	configOutputPath: string;
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
export function serializeCollection(collection: CollectionDefinition, indent = '\t'): string {
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
		const adminEntries = Object.entries(collection.admin)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]): [string, unknown] => {
				if (k === 'preview' && typeof v === 'function') {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by typeof check
					const fn = v as (...args: unknown[]) => unknown;
					return [k, previewFunctionToTemplate(fn, collection.fields)];
				}
				return [k, v];
			})
			.filter(([, v]) => typeof v !== 'function');
		if (adminEntries.length > 0) {
			const adminObj = Object.fromEntries(adminEntries);
			parts.push(`${indent}\tadmin: ${serializeValue(adminObj, indent + '\t')}`);
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
export function generateAdminConfig(config: MomentumConfig, typesRelPath: string): string {
	const lines: string[] = [];
	const allCollections = resolveAllCollections(config);
	const globals = config.globals ?? [];
	const plugins = config.plugins ?? [];

	// Plugins that have admin routes with browser imports
	const pluginsWithAdminRoutes = plugins.filter(
		(p) => p.browserImports?.adminRoutes && p.adminRoutes && p.adminRoutes.length > 0,
	);

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
		const imp = plugin.browserImports!.adminRoutes!;
		lines.push(`import { ${imp.exportName} } from '${imp.path}';`);
	}

	lines.push('');

	// Export typed config
	const genericParams = globals.length > 0 ? '<CollectionSlug, GlobalSlug>' : '<CollectionSlug>';
	lines.push(`export const adminConfig: MomentumAdminConfig${genericParams} = {`);

	// Collections (inlined)
	if (allCollections.length > 0) {
		const collectionItems = allCollections
			.map((c) => `\t\t${serializeCollection(c, '\t\t')}`)
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
		const adminObj: Record<string, unknown> = {};
		if (config.admin.basePath) adminObj['basePath'] = config.admin.basePath;
		if (config.admin.branding) adminObj['branding'] = config.admin.branding;
		if (config.admin.toasts !== undefined) adminObj['toasts'] = config.admin.toasts;
		if (Object.keys(adminObj).length > 0) {
			lines.push(`\tadmin: ${serializeValue(adminObj)},`);
		}
	}

	// Plugin descriptors (only those with admin routes)
	if (pluginsWithAdminRoutes.length > 0) {
		const pluginItems = pluginsWithAdminRoutes
			.map((p) => {
				const imp = p.browserImports!.adminRoutes!;
				return `\t\t{ name: ${JSON.stringify(p.name)}, adminRoutes: ${imp.exportName} }`;
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

function parseArgs(args: string[]): GeneratorOptions {
	const configPath = args[0];
	let typesOutputPath = '';
	let configOutputPath = '';
	let watchMode = false;

	for (let i = 1; i < args.length; i++) {
		if (args[i] === '--types' && args[i + 1]) {
			typesOutputPath = args[++i];
		} else if (args[i] === '--config' && args[i + 1]) {
			configOutputPath = args[++i];
		} else if (args[i] === '--watch') {
			watchMode = true;
		}
	}

	if (!configPath) {
		console.error(
			'Usage: npx tsx generator.ts <config-path> --types <types-output> --config <config-output> [--watch]',
		);
		process.exit(1);
	}

	if (!typesOutputPath) {
		typesOutputPath = 'src/generated/momentum.types.ts';
	}
	if (!configOutputPath) {
		configOutputPath = 'src/generated/momentum.config.ts';
	}

	return { configPath, typesOutputPath, configOutputPath, watch: watchMode };
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

	console.info(`Generating from: ${configPath}`);
	console.info(`Types output: ${typesOutputPath}`);
	console.info(`Config output: ${configOutputPath}`);

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
			const adminConfigContent = generateAdminConfig(config, typesRelPath);
			mkdirSync(dirname(configOutputPath), { recursive: true });
			writeFileSync(configOutputPath, adminConfigContent, 'utf-8');
			console.info(`Admin config generated: ${configOutputPath}`);

			// Format with prettier so output matches pre-commit formatting
			formatWithPrettier(typesOutputPath, configOutputPath);
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
					execFileSync(
						process.execPath,
						[
							...process.execArgv,
							process.argv[1],
							configPath,
							'--types',
							typesOutputPath,
							'--config',
							configOutputPath,
						],
						{ stdio: 'inherit' },
					);
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
