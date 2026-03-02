import { Module, type DynamicModule } from '@nestjs/common';
import type { MomentumConfig, ResolvedMomentumConfig } from '@momentumcms/core';
import { MOMENTUM_CONFIG } from './momentum-config.token';
import { MomentumApiService } from './momentum-api.service';

/**
 * Minimal NestJS module for Momentum CMS.
 *
 * API routes are handled by Express middleware (momentumApiMiddleware) mounted
 * directly on the underlying Express instance in createMomentumNestServer().
 * This module provides the DI container for optional custom NestJS controllers.
 */
@Module({})
export class MomentumModule {
	static forRoot(config: MomentumConfig | ResolvedMomentumConfig): DynamicModule {
		return {
			module: MomentumModule,
			providers: [{ provide: MOMENTUM_CONFIG, useValue: config }, MomentumApiService],
			exports: [MomentumApiService, MOMENTUM_CONFIG],
		};
	}
}
