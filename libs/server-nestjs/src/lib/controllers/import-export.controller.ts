import { Controller, Get, Post, Param, Body, Query, Req, Res, Inject } from '@nestjs/common';
import { handleExportRequest, handleImportRequest } from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';
import { parsePositiveInt } from '../utils/parse-query-int';

/**
 * Optional NestJS controller exposing import/export:
 * - GET  /:collection/export?format=json|csv&limit=N
 * - POST /:collection/import   { format, items, dryRun? }
 */
@Controller(':collection')
export class ImportExportController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get('export')
	async export(
		@Param('collection') collectionSlug: string,
		@Query('format') format: string | undefined,
		@Query('limit') limitParam: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const config = this._apiService.getConfig();
		const result = await handleExportRequest({
			collectionSlug,
			format: typeof format === 'string' ? format : 'json',
			limit: parsePositiveInt(limitParam),
			user: extractUser(req),
			config,
			api: this._apiService.getApi(),
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

	@Post('import')
	async import(
		@Param('collection') collectionSlug: string,
		@Body() body: Record<string, unknown> | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const config = this._apiService.getConfig();
		const collection = config.collections.find((c) => c.slug === collectionSlug);
		if (collection?.managed) {
			res.status(403).json({ error: 'Managed collection is read-only' });
			return;
		}
		const safeBody = body ?? {};
		const result = await handleImportRequest({
			collectionSlug,
			format: safeBody['format'] === 'csv' ? 'csv' : 'json',
			body: safeBody,
			dryRun: safeBody['dryRun'] === true,
			user: extractUser(req),
			config: { collections: config.collections },
			api: this._apiService.getApi(),
		});
		res.status(result.status).json(result.body);
	}
}
