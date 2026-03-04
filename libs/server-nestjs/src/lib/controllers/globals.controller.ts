import { Controller, Get, Patch, Param, Body, Req, Inject } from '@nestjs/common';
import { MomentumApiService } from '../momentum-api.service';
import type { Request } from 'express';
import type { UserContext } from '@momentumcms/core';

function extractUser(req: Request): UserContext | undefined {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation for req.user
	const user = (req as any)['user'];
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing after runtime check
	return user?.id ? (user as UserContext) : undefined;
}

@Controller('globals')
export class GlobalsController {
	constructor(@Inject(MomentumApiService) private readonly apiService: MomentumApiService) {}

	@Get(':slug')
	async findOne(
		@Param('slug') slug: string,
		@Req() req: Request,
	): Promise<{ doc: Record<string, unknown> }> {
		const user = extractUser(req);
		const api = this.apiService.getContextualApi(user);
		const doc = await api.global(slug).findOne();
		return { doc };
	}

	@Patch(':slug')
	async update(
		@Param('slug') slug: string,
		@Body() body: Record<string, unknown>,
		@Req() req: Request,
	): Promise<{ doc: Record<string, unknown> }> {
		const user = extractUser(req);
		const api = this.apiService.getContextualApi(user);
		const doc = await api.global(slug).update(body);
		return { doc };
	}
}
