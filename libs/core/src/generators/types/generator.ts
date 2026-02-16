/**
 * Momentum CMS Type Generator
 *
 * Generates TypeScript interfaces from collection definitions.
 * Run via: nx run <app>:generate-types
 */

/* eslint-disable no-console -- CLI tool requires console output */
import { writeFileSync, watch } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

interface GeneratorSchema {
	configPath: string;
	outputPath: string;
	watch?: boolean;
}

interface ExecutorContext {
	root: string;
	projectName?: string;
	projectsConfigurations?: {
		projects: Record<string, { root: string }>;
	};
}

interface FieldDefinition {
	name: string;
	type: string;
	required?: boolean;
	options?: Array<{ value: string; label?: string }>;
	fields?: FieldDefinition[];
	collection?: () => { slug: string };
	hasMany?: boolean;
}

interface CollectionDefinition {
	slug: string;
	fields: FieldDefinition[];
	timestamps?: boolean | { createdAt?: boolean; updatedAt?: boolean };
}

interface MomentumConfig {
	collections: CollectionDefinition[];
}

/**
 * Map field types to TypeScript types.
 */
function fieldTypeToTS(field: FieldDefinition): string {
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'email':
		case 'password':
		case 'slug':
			return 'string';

		case 'number':
			return 'number';

		case 'checkbox':
			return 'boolean';

		case 'date':
			return 'string'; // ISO date string

		case 'select':
		case 'radio':
			if (field.options && field.options.length > 0) {
				return field.options.map((opt) => `'${opt.value}'`).join(' | ');
			}
			return 'string';

		case 'relationship': {
			// Relationships return IDs (or arrays of IDs)
			const baseType = 'string';
			return field.hasMany ? `${baseType}[]` : baseType;
		}

		case 'upload':
			return field.hasMany ? 'string[]' : 'string';

		case 'array':
			if (field.fields && field.fields.length > 0) {
				const arrayItemType = generateFieldsInterface(field.fields, '  ');
				return `Array<{\n${arrayItemType}\n  }>`;
			}
			return 'unknown[]';

		case 'group':
			if (field.fields && field.fields.length > 0) {
				const groupType = generateFieldsInterface(field.fields, '  ');
				return `{\n${groupType}\n  }`;
			}
			return 'Record<string, unknown>';

		case 'blocks':
			return 'unknown[]'; // Blocks are complex, default to unknown

		case 'json':
			return 'Record<string, unknown>';

		case 'point':
			return '[number, number]';

		default:
			return 'unknown';
	}
}

/**
 * Generate interface fields from field definitions.
 */
function generateFieldsInterface(fields: FieldDefinition[], indent = ''): string {
	return fields
		.map((field) => {
			const tsType = fieldTypeToTS(field);
			const optional = field.required ? '' : '?';
			return `${indent}  ${field.name}${optional}: ${tsType};`;
		})
		.join('\n');
}

/**
 * Convert slug to PascalCase for interface name.
 */
function slugToPascalCase(slug: string): string {
	return slug
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

/**
 * Get the where clause type for a field based on its type.
 */
function getFieldWhereType(field: FieldDefinition): string {
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'email':
		case 'slug':
			return `string | { equals?: string; not?: string; contains?: string; in?: string[] }`;

		case 'number':
			return `number | { equals?: number; not?: number; gt?: number; gte?: number; lt?: number; lte?: number; in?: number[] }`;

		case 'checkbox':
			return `boolean | { equals?: boolean }`;

		case 'date':
			return `string | { equals?: string; not?: string; gt?: string; gte?: string; lt?: string; lte?: string }`;

		case 'select':
		case 'radio':
			if (field.options && field.options.length > 0) {
				const options = field.options.map((opt) => `'${opt.value}'`).join(' | ');
				return `${options} | { equals?: ${options}; not?: ${options}; in?: (${options})[] }`;
			}
			return `string | { equals?: string; in?: string[] }`;

		case 'relationship':
			return `string | { equals?: string; not?: string; in?: string[] }`;

		default:
			return 'unknown';
	}
}

