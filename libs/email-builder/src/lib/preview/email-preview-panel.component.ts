import {
	Component,
	ChangeDetectionStrategy,
	inject,
	computed,
	ElementRef,
	viewChild,
	effect,
} from '@angular/core';
import { EmailBuilderStateService } from '../services/email-builder-state.service';
import { blocksToPreviewHtml } from './preview-renderer';

@Component({
	selector: 'eml-preview-panel',
	host: { class: 'eml-preview-panel', 'data-testid': 'email-preview-panel' },
	template: `
		<div class="eml-preview-toolbar">
			<span class="eml-preview-label">Preview</span>
		</div>
		<div class="eml-preview-frame-wrapper">
			<iframe
				#previewFrame
				class="eml-preview-frame"
				sandbox="allow-same-origin"
				title="Email preview"
			></iframe>
		</div>
	`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
		}

		.eml-preview-toolbar {
			display: flex;
			align-items: center;
			padding: 10px 16px;
			border-bottom: 1px solid hsl(var(--mcms-border));
		}

		.eml-preview-label {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: hsl(var(--mcms-muted-foreground));
		}

		.eml-preview-frame-wrapper {
			flex: 1;
			padding: 16px;
			background: hsl(var(--mcms-muted) / 0.3);
			display: flex;
			justify-content: center;
		}

		.eml-preview-frame {
			width: 100%;
			max-width: 600px;
			min-height: 400px;
			height: 100%;
			border: 1px solid hsl(var(--mcms-border));
			border-radius: 8px;
			background: #ffffff;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailPreviewPanelComponent {
	private readonly state = inject(EmailBuilderStateService);
	private readonly previewFrame = viewChild<ElementRef<HTMLIFrameElement>>('previewFrame');

	readonly previewHtml = computed(() =>
		blocksToPreviewHtml(this.state.blocks(), this.state.theme()),
	);

	constructor() {
		effect(() => {
			const html = this.previewHtml();
			const iframe = this.previewFrame()?.nativeElement;
			if (!iframe) return;

			const doc = iframe.contentDocument;
			if (doc) {
				doc.open();
				doc.write(html);
				doc.close();
			}
		});
	}
}
