import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { appRoutes } from './app.routes';
import {
	provideClientHydration,
	withEventReplay,
	withIncrementalHydration,
} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
	providers: [
		provideHttpClient(withFetch()),
		provideClientHydration(withEventReplay(), withIncrementalHydration()),
		provideBrowserGlobalErrorListeners(),
		provideRouter(appRoutes, withViewTransitions()),
	],
};
