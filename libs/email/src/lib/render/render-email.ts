import '@angular/compiler';
import { type Type, type Provider, reflectComponentType } from '@angular/core';
import { renderApplication } from '@angular/platform-server';
import { bootstrapApplication } from '@angular/platform-browser';
import { inlineCss } from '../utils/css-inliner';
import { stripAngularArtifacts } from '../utils/strip-artifacts';
import { EMAIL_DATA, type RenderEmailOptions } from './render-types';

/**
 * Build a minimal HTML document with the component's selector in the body.
 */
function buildDocument(selector: string): string {
	return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><${selector}></${selector}></body></html>`;
}

/**
 * Render an Angular email component to an HTML string.
 *
 * The component receives its data via the `EMAIL_DATA` injection token.
 * Use `injectEmailData<T>()` inside the component to access it.
 *
 * @example
 * ```typescript
 * const html = await renderEmail(PasswordResetEmail, {
 *   name: 'John',
 *   url: 'https://example.com/reset?token=abc',
 * });
 * ```
 *
 * @param component The Angular component class to render as the root.
 * @param data Optional data object provided via EMAIL_DATA injection token.
 * @param options Optional render configuration.
 * @returns Rendered HTML string with inlined CSS and Angular artifacts stripped.
 */
export async function renderEmail<TData extends object = Record<string, unknown>>(
	component: Type<unknown>,
	data?: TData,
	options?: RenderEmailOptions,
): Promise<string> {
	const shouldInlineCss = options?.inlineCss ?? true;
	const shouldStripArtifacts = options?.stripArtifacts ?? true;
	const extraProviders: Provider[] = options?.providers ?? [];

	const mirror = reflectComponentType(component);
	if (!mirror) {
		throw new Error(
			`Cannot reflect component type: ${component.name}. Ensure it has a @Component decorator.`,
		);
	}

	const providers: Provider[] = [...extraProviders, { provide: EMAIL_DATA, useValue: data ?? {} }];

	let html = await renderApplication(
		(context) => bootstrapApplication(component, { providers }, context),
		{
			document: buildDocument(mirror.selector),
			url: '/',
		},
	);

	if (shouldStripArtifacts) {
		html = stripAngularArtifacts(html);
	}

	if (shouldInlineCss) {
		html = inlineCss(html);
	}

	return html;
}
