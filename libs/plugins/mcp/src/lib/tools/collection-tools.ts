/**
 * Collection CRUD tools for MCP.
 *
 * find, get, create, update, delete, search, count
 */

import type { MomentumAPI } from '@momentumcms/plugins/core';

interface ToolResult {
	[key: string]: unknown;
	content: Array<{ type: 'text'; text: string }>;
	isError?: true;
}

interface CollectionOps {
	find(opts: Record<string, unknown>): Promise<unknown>;
	findById(id: string, opts: Record<string, unknown>): Promise<unknown>;
	create(data: Record<string, unknown>): Promise<unknown>;
	update(id: string, data: Record<string, unknown>): Promise<unknown>;
	delete(id: string): Promise<unknown>;
	search(query: string, opts: Record<string, unknown>): Promise<unknown>;
	count(where?: Record<string, unknown>): Promise<number>;
}

const MAX_LIMIT = 100;
const MAX_DEPTH = 3;
const MAX_PAGE = 100_000;

function errorResult(message: string): ToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] };
}

function jsonResult(data: unknown): ToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function parseJsonParam(
	raw: string | undefined,
	paramName: string,
): { value?: Record<string, unknown>; error?: ToolResult } {
	if (!raw) return {};
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { error: errorResult(`Invalid JSON in "${paramName}" parameter`) };
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return { error: errorResult(`"${paramName}" must be a JSON object`) };
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- guarded above
	return { value: parsed as Record<string, unknown> };
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.min(Math.max(value, min), max);
}

function getCollectionOps(api: MomentumAPI, slug: string): CollectionOps {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection() returns dynamic shape
	return api.collection(slug) as CollectionOps;
}

export async function handleFindDocuments(
	api: MomentumAPI,
	args: {
		collection: string;
		where?: string;
		sort?: string;
		limit?: number;
		page?: number;
		depth?: number;
	},
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	const { value: where, error: whereError } = parseJsonParam(args.where, 'where');
	if (whereError) return whereError;

	try {
		const ops = getCollectionOps(api, args.collection);
		const result = await ops.find({
			where,
			sort: args.sort,
			limit: clamp(args.limit, 10, 1, MAX_LIMIT),
			page: clamp(args.page, 1, 1, MAX_PAGE),
			depth: clamp(args.depth, 0, 0, MAX_DEPTH),
		});
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleGetDocument(
	api: MomentumAPI,
	args: { collection: string; id: string; depth?: number },
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	try {
		const ops = getCollectionOps(api, args.collection);
		const result = await ops.findById(args.id, { depth: clamp(args.depth, 0, 0, MAX_DEPTH) });
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleCreateDocument(
	api: MomentumAPI,
	args: { collection: string; data: string },
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	const { value: data, error: dataError } = parseJsonParam(args.data, 'data');
	if (dataError) return dataError;
	if (!data) return errorResult('"data" must be a JSON object');

	try {
		const ops = getCollectionOps(api, args.collection);
		const result = await ops.create(data);
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleUpdateDocument(
	api: MomentumAPI,
	args: { collection: string; id: string; data: string },
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	const { value: data, error: dataError } = parseJsonParam(args.data, 'data');
	if (dataError) return dataError;
	if (!data) return errorResult('"data" must be a JSON object');

	try {
		const ops = getCollectionOps(api, args.collection);
		const result = await ops.update(args.id, data);
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleDeleteDocument(
	api: MomentumAPI,
	args: { collection: string; id: string },
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	try {
		const ops = getCollectionOps(api, args.collection);
		const result = await ops.delete(args.id);
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleSearchDocuments(
	api: MomentumAPI,
	args: { collection: string; query: string; limit?: number; page?: number },
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	try {
		const ops = getCollectionOps(api, args.collection);
		const result = await ops.search(args.query, {
			limit: clamp(args.limit, 10, 1, MAX_LIMIT),
			page: clamp(args.page, 1, 1, MAX_PAGE),
		});
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleCountDocuments(
	api: MomentumAPI,
	args: { collection: string; where?: string },
	isCollectionAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isCollectionAllowed(args.collection)) {
		return errorResult(`Collection "${args.collection}" is not accessible via MCP`);
	}

	const { value: where, error: whereError } = parseJsonParam(args.where, 'where');
	if (whereError) return whereError;

	try {
		const ops = getCollectionOps(api, args.collection);
		const count = await ops.count(where);
		return jsonResult({ count });
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}
