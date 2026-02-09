import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import {
	provideClientHydration,
	withEventReplay,
	withIncrementalHydration,
} from '@angular/platform-browser';
import { crudToastInterceptor } from '@momentum-cms/admin';
import { providePageBlocks } from './pages/page-block-providers';

export const appConfig: ApplicationConfig = {
	providers: [
		provideHttpClient(withFetch(), withInterceptors([crudToastInterceptor])),
		provideClientHydration(withEventReplay(), withIncrementalHydration()),
		provideBrowserGlobalErrorListeners(),
		provideRouter(appRoutes, withViewTransitions()),
		...providePageBlocks(),
	],
};
