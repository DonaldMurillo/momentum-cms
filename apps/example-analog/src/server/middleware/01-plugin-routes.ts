import { defineEventHandler, readBody, type EventHandler } from 'h3';
import type { IncomingMessage, ServerResponse } from 'http';
import { parse as parseQueryString } from 'node:querystring';
import { getPluginMiddleware, getAuth } from '../utils/momentum-init';

/**
 * Nitro middleware that delegates plugin-registered Express middleware to h3.
 *
 * Plugins register Express Routers via registerMiddleware(). The Express
 * server (server-express) mounts them automatically, but h3/Nitro doesn't.
 * This middleware bridges the gap by wrapping Express routers with Express-
 * compatible `res.json()`, `res.status()`, `res.send()`, `res.set()` polyfills
 * since h3's `fromNodeMiddleware` only provides raw Node.js ServerResponse.
 *
 * Named "01-" so it runs AFTER "00-init.ts" (Nitro orders alphabetically).
 */

/**
 * Patch a raw Node.js ServerResponse with Express-style convenience methods
 * (json, status, send, set) so that Express Routers work inside h3/Nitro.
 */
function patchResponse(res: ServerResponse): void {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- patching Express methods onto raw ServerResponse
	const r = res as ServerResponse & {
		json?: (body: unknown) => void;
		status?: (code: number) => ServerResponse;
		send?: (body: unknown) => void;
		set?: (field: string, value: string) => void;
	};

	if (typeof r.json === 'function') return; // already patched

	r.status = function (code: number): ServerResponse {
		res.statusCode = code;
		return res;
	};

	r.json = function (body: unknown): void {
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(body));
	};

	r.send = function (body: unknown): void {
		if (typeof body === 'string') {
			if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html');
			res.end(body);
		} else if (Buffer.isBuffer(body)) {
			if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
			res.end(body);
		} else {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(body));
		}
	};

	r.set = function (field: string, value: string): void {
		res.setHeader(field, value);
	};
}

/**
 * Wrap an Express Router (or any Node.js HTTP handler) so it can be called
 * from an h3 event handler. Patches the response with Express methods and
 * returns a Promise that resolves when the handler calls `next()` (no match)
 * or sends a response.
 */
function wrapExpressHandler(handler: unknown): EventHandler {
	return defineEventHandler(async (event) => {
		const req = event.node.req;
		const res = event.node.res;
		patchResponse(res);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- patching Express properties onto raw IncomingMessage
		const patched = req as IncomingMessage & {
			query?: Record<string, string | string[] | undefined>;
			ip?: string;
			path?: string;
			originalUrl?: string;
			user?: { id: string; email?: string; role?: string };
			body?: unknown;
		};

		// Parse query string into req.query (Express populates this via express.query())
		const urlStr = req.url ?? '/';
		const qIdx = urlStr.indexOf('?');
		if (qIdx >= 0) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- querystring.parse returns compatible type
			patched.query = parseQueryString(urlStr.slice(qIdx + 1)) as Record<
				string,
				string | string[] | undefined
			>;
		} else {
			patched.query = {};
		}

		// Set req.ip (Express provides this via trust-proxy; use socket address as fallback)
		patched.ip = patched.ip ?? req.socket.remoteAddress;

		// Set req.path (URL pathname without query string)
		patched.path = qIdx >= 0 ? urlStr.slice(0, qIdx) : urlStr;

		// Set req.originalUrl (Express uses this to track the original URL before rewriting)
		patched.originalUrl = patched.originalUrl ?? req.url ?? '/';

		// Resolve Better Auth session and set req.user for access control checks.
		// Plugin handlers (SEO, analytics) check req['user'] for authentication.
		const auth = getAuth();
		if (auth && !patched.user) {
			try {
				const headers = new Headers();
				for (const [key, value] of Object.entries(req.headers)) {
					if (value != null) {
						if (Array.isArray(value)) {
							for (const v of value) headers.append(key, v);
						} else {
							headers.set(key, value);
						}
					}
				}
				const session = await auth.api.getSession({ headers });
				if (session) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Better Auth user type
					const userRecord = session.user as Record<string, unknown>;
					const role = typeof userRecord['role'] === 'string' ? userRecord['role'] : 'user';
					patched.user = {
						id: session.user.id,
						email: session.user.email,
						role,
					};
				}
			} catch {
				// Session validation failed — continue without auth
			}
		}

		// Parse the request body so Express handlers can access req.body.
		// h3's readBody() handles JSON parsing; Express Routers expect req.body.
		const method = (req.method ?? 'GET').toUpperCase();
		if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
			try {
				patched.body = await readBody(event);
			} catch {
				// body parsing failed — Express handler will see undefined body
			}
		}

		return new Promise<void>((resolve) => {
			// Track whether the handler sent a response
			const origEnd = res.end.bind(res);
			let responded = false;
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- wrapping res.end
			(res as { end: typeof res.end }).end = function (...args: Parameters<typeof res.end>) {
				responded = true;
				origEnd(...args);
				resolve();
				return res;
			} as typeof res.end;

			// Call the Express handler with (req, res, next)
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler is Express Router
			(handler as (req: IncomingMessage, res: ServerResponse, next: () => void) => void)(
				req,
				res,
				() => {
					if (!responded) resolve();
				},
			);
		});
	});
}