/**
 * Generate where clause interface for a collection.
 */
function generateWhereClauseInterface(collection: CollectionDefinition): string {
	const interfaceName = slugToPascalCase(collection.slug);
	const lines: string[] = [];

	lines.push(`/**`);
	lines.push(` * Where clause type for querying the "${collection.slug}" collection.`);
	lines.push(` */`);
	lines.push(`export interface ${interfaceName}WhereClause {`);

	// Add id field (always available)
	lines.push(`  id?: string | { equals?: string; not?: string; in?: string[] };`);

	// Add where types for each field
	for (const field of collection.fields) {
		const whereType = getFieldWhereType(field);
		lines.push(`  ${field.name}?: ${whereType};`);
	}

	// Add timestamp fields if enabled
	const hasTimestamps = collection.timestamps !== false;
	if (hasTimestamps) {
		lines.push(
			`  createdAt?: string | { equals?: string; gt?: string; gte?: string; lt?: string; lte?: string };`,
		);
		lines.push(
			`  updatedAt?: string | { equals?: string; gt?: string; gte?: string; lt?: string; lte?: string };`,
		);
	}

	lines.push(`}`);

	return lines.join('\n');
}

/**
 * Generate TypeScript types from collections.
 */
function generateTypes(config: MomentumConfig): string {
	const lines: string[] = [
		'/**',
		' * Auto-generated types from Momentum CMS collection definitions.',
		' * DO NOT EDIT - This file is regenerated when collections change.',
		` * Generated at: ${new Date().toISOString()}`,
		' */',
		'',
	];

	// Generate interface for each collection
	for (const collection of config.collections) {
		const interfaceName = slugToPascalCase(collection.slug);

		lines.push(`/**`);
		lines.push(` * Document type for the "${collection.slug}" collection.`);
		lines.push(` */`);
		lines.push(`export interface ${interfaceName} {`);
		lines.push(`  /** Unique document identifier */`);
		lines.push(`  id: string;`);

		// Add fields
		const fieldsCode = generateFieldsInterface(collection.fields);
		if (fieldsCode) {
			lines.push(fieldsCode);
		}

		// Add timestamps if enabled (default is true)
		const hasTimestamps = collection.timestamps !== false;
		if (hasTimestamps) {
			lines.push(`  /** Document creation timestamp */`);
			lines.push(`  createdAt: string;`);
			lines.push(`  /** Document last update timestamp */`);
			lines.push(`  updatedAt: string;`);
		}

		lines.push(`}`);
		lines.push('');
	}

	// Generate where clause interfaces for each collection
	for (const collection of config.collections) {
		lines.push(generateWhereClauseInterface(collection));
		lines.push('');
	}

	// Generate union type of all collection slugs
	lines.push(`/**`);
	lines.push(` * All collection slugs in this Momentum CMS instance.`);
	lines.push(` */`);
	const slugs = config.collections.map((c) => `'${c.slug}'`).join(' | ');
	lines.push(`export type CollectionSlug = ${slugs || 'never'};`);
	lines.push('');

	// Generate mapping type (legacy, for backwards compat)
	lines.push(`/**`);
	lines.push(` * Mapping from collection slug to document type.`);
	lines.push(` */`);
	lines.push(`export interface MomentumCollections {`);
	for (const collection of config.collections) {
		const interfaceName = slugToPascalCase(collection.slug);
		lines.push(`  '${collection.slug}': ${interfaceName};`);
	}
	lines.push(`}`);
	lines.push('');

	// Generate TypedMomentumCollections for use with injectTypedMomentumAPI
	lines.push(`/**`);
	lines.push(` * Type-safe collection mapping for use with injectTypedMomentumAPI().`);
	lines.push(` * Includes both document types and where clause types.`);
	lines.push(` *`);
	lines.push(` * @example`);
	lines.push(` * \`\`\`typescript`);
	lines.push(` * import { injectTypedMomentumAPI } from '@momentumcms/admin';`);
	lines.push(` * import type { TypedMomentumCollections } from './types/momentum.generated';`);
	lines.push(` *`);
	lines.push(` * const api = injectTypedMomentumAPI<TypedMomentumCollections>();`);
	lines.push(` * const posts = await api.posts.find({ where: { status: 'published' } });`);
	lines.push(` * \`\`\``);
	lines.push(` */`);
	// Use 'type' instead of 'interface' to satisfy index signature constraints
	lines.push(`export type TypedMomentumCollections = {`);
	for (const collection of config.collections) {
		const interfaceName = slugToPascalCase(collection.slug);
		lines.push(
			`  '${collection.slug}': { doc: ${interfaceName}; where: ${interfaceName}WhereClause };`,
		);
	}
	lines.push(`};`);
	lines.push('');

	// Generate helper type for typed collection access
	lines.push(`/**`);
	lines.push(` * Helper type for getting document type from collection slug.`);
	lines.push(` */`);
	lines.push(`export type DocumentType<S extends CollectionSlug> = MomentumCollections[S];`);
	lines.push('');

	// Generate helper type for getting where clause type
	lines.push(`/**`);
	lines.push(` * Helper type for getting where clause type from collection slug.`);
	lines.push(` */`);
	lines.push(
		`export type WhereClauseType<S extends CollectionSlug> = TypedMomentumCollections[S]['where'];`,
	);
	lines.push('');

	return lines.join('\n');
}

