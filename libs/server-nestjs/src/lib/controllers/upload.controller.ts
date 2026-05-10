import { Controller, Post, Param, Req, Res, Inject } from '@nestjs/common';
import { handleMediaCollectionUploadRequest, getUploadConfig } from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';
import { extractUploadedFile } from '../utils/extract-uploaded-file';

/**
 * Optional NestJS controller for per-collection file uploads:
 * - POST /:collection/upload  (semantic, for upload-enabled collections)
 *
 * The Express adapter accepts uploads at `POST /:collection` directly; this
 * controller exposes a dedicated `/upload` sub-path so it can coexist with
 * non-upload `CollectionController` route registrations without colliding on
 * `POST /:collection` (which the standard create handler claims).
 *
 * Multipart parsing is the consumer's responsibility — wire `FileInterceptor`
 * from `@nestjs/platform-express` on this route in your own module.
 */
@Controller(':collection')
export class UploadController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Post('upload')
	async upload(
		@Param('collection') collectionSlug: string,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const config = this._apiService.getConfig();
		const collection = config.collections.find((c) => c.slug === collectionSlug);

		const fields: Record<string, unknown> = {};
		if (req.body && typeof req.body === 'object') {
			for (const [key, value] of Object.entries(req.body)) {
				if (key !== 'file') fields[key] = value;
			}
		}

		const result = await handleMediaCollectionUploadRequest({
			uploadConfig: getUploadConfig(config),
			collectionSlug,
			collectionUpload: collection?.upload,
			file: extractUploadedFile(req),
			fields,
			user: extractUser(req),
		});
		res.status(result.status).json(result.body);
	}
}
