import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
	Button,
	DialogService,
	DropdownMenu,
	DropdownMenuItem,
	DropdownSeparator,
	DropdownTrigger,
	DropdownLabel,
} from '@momentumcms/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroArrowUpTray } from '@ng-icons/heroicons/outline';
import type { CollectionConfig } from '@momentumcms/core';
import { ImportExportService } from '../../services/import-export.service';
import { FeedbackService } from '../../widgets/feedback/feedback.service';
import {
	ImportDialog,
	type ImportDialogData,
	type ImportDialogResult,
} from './import-dialog.component';

@Component({
	selector: 'mcms-import-export-menu',
	imports: [
		Button,
		DropdownMenu,
		DropdownMenuItem,
		DropdownSeparator,
		DropdownTrigger,
		DropdownLabel,
		NgIcon,
	],
	providers: [provideIcons({ heroArrowDownTray, heroArrowUpTray })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'inline-block' },
	template: `
		<button
			mcms-button
			variant="outline"
			size="sm"
			[mcmsDropdownTrigger]="menuContent"
			data-testid="import-export-trigger"
		>
			<ng-icon name="heroArrowDownTray" size="16" class="mr-1" />
			Import / Export
		</button>

		<ng-template #menuContent>
			<mcms-dropdown-menu>
				<mcms-dropdown-label>Import</mcms-dropdown-label>
				<button
					mcms-dropdown-item
					value="import"
					(selected)="openImport()"
					data-testid="menu-import"
				>
					<ng-icon name="heroArrowUpTray" size="16" class="mr-2" />
					Import from file
				</button>
				<mcms-dropdown-separator />
				<mcms-dropdown-label>Export</mcms-dropdown-label>
				<button
					mcms-dropdown-item
					value="export-json"
					(selected)="exportJson()"
					data-testid="menu-export-json"
				>
					Export as JSON
				</button>
				<button
					mcms-dropdown-item
					value="export-csv"
					(selected)="exportCsv()"
					data-testid="menu-export-csv"
				>
					Export as CSV
				</button>
			</mcms-dropdown-menu>
		</ng-template>
	`,
})
export class ImportExportMenu {
	readonly collection = input.required<CollectionConfig>();
	readonly importComplete = output<number>();

	private readonly importExport = inject(ImportExportService);
	private readonly feedback = inject(FeedbackService);
	private readonly dialog = inject(DialogService);

	readonly collectionLabel = computed(
		() => this.collection().labels?.plural ?? this.collection().slug,
	);

	openImport(): void {
		const ref = this.dialog.open<ImportDialog, ImportDialogData, ImportDialogResult | undefined>(
			ImportDialog,
			{
				width: '36rem',
				data: { collection: this.collection() },
			},
		);

		ref.afterClosed.subscribe((result) => {
			if (result?.imported) {
				this.importComplete.emit(result.imported);
			}
		});
	}

	exportJson(): void {
		this.importExport.exportCollection(this.collection().slug, 'json').subscribe(() => {
			this.feedback.exportSuccess(this.collectionLabel(), 'json');
		});
	}

	exportCsv(): void {
		this.importExport.exportCollection(this.collection().slug, 'csv').subscribe(() => {
			this.feedback.exportSuccess(this.collectionLabel(), 'csv');
		});
	}
}
