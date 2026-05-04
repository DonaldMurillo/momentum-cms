import {
	Component,
	ChangeDetectionStrategy,
	input,
	output,
	signal,
	computed,
	inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmailBlockRegistryService } from '../services/email-block-registry.service';
import { EmailBuilderStateService, generateBlockId } from '../services/email-builder-state.service';

@Component({
	selector: 'eml-block-inserter',
	imports: [FormsModule],
	host: {
		class: 'eml-block-inserter',
		'data-testid': 'eml-block-inserter',
		'(click)': '$event.stopPropagation()',
	},
	template: `
		@if (isOpen()) {
			<div class="eml-inserter-panel">
				<input
					type="text"
					class="eml-input eml-inserter-search"
					placeholder="Search blocks..."
					[ngModel]="searchQuery()"
					(ngModelChange)="searchQuery.set($event)"
				/>
				<div class="eml-inserter-grid">
					@for (def of filteredBlocks(); track def.slug) {
						<button
							type="button"
							class="eml-inserter-item"
							[attr.data-testid]="'block-option-' + def.slug"
							(click)="selectBlock(def.slug)"
						>
							{{ def.label }}
						</button>
					}
				</div>
			</div>
		} @else {
			<button
				type="button"
				class="eml-inserter-trigger"
				data-testid="block-inserter-toggle"
				(click)="toggle()"
				title="Add block"
			>
				<span aria-hidden="true">+</span>
				Insert block
			</button>
		}
	`,
	styles: `
		:host {
			display: flex;
			justify-content: center;
			padding: 4px 0;
		}

		/* The trigger is a flush hairline that reveals a "+ Insert block" pill on hover.
		 * No floating dashed circle — that pattern reads as decorative rather than
		 * functional. The hairline doubles as a visual separator between blocks. */
		:host {
			position: relative;
		}

		.eml-inserter-trigger {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.125rem 0.625rem;
			border-radius: 999px;
			border: 1px solid hsl(var(--mcms-border));
			background: hsl(var(--mcms-background));
			color: hsl(var(--mcms-muted-foreground));
			font-size: 0.6875rem;
			font-weight: 500;
			cursor: pointer;
			transition:
				border-color 0.15s,
				color 0.15s,
				background-color 0.15s,
				opacity 0.15s;
			opacity: 0;
			z-index: 1;
		}

		:host(:hover) .eml-inserter-trigger,
		.eml-inserter-trigger:focus-visible {
			opacity: 1;
		}

		.eml-inserter-trigger:hover {
			border-color: hsl(var(--mcms-foreground) / 0.4);
			color: hsl(var(--mcms-foreground));
		}

		.eml-inserter-panel {
			width: 100%;
			border-radius: 8px;
			border: 1px solid hsl(var(--mcms-border));
			background: hsl(var(--mcms-card));
			padding: 12px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		}

		.eml-input {
			height: 36px;
			width: 100%;
			border-radius: 6px;
			border: 1px solid hsl(var(--mcms-border));
			background-color: hsl(var(--mcms-background));
			color: hsl(var(--mcms-foreground));
			padding: 0 10px;
			font-size: 14px;
			outline: none;
			transition:
				border-color 0.15s,
				box-shadow 0.15s;
		}

		.eml-input:focus {
			border-color: hsl(var(--mcms-primary));
			box-shadow: 0 0 0 2px hsl(var(--mcms-primary) / 0.15);
		}

		.eml-inserter-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
			gap: 6px;
		}

		.eml-inserter-item {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 10px 8px;
			border-radius: 6px;
			border: 1px solid hsl(var(--mcms-border));
			background: hsl(var(--mcms-background));
			color: hsl(var(--mcms-foreground));
			font-size: 13px;
			font-weight: 500;
			cursor: pointer;
			transition:
				border-color 0.15s,
				background-color 0.15s;
		}

		.eml-inserter-item:hover {
			border-color: hsl(var(--mcms-primary));
			background: hsl(var(--mcms-primary) / 0.05);
			color: hsl(var(--mcms-primary));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockInserterComponent {
	private readonly registry = inject(EmailBlockRegistryService);
	private readonly state = inject(EmailBuilderStateService);

	readonly insertIndex = input.required<number>();
	readonly blockInserted = output<void>();

	readonly searchQuery = signal('');

	readonly isOpen = computed(() => this.state.inserterOpen()?.index === this.insertIndex());

	readonly filteredBlocks = computed(() => {
		const query = this.searchQuery().toLowerCase();
		const defs = this.registry.definitions;
		if (!query) return defs;
		return defs.filter((d) => d.label.toLowerCase().includes(query));
	});

	toggle(): void {
		if (this.isOpen()) {
			this.state.inserterOpen.set(null);
		} else {
			this.state.inserterOpen.set({ index: this.insertIndex() });
		}
		this.searchQuery.set('');
	}

	selectBlock(slug: string): void {
		const def = this.registry.get(slug);
		if (!def) return;

		this.state.addBlock(
			{
				type: slug,
				id: generateBlockId(),
				data: { ...def.defaultData },
			},
			this.insertIndex(),
		);
		this.searchQuery.set('');
		this.blockInserted.emit();
	}
}
