// @momentumcms/server-nestjs — NestJS adapter for Momentum CMS

// Module
export { MomentumModule } from './lib/momentum.module';

// Factory
export {
	createMomentumNestServer,
	type CreateMomentumNestServerOptions,
	type MomentumNestServer,
} from './lib/create-momentum-nest-server';

// Service & DI
export { MomentumApiService } from './lib/momentum-api.service';
export { MOMENTUM_CONFIG } from './lib/momentum-config.token';

// Re-exports from server-express (for convenience)
export type { MomentumInitResult, SeedingStatus } from '@momentumcms/server-express';

// Controllers
export { HealthController } from './lib/controllers/health.controller';
export { AccessController } from './lib/controllers/access.controller';
export { CollectionController } from './lib/controllers/collection.controller';
export { GlobalsController } from './lib/controllers/globals.controller';

// Guards & Middleware
export { MomentumAuthGuard } from './lib/guards/auth.guard';
export { ApiKeyGuard } from './lib/guards/api-key.guard';
export { SessionMiddleware } from './lib/guards/session.middleware';

// Filters & Interceptors
export { MomentumExceptionFilter } from './lib/filters/momentum-exception.filter';
export { MomentumResponseInterceptor } from './lib/interceptors/momentum-response.interceptor';

// Decorators & Pipes
export { CurrentUser } from './lib/decorators/current-user.decorator';
export { ParseQueryPipe } from './lib/pipes/parse-query.pipe';
