import { Controller, Get, Post, Param, Req, Res, Inject } from '@nestjs/common';
import {
	handleMediaServeRequest,
	handleMediaUploadRequest,
	getUploadConfig,
} from '@momentumcms/server-core';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';
import { extractUploadedFile } from '../utils/extract-uploaded-file';

/**
 * Optional NestJS controller exposing media routes:
 * - GET  /media/file/* (public file serve)
 * - POST /media/upload (legacy single-file upload)
 *
 * Multipart parsing is the consumer's responsibility — wire `FileInterceptor`
 * from `@nestjs/platform-express` on the upload route in your own module if
 * you register this controller. The default `createMomentumNestServer` mounts
 * the same routes via Express middleware (with multer pre-wired).
 */
@Controller()
export class MediaController {
	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {}

	@Get('media/file/*path')
	async serve(
		@Param('path') pathParam: string | string[] | undefined,
		@Res() res: Response,
	): Promise<void> {
		// path-to-regexp v8 (bundled with @nestjs/platform-express ≥ 11) captures
		// named splats as an array of segments. v7 / Express 4 stacks pass the joined
		// string. Normalize both shapes so the controller behaves identically across
		// the supported peer-dep range.
		const rawPath = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;
		const result = await handleMediaServeRequest({
			uploadConfig: getUploadConfig(this._apiService.getConfig()),
			rawPath,
		});
		if (result.status !== 200) {
			res.status(result.status).json(result.body);
			return;
		}
		if (result.headers) {
			for (const [key, value] of Object.entries(result.headers)) {
				res.setHeader(key, value);
			}
		}
		res.setHeader('Cache-Control', 'public, max-age=31536000');
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler success body is the file payload
		const fileResult = result.body as { buffer: Uint8Array };
		res.status(200).send(Buffer.from(fileResult.buffer));
	}

	@Post('media/upload')
	async upload(@Req() req: Request, @Res() res: Response): Promise<void> {
		const user = extractUser(req);
		const altRaw = req.body && typeof req.body === 'object' ? req.body['alt'] : undefined;
		const result = await handleMediaUploadRequest({
			uploadConfig: getUploadConfig(this._apiService.getConfig()),
			file: extractUploadedFile(req),
			user,
			alt: typeof altRaw === 'string' ? altRaw : undefined,
		});
		res.status(result.status).json(result.body);
	}
}
