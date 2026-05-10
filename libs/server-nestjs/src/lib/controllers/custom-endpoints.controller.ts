import {
	Controller,
	Get,
	Post,
	Put,
	Patch,
	Delete,
	Param,
	Body,
	Query,
	Req,
	Res,
	Next,
	Inject,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import type {
	EndpointConfig,
	EndpointQueryHelper,
	DatabaseAdapter,
	MomentumConfig,
	ResolvedMomentumConfig,
} from '@momentumcms/core';
import { sanitizeErrorMessage, type MomentumAPI } from '@momentumcms/server-core';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

interface DispatchInput {
	collectionSlug: string;
	id: string | undefined;
	action: string;
	method: EndpointConfig['method'];
	body: Record<string, unknown> | undefined;
	query: Record<string, unknown> | undefined;
	req: Request;
	res: Response;
	next: NextFunction;
}

/**
 * Optional NestJS controller that dispatches per-collection custom endpoints
 * declared via `collection.endpoints[]`.
 *
 * Supports the two common path shapes:
 *   - METHOD /:collection/:action               (collection-level action)
 *   - METHOD /:collection/:id/:action           (document-level action)
 *
 * Coexistence with `CollectionController`: this controller's route patterns
 * (`:collection/:action`, `:collection/:id/:action`) overlap CRUD findById /
 * update / delete patterns (`:collection/:id`, `:collection/:id`) on the same
 * HTTP methods. To prevent shadowing, the dispatcher calls `next()` whenever
 * no `endpoints[]` entry matches — letting Express fall through to the next
 * registered handler. Register `CustomEndpointsController` BEFORE
 * `CollectionController` in your module's `controllers: [...]` array so the
 * fall-through reaches the standard CRUD routes.
 *
 * Coexistence with sibling controllers: BatchController, SearchController,
 * UploadController, ImportExportController, and PreviewController all live
 * under `:collection` and claim reserved actions (`batch`, `search`,
 * `upload`, `import`, `export`, `preview`). Custom endpoints whose `path`
 * matches any of those reserved actions will silently shadow / be shadowed
 * by the sibling depending on registration order. Avoid those names for
 * custom endpoints, or register the siblings AFTER this controller so the
 * dispatcher's `next()` fall-through reaches them when the slug is unknown.
 *
 * Multi-segment endpoint paths beyond two parameters are not supported here.
 * For arbitrary paths, register your own NestJS controller per endpoint, or
 * rely on the Express middleware mounted by `createMomentumNestServer` —
 * which already handles the full path space.
 */
@Controller(':collection')
export class CustomEndpointsController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get(':action')
	async getOne(
		@Param('collection') collectionSlug: string,
		@Param('action') action: string,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id: undefined,
			action,
			method: 'get',
			body: undefined,
			query,
			req,
			res,
			next,
		});
	}

	@Post(':action')
	async postOne(
		@Param('collection') collectionSlug: string,
		@Param('action') action: string,
		@Body() body: Record<string, unknown> | undefined,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id: undefined,
			action,
			method: 'post',
			body,
			query,
			req,
			res,
			next,
		});
	}

	@Put(':action')
	async putOne(
		@Param('collection') collectionSlug: string,
		@Param('action') action: string,
		@Body() body: Record<string, unknown> | undefined,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id: undefined,
			action,
			method: 'put',
			body,
			query,
			req,
			res,
			next,
		});
	}

	@Patch(':action')
	async patchOne(
		@Param('collection') collectionSlug: string,
		@Param('action') action: string,
		@Body() body: Record<string, unknown> | undefined,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id: undefined,
			action,
			method: 'patch',
			body,
			query,
			req,
			res,
			next,
		});
	}

	@Delete(':action')
	async deleteOne(
		@Param('collection') collectionSlug: string,
		@Param('action') action: string,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id: undefined,
			action,
			method: 'delete',
			body: undefined,
			query,
			req,
			res,
			next,
		});
	}

	@Get(':id/:action')
	async getTwo(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Param('action') action: string,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id,
			action,
			method: 'get',
			body: undefined,
			query,
			req,
			res,
			next,
		});
	}

	@Post(':id/:action')
	async postTwo(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Param('action') action: string,
		@Body() body: Record<string, unknown> | undefined,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id,
			action,
			method: 'post',
			body,
			query,
			req,
			res,
			next,
		});
	}

	@Put(':id/:action')
	async putTwo(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Param('action') action: string,
		@Body() body: Record<string, unknown> | undefined,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({ collectionSlug, id, action, method: 'put', body, query, req, res, next });
	}

	@Patch(':id/:action')
	async patchTwo(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Param('action') action: string,
		@Body() body: Record<string, unknown> | undefined,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id,
			action,
			method: 'patch',
			body,
			query,
			req,
			res,
			next,
		});
	}

	@Delete(':id/:action')
	async deleteTwo(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Param('action') action: string,
		@Query() query: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
		@Next() next: NextFunction,
	): Promise<void> {
		await this.dispatch({
			collectionSlug,
			id,
			action,
			method: 'delete',
			body: undefined,
			query,
			req,
			res,
			next,
		});
	}

	private async dispatch(input: DispatchInput): Promise<void> {
		const config = this._apiService.getConfig();
		const collection = config.collections.find((c) => c.slug === input.collectionSlug);
		// When no custom endpoint matches, fall through to the next Express handler
		// (typically `CollectionController` in the same module) instead of swallowing
		// the request with a 404. This is what makes co-registration with the
		// standard CRUD controller safe — see class-level docs.
		if (!collection || collection.managed) {
			input.next();
			return;
		}

		// Endpoint paths declared in `collection.endpoints[]` may or may not
		// have a leading slash. Normalize both sides to the no-leading-slash
		// form so the lookup is unambiguous regardless of author style.
		const expectedPath = input.id ? `:id/${input.action}` : input.action;
		const endpoint = collection.endpoints?.find(
			(e) => e.method === input.method && e.path.replace(/^\//, '') === expectedPath,
		);
		if (!endpoint) {
			input.next();
			return;
		}

		try {
			const user = extractUser(input.req);
			const api = this._apiService.getApi();
			const contextApi = user ? api.setContext({ user }) : api;
			const queryHelper = buildQueryHelper(contextApi, config);

			const result = await endpoint.handler({
				req: { user },
				collection,
				body: input.body && typeof input.body === 'object' ? input.body : undefined,
				params: { ...(input.query ?? {}), ...(input.id ? { id: input.id } : {}) },
				query: queryHelper,
			});
			input.res.status(result.status).json(result.body);
		} catch (error) {
			const message = sanitizeErrorMessage(error, 'Custom endpoint error');
			input.res.status(500).json({ error: message });
		}
	}
}

