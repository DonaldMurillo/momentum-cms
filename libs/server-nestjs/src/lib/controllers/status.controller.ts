import { Controller, Get, Param, Req, Res, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import { handleStatusRequest } from '@momentumcms/server-core';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

/**
 * Optional NestJS controller exposing GET /:collection/:id/status.
 *
 * Returns the document version status (current draft/published state).
 * The default `createMomentumNestServer` mounts this route via Express
 * middleware; this controller is provided for users who wire their own
 * NestJS module and prefer DI-based controllers.
 */
@Controller(':collection/:id/status')
export class StatusController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get()
	async getStatus(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleStatusRequest({
			collectionSlug,
			id,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
