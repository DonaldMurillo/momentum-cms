import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * MCP Server E2E Tests
 *
 * Tests the MCP (Model Context Protocol) endpoint at /api/mcp by sending
 * raw JSON-RPC 2.0 requests over HTTP POST — the same protocol that
 * Claude Code and other MCP clients use.
 *
 * Key protocol details:
 * - Stateless mode: each POST gets a fresh McpServer (no sessions)
 * - No initialize required: tools/call works directly in stateless mode
 * - Responses use SSE format: "event: message\ndata: {...}\n\n"
 * - Must send Accept header: "application/json, text/event-stream"
 */

/** Parse SSE response text to extract the JSON-RPC result */
function parseSseResponse(text: string): Record<string, unknown> {
	const lines = text.split('\n');
	for (const line of lines) {
		if (line.startsWith('data: ')) {
			return JSON.parse(line.slice(6));
		}
	}
	throw new Error(`No data line found in SSE response: ${text.substring(0, 200)}`);
}

/** Send a JSON-RPC request to the MCP endpoint */
async function mcpRequest(
	ctx: APIRequestContext,
	method: string,
	params: Record<string, unknown> = {},
	id = 1,
) {
	const response = await ctx.post('/api/mcp', {
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
		},
		data: {
			jsonrpc: '2.0',
			method,
			params,
			id,
		},
	});
	return { response, status: response.status() };
}

/** Send a JSON-RPC request and parse the SSE result */
async function mcpResult(
	ctx: APIRequestContext,
	method: string,
	params: Record<string, unknown> = {},
	id = 1,
) {
	const { response, status } = await mcpRequest(ctx, method, params, id);
	expect(status).toBe(200);
	const text = await response.text();
	return parseSseResponse(text) as {
		jsonrpc: string;
		id: number;
		result?: Record<string, unknown>;
		error?: { code: number; message: string };
	};
}

