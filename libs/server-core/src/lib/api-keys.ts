import { randomBytes, createHash } from 'node:crypto';
import type { DatabaseAdapter } from '@momentum-cms/core';

/**
 * API key prefix for easy identification.
 * Keys look like: mcms_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
const API_KEY_PREFIX = 'mcms_';

/**
 * Stored API key record.
 */
export interface ApiKeyRecord {
	id: string;
	name: string;
	/** SHA-256 hash of the full key */
	keyHash: string;
	/** First 8 chars of the key for display (e.g., "mcms_abc1...") */
	keyPrefix: string;
	/** User ID that created this key */
	createdBy: string;
	/** Role assigned to this key for access control */
	role: string;
	expiresAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Result of creating a new API key.
 * The full key is only returned once at creation time.
 */
export interface CreateApiKeyResult {
	id: string;
	name: string;
	/** The full API key - only shown once */
	key: string;
	keyPrefix: string;
	role: string;
	expiresAt: string | null;
	createdAt: string;
}

/**
 * Options for creating an API key.
 */
export interface CreateApiKeyOptions {
	name: string;
	role?: string;
	expiresAt?: Date;
}

/**
 * Generate a cryptographically secure API key.
 * Format: mcms_ + 40 hex chars = 45 chars total
 */
export function generateApiKey(): string {
	return `${API_KEY_PREFIX}${randomBytes(20).toString('hex')}`;
}

/**
 * Hash an API key using SHA-256 for secure storage.
 */
export function hashApiKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

/**
 * Extract a display-safe prefix from an API key.
 * Returns the first 12 chars (prefix + 7 hex chars).
 */
export function getKeyPrefix(key: string): string {
	return `${key.substring(0, 12)}...`;
}

/**
 * Validate that a string looks like a Momentum API key.
 */
export function isValidApiKeyFormat(key: string): boolean {
	return key.startsWith(API_KEY_PREFIX) && key.length === 45;
}

/**
 * Generate a unique ID for an API key record.
 */
export function generateApiKeyId(): string {
	return randomBytes(16).toString('hex');
}

/**
 * Database operations for API keys.
 * Uses raw SQL queries through the database adapter.
 */
export interface ApiKeyStore {
	/** Create a new API key record, returns the created record ID */
	create(record: Omit<ApiKeyRecord, 'lastUsedAt'>): Promise<string>;
	/** Find an API key by its hash */
	findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
	/** List all API keys (without sensitive data) */
	listAll(): Promise<Omit<ApiKeyRecord, 'keyHash'>[]>;
	/** List API keys created by a specific user */
	listByUser(userId: string): Promise<Omit<ApiKeyRecord, 'keyHash'>[]>;
	/** Find an API key by ID (without keyHash) */
	findById(id: string): Promise<Omit<ApiKeyRecord, 'keyHash'> | null>;
	/** Delete an API key by ID */
	deleteById(id: string): Promise<boolean>;
	/** Update last used timestamp */
	updateLastUsed(id: string, timestamp: string): Promise<void>;
}

/**
 * SQL for creating the API keys table (PostgreSQL).
 */
export const API_KEYS_TABLE_SQL_POSTGRES = `
	CREATE TABLE IF NOT EXISTS "_api_keys" (
		"id" VARCHAR(36) PRIMARY KEY NOT NULL,
		"name" VARCHAR(255) NOT NULL,
		"keyHash" VARCHAR(64) NOT NULL UNIQUE,
		"keyPrefix" VARCHAR(20) NOT NULL,
		"createdBy" VARCHAR(36) NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
		"role" VARCHAR(50) NOT NULL DEFAULT 'user',
		"expiresAt" TIMESTAMPTZ,
		"lastUsedAt" TIMESTAMPTZ,
		"createdAt" TIMESTAMPTZ NOT NULL,
		"updatedAt" TIMESTAMPTZ NOT NULL
	);

	CREATE INDEX IF NOT EXISTS "idx_api_keys_keyHash" ON "_api_keys"("keyHash");
	CREATE INDEX IF NOT EXISTS "idx_api_keys_createdBy" ON "_api_keys"("createdBy");
`;

/**
 * SQL for creating the API keys table (SQLite).
 */
export const API_KEYS_TABLE_SQL_SQLITE = `
	CREATE TABLE IF NOT EXISTS "_api_keys" (
		"id" TEXT PRIMARY KEY NOT NULL,
		"name" TEXT NOT NULL,
		"keyHash" TEXT NOT NULL UNIQUE,
		"keyPrefix" TEXT NOT NULL,
		"createdBy" TEXT NOT NULL,
		"role" TEXT NOT NULL DEFAULT 'user',
		"expiresAt" TEXT,
		"lastUsedAt" TEXT,
		"createdAt" TEXT NOT NULL,
		"updatedAt" TEXT NOT NULL,
		FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS "idx_api_keys_keyHash" ON "_api_keys"("keyHash");
	CREATE INDEX IF NOT EXISTS "idx_api_keys_createdBy" ON "_api_keys"("createdBy");
`;

/**
 * Create an API key store backed by a generic DatabaseAdapter.
 * Works with any adapter (SQLite, Postgres, etc.) using collection CRUD methods.
 */
export function createAdapterApiKeyStore(adapter: DatabaseAdapter): ApiKeyStore {
	const COLLECTION = 'auth-api-keys';

	return {
		async create(record): Promise<string> {
			const doc = await adapter.create(COLLECTION, {
				name: record.name,
				keyHash: record.keyHash,
				keyPrefix: record.keyPrefix,
				createdBy: record.createdBy,
				role: record.role,
				expiresAt: record.expiresAt,
			});
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter always returns id
			return doc['id'] as string;
		},

		async findByHash(keyHash): Promise<ApiKeyRecord | null> {
			const results = await adapter.find(COLLECTION, { keyHash, limit: 1 });
			if (results.length === 0) return null;
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter returns generic records
			return results[0] as unknown as ApiKeyRecord;
		},

		async findById(id): Promise<Omit<ApiKeyRecord, 'keyHash'> | null> {
			const doc = await adapter.findById(COLLECTION, id);
			if (!doc) return null;
			const { keyHash: _kh, ...rest } = doc;
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter returns generic records
			return rest as unknown as Omit<ApiKeyRecord, 'keyHash'>;
		},

		async listAll(): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
			const results = await adapter.find(COLLECTION, {
				limit: 1000,
				sort: 'createdAt',
				order: 'desc',
			});
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter returns generic records
			return results.map(({ keyHash: _kh, ...rest }) => rest) as unknown as Omit<
				ApiKeyRecord,
				'keyHash'
			>[];
		},

		async listByUser(userId): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
			const results = await adapter.find(COLLECTION, {
				createdBy: userId,
				limit: 1000,
				sort: 'createdAt',
				order: 'desc',
			});
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter returns generic records
			return results.map(({ keyHash: _kh, ...rest }) => rest) as unknown as Omit<
				ApiKeyRecord,
				'keyHash'
			>[];
		},

