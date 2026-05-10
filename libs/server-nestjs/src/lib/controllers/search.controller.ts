import { Controller, Get, Param, Query, Req, Res, Inject } from '@nestjs/common';
import type { MomentumRequest } from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';
import { parsePositiveInt } from '../utils/parse-query-int';

/**
 * Optional NestJS controller exposing full-text search:
 * - GET /:collection/search?q=...&fields=title,body&limit=20&page=1
 *
 * Mirrors the Express adapter's search route — dispatches to the shared
 * `handleSearch` method on the `MomentumHandlers` instance.
 */
@Controller(':collection')
export class SearchController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get('search')
	async search(
		@Param('collection') collectionSlug: string,
		@Query('q') q: string | undefined,
		@Query('fields') fields: string | undefined,
		@Query('limit') limitParam: string | undefined,
		@Query('page') pageParam: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const request: MomentumRequest = {
			method: 'GET',
			collectionSlug,
			query: {
				q: typeof q === 'string' ? q : '',
				fields: typeof fields === 'string' ? fields : undefined,
				limit: parsePositiveInt(limitParam),
				page: parsePositiveInt(pageParam),
			},
			user: extractUser(req),
		};
		const response = await this._apiService.getHandlers().handleSearch(request);
		res.status(response.status ?? 200).json(response);
	}
}
