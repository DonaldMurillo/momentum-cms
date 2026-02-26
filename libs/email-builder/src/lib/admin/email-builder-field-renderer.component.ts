import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	untracked,
	type Signal,
	type WritableSignal,
} from '@angular/core';
import type { Field } from '@momentumcms/core';
import type { EmailBlock } from '@momentumcms/email';
import { EmailEditorPanelComponent } from '../editor/email-editor-panel.component';
import { EmailBuilderStateService } from '../services/email-builder-state.service';
import { provideEmailBuilder } from '../providers/provide-email-builder';

/**
 * Minimal field node state interface — inlined to avoid importing @momentumcms/admin.
 * Matches the FieldNodeState shape from the entity form types.
 */
interface FieldNodeState {
	readonly value: WritableSignal<unknown>;
	readonly errors: Signal<ReadonlyArray<{ kind: string; message?: string }>>;
	readonly touched: Signal<boolean>;
	readonly dirty: Signal<boolean>;
	readonly invalid: Signal<boolean>;
	markAsTouched(): void;
	reset(value?: unknown): void;
}

/**
 * Safely extract FieldNodeState from a Signal Forms FieldTree node.
 * Inlined helper — avoids importing from @momentumcms/admin.
 */
function getFieldNodeState(formNode: unknown): FieldNodeState | null {
	if (formNode == null || typeof formNode !== 'function') return null;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
	return (formNode as () => FieldNodeState)();
}

/**
 * Email builder field renderer — bridges Signal Forms ↔ Email Builder.
 *
 * Renders the block editor panel. The live preview is handled by the
 * collection's `preview: true` config which shows the LivePreviewComponent
 * in a separate panel. The server preview endpoint accepts POST data
 * so the preview updates in realtime from form state.
 *
 * Registered as the `json-email-builder` field renderer via `provideFieldRenderer()`.
 */
@Component({
	selector: 'eml-field-renderer',
	imports: [EmailEditorPanelComponent],
	providers: [provideEmailBuilder()],
	host: { class: 'block rounded-lg border border-border overflow-hidden' },
	template: `
		<div class="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
			<span class="text-sm font-medium text-foreground">{{ label() }}</span>
			<span class="text-xs text-muted-foreground">{{ blockCount() }} blocks</span>
		</div>
		<eml-editor-panel class="block" style="min-height: 400px; max-height: 70vh; overflow-y: auto" />
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailBuilderFieldRendererComponent {
	private readonly builderState = inject(EmailBuilderStateService);

	// Standard field renderer inputs (passed by FieldRenderer shell via NgComponentOutlet)
	readonly field = input.required<Field>();
	readonly formNode = input<unknown>(null);
	readonly formTree = input<unknown>(null);
	readonly formModel = input<Record<string, unknown>>({});
	readonly mode = input<'create' | 'edit' | 'view'>('create');
	readonly path = input.required<string>();

	private readonly nodeState = computed(() => getFieldNodeState(this.formNode()));

	readonly label = computed(() => this.field().label ?? this.field().name);
	readonly blockCount = computed(() => this.builderState.blockCount());

	/** Normalize stored value to EmailBlock[]. Handles initial {} default for json fields. */
	private readonly emailBlocks = computed((): EmailBlock[] => {
		const state = this.nodeState();
		if (!state) return [];
		const val = state.value();
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- json field stores unknown[], validated as array
		if (Array.isArray(val)) return val as EmailBlock[];
		return [];
	});

	constructor() {
		// Sync form state → email builder state
		effect(() => {
			const blocks = this.emailBlocks();
			untracked(() => this.builderState.setBlocks(blocks));
		});

		// Sync email builder state → form state
		effect(() => {
			const builderBlocks = this.builderState.blocks();
			const state = untracked(() => this.nodeState());
			if (state) {
				untracked(() => state.value.set(builderBlocks));
			}
		});
	}
}