		async deleteById(id): Promise<boolean> {
			return adapter.delete(COLLECTION, id);
		},

		async updateLastUsed(id, timestamp): Promise<void> {
			await adapter.update(COLLECTION, id, { lastUsedAt: timestamp });
		},
	};
}

/**
 * Create an API key store backed by PostgreSQL.
 */
export function createPostgresApiKeyStore(query: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic database query interface
	query: (sql: string, params?: unknown[]) => Promise<any[]>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic database query interface
	queryOne: (sql: string, params?: unknown[]) => Promise<any | null>;
	execute: (sql: string, params?: unknown[]) => Promise<number>;
}): ApiKeyStore {
	return {
		async create(record): Promise<string> {
			await query.execute(
				`INSERT INTO "_api_keys" ("id", "name", "keyHash", "keyPrefix", "createdBy", "role", "expiresAt", "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[
					record.id,
					record.name,
					record.keyHash,
					record.keyPrefix,
					record.createdBy,
					record.role,
					record.expiresAt,
					record.createdAt,
					record.updatedAt,
				],
			);
			return record.id;
		},

		async findByHash(keyHash): Promise<ApiKeyRecord | null> {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB row to typed record
			return (await query.queryOne(`SELECT * FROM "_api_keys" WHERE "keyHash" = $1`, [
				keyHash,
			])) as ApiKeyRecord | null;
		},

		async findById(id): Promise<Omit<ApiKeyRecord, 'keyHash'> | null> {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB row to typed record
			return (await query.queryOne(
				`SELECT "id", "name", "keyPrefix", "createdBy", "role", "expiresAt", "lastUsedAt", "createdAt", "updatedAt"
				 FROM "_api_keys" WHERE "id" = $1`,
				[id],
			)) as Omit<ApiKeyRecord, 'keyHash'> | null;
		},

		async listAll(): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB rows to typed records
			return (await query.query(
				`SELECT "id", "name", "keyPrefix", "createdBy", "role", "expiresAt", "lastUsedAt", "createdAt", "updatedAt"
				 FROM "_api_keys" ORDER BY "createdAt" DESC`,
			)) as Omit<ApiKeyRecord, 'keyHash'>[];
		},

		async listByUser(userId): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- DB rows to typed records
			return (await query.query(
				`SELECT "id", "name", "keyPrefix", "createdBy", "role", "expiresAt", "lastUsedAt", "createdAt", "updatedAt"
				 FROM "_api_keys" WHERE "createdBy" = $1 ORDER BY "createdAt" DESC`,
				[userId],
			)) as Omit<ApiKeyRecord, 'keyHash'>[];
		},

		async deleteById(id): Promise<boolean> {
			const rows = await query.execute(`DELETE FROM "_api_keys" WHERE "id" = $1`, [id]);
			return rows > 0;
		},

		async updateLastUsed(id, timestamp): Promise<void> {
			await query.execute(`UPDATE "_api_keys" SET "lastUsedAt" = $1 WHERE "id" = $2`, [
				timestamp,
				id,
			]);
		},
	};
}
