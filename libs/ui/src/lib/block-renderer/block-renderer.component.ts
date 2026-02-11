/**
 * Block Renderer Component
 *
 * Iterates over a blocks array and renders each block via BlockOutletComponent.
 * The `typeField` input configures which key in each block record holds the
 * block type discriminator (defaults to 'blockType').
 *
 * When BLOCK_ADMIN_MODE is provided and true, shows hover overlays with edit
 * buttons on each block. Emits `editBlock` events with the block index.
 *
 * @example
 * ```html
 * <mcms-block-renderer [blocks]="blocks()" />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { BlockOutletComponent } from './block-outlet.component';
import { BLOCK_ADMIN_MODE } from './block-renderer.types';
import { BlockAdminModeService } from './block-admin-mode.service';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Component({
	selector: 'mcms-block-renderer',
	imports: [BlockOutletComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
	},
	template: `
		@for (block of blocks(); track $index) {
			@if (getBlockType(block); as type) {
				@if (adminMode()) {
					<div
						class="group relative"
						data-testid="block-edit-wrapper"
						[attr.data-block-type]="type"
						[attr.data-block-index]="$index"
						[attr.data-block-track]="getBlockTrack(block)"
					>
						<mcms-block-outlet [blockType]="type" [blockData]="block" />
						<!-- Admin edit overlay -->
						<div
							class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
						>
							<div class="absolute inset-0 border-2 border-primary/40 rounded-md"></div>
							<button
								class="absolute top-2 right-2 pointer-events-auto bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors"
								(click)="onEditBlock($index)"
								data-testid="block-edit-button"
							>
								Edit Block
							</button>
						</div>
					</div>
				} @else {
					<mcms-block-outlet
						[blockType]="type"
						[blockData]="block"
						[attr.data-block-type]="type"
						[attr.data-block-index]="$index"
						[attr.data-block-track]="getBlockTrack(block)"
					/>
				}
			}
		}
	`,
})
export class BlockRendererComponent {
	/** Array of block data records to render. */
	readonly blocks = input<Record<string, unknown>[]>([]);

	/** Key used to read the block type from each record. Defaults to 'blockType'. */
	readonly typeField = input('blockType');

	/** Emitted when an admin clicks the edit button on a block. Payload is the block index. */
	readonly editBlock = output<number>();

	/** Whether admin mode is active (shows edit overlays). Prefers service over deprecated token. */
	private readonly adminModeService = inject(BlockAdminModeService, { optional: true });
	private readonly adminModeToken = inject(BLOCK_ADMIN_MODE, { optional: true }) ?? false;
	readonly adminMode = computed(
		(): boolean => this.adminModeService?.isAdmin() ?? this.adminModeToken,
	);

	/** Extract the block type string from a block record. */
	getBlockType(block: Record<string, unknown>): string | null {
		const val = block[this.typeField()];
		return typeof val === 'string' ? val : null;
	}

	/**
	 * Read the `_analytics` group from block data and return a tracking descriptor.
	 * Returns null if no tracking is configured (attribute won't be rendered).
	 */
	getBlockTrack(block: Record<string, unknown>): string | null {
		const analytics = block['_analytics'];
		if (!isRecord(analytics)) return null;

		const parts: string[] = [];
		if (analytics['trackImpressions']) parts.push('impressions');
		if (analytics['trackHover']) parts.push('hover');
		return parts.length > 0 ? parts.join(',') : null;
	}

	onEditBlock(index: number): void {
		this.editBlock.emit(index);
	}
}
