/**
 * Global tools for MCP.
 *
 * list_globals, get_global, update_global
 */

import type { MomentumAPI } from '@momentumcms/plugins/core';
import type { MomentumConfig } from '@momentumcms/core';

interface ToolResult {
	[key: string]: unknown;
	content: Array<{ type: 'text'; text: string }>;
	isError?: true;
}

interface GlobalOps {
	findOne(opts?: Record<string, unknown>): Promise<unknown>;
	update(data: Record<string, unknown>): Promise<unknown>;
}

interface ApiWithGlobals extends MomentumAPI {
	global(slug: string): unknown;
}

function errorResult(message: string): ToolResult {
	return { isError: true, content: [{ type: 'text', text: message }] };
}

function jsonResult(data: unknown): ToolResult {
	return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// Uniform message for any slug the filter rejects — whether unknown or in
// deniedGlobals. Differentiated messages would let callers enumerate hidden
// globals by probing slugs.
function deniedGlobalError(slug: string): ToolResult {
	return errorResult(`Global "${slug}" is not accessible via MCP`);
}

function getGlobalOps(api: MomentumAPI, slug: string): GlobalOps {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI minimal interface lacks global(); full API has it at runtime
	return (api as ApiWithGlobals).global(slug) as GlobalOps;
}

export function handleListGlobals(
	config: MomentumConfig,
	isGlobalAllowed: (slug: string) => boolean,
): ToolResult {
	const globals = (config.globals ?? [])
		.filter((g) => isGlobalAllowed(g.slug))
		.map((g) => ({
			slug: g.slug,
			label: g.label ?? g.slug,
			fieldCount: (g.fields ?? []).length,
		}));
	return jsonResult(globals);
}

export async function handleGetGlobal(
	api: MomentumAPI,
	args: { slug: string; depth?: number },
	isGlobalAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isGlobalAllowed(args.slug)) return deniedGlobalError(args.slug);

	try {
		const ops = getGlobalOps(api, args.slug);
		const opts =
			args.depth !== undefined ? { depth: Math.max(0, Math.min(args.depth, 3)) } : undefined;
		const result = await ops.findOne(opts);
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}

export async function handleUpdateGlobal(
	api: MomentumAPI,
	args: { slug: string; data: string },
	isGlobalAllowed: (slug: string) => boolean,
): Promise<ToolResult> {
	if (!isGlobalAllowed(args.slug)) return deniedGlobalError(args.slug);

	let parsed: unknown;
	try {
		parsed = JSON.parse(args.data);
	} catch {
		return errorResult('Invalid JSON in "data" parameter');
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return errorResult('"data" must be a JSON object');
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- guarded above
	const data = parsed as Record<string, unknown>;

	try {
		const ops = getGlobalOps(api, args.slug);
		const result = await ops.update(data);
		return jsonResult(result);
	} catch (err) {
		return errorResult(String(err instanceof Error ? err.message : err));
	}
}
