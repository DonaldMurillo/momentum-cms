/**
 * Field-to-TypeScript mapping utilities for Momentum CMS code generation.
 *
 * Converts collection/global field definitions into TypeScript type strings.
 * Handles layout field flattening, block discriminated unions, and where clauses.
 */

import type { Field, BlocksField } from '../lib/fields/field.types';
import { flattenDataFields } from '../lib/fields/field.types';

/**
 * Convert a slug like 'auth-user' to PascalCase like 'AuthUser'.
 * Strips any characters that are not valid in a TypeScript identifier.
 */
export function slugToPascalCase(slug: string): string {
	return slug
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')
		.replace(/[^a-zA-Z0-9_$]/g, '');
}

/**
 * Check if a field name needs quoting (contains hyphens or starts with a digit).
 */
function needsQuoting(name: string): boolean {
	return /[^a-zA-Z0-9_$]/.test(name) || /^\d/.test(name);
}

/**
 * Safely quote a string value for use in generated TypeScript.
 * Uses JSON.stringify to handle escaping (produces double-quoted strings).
 */
export function safeQuote(value: string | number): string {
	return JSON.stringify(String(value));
}

/**
 * Format a property name, quoting if necessary.
 */
function formatPropName(name: string): string {
	return needsQuoting(name) ? safeQuote(name) : name;
}

/**
 * Map a single field to its TypeScript type string.
 */
export function fieldTypeToTS(field: Field): string {
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

		case 'select': {
			if (field.options && field.options.length > 0) {
				const union = field.options.map((opt) => safeQuote(opt.value)).join(' | ');
				return field.hasMany ? `(${union})[]` : union;
			}
			return field.hasMany ? 'string[]' : 'string';
		}

		case 'radio': {
			if (field.options && field.options.length > 0) {
				return field.options.map((opt) => safeQuote(opt.value)).join(' | ');
			}
			return 'string';
		}

		case 'relationship': {
			return field.hasMany ? 'string[]' : 'string';
		}

		case 'upload':
			return field.hasMany ? 'string[]' : 'string';

		case 'array': {
			if (field.fields && field.fields.length > 0) {
				const arrayItemType = generateFieldsInterface(field.fields, '    ');
				return `Array<{\n${arrayItemType}\n  }>`;
			}
			return 'unknown[]';
		}

		case 'group': {
			if (field.fields && field.fields.length > 0) {
				const groupType = generateFieldsInterface(field.fields, '    ');
				return `{\n${groupType}\n  }`;
			}
			return 'Record<string, unknown>';
		}

		case 'blocks':
			// Blocks are handled specially via generateBlockTypes.
			// This fallback returns the union type name placeholder.
			return 'unknown[]';

		case 'json':
			return 'Record<string, unknown>';

		case 'point':
			return '[number, number]';

		default:
			return 'unknown';
	}
}

/**
 * Generate interface field lines from an array of field definitions.
 * Flattens layout fields (tabs, collapsible, row) before processing.
 */
export function generateFieldsInterface(fields: Field[], indent = '  '): string {
	const dataFields = flattenDataFields(fields);
	return dataFields
		.map((field) => {
			const tsType = fieldTypeToTS(field);
			const optional = field.required ? '' : '?';
			const propName = formatPropName(field.name);
			return `${indent}${propName}${optional}: ${tsType};`;
		})
		.join('\n');
}

/**
 * Generate discriminated union types for a blocks field.
 *
 * Returns the block interface definitions and union type as a string,
 * plus the union type name to use in the parent interface.
 */
export function generateBlockTypes(
	collectionName: string,
	fieldName: string,
	blocksField: BlocksField,
): { declarations: string; unionTypeName: string } {
	const collectionPascal = slugToPascalCase(collectionName);
	const fieldPascal = slugToPascalCase(fieldName);
	const prefix = `${collectionPascal}${fieldPascal}`;

	const blockTypeNames: string[] = [];
	const declarations: string[] = [];

	for (const block of blocksField.blocks) {
		const blockPascal = slugToPascalCase(block.slug);
		const typeName = `${prefix}${blockPascal}Block`;
		blockTypeNames.push(typeName);

		const fieldsCode = generateFieldsInterface(block.fields);

		declarations.push(`export interface ${typeName} {`);
		declarations.push(`  blockType: ${safeQuote(block.slug)};`);
		if (fieldsCode) {
			declarations.push(fieldsCode);
		}
		declarations.push(`}`);
		declarations.push('');
	}

	const unionTypeName = `${prefix}Block`;
	if (blockTypeNames.length > 0) {
		declarations.push(`export type ${unionTypeName} =`);
		declarations.push(blockTypeNames.map((name) => `  | ${name}`).join('\n') + ';');
		declarations.push('');
	}

	return { declarations: declarations.join('\n'), unionTypeName };
}

/**
 * Get the where clause type for a field based on its type.
 */
export function getFieldWhereType(field: Field): string {
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
		case 'radio': {
			if (field.options && field.options.length > 0) {
				const options = field.options.map((opt) => safeQuote(opt.value)).join(' | ');
				return `${options} | { equals?: ${options}; not?: ${options}; in?: (${options})[] }`;
			}
			return `string | { equals?: string; in?: string[] }`;
		}

		case 'relationship':
		case 'upload':
			return `string | { equals?: string; not?: string; in?: string[] }`;

		default:
			return 'unknown';
	}
}

/**
 * Generate a where clause interface for a collection.
 */
export function generateWhereClauseInterface(
	slug: string,
	fields: Field[],
	hasTimestamps: boolean,
): string {
	const interfaceName = slugToPascalCase(slug);
	const lines: string[] = [];
	const dataFields = flattenDataFields(fields);

	lines.push(`export interface ${interfaceName}WhereClause {`);
	lines.push(`  id?: string | { equals?: string; not?: string; in?: string[] };`);

	for (const field of dataFields) {
		const whereType = getFieldWhereType(field);
		if (whereType !== 'unknown') {
			const propName = formatPropName(field.name);
			lines.push(`  ${propName}?: ${whereType};`);
		}
	}

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
