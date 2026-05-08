import { Controller, Get, Post, Param, Body, Req, Res, Inject, Query } from '@nestjs/common';
import {
	handleListVersionsRequest,
	handleGetVersionRequest,
	handleRestoreVersionRequest,
	handleCompareVersionsRequest,
} from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

function parsePositiveInt(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Optional NestJS controller exposing version-related routes:
 * - GET    /:collection/:id/versions
 * - GET    /:collection/:id/versions/:versionId
 * - POST   /:collection/:id/versions/restore
 * - POST   /:collection/:id/versions/compare
 *
 * The default `createMomentumNestServer` mounts these via Express middleware.
 * Register this controller in your own NestJS module if you prefer DI-based
 * controllers with guards, interceptors, and OpenAPI metadata.
 */
@Controller(':collection/:id/versions')
export class VersionController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get()
	async list(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Query('limit') limitParam: string | undefined,
		@Query('page') pageParam: string | undefined,
		@Query('includeAutosave') includeAutosaveParam: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleListVersionsRequest({
			collectionSlug,
			id,
			limit: parsePositiveInt(limitParam),
			page: parsePositiveInt(pageParam),
			includeAutosave: includeAutosaveParam === 'true',
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Get(':versionId')
	async getOne(
		@Param('collection') collectionSlug: string,
		@Param('versionId') versionId: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleGetVersionRequest({
			collectionSlug,
			versionId,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Post('restore')
	async restore(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Body() body: { versionId?: unknown; publish?: unknown } | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleRestoreVersionRequest({
			collectionSlug,
			id,
			versionId: body?.versionId,
			publish: body?.publish,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}

	@Post('compare')
	async compare(
		@Param('collection') collectionSlug: string,
		@Param('id') id: string,
		@Body() body: { versionId1?: unknown; versionId2?: unknown } | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleCompareVersionsRequest({
			collectionSlug,
			id,
			versionId1: body?.versionId1,
			versionId2: body?.versionId2,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