/**
 * Load config dynamically using dynamic import.
 */
async function loadConfig(configPath: string): Promise<MomentumConfig> {
	try {
		// Use dynamic import for ES modules
		const configUrl = pathToFileURL(configPath).href;
		const configModule = await import(configUrl);
		return configModule.default || configModule;
	} catch (error) {
		throw new Error(`Failed to load config from ${configPath}: ${error}`);
	}
}

/**
 * Main executor function.
 */
export default async function runExecutor(
	options: GeneratorSchema,
	context: ExecutorContext,
): Promise<{ success: boolean }> {
	const projectRoot = context.projectsConfigurations?.projects[context.projectName ?? '']?.root;
	const root = projectRoot ? join(context.root, projectRoot) : context.root;

	const configPath = resolve(root, options.configPath);
	const outputPath = resolve(root, options.outputPath);

	console.info(`Generating types from: ${configPath}`);
	console.info(`Output to: ${outputPath}`);

	async function generate(): Promise<void> {
		try {
			const config = await loadConfig(configPath);
			const types = generateTypes(config);
			writeFileSync(outputPath, types, 'utf-8');
			console.info(`Types generated successfully!`);
		} catch (error) {
			console.error(`Error generating types:`, error);
			throw error;
		}
	}

	// Initial generation
	await generate();

	// Watch mode
	if (options.watch) {
		console.info(`Watching for changes...`);
		const configDir = dirname(configPath);

		watch(configDir, { recursive: true }, async (eventType, filename) => {
			if (filename?.endsWith('.ts')) {
				console.info(`Change detected: ${filename}`);
				try {
					await generate();
				} catch {
					// Continue watching on error
				}
			}
		});

		// Keep process alive
		return new Promise(() => {
			// Never resolves in watch mode
		});
	}

	return { success: true };
}

// CLI entry point
if (process.argv[1]?.endsWith('generator.ts') || process.argv[1]?.endsWith('generator.js')) {
	const args = process.argv.slice(2);
	const configPath = args[0];
	const outputPath = args[1] || 'src/types/momentum.generated.ts';
	const watchMode = args.includes('--watch');

	if (!configPath) {
		console.error('Usage: npx ts-node generator.ts <config-path> [output-path] [--watch]');
		process.exit(1);
	}

	runExecutor({ configPath, outputPath, watch: watchMode }, { root: process.cwd() })
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
