import { Controller, Get, Patch, Param, Body, Req, Res, Inject, Query } from '@nestjs/common';
import { handleGetGlobalRequest, handleUpdateGlobalRequest } from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

@Controller('globals')
export class GlobalsController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get(':slug')
	async findOne(
		@Param('slug') slug: string,
		@Query('depth') depthParam: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const depth = depthParam ? parseInt(depthParam, 10) || 0 : 0;
		const result = await handleGetGlobalRequest({ slug, depth, user: extractUser(req) });
		res.status(result.status).json(result.body);
	}

	@Patch(':slug')
	async update(
		@Param('slug') slug: string,
		@Body() body: Record<string, unknown>,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleUpdateGlobalRequest({
			slug,
			data: body,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
