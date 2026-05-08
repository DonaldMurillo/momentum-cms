import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMcpRouter } from '../mcp-transport';
import type { Request, Response } from 'express';
import type { PluginLogger } from '@momentumcms/core';

function makeReq(method: string, user?: Record<string, unknown>, body?: unknown): Request {
	return {
		method,
		user,
		body,
		headers: {},
	} as unknown as Request;
}

interface MockResponse extends Response {
	_status: number | null;
	_body: unknown;
}

function makeRes(): MockResponse {
	const res = {
		_status: null as number | null,
		_body: null as unknown,
		headersSent: false,
		status(code: number) {
			res._status = code;
			return res;
		},
		json(body: unknown) {
			res._body = body;
			return res;
		},
		setHeader: vi.fn(),
	};
	return res as unknown as MockResponse;
}

function makeLogger(): PluginLogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

const allowAll = () => true;

describe('createMcpRouter', () => {
	const defaultConfig = { apiKeyRequired: true };
	let getApi: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		getApi = vi.fn().mockReturnValue({
			getConfig: vi.fn().mockReturnValue({ collections: [], globals: [] }),
			setContext: vi.fn().mockReturnThis(),
			collection: vi.fn(),
			global: vi.fn(),
		});
	});

	it('should return an Express router function', () => {
		const router = createMcpRouter(defaultConfig, getApi, allowAll, allowAll);
		expect(typeof router).toBe('function');
	});

	it('should return 503 when API is not ready', () => {
		getApi.mockReturnValue(null);
		const router = createMcpRouter(defaultConfig, getApi, allowAll, allowAll);

		const req = makeReq('POST', { id: 'u1', email: 'a@b.com', role: 'admin' }, {});
		const res = makeRes();
		const next = vi.fn();

		router(req, res as never, next);

		expect(res._status).toBe(503);
		expect(res._body).toEqual(expect.objectContaining({ error: expect.any(String) }));
	});

	it('should return 401 when auth required and no user', () => {
		const router = createMcpRouter({ apiKeyRequired: true }, getApi, allowAll, allowAll);

		const req = makeReq('POST', undefined, {});
		const res = makeRes();
		const next = vi.fn();

		router(req, res as never, next);

		expect(res._status).toBe(401);
	});

	it('should not synchronously reject (401/503/405) when allowAnonymous is true and POST is used', () => {
		const router = createMcpRouter(
			{ apiKeyRequired: false, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
		);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		const next = vi.fn();

		// `handleMcpRequest` is fired without await, so this only proves the
		// three synchronous gates (auth/readiness/method) did not short-circuit.
		// The async path is covered by the setContext + 500 tests below.
		router(req, res as never, next);

		expect(res._status).toBeNull();
	});

	it('should return 401 when apiKeyRequired is false but allowAnonymous is NOT set (footgun guard)', () => {
		// `apiKeyRequired: false` alone must not silently allow anonymous access —
		// callers must explicitly opt in via `allowAnonymous: true`.
		const router = createMcpRouter({ apiKeyRequired: false }, getApi, allowAll, allowAll);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		router(req, res as never, vi.fn());

		expect(res._status).toBe(401);
	});

	it('should return 401 when apiKeyRequired is true even if allowAnonymous is true (auth wins)', () => {
		const router = createMcpRouter(
			{ apiKeyRequired: true, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
		);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		router(req, res as never, vi.fn());

		expect(res._status).toBe(401);
	});

	it('should return 405 for non-POST requests', () => {
		const router = createMcpRouter(
			{ apiKeyRequired: false, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
		);

		const req = makeReq('GET', undefined, {});
		const res = makeRes();
		const next = vi.fn();

		router(req, res as never, next);

		expect(res._status).toBe(405);
		expect(res._body).toEqual(
			expect.objectContaining({ error: expect.stringContaining('Method not allowed') }),
		);
	});

	it('should return 500 when MCP request handling fails', async () => {
		// Force StreamableHTTPServerTransport to throw on construction so the catch block runs deterministically.
		vi.resetModules();
		vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
			StreamableHTTPServerTransport: class {
				constructor() {
					throw new Error('forced transport failure');
				}
			},
		}));

		const { createMcpRouter: freshCreateMcpRouter } = await import('../mcp-transport');
		const router = freshCreateMcpRouter(
			{ apiKeyRequired: false, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
		);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		router(req, res as never, vi.fn());

		await vi.waitFor(
			() => {
				expect(res._status).toBe(500);
			},
			{ timeout: 2000 },
		);
		expect(res._body).toEqual(expect.objectContaining({ error: 'Internal MCP error' }));

		vi.doUnmock('@modelcontextprotocol/sdk/server/streamableHttp.js');
		vi.resetModules();
	});

	it('should log via the provided logger when MCP request handling fails', async () => {
		vi.resetModules();
		vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
			StreamableHTTPServerTransport: class {
				constructor() {
					throw new Error('forced transport failure');
				}
			},
		}));

		const { createMcpRouter: freshCreateMcpRouter } = await import('../mcp-transport');
		const logger = makeLogger();
		const router = freshCreateMcpRouter(
			{ apiKeyRequired: false, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
			logger,
		);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		router(req, res as never, vi.fn());

		await vi.waitFor(
			() => {
				expect(logger.error).toHaveBeenCalled();
			},
			{ timeout: 2000 },
		);

		const errorCall = vi.mocked(logger.error).mock.calls[0];
		expect(errorCall[0]).toContain('MCP request handling failed');
		expect(errorCall[1]).toBeInstanceOf(Error);

		vi.doUnmock('@modelcontextprotocol/sdk/server/streamableHttp.js');
		vi.resetModules();
	});

	it('should not crash when no logger is provided and the request fails', async () => {
		vi.resetModules();
		vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
			StreamableHTTPServerTransport: class {
				constructor() {
					throw new Error('forced transport failure');
				}
			},
		}));

		const { createMcpRouter: freshCreateMcpRouter } = await import('../mcp-transport');
		// No logger — must still gracefully respond with 500.
		const router = freshCreateMcpRouter(
			{ apiKeyRequired: false, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
		);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		router(req, res as never, vi.fn());

		await vi.waitFor(
			() => {
				expect(res._status).toBe(500);
			},
			{ timeout: 2000 },
		);

		vi.doUnmock('@modelcontextprotocol/sdk/server/streamableHttp.js');
		vi.resetModules();
	});

	it('should scope api with anonymous user when allowAnonymous is true and no req.user', async () => {
		const setContextSpy = vi.fn().mockReturnThis();
		getApi.mockReturnValue({
			getConfig: vi.fn().mockReturnValue({ collections: [], globals: [] }),
			setContext: setContextSpy,
			collection: vi.fn(),
			global: vi.fn(),
		});
		const router = createMcpRouter(
			{ apiKeyRequired: false, allowAnonymous: true },
			getApi,
			allowAll,
			allowAll,
		);

		const req = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
		const res = makeRes();
		router(req, res as never, vi.fn());

		await vi.waitFor(
			() => {
				expect(setContextSpy).toHaveBeenCalledTimes(1);
			},
			{ timeout: 2000 },
		);

		// Lock in the exact ANONYMOUS_USER shape so a regression that swaps in
		// a real role (e.g. 'user') doesn't silently pass.
		expect(setContextSpy).toHaveBeenCalledWith({
			user: { id: 'mcp-anonymous', role: 'public' },
		});
	});

	it('should scope api with authenticated user when req.user is present', async () => {
		const setContextSpy = vi.fn().mockReturnThis();
		getApi.mockReturnValue({
			getConfig: vi.fn().mockReturnValue({ collections: [], globals: [] }),
			setContext: setContextSpy,
			collection: vi.fn(),
			global: vi.fn(),
		});
		const router = createMcpRouter({ apiKeyRequired: true }, getApi, allowAll, allowAll);

		const req = makeReq(
			'POST',
			{ id: 'u1', email: 'admin@test.com', role: 'admin' },
			{
				jsonrpc: '2.0',
				method: 'initialize',
				id: 1,
			},
		);
		const res = makeRes();
		router(req, res as never, vi.fn());

		await vi.waitFor(
			() => {
				expect(setContextSpy).toHaveBeenCalledTimes(1);
			},
			{ timeout: 2000 },
		);

		expect(setContextSpy).toHaveBeenCalledWith({
			user: expect.objectContaining({ id: 'u1', role: 'admin' }),
		});
	});

	describe('Dynamic import caching', () => {
		it('should cache the streamable transport import — same Promise returned on repeated calls', async () => {
			vi.resetModules();
			vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
				StreamableHTTPServerTransport: class {},
			}));

			const mod = await import('../mcp-transport');
			const p1 = (mod as Record<string, unknown>).getStreamableTransport();
			const p2 = (mod as Record<string, unknown>).getStreamableTransport();
			expect(p1).toBe(p2); // same Promise object ⇒ cached

			vi.doUnmock('@modelcontextprotocol/sdk/server/streamableHttp.js');
			vi.resetModules();
		});

		it('should cache the server factory import — same Promise returned on repeated calls', async () => {
			vi.resetModules();
			vi.doMock('../mcp-server-factory', () => ({
				createMcpServerInstance: vi.fn(),
			}));

			const mod = await import('../mcp-transport');
			const p1 = (mod as Record<string, unknown>).getServerFactory();
			const p2 = (mod as Record<string, unknown>).getServerFactory();
			expect(p1).toBe(p2); // same Promise object ⇒ cached

			vi.doUnmock('../mcp-server-factory');
			vi.resetModules();
		});

		it('should handle two consecutive requests correctly with cached imports', async () => {
			vi.resetModules();

			const handleRequestCalls: unknown[][] = [];
			vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
				StreamableHTTPServerTransport: class {
					connect = vi.fn().mockResolvedValue(undefined);
					handleRequest = vi.fn((...args: unknown[]) => {
						handleRequestCalls.push(args);
						return Promise.resolve();
					});
					close = vi.fn().mockResolvedValue(undefined);
				},
			}));
			vi.doMock('../mcp-server-factory', () => ({
				createMcpServerInstance: vi.fn().mockReturnValue({
					connect: vi.fn().mockResolvedValue(undefined),
					close: vi.fn().mockResolvedValue(undefined),
				}),
			}));

			const { createMcpRouter: freshRouter } = await import('../mcp-transport');
			const router = freshRouter(
				{ apiKeyRequired: false, allowAnonymous: true },
				getApi,
				allowAll,
				allowAll,
			);

			// First request
			const req1 = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 1 });
			const res1 = makeRes();
			router(req1, res1 as never, vi.fn());

			await vi.waitFor(
				() => {
					expect(handleRequestCalls.length).toBeGreaterThanOrEqual(1);
				},
				{ timeout: 3000 },
			);

			// Second request — uses cached import
			const req2 = makeReq('POST', undefined, { jsonrpc: '2.0', method: 'initialize', id: 2 });
			const res2 = makeRes();
			router(req2, res2 as never, vi.fn());

			await vi.waitFor(
				() => {
					expect(handleRequestCalls.length).toBe(2);
				},
				{ timeout: 3000 },
			);

			// Both requests went through handleRequest → cached imports work
			expect(handleRequestCalls.length).toBe(2);

			vi.doUnmock('@modelcontextprotocol/sdk/server/streamableHttp.js');
			vi.doUnmock('../mcp-server-factory');
			vi.resetModules();
		});
	});

	describe('DNS rebinding / Host validation forwarding', () => {
		// The MCP HTTP spec recommends Host/Origin validation to defend
		// against DNS-rebinding attacks against locally-bound or private
		// servers. The plugin must forward these options to the transport.
		async function captureTransportOptions(
			config: Parameters<typeof createMcpRouter>[0],
		): Promise<Record<string, unknown>> {
			const captured: Record<string, unknown>[] = [];
			vi.resetModules();
			vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
				StreamableHTTPServerTransport: class {
					constructor(opts: Record<string, unknown>) {
						captured.push(opts);
					}
					connect = vi.fn();
					handleRequest = vi.fn().mockResolvedValue(undefined);
					close = vi.fn().mockResolvedValue(undefined);
				},
			}));
			vi.doMock('../mcp-server-factory', () => ({
				createMcpServerInstance: () => ({
					connect: vi.fn().mockResolvedValue(undefined),
					close: vi.fn().mockResolvedValue(undefined),
				}),
			}));

			const { createMcpRouter: freshCreateMcpRouter } = await import('../mcp-transport');
			const router = freshCreateMcpRouter(config, getApi, allowAll, allowAll);
			const req = makeReq(
				'POST',
				{ id: 'u1', email: 'a@b.com', role: 'admin' },
				{ jsonrpc: '2.0', method: 'initialize', id: 1 },
			);
			const res = makeRes();
			router(req, res as never, vi.fn());

			await vi.waitFor(
				() => {
					expect(captured.length).toBe(1);
				},
				{ timeout: 2000 },
			);

			vi.doUnmock('@modelcontextprotocol/sdk/server/streamableHttp.js');
			vi.doUnmock('../mcp-server-factory');
			vi.resetModules();
			return captured[0];
		}

		it('should forward allowedHosts to the transport', async () => {
			const opts = await captureTransportOptions({
				apiKeyRequired: true,
				allowedHosts: ['cms.example.com', 'localhost:3000'],
			});
			expect(opts['allowedHosts']).toEqual(['cms.example.com', 'localhost:3000']);
		});

		it('should forward allowedOrigins to the transport', async () => {
			const opts = await captureTransportOptions({
				apiKeyRequired: true,
				allowedOrigins: ['https://cms.example.com'],
			});
			expect(opts['allowedOrigins']).toEqual(['https://cms.example.com']);
		});

		it('should forward enableDnsRebindingProtection to the transport', async () => {
			const opts = await captureTransportOptions({
				apiKeyRequired: true,
				enableDnsRebindingProtection: true,
			});
			expect(opts['enableDnsRebindingProtection']).toBe(true);
		});

		it('should not pass any host/origin protection options when none are configured', async () => {
			const opts = await captureTransportOptions({ apiKeyRequired: true });
			expect(opts['allowedHosts']).toBeUndefined();
			expect(opts['allowedOrigins']).toBeUndefined();
			expect(opts['enableDnsRebindingProtection']).toBeUndefined();
		});
	});
});
