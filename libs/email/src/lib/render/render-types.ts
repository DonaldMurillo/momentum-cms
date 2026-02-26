import { InjectionToken, inject, type Provider } from '@angular/core';

/**
 * Injection token for passing data to email components during rendering.
 *
 * Email components use `injectEmailData<T>()` to retrieve their typed data.
 * The `renderEmail()` function provides this token automatically.
 */
export const EMAIL_DATA = new InjectionToken<Record<string, unknown>>('EMAIL_DATA');

/**
 * Inject typed email data inside an email component.
 *
 * @example
 * ```typescript
 * interface WelcomeEmailData {
 *   name: string;
 *   url: string;
 * }
 *
 * @Component({ ... })
 * export class WelcomeEmail {
 *   private readonly data = injectEmailData<WelcomeEmailData>();
 *   // data.name, data.url are typed
 * }
 * ```
 */
export function injectEmailData<T extends object>(): T {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- EMAIL_DATA is Record<string, unknown> but callers provide their own type
	return inject(EMAIL_DATA) as T;
}

/**
 * Options for the `renderEmail()` function.
 */
export interface RenderEmailOptions {
	/** Extra DI providers for the render context. */
	providers?: Provider[];
	/** Whether to inline CSS via Juice. Default: true. */
	inlineCss?: boolean;
	/** Whether to strip Angular SSR artifacts. Default: true. */
	stripArtifacts?: boolean;
}
