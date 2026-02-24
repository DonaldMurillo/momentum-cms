import type { Provider } from '@angular/core';
import type { EmailBlockDefinition } from '@momentumcms/email';
import { EmailBuilderStateService } from '../services/email-builder-state.service';
import {
	EmailBlockRegistryService,
	DEFAULT_EMAIL_BLOCK_DEFINITIONS,
	provideEmailBlocks,
} from '../services/email-block-registry.service';

/**
 * Options for configuring the email builder.
 */
export interface EmailBuilderOptions {
	/** Block definitions to register. Defaults to built-in block types. */
	blocks?: EmailBlockDefinition[];
}

/**
 * Provide the full email builder setup (state + registry + default blocks).
 *
 * @example
 * ```typescript
 * // Default setup with built-in blocks:
 * bootstrapApplication(AppComponent, {
 *   providers: [provideEmailBuilder()],
 * });
 *
 * // Custom blocks:
 * provideEmailBuilder({
 *   blocks: [...DEFAULT_EMAIL_BLOCK_DEFINITIONS, myCustomBlock],
 * });
 * ```
 */
export function provideEmailBuilder(options?: EmailBuilderOptions): Provider[] {
	const blocks = options?.blocks ?? DEFAULT_EMAIL_BLOCK_DEFINITIONS;

	return [EmailBuilderStateService, EmailBlockRegistryService, provideEmailBlocks(blocks)];
}
