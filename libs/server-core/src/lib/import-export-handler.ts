/**
 * Shared Import/Export Handler for Momentum CMS.
 *
 * Framework-agnostic handler functions that encapsulate all import/export logic.
 * Adapters (Express, Analog, NestJS) call these and map the result to their response format.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions -- Type assertions needed for API result narrowing */

import type { CollectionConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/core';
import type { ExportFormat, ImportResult } from './import-export';
import {
	exportToJson,
	exportToCsv,
	parseJsonImport,
	parseCsvImport,
	validateImportDocs,
} from './import-export';
import { sanitizeErrorMessage, sanitizeFilename } from './shared-server-utils';

// ============================================
// Types
// ============================================

export interface ExportHandlerParams {
	collectionSlug: string;
	format: ExportFormat;
	limit?: number;
	where?: Record<string, unknown>;
	user?: { id: string | number; role?: string };
	config: { collections: CollectionConfig[] };
	api: MomentumAPI;
}

export interface ImportHandlerParams {
	collectionSlug: string;
	format: ExportFormat;
	body: unknown;
	dryRun?: boolean;
	user?: { id: string | number; role?: string };
	config: { collections: CollectionConfig[] };
	api: MomentumAPI;
}

export interface HandlerResult {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
}

// ============================================
// Export Handler
// ============================================

export async function handleExportRequest(params: ExportHandlerParams): Promise<HandlerResult> {
	const { collectionSlug, format, limit = 10000, user, config, api } = params;

	const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
	if (!collectionConfig) {
		return { status: 404, body: { error: `Collection "${collectionSlug}" not found` } };
	}

	if (format !== 'json' && format !== 'csv') {
		return { status: 400, body: { error: 'Invalid format. Use "json" or "csv"' } };
	}

	try {
		const contextApi = user ? api.setContext({ user }) : api;
		const result = await (
			contextApi.collection(collectionSlug) as {
				find(opts: { limit: number }): Promise<{ docs: Record<string, unknown>[] }>;
			}
		).find({ limit });
		const docs = result.docs as Record<string, unknown>[];
		const safeSlug = sanitizeFilename(collectionSlug);

		if (format === 'csv') {
			const exportResult = exportToCsv(docs, collectionConfig);
			return {
				status: 200,
				body: exportResult.data,
				headers: {
					'Content-Type': 'text/csv',
					'Content-Disposition': `attachment; filename="${safeSlug}-export.csv"`,
				},
			};
		}

		const exportResult = exportToJson(docs, collectionConfig);
		return {
			status: 200,
			body: {
				collection: collectionSlug,
				format: 'json',
				totalDocs: exportResult.totalDocs,
				docs: exportResult.docs,
			},
			headers: {
				'Content-Disposition': `attachment; filename="${safeSlug}-export.json"`,
			},
		};
	} catch (error) {
		const message = sanitizeErrorMessage(error, 'Export failed');
		let status = 500;
		if (error instanceof Error) {
			if (error.name === 'AccessDeniedError') status = 403;
			else if (error.name === 'ValidationError') status = 400;
			else if (error.name === 'DocumentNotFoundError') status = 404;
		}
		return { status, body: { error: message } };
	}
}

// ============================================
// Import Handler
// ============================================

/** Maximum number of documents that can be imported in a single request */
export const MAX_IMPORT_DOCS = 5000;

export async function handleImportRequest(params: ImportHandlerParams): Promise<HandlerResult> {
	const { collectionSlug, format, body, dryRun, user, config, api } = params;

	// Auth check
	if (!user) {
		return { status: 401, body: { error: 'Authentication required to import data' } };
	}

	const collectionConfig = config.collections.find((c) => c.slug === collectionSlug);
	if (!collectionConfig) {
		return { status: 404, body: { error: `Collection "${collectionSlug}" not found` } };
	}

	// Parse input
	let docsToImport: Record<string, unknown>[];
	let parseError: string | undefined;

	const bodyObj = (typeof body === 'object' && body !== null ? body : {}) as Record<
		string,
		unknown
	>;

	if (format === 'csv') {
		const csvData = bodyObj['data'];
		if (typeof csvData !== 'string') {
			return { status: 400, body: { error: 'CSV import requires "data" field with CSV string' } };
		}
		const parsed = parseCsvImport(csvData, collectionConfig);
		docsToImport = parsed.docs;
		parseError = parsed.error;
	} else {
		const parsed = parseJsonImport(bodyObj['docs'] ?? bodyObj['data'] ?? body);
		docsToImport = parsed.docs;
		parseError = parsed.error;
	}

	if (parseError) {
		return { status: 400, body: { error: parseError } };
	}

	if (docsToImport.length === 0) {
		return { status: 400, body: { error: 'No documents to import' } };
	}

	// Enforce max import document limit to prevent DoS
	if (docsToImport.length > MAX_IMPORT_DOCS) {
		return {
			status: 400,
			body: {
				error: `Import limit exceeded. Maximum ${MAX_IMPORT_DOCS} documents per request, received ${docsToImport.length}`,
			},
		};
	}

	// Dry-run mode: validate only
	if (dryRun) {
		const validation = validateImportDocs(docsToImport, collectionConfig);
		return {
			status: 200,
			body: { validation, total: docsToImport.length },
		};
	}

	// Execute import
	try {
		const contextApi = api.setContext({ user });
		const result: ImportResult = {
			imported: 0,
			total: docsToImport.length,
			errors: [],
			docs: [],
		};

		for (let i = 0; i < docsToImport.length; i++) {
			try {
				const doc = await (
					contextApi.collection(collectionSlug) as {
						create(data: Record<string, unknown>): Promise<Record<string, unknown>>;
					}
				).create(docsToImport[i]);
				result.docs.push(doc);
				result.imported++;
			} catch (err) {
				const errMsg = sanitizeErrorMessage(err, 'Failed to import document');
				result.errors.push({ index: i, message: errMsg });
			}
		}

		const status = result.imported > 0 ? 200 : 400;
		return { status, body: result };
	} catch (error) {
		const message = sanitizeErrorMessage(error, 'Import failed');
		return { status: 500, body: { error: message } };
	}
}
