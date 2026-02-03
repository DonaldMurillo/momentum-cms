import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { getMomentumAPI, isMomentumAPIInitialized } from '@momentum-cms/server-core';
import { MOMENTUM_API, MOMENTUM_API_CONTEXT } from '@momentum-cms/admin';

const serverConfig: ApplicationConfig = {
	providers: [
		provideServerRendering(withRoutes(serverRoutes)),
		// Provide Momentum API for SSR - initialized in server.ts before Angular bootstraps
		{
			provide: MOMENTUM_API,
			useFactory: (): ReturnType<typeof getMomentumAPI> | null =>
				isMomentumAPIInitialized() ? getMomentumAPI() : null,
		},
		{ provide: MOMENTUM_API_CONTEXT, useValue: {} },
	],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
