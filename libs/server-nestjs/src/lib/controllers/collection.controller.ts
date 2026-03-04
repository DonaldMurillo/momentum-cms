import {
	Controller,
	Get,
	Post,
	Patch,
	Delete,
	Param,
	Body,
	Query,
	Req,
	Inject,
} from '@nestjs/common';
import { MomentumApiService } from '../momentum-api.service';
import type { MomentumRequest, MomentumResponse, QueryOptions } from '@momentumcms/server-core';
import type { Request } from 'express';
import type { UserContext } from '@momentumcms/core';
import { ParseQueryPipe } from '../pipes/parse-query.pipe';

@Controller()
export class CollectionController {
	constructor(@Inject(MomentumApiService) private readonly apiService: MomentumApiService) {}

	@Get(':collection')
	async find(
		@Param('collection') collection: string,
		@Query(new ParseQueryPipe()) query: QueryOptions,
		@Req() req: Request,
	): Promise<MomentumResponse> {
		const handlers = this.apiService.getHandlers();
		const request = this.buildRequest('GET', collection, undefined, undefined, query, req);
		return handlers.handleFind(request);
	}

	@Get(':collection/:id')
	async findById(
		@Param('collection') collection: string,
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<MomentumResponse> {
		const handlers = this.apiService.getHandlers();
		const request = this.buildRequest('GET', collection, id, undefined, undefined, req);
		return handlers.handleFindById(request);
	}

	@Post(':collection')
	async create(
		@Param('collection') collection: string,
		@Body() body: Record<string, unknown>,
		@Req() req: Request,
	): Promise<MomentumResponse> {
		const handlers = this.apiService.getHandlers();
		const request = this.buildRequest('POST', collection, undefined, body, undefined, req);
		return handlers.handleCreate(request);
	}

	@Patch(':collection/:id')
	async update(
		@Param('collection') collection: string,
		@Param('id') id: string,
		@Body() body: Record<string, unknown>,
		@Req() req: Request,
	): Promise<MomentumResponse> {
		const handlers = this.apiService.getHandlers();
		const request = this.buildRequest('PATCH', collection, id, body, undefined, req);
		return handlers.handleUpdate(request);
	}

	@Delete(':collection/:id')
	async delete(
		@Param('collection') collection: string,
		@Param('id') id: string,
		@Req() req: Request,
	): Promise<MomentumResponse> {
		const handlers = this.apiService.getHandlers();
		const request = this.buildRequest('DELETE', collection, id, undefined, undefined, req);
		return handlers.handleDelete(request);
	}

	private buildRequest(
		method: MomentumRequest['method'],
		collectionSlug: string,
		id?: string,
		body?: Record<string, unknown>,
		query?: QueryOptions,
		req?: Request,
	): MomentumRequest {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- Express request augmentation for req.user
		const reqUser = req ? (req as any)['user'] : undefined;
		const user: UserContext | undefined = reqUser?.id ? reqUser : undefined;

		return {
			method,
			collectionSlug,
			...(id && { id }),
			...(body && { body }),
			...(query && Object.keys(query).length > 0 && { query }),
			...(user && { user }),
		};
	}
}
