/**
 * Serialization helpers for converting config objects to TypeScript literal strings.
 * Used by the admin config generator.
 */

import { dirname, resolve } from 'node:path';
import { safeQuote, needsQuoting } from './field-to-typescript';
import type { FieldDefinition, CollectionDefinition, GlobalDefinition } from './generator-types';
import { computeRelativeImport } from './generator-types';

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
 * Example: `(doc) => '/' + String(doc['slug'] ?? '')` -> `'/{slug}'`
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
export function serializeComponentLoaders(
	components: Record<string, unknown>,
	configPath: string,
	outputPath: string,
	indent: string,
): string | null {
	const entries: string[] = [];
	for (const [key, value] of Object.entries(components)) {
		if (typeof value !== 'function') continue;
		const source = value.toString();

		// Extract import path -- match both native import() and bundler variants
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

		// Generic serialization for remaining props (quote unsafe keys to prevent injection)
		const safeKey = needsQuoting(key) ? safeQuote(key) : key;
		props.push(`${indent}${safeKey}: ${serializeValue(value, indent + '\t')}`);
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
		.map(([k, v]) => {
			const safeKey = needsQuoting(k) ? safeQuote(k) : k;
			return `${indent}\t${safeKey}: ${serializeValue(v, indent + '\t')}`;
		})
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

	// Upload config (browser-safe -- only contains primitives, no functions)
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
