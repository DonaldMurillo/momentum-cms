import { Controller, Get, Post, Param, Body, Req, Res, Inject } from '@nestjs/common';
import { handlePreviewRequest } from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';
import { renderEmailPreviewHTML } from '../utils/render-email-preview';

/**
 * Optional NestJS controller exposing the live-preview route:
 * - GET  /:collection/:id/preview
 * - POST /:collection/:id/preview  (body holds in-flight form draft)
 */
@Controller(':collection/:id')
export class PreviewController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get('preview')
	async previewGet(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		await this.dispatch(collectionSlug, id, 'GET', undefined, req, res);
	}

	@Post('preview')
	async previewPost(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Body() body: Record<string, unknown> | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		await this.dispatch(collectionSlug, id, 'POST', body, req, res);
	}

	private async dispatch(
		collectionSlug: string,
		id: string,
		method: 'GET' | 'POST',
		postBody: Record<string, unknown> | undefined,
		req: Request,
		res: Response,
	): Promise<void> {
		const result = await handlePreviewRequest({
			config: this._apiService.getConfig(),
			collectionSlug,
			id,
			method,
			postBody: method === 'POST' ? postBody : undefined,
			user: extractUser(req),
			renderEmail: renderEmailPreviewHTML,
		});

		if (result.headers) {
			for (const [key, value] of Object.entries(result.headers)) {
				res.setHeader(key, value);
			}
		}
		res.status(result.status);
		if (typeof result.body === 'string') {
			res.send(result.body);
		} else {
			res.json(result.body);
		}
	}
}
