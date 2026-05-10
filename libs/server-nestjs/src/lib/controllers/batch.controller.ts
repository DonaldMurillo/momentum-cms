import { Controller, Post, Param, Body, Req, Res, Inject } from '@nestjs/common';
import { handleBatchRequest } from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

/**
 * Optional NestJS controller exposing batch operations:
 * - POST /:collection/batch  (bulk create / update / delete)
 *
 * The default `createMomentumNestServer` already mounts this route via
 * Express middleware. Register this controller in your own module if you
 * want DI-based guards / interceptors / OpenAPI metadata.
 */
@Controller(':collection')
export class BatchController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Post('batch')
	async batch(
		@Param('collection') collectionSlug: string,
		@Body() body: Record<string, unknown> | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleBatchRequest({
			config: this._apiService.getConfig(),
			collectionSlug,
			body: body ?? {},
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
