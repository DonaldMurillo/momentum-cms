import { Controller, Get, Inject, Req } from '@nestjs/common';
import { MomentumApiService } from '../momentum-api.service';
import { handleAccessRequest, type AccessResponseBody } from '@momentumcms/server-core';
import type { Request } from 'express';
import type { UserContext } from '@momentumcms/core';

@Controller('access')
export class AccessController {
	constructor(@Inject(MomentumApiService) private readonly apiService: MomentumApiService) {}

	@Get()
	async getPermissions(@Req() req: Request): Promise<AccessResponseBody> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation for req.user
		const reqUser = (req as any)['user'];
		const user: UserContext | undefined = reqUser?.id ? reqUser : undefined;
		const config = this.apiService.getConfig();
		const result = await handleAccessRequest({ config, user });
		return result.body;
	}
}
