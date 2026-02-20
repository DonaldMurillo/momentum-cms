/**
 * Column Type Mapping
 *
 * Maps Momentum CMS field types to database column types.
 * Shared between the migration system and database adapters.
 */
import type { Field } from '@momentumcms/core';

/**
 * Supported database dialects for column type mapping.
 */
export type DatabaseDialect = 'postgresql' | 'sqlite';

/**
 * Map a Momentum field type to a PostgreSQL column type.
 */
export function fieldToPostgresType(field: Field): string {
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'password':
		case 'radio':
		case 'point':
			return 'TEXT';
		case 'email':
		case 'slug':
		case 'select':
			return 'VARCHAR(255)';
		case 'number':
			return 'NUMERIC';
		case 'checkbox':
			return 'BOOLEAN';
		case 'date':
			return 'TIMESTAMPTZ';
		case 'relationship':
		case 'upload':
			return 'VARCHAR(36)';
		case 'array':
		case 'group':
		case 'blocks':
		case 'json':
			return 'JSONB';
		case 'tabs':
		case 'collapsible':
		case 'row':
			// Layout fields should be filtered before reaching here.
			return 'TEXT';
		default:
			return 'TEXT';
	}
}

/**
 * Map a Momentum field type to a SQLite column type.
 */
export function fieldToSqliteType(field: Field): string {
	switch (field.type) {
		case 'text':
		case 'textarea':
		case 'richText':
		case 'email':
		case 'slug':
		case 'select':
		case 'password':
		case 'radio':
		case 'point':
			return 'TEXT';
		case 'number':
			return 'REAL';
		case 'checkbox':
			return 'INTEGER';
		case 'date':
		case 'relationship':
		case 'upload':
			return 'TEXT';
		case 'array':
		case 'group':
		case 'blocks':
		case 'json':
			return 'TEXT';
		default:
			return 'TEXT';
	}
}

/**
 * Map a Momentum field type to a database column type for the given dialect.
 */
export function fieldToColumnType(field: Field, dialect: DatabaseDialect): string {
	if (dialect === 'postgresql') return fieldToPostgresType(field);
	return fieldToSqliteType(field);
}

/**
 * Normalize a raw database type string for reliable comparison.
 * Handles variations like "character varying(255)" vs "VARCHAR(255)".
 */
export function normalizeColumnType(rawType: string, dialect: DatabaseDialect): string {
	const upper = rawType.toUpperCase().trim();

	if (dialect === 'postgresql') {
		return normalizePgType(upper);
	}
	return normalizeSqliteType(upper);
}

/**
 * Normalize PostgreSQL type names.
 * PostgreSQL information_schema returns verbose names that need mapping.
 */
function normalizePgType(type: string): string {
	// character varying(N) → VARCHAR(N)
	const charVaryingMatch = type.match(/^CHARACTER VARYING\((\d+)\)$/);
	if (charVaryingMatch) return `VARCHAR(${charVaryingMatch[1]})`;

	// character varying → VARCHAR(255) (no length specified)
	if (type === 'CHARACTER VARYING') return 'VARCHAR(255)';

	// timestamp with time zone → TIMESTAMPTZ
	if (type === 'TIMESTAMP WITH TIME ZONE') return 'TIMESTAMPTZ';

	// timestamp without time zone → TIMESTAMP
	if (type === 'TIMESTAMP WITHOUT TIME ZONE') return 'TIMESTAMP';

	// boolean → BOOLEAN
	if (type === 'BOOLEAN') return 'BOOLEAN';

	// numeric → NUMERIC
	if (type === 'NUMERIC') return 'NUMERIC';

	// text → TEXT
	if (type === 'TEXT') return 'TEXT';

	// jsonb → JSONB
	if (type === 'JSONB') return 'JSONB';

	// json → JSON
	if (type === 'JSON') return 'JSON';

	// integer → INTEGER
	if (type === 'INTEGER') return 'INTEGER';

	// bigint → BIGINT
	if (type === 'BIGINT') return 'BIGINT';

	// real → REAL
	if (type === 'REAL') return 'REAL';

	// double precision → DOUBLE PRECISION
	if (type === 'DOUBLE PRECISION') return 'DOUBLE PRECISION';

	return type;
}

/**
 * Normalize SQLite type names.
 */
function normalizeSqliteType(type: string): string {
	// SQLite is less verbose, but normalize common variants
	if (type === 'INT' || type === 'INTEGER') return 'INTEGER';
	if (type === 'REAL' || type === 'FLOAT' || type === 'DOUBLE') return 'REAL';
	return type;
}

/**
 * Check if two column types are compatible (same effective storage).
 * Used to avoid flagging non-breaking type "changes" as diffs.
 */
export function areTypesCompatible(
	typeA: string,
	typeB: string,
	dialect: DatabaseDialect,
): boolean {
	const normA = normalizeColumnType(typeA, dialect);
	const normB = normalizeColumnType(typeB, dialect);
	return normA === normB;
}
