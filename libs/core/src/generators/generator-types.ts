/**
 * Shared types and config-loading utilities for the Momentum code generator.
 */

import { pathToFileURL } from 'node:url';
import { dirname, relative } from 'node:path';

// ============================================
// Minimal interfaces for config loading
// (avoids importing full types that pull in server deps)
// ============================================

export interface FieldDefinition {
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

export interface CollectionDefinition {
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

export interface GlobalDefinition {
	slug: string;
	label?: string;
	fields: FieldDefinition[];
	admin?: Record<string, unknown>;
	access?: unknown;
	hooks?: unknown;
	versions?: boolean | { drafts?: boolean };
}

export interface PluginBrowserImport {
	path: string;
	exportName: string;
}

export interface PluginBrowserImports {
	collections?: PluginBrowserImport;
	adminRoutes?: PluginBrowserImport;
	modifyCollections?: PluginBrowserImport;
}

export interface PluginDescriptor {
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

export interface MomentumConfig {
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

export interface GeneratorOptions {
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
export async function loadConfig(configPath: string): Promise<MomentumConfig> {
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
export function resolveAllCollections(config: MomentumConfig): CollectionDefinition[] {
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

export function hasVersionsWithDrafts(collection: CollectionDefinition): boolean {
	if (!collection.versions) return false;
	if (collection.versions === true) return false;
	return !!collection.versions.drafts;
}
