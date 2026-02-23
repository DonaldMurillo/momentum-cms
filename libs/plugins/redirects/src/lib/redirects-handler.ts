import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { MomentumAPI } from '@momentumcms/core';

interface CollectionFindApi {
	find(opts: unknown): Promise<{ docs: Array<Record<string, unknown>> }>;
}

interface RedirectDoc {
	from: string;
	to: string;
	type?: string;
	active: boolean;
}

interface RedirectsHandlerOptions {
	cacheTtl?: number;
}

interface RedirectsRouter {
	router: Router;
	invalidateCache: () => void;
}

const REDIRECT_STATUS_CODES: Record<string, number> = {
	permanent: 301,
	temporary: 302,
	temporary_preserve: 307,
	permanent_preserve: 308,
};

function toRedirectDoc(doc: Record<string, unknown>): RedirectDoc {
	return {
		from: String(doc['from'] ?? ''),
		to: String(doc['to'] ?? ''),
		type: doc['type'] != null ? String(doc['type']) : undefined,
		active: doc['active'] !== false,
	};
}

export function createRedirectsRouter(
	getApi: () => MomentumAPI | null,
	options: RedirectsHandlerOptions = {},
): RedirectsRouter {
	const { cacheTtl = 60_000 } = options;
	const router = Router();

	let cachedRedirects: RedirectDoc[] | null = null;
	let cacheTimestamp = 0;

	function invalidateCache(): void {
		cachedRedirects = null;
		cacheTimestamp = 0;
	}

	async function loadRedirects(api: MomentumAPI): Promise<RedirectDoc[]> {
		const now = Date.now();
		if (cachedRedirects && now - cacheTimestamp < cacheTtl) {
			return cachedRedirects;
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- MomentumAPI.collection returns dynamic shape
		const collectionApi = api.collection('redirects') as CollectionFindApi;
		const result = await collectionApi.find({
			where: { active: { equals: true } },
			limit: 1000,
		});

		cachedRedirects = (result.docs ?? []).map(toRedirectDoc);
		cacheTimestamp = now;
		return cachedRedirects;
	}

	router.use(async (req: Request, res: Response, next: NextFunction) => {
		const api = getApi();
		if (!api) {
			next();
			return;
		}

		try {
			const redirects = await loadRedirects(api);
			const match = redirects.find((r) => r.active !== false && r.from === req.path);

			if (!match) {
				next();
				return;
			}

			const statusCode = match.type ? (REDIRECT_STATUS_CODES[match.type] ?? 301) : 301;
			res.redirect(statusCode, match.to);
		} catch {
			next();
		}
	});

	return { router, invalidateCache };
}
