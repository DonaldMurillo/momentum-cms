import { Inject, Injectable } from '@nestjs/common';
import type { MomentumConfig, UserContext } from '@momentumcms/core';
import {
	createMomentumHandlers,
	getMomentumAPI,
	type MomentumHandlers,
	type MomentumAPI,
} from '@momentumcms/server-core';
import { MOMENTUM_CONFIG } from './momentum-config.token';

/**
 * Injectable service that bridges NestJS DI with the Momentum API singleton.
 * Wraps createMomentumHandlers() and getMomentumAPI() for use in controllers.
 */
@Injectable()
export class MomentumApiService {
	private readonly handlers: MomentumHandlers;

	constructor(@Inject(MOMENTUM_CONFIG) private readonly config: MomentumConfig) {
		this.handlers = createMomentumHandlers(config);
	}

	getApi(): MomentumAPI {
		return getMomentumAPI();
	}

	getHandlers(): MomentumHandlers {
		return this.handlers;
	}

	getConfig(): MomentumConfig {
		return this.config;
	}

	getContextualApi(user?: UserContext): MomentumAPI {
		const api = this.getApi();
		return user ? api.setContext({ user }) : api;
	}
}
