/**
 * Shared Database Utilities
 *
 * Functions shared between SQLite and PostgreSQL adapters.
 * Extracted to eliminate duplication.
 */

import type { CollectionConfig, DocumentStatus } from '@momentumcms/core';

/** Regex shared by slug and dbName validators — both reach SQL interpolation. */
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * Validates that a collection slug is safe for use in SQL.
 * Prevents potential SQL injection via table names.
 */
export function validateCollectionSlug(slug: string): void {
	if (typeof slug !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(slug)) {
		throw new Error(
			`Invalid collection slug: "${slug}". Slugs must start with a letter or underscore and contain only alphanumeric characters, underscores, and hyphens.`,
		);
	}
}

/**
 * Validates that a table name (resolved from `collection.dbName ?? collection.slug`)
 * is safe to interpolate into raw SQL DDL.
 *
 * `validateCollectionSlug` only guards the slug field; without this check, a
 * collection that sets `dbName` to an unsafe value silently bypasses the
 * SQL-identifier check at every interpolation site (CREATE TABLE, ALTER
 * TABLE, CREATE INDEX, derived table names like `${tbl}_workflow_history`).
 */
export function validateTableName(name: string): void {
	if (typeof name !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(name)) {
		throw new Error(
			`Invalid table name: "${name}". Names must start with a letter or underscore and contain only alphanumeric characters, underscores, and hyphens.`,
		);
	}
}

/**
 * Validates that a column name is safe for use in SQL.
 * Prevents SQL injection via column name interpolation.
 */
export function validateColumnName(name: string): void {
	const validColumnName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
	if (!validColumnName.test(name)) {
		throw new Error(`Invalid column name: "${name}"`);
	}
}

/**
 * Resolves the actual database table name for a collection.
 * Uses dbName if specified, falls back to slug. Validates the resolved name
 * against the SQL-identifier pattern so a malicious `dbName` cannot reach
 * the interpolation sites that consume this value (raw DDL strings,
 * `${tbl}_workflow_history` derived names, etc.).
 */
export function getTableName(collection: CollectionConfig): string {
	const name = collection.dbName ?? collection.slug;
	validateTableName(name);
	return name;
}

/**
 * Type guard to check if a value is a valid DocumentStatus.
 */
export function isDocumentStatus(value: unknown): value is DocumentStatus {
	return value === 'draft' || value === 'published';
}

/**
 * Safely extract status from a database row.
 */
export function getStatusFromRow(row: Record<string, unknown>): DocumentStatus {
	const status = row['_status'];
	return isDocumentStatus(status) ? status : 'draft';
}

/**
 * Safely parse JSON to Record<string, unknown>.
 */
export function parseJsonToRecord(jsonString: string): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(jsonString);
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Safe after type check
			return parsed as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}

/**
 * Type guard to check if a value is a record object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
