import type { Provider } from '@angular/core';
import { provideBlockComponents } from '@momentumcms/ui';
import { HeroBlockComponent } from './blocks/hero-block.component';
import { TextBlockComponent } from './blocks/text-block.component';
import { FeatureBlockComponent } from './blocks/feature-block.component';
import { CallToActionBlockComponent } from './blocks/call-to-action-block.component';
import { ImageTextBlockComponent } from './blocks/image-text-block.component';
import { StatsBlockComponent } from './blocks/stats-block.component';
import { TestimonialBlockComponent } from './blocks/testimonial-block.component';
import { FeatureGridBlockComponent } from './blocks/feature-grid-block.component';
import { FormBlockComponent } from './blocks/form-block.component';

/**
 * Provide all page block components for the block renderer.
 * Add to the app's root providers.
 */
export function providePageBlocks(): Provider[] {
	return provideBlockComponents({
		hero: HeroBlockComponent,
		textBlock: TextBlockComponent,
		feature: FeatureBlockComponent,
		callToAction: CallToActionBlockComponent,
		imageText: ImageTextBlockComponent,
		stats: StatsBlockComponent,
		testimonial: TestimonialBlockComponent,
		featureGrid: FeatureGridBlockComponent,
		form: FormBlockComponent,
	});
}
