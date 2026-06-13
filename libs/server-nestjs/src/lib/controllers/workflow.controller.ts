import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import {
	handleListWorkflowHistoryRequest,
	handleTransitionRequest,
} from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

/**
 * Optional NestJS controller exposing workflow routes:
 * - POST /:collection/:id/transition
 * - GET  /:collection/:id/workflow-history
 *
 * Mirrors the Publishing/Version controller pattern. Default
 * `createMomentumNestServer` already exposes these routes via Express
 * middleware; register this controller in your own NestJS module if you
 * want DI guards / interceptors / OpenAPI metadata applied per-route.
 */
@Controller(':collection/:id')
export class WorkflowController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Post('transition')
	async transition(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Body()
		body:
			| {
					toStage?: unknown;
					comment?: unknown;
					expectedStage?: unknown;
					expectedUpdatedAt?: unknown;
			  }
			| undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleTransitionRequest({
			collectionSlug,
			id,
			body: body ?? {},
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Get('workflow-history')
	async history(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Query('limit') limitRaw: string | undefined,
		@Query('page') pageRaw: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
		const page = pageRaw !== undefined ? Number(pageRaw) : undefined;
		const result = await handleListWorkflowHistoryRequest({
			collectionSlug,
			id,
			limit: Number.isFinite(limit) ? limit : undefined,
			page: Number.isFinite(page) ? page : undefined,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
