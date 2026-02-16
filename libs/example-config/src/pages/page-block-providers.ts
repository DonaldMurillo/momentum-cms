import type { Provider } from '@angular/core';
import { provideBlockComponents } from '@momentumcms/ui';
import { HeroBlockComponent } from './blocks/hero-block.component';
import { TextBlockComponent } from './blocks/text-block.component';
import { FeatureBlockComponent } from './blocks/feature-block.component';

/**
 * Provide all page block components for the block renderer.
 * Add to the app's root providers.
 */
export function providePageBlocks(): Provider[] {
	return provideBlockComponents({
		hero: HeroBlockComponent,
		textBlock: TextBlockComponent,
		feature: FeatureBlockComponent,
	});
}
