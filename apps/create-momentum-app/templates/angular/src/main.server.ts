import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

const bootstrap = (context: BootstrapContext): ReturnType<typeof bootstrapApplication> =>
	bootstrapApplication(App, config, context);

export default bootstrap;
