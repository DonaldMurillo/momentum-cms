import { Controller, Get, Post, Body, Query, Req, Res, Inject } from '@nestjs/common';
import {
	buildGraphQLSchema,
	handleGraphQLPostRequest,
	handleGraphQLGetRequest,
} from '@momentumcms/server-core';
import type { GraphQLSchema } from 'graphql';
import type { Request, Response } from 'express';
import { MomentumApiService } from '../momentum-api.service';
import { extractUser } from '../utils/extract-user';

/**
 * Optional NestJS controller exposing the GraphQL endpoint:
 * - POST /graphql  (queries & mutations)
 * - GET  /graphql  (read-only — mutations rejected)
 *
 * Schema is built once on construction from the configured collections.
 */
@Controller('graphql')
export class GraphQLController {
	private readonly schema: GraphQLSchema;

	constructor(@Inject(MomentumApiService) private readonly _apiService: MomentumApiService) {
		this.schema = buildGraphQLSchema(this._apiService.getConfig().collections);
	}

	@Post()
	async query(
		@Body() body: Record<string, unknown> | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleGraphQLPostRequest(this.schema, body ?? {}, extractUser(req));
		res.status(result.status).json(result.body);
	}

	@Get()
	async introspect(
		@Query('query') queryParam: string | undefined,
		@Req() req: Request,
		@Res() res: Response,
	): Promise<void> {
		const result = await handleGraphQLGetRequest(this.schema, queryParam, extractUser(req));
		res.status(result.status).json(result.body);
	}
}