let rootHandler: EventHandler | null = null;
let apiHandlers: Array<{ pathPrefix: string; handler: EventHandler }> | null = null;

function buildHandlers(): void {
	const middleware = getPluginMiddleware();
	if (middleware.length === 0) return;

	// Root-level middleware: served at domain root (e.g. /robots.txt, /sitemap.xml).
	const rootMw = middleware.filter((m) => m.position === 'root');
	if (rootMw.length > 0) {
		const handlers = rootMw.map((mw) => wrapExpressHandler(mw.handler));
		rootHandler = defineEventHandler(async (event) => {
			for (const h of handlers) {
				await h(event);
				if (event.node.res.writableEnded) return;
			}
		});
	}

	// Before-API / after-API middleware: served under /api (e.g. /api/analytics/*).
	const apiMw = middleware.filter((m) => m.position === 'before-api' || m.position === 'after-api');
	if (apiMw.length > 0) {
		apiHandlers = [];
		const byPath = new Map<string, EventHandler[]>();
		for (const mw of apiMw) {
			const prefix = `/api${mw.path}`;
			if (!byPath.has(prefix)) byPath.set(prefix, []);
			byPath.get(prefix)!.push(wrapExpressHandler(mw.handler));
		}
		for (const [prefix, handlers] of byPath) {
			const combined = defineEventHandler(async (event) => {
				const origUrl = event.node.req.url ?? '';
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- setting originalUrl for Express Router compat
				(event.node.req as IncomingMessage & { originalUrl?: string }).originalUrl = origUrl;
				event.node.req.url = origUrl.slice(prefix.length) || '/';
				try {
					for (const h of handlers) {
						await h(event);
						if (event.node.res.writableEnded) return;
					}
				} finally {
					event.node.req.url = origUrl;
				}
			});
			apiHandlers.push({ pathPrefix: prefix, handler: combined });
		}
	}
}

export default defineEventHandler(async (event) => {
	const url = event.path;

	// Lazy-build handlers on first request (after plugin init in 00-init.ts)
	if (rootHandler === null && apiHandlers === null) {
		buildHandlers();
	}

	// Root-level plugin routes (e.g. /robots.txt, /sitemap.xml)
	if (rootHandler && (url === '/robots.txt' || url === '/sitemap.xml')) {
		return rootHandler(event);
	}

	// API-level plugin routes (e.g. /api/seo/*)
	// Try ALL matching prefixes (not just the first) because middleware like api-collector
	// registers at '/' (prefix '/api/') and matches everything but only observes — it calls
	// next() without sending a response. If we returned on first match, SEO/analytics handlers
	// with more specific prefixes would never run.
	if (apiHandlers) {
		for (const { pathPrefix, handler } of apiHandlers) {
			if (url.startsWith(pathPrefix)) {
				await handler(event);
				if (event.node.res.writableEnded) return;
			}
		}
	}
});
