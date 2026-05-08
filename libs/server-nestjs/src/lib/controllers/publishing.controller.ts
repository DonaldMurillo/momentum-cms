import { Controller, Post, Param, Body, Req, Res, Inject } from '@nestjs/common';
import {
	handlePublishRequest,
	handleUnpublishRequest,
	handleSaveDraftRequest,
	handleSchedulePublishRequest,
	handleCancelScheduledPublishRequest,
} from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

/**
 * Optional NestJS controller exposing publishing routes:
 * - POST /:collection/:id/publish
 * - POST /:collection/:id/unpublish
 * - POST /:collection/:id/draft
 * - POST /:collection/:id/schedule-publish
 * - POST /:collection/:id/cancel-scheduled-publish
 *
 * The default `createMomentumNestServer` mounts these via Express middleware.
 * Register this controller in your own NestJS module if you prefer DI-based
 * controllers with guards, interceptors, and OpenAPI metadata.
 */
@Controller(':collection/:id')
export class PublishingController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Post('publish')
	async publish(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handlePublishRequest({
			collectionSlug,
			id,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Post('unpublish')
	async unpublish(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleUnpublishRequest({
			collectionSlug,
			id,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Post('draft')
	async saveDraft(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Body() body: Record<string, unknown> | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleSaveDraftRequest({
			collectionSlug,
			id,
			data: body ?? {},
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Post('schedule-publish')
	async schedulePublish(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Body() body: { publishAt?: unknown } | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleSchedulePublishRequest({
			collectionSlug,
			id,
			publishAt: body?.publishAt,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Post('cancel-scheduled-publish')
	async cancelScheduledPublish(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleCancelScheduledPublishRequest({
			collectionSlug,
			id,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
