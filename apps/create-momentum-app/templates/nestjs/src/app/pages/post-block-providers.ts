import type { Provider } from '@angular/core';
import { provideBlockComponents } from '@momentumcms/ui';
import { HeroBlockComponent } from './blocks/hero-block.component';
import { TextBlockComponent } from './blocks/text-block.component';
import { ImageTextBlockComponent } from './blocks/image-text-block.component';

/**
 * Provide all post block components for the block renderer.
 * Add to the app's root providers.
 */
export function providePostBlocks(): Provider[] {
	return provideBlockComponents({
		hero: HeroBlockComponent,
		textBlock: TextBlockComponent,
		imageText: ImageTextBlockComponent,
	});
}