// ---- query helpers ----

function buildQueryHelper(
	api: MomentumAPI,
	config: MomentumConfig | ResolvedMomentumConfig,
): EndpointQueryHelper {
	const helper: EndpointQueryHelper = {
		find: async (slug, options) => {
			const r = await api.collection(slug).find(options);
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter results are Record-shaped
			return { docs: r.docs as Record<string, unknown>[], totalDocs: r.totalDocs };
		},
		findById: async (slug, id) => {
			try {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter results are Record-shaped
				return (await api.collection(slug).findById(id)) as Record<string, unknown>;
			} catch (err) {
				if (err instanceof Error && err.name === 'DocumentNotFoundError') return null;
				throw err;
			}
		},
		count: (slug, where) => api.collection(slug).count(where),
		create: async (slug, data) => {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter results are Record-shaped
			return (await api.collection(slug).create(data)) as Record<string, unknown>;
		},
		update: async (slug, id, data) => {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- adapter results are Record-shaped
			return (await api.collection(slug).update(id, data)) as Record<string, unknown>;
		},
		delete: (slug, id) => api.collection(slug).delete(id),
		transaction: async <T>(callback: (q: EndpointQueryHelper) => Promise<T>): Promise<T> => {
			const adapter = config.db.adapter;
			if (adapter.transaction) {
				return adapter.transaction(async (tx) => callback(buildTxHelper(tx)));
			}
			return callback(helper);
		},
	};
	return helper;
}

function buildTxHelper(tx: DatabaseAdapter): EndpointQueryHelper {
	const helper: EndpointQueryHelper = {
		find: async (slug, query) => {
			const docs = await tx.find(slug, query ?? {});
			return { docs, totalDocs: docs.length };
		},
		findById: (slug, id) => tx.findById(slug, id),
		count: async (slug, where) => {
			if (tx.count) return tx.count(slug, where ?? {});
			const docs = await tx.find(slug, where ?? {});
			return docs.length;
		},
		create: (slug, data) => tx.create(slug, data),
		update: (slug, id, data) => tx.update(slug, id, data),
		delete: async (slug, id) => {
			const deleted = await tx.delete(slug, id);
			return { id, deleted };
		},
		transaction: async <T>(callback: (q: EndpointQueryHelper) => Promise<T>): Promise<T> =>
			callback(helper),
	};
	return helper;
}
