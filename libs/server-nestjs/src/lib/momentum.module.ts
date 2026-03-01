import {
	Module,
	type DynamicModule,
	type NestModule,
	type MiddlewareConsumer,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { MomentumConfig } from '@momentumcms/core';
import { MOMENTUM_CONFIG, API_KEY_STORE } from './momentum-config.token';
import { MomentumApiService } from './momentum-api.service';
import { MomentumExceptionFilter } from './filters/momentum-exception.filter';
import { MomentumResponseInterceptor } from './interceptors/momentum-response.interceptor';
import { SessionMiddleware } from './guards/session.middleware';
import { ApiKeyGuard } from './guards/api-key.guard';
import { HealthController } from './controllers/health.controller';
import { AccessController } from './controllers/access.controller';
import { GlobalsController } from './controllers/globals.controller';
import { CollectionController } from './controllers/collection.controller';

@Module({})
export class MomentumModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(SessionMiddleware).forRoutes('*');
	}

	static forRoot(config: MomentumConfig): DynamicModule {
		return {
			module: MomentumModule,
			controllers: [
				HealthController,
				AccessController,
				GlobalsController,
				// CollectionController must be LAST — its `:collection` param is a catch-all
				CollectionController,
			],
			providers: [
				{ provide: MOMENTUM_CONFIG, useValue: config },
				{ provide: API_KEY_STORE, useValue: null },
				MomentumApiService,
				SessionMiddleware,
				{ provide: APP_FILTER, useClass: MomentumExceptionFilter },
				{ provide: APP_INTERCEPTOR, useClass: MomentumResponseInterceptor },
				{ provide: APP_GUARD, useClass: ApiKeyGuard },
			],
			exports: [MomentumApiService, MOMENTUM_CONFIG, API_KEY_STORE, SessionMiddleware],
		};
	}
}
