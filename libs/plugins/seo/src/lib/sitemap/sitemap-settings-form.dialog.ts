/**
 * Sitemap Settings Form Dialog
 *
 * Edit dialog for per-collection sitemap settings (priority + change frequency).
 * Opened via DialogService from the Sitemap Settings page.
 * Persists via PUT /api/seo/sitemap-settings/:collection.
 */

import { Component, ChangeDetectionStrategy, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	DIALOG_DATA,
	DialogRef,
	Input,
	Select,
	Switch,
	Button,
	McmsFormField,
} from '@momentumcms/ui';

export interface SitemapSettingsEntry {
	collection: string;
	includeInSitemap: boolean;
	priority: number | null;
	changeFreq: string | null;
	id: string | null;
}

export interface SitemapSettingsFormData {
	entry: SitemapSettingsEntry;
}

const CHANGE_FREQ_OPTIONS = [
	{ label: '(default)', value: '' },
	{ label: 'Always', value: 'always' },
	{ label: 'Hourly', value: 'hourly' },
	{ label: 'Daily', value: 'daily' },
	{ label: 'Weekly', value: 'weekly' },
	{ label: 'Monthly', value: 'monthly' },
	{ label: 'Yearly', value: 'yearly' },
	{ label: 'Never', value: 'never' },
];

@Component({
	selector: 'mcms-sitemap-settings-form-dialog',
	imports: [
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Input,
		Select,
		Switch,
		Button,
		McmsFormField,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title> Edit Sitemap Settings </mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="space-y-4">
					<mcms-form-field id="setting-collection">
						<span mcmsLabel>Collection</span>
						<mcms-input [value]="data.entry.collection" [disabled]="true" id="setting-collection" />
					</mcms-form-field>

					<div class="pt-2">
						<mcms-switch [(value)]="includeInSitemap">Include in Sitemap</mcms-switch>
					</div>

					<mcms-form-field
						id="setting-priority"
						[hint]="'Value between 0.0 and 1.0. Leave empty for default.'"
					>
						<span mcmsLabel>Priority</span>
						<mcms-input
							[(value)]="priorityStr"
							type="number"
							placeholder="0.5"
							id="setting-priority"
						/>
					</mcms-form-field>

					<mcms-form-field id="setting-change-freq">
						<span mcmsLabel>Change Frequency</span>
						<mcms-select
							[(value)]="changeFreq"
							[options]="changeFreqOptions"
							id="setting-change-freq"
						/>
					</mcms-form-field>
				</div>
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" mcmsDialogClose>Cancel</button>
				<button mcms-button [loading]="saving()" (click)="save()">Save</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class SitemapSettingsFormDialog {
	readonly data = inject<SitemapSettingsFormData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef);
	private readonly platformId = inject(PLATFORM_ID);

	readonly includeInSitemap = signal(this.data.entry.includeInSitemap);
	readonly priorityStr = signal(
		this.data.entry.priority != null ? String(this.data.entry.priority) : '',
	);
	readonly changeFreq = signal(this.data.entry.changeFreq ?? '');
	readonly saving = signal(false);

	readonly changeFreqOptions = CHANGE_FREQ_OPTIONS;

	async save(): Promise<void> {
		if (this.saving()) return;
		if (!isPlatformBrowser(this.platformId)) return;

		this.saving.set(true);

		const body: Record<string, unknown> = {
			includeInSitemap: this.includeInSitemap(),
		};

		const priorityVal = this.priorityStr().trim();
		if (priorityVal && !Number.isNaN(Number(priorityVal))) {
			body['priority'] = Number(priorityVal);
		}

		const freq = this.changeFreq();
		if (freq) {
			body['changeFreq'] = freq;
		}

		try {
			await fetch(`/api/seo/sitemap-settings/${this.data.entry.collection}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			this.dialogRef.close('saved');
		} finally {
			this.saving.set(false);
		}
	}
}