test.describe('MCP Server', { tag: ['@mcp', '@api'] }, () => {
	let mcpContext: APIRequestContext;
	let apiKey: string;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		// 1. Sign in as admin to create an API key
		const adminCtx = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		const signIn = await adminCtx.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok()).toBe(true);

		// 2. Create an API key for MCP access
		const keyResponse = await adminCtx.post('/api/auth/api-keys', {
			data: { name: 'MCP E2E Test Key', role: 'admin' },
		});
		expect(keyResponse.status()).toBe(201);
		const keyData = (await keyResponse.json()) as { key: string };
		apiKey = keyData.key;
		await adminCtx.dispose();

		// 3. Create MCP context with the API key
		mcpContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: {
				'X-API-Key': apiKey,
			},
		});
	});

	test.afterAll(async () => {
		await mcpContext?.dispose();
	});

	test('should reject unauthenticated requests with 401', async ({ playwright, workerBaseURL }) => {
		const anonCtx = await playwright.request.newContext({ baseURL: workerBaseURL });
		const { status } = await mcpRequest(anonCtx, 'initialize', {
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: { name: 'test', version: '1.0' },
		});
		expect(status).toBe(401);
		await anonCtx.dispose();
	});

	test('should reject non-POST methods with 405 and an explanatory body', async () => {
		const response = await mcpContext.get('/api/mcp');
		expect(response.status()).toBe(405);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain('Method not allowed');
	});

	test('should complete MCP initialize handshake', async () => {
		const result = await mcpResult(mcpContext, 'initialize', {
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: { name: 'e2e-test', version: '1.0.0' },
		});
		expect(result.error).toBeUndefined();
		expect(result.result).toBeDefined();
		const serverInfo = result.result?.['serverInfo'] as { name: string };
		expect(serverInfo.name).toBe('momentum-cms');
	});

	test('should list available tools via tools/list', async () => {
		// In stateless mode, tools/list works without prior initialize
		const toolsResult = await mcpResult(mcpContext, 'tools/list', {});
		expect(toolsResult.result).toBeDefined();
		const tools = toolsResult.result?.['tools'] as Array<{ name: string }>;
		expect(tools).toBeDefined();
		expect(tools.length).toBeGreaterThanOrEqual(10);

		const toolNames = tools.map((t) => t.name);
		// Schema tools (always present)
		expect(toolNames).toContain('list_collections');
		expect(toolNames).toContain('get_collection_schema');
		// Read tools
		expect(toolNames).toContain('find_documents');
		expect(toolNames).toContain('get_document');
		expect(toolNames).toContain('search_documents');
		expect(toolNames).toContain('count_documents');
		// Write tools (enabled in example app config)
		expect(toolNames).toContain('create_document');
		expect(toolNames).toContain('update_document');
		expect(toolNames).toContain('delete_document');
		// Global tools
		expect(toolNames).toContain('list_globals');
		expect(toolNames).toContain('get_global');
		expect(toolNames).toContain('update_global');
	});

	test('should list collections and exclude auth collections @mcp @api', async () => {
		const result = await mcpResult(mcpContext, 'tools/call', {
			name: 'list_collections',
			arguments: {},
		});
		expect(result.result).toBeDefined();

		const content = result.result?.['content'] as Array<{ type: string; text: string }>;
		expect(content).toBeDefined();
		expect(content[0].type).toBe('text');

		const collections = JSON.parse(content[0].text) as Array<{
			slug: string;
			label: string;
			fieldCount: number;
		}>;
		expect(collections.length).toBeGreaterThan(0);

		const slugs = collections.map((c) => c.slug);
		// Should include real content collections
		expect(slugs).toContain('articles');
		expect(slugs).toContain('categories');

		// Should NOT include auth collections
		expect(slugs).not.toContain('auth-user');
		expect(slugs).not.toContain('auth-session');
		expect(slugs).not.toContain('auth-account');
	});

	test('should get collection schema', async () => {
		const result = await mcpResult(mcpContext, 'tools/call', {
			name: 'get_collection_schema',
			arguments: { collection: 'articles' },
		});
		expect(result.result).toBeDefined();

		const content = result.result?.['content'] as Array<{ type: string; text: string }>;
		const schema = JSON.parse(content[0].text) as {
			slug: string;
			fields: Array<{ name: string; type: string }>;
		};
		expect(schema.slug).toBe('articles');
		expect(schema.fields.length).toBeGreaterThan(0);

		const fieldNames = schema.fields.map((f) => f.name);
		expect(fieldNames).toContain('title');
	});

	test('should find documents from a seeded collection', async () => {
		const result = await mcpResult(mcpContext, 'tools/call', {
			name: 'find_documents',
			arguments: { collection: 'articles', limit: 5 },
		});
		expect(result.result).toBeDefined();

		const content = result.result?.['content'] as Array<{ type: string; text: string }>;
		const data = JSON.parse(content[0].text) as {
			docs: Array<{ id: string; title: string }>;
			totalDocs: number;
		};

		expect(data.docs.length).toBeGreaterThan(0);
		expect(data.totalDocs).toBeGreaterThan(0);
		expect(data.docs[0].id).toBeDefined();
		expect(data.docs[0].title).toBeDefined();
	});

	test('should create and then retrieve a document', async () => {
		// Use unique slug per run so the suite is re-runnable against the same DB.
		const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const slug = `mcp-test-cat-${unique}`;
		const name = `MCP Test Category ${unique}`;

		// Create
		const createResult = await mcpResult(mcpContext, 'tools/call', {
			name: 'create_document',
			arguments: {
				collection: 'categories',
				data: JSON.stringify({ name, slug }),
			},
		});
		expect(createResult.result).toBeDefined();
		const createContent = createResult.result?.['content'] as Array<{ type: string; text: string }>;
		const created = JSON.parse(createContent[0].text) as { id: string; name: string };
		expect(created.id).toBeDefined();
		expect(created.name).toBe(name);

		// Get
		const getResult = await mcpResult(mcpContext, 'tools/call', {
			name: 'get_document',
			arguments: { collection: 'categories', id: created.id },
		});
		expect(getResult.result).toBeDefined();
		const getContent = getResult.result?.['content'] as Array<{ type: string; text: string }>;
		const fetched = JSON.parse(getContent[0].text) as { id: string; name: string };
		expect(fetched.id).toBe(created.id);
		expect(fetched.name).toBe(name);

		// Clean up: delete the document to keep the DB tidy across runs
		const deleteResult = await mcpResult(mcpContext, 'tools/call', {
			name: 'delete_document',
			arguments: { collection: 'categories', id: created.id },
		});
		expect(deleteResult.result).toBeDefined();
	});

	test('should count documents', async () => {
		const result = await mcpResult(mcpContext, 'tools/call', {
			name: 'count_documents',
			arguments: { collection: 'articles' },
		});
		expect(result.result).toBeDefined();
		const content = result.result?.['content'] as Array<{ type: string; text: string }>;
		const data = JSON.parse(content[0].text) as { count: number };
		expect(data.count).toBeGreaterThan(0);
	});

	test('should list globals', async () => {
		const result = await mcpResult(mcpContext, 'tools/call', {
			name: 'list_globals',
			arguments: {},
		});
		expect(result.result).toBeDefined();
		const content = result.result?.['content'] as Array<{ type: string; text: string }>;
		const globals = JSON.parse(content[0].text) as Array<{ slug: string; label: string }>;
		expect(globals.length).toBeGreaterThan(0);
	});

	test('should return error for denied collection', async () => {
		const result = await mcpResult(mcpContext, 'tools/call', {
			name: 'find_documents',
			arguments: { collection: 'auth-user' },
		});
		expect(result.result).toBeDefined();
		const content = result.result?.['content'] as Array<{ type: string; text: string }>;
		const isError = result.result?.['isError'];
		expect(isError).toBe(true);
		expect(content[0].text).toContain('not accessible');
	});
});
