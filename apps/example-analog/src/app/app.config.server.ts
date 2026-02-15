import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { MOMENTUM_API, MOMENTUM_API_CONTEXT } from '@momentum-cms/admin';

import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
	providers: [
		provideServerRendering(),
		{
			provide: MOMENTUM_API,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions, local/no-direct-browser-apis -- cross-bundle bridge: Nitro exposes the API singleton on globalThis
			useFactory: (): unknown => (globalThis as any).__momentum_api ?? null,
		},
		{
			provide: MOMENTUM_API_CONTEXT,
			useValue: {},
		},
	],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
