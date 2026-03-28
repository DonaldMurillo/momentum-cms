import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import {
	Button,
	Badge,
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogRef,
	DIALOG_DATA,
	Spinner,
} from '@momentumcms/ui';
import type { CollectionConfig } from '@momentumcms/core';
import {
	ImportExportService,
	type DryRunResult,
	type ImportResult,
} from '../../services/import-export.service';
import { FeedbackService } from '../../widgets/feedback/feedback.service';

export interface ImportDialogData {
	collection: CollectionConfig;
}

export interface ImportDialogResult {
	imported: number;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'results';

@Component({
	selector: 'mcms-import-dialog',
	imports: [Button, Badge, Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, Spinner],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Import {{ data.collection.labels?.plural ?? data.collection.slug }}</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				@switch (step()) {
					@case ('upload') {
						<div
							class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
							[class.border-primary]="isDragOver()"
							[class.border-muted-foreground/25]="!isDragOver()"
							role="button"
							tabindex="0"
							aria-label="Drop file here or click to browse"
							aria-describedby="import-file-hint"
							(dragover)="onDragOver($event)"
							(dragleave)="isDragOver.set(false)"
							(drop)="onDrop($event)"
							(click)="triggerFileInput()"
							(keydown.enter)="triggerFileInput()"
							(keydown.space)="triggerFileInput()"
							data-testid="import-drop-zone"
						>
							<input
								#fileInput
								type="file"
								accept=".json,.csv"
								class="hidden"
								aria-label="Select a JSON or CSV file to import"
								(change)="onFileSelected($event)"
								data-testid="import-file-input"
							/>

							@if (file()) {
								<div class="text-center">
									<p class="font-medium">{{ file()?.name }}</p>
									<p class="text-sm text-muted-foreground">{{ formatFileSize(file()?.size ?? 0) }}</p>
									<mcms-badge class="mt-2" variant="secondary">{{ fileExtension() }}</mcms-badge>
								</div>
							} @else {
								<p id="import-file-hint" class="text-muted-foreground">Drop a .json or .csv file here, or click to browse</p>
							}
						</div>

						@if (parseError()) {
							<div class="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
								{{ parseError() }}
							</div>
						}
					}

					@case ('preview') {
						@if (dryRunResult(); as dr) {
							<div
								class="mb-4 rounded-md p-3 text-sm"
								[class]="statusClasses(validCount(dr), dr.total)"
								role="status"
								tabindex="-1"
								data-testid="validation-summary"
							>
								{{ validCount(dr) }} of {{ dr.total }} rows valid
								@if (invalidCount(dr) > 0) {
									— {{ invalidCount(dr) }} with errors
								}
							</div>

							<div class="max-h-64 overflow-auto rounded border" tabindex="0" role="region" aria-label="Validation results">
								<table class="w-full text-sm" role="table" aria-label="Import validation preview">
									<thead class="bg-muted/50 sticky top-0">
										<tr>
											<th scope="col" class="px-3 py-2 text-left font-medium">#</th>
											<th scope="col" class="px-3 py-2 text-left font-medium">Status</th>
											<th scope="col" class="px-3 py-2 text-left font-medium">Details</th>
										</tr>
									</thead>
									<tbody>
										@for (row of dr.validation; track row.index) {
											<tr class="border-t" [attr.data-testid]="'preview-row-' + row.index">
												<td class="px-3 py-2">{{ row.index + 1 }}</td>
												<td class="px-3 py-2">
													@if (row.valid) {
														<mcms-badge variant="default">Valid</mcms-badge>
													} @else {
														<mcms-badge variant="destructive">Error</mcms-badge>
													}
												</td>
												<td class="px-3 py-2">
													@if (!row.valid) {
														<ul class="list-disc pl-4 text-xs text-destructive">
															@for (err of row.errors; track err.field) {
																<li>{{ err.message }}</li>
															}
														</ul>
													} @else {
														<span class="text-xs text-muted-foreground">Ready to import</span>
													}
												</td>
											</tr>
										}
									</tbody>
								</table>
							</div>
						}
					}

					@case ('importing') {
						<div class="flex flex-col items-center gap-4 py-8" role="status" aria-live="polite">
							<mcms-spinner />
							<p class="text-sm text-muted-foreground">Importing documents...</p>
						</div>
					}

					@case ('results') {
						@if (importResult(); as ir) {
							<div
								class="rounded-md p-3 text-sm"
								[class]="statusClasses(ir.imported, ir.imported + ir.errors.length)"
								role="status"
								tabindex="-1"
								data-testid="import-result"
							>
								@if (ir.errors.length === 0) {
									{{ ir.imported }} documents imported successfully.
								} @else if (ir.imported > 0) {
									{{ ir.imported }} imported, {{ ir.errors.length }} failed.
								} @else {
									Import failed. {{ ir.errors.length }} errors.
								}
							</div>

							@if (ir.errors.length > 0) {
								<div class="mt-3 max-h-40 overflow-auto rounded border p-3">
									<p class="mb-2 text-sm font-medium">Errors:</p>
									<ul class="list-disc pl-4 text-xs text-destructive">
										@for (err of ir.errors; track err.index) {
											<li>Row {{ err.index + 1 }}: {{ err.message }}</li>
										}
									</ul>
								</div>
							}
						}
					}
				}
			</mcms-dialog-content>

			<mcms-dialog-footer>
				@switch (step()) {
					@case ('upload') {
						<button mcms-button variant="outline" (click)="close()">Cancel</button>
						<button
							mcms-button
							[disabled]="!file() || isLoading()"
							(click)="validate()"
							data-testid="validate-btn"
						>
							@if (isLoading()) {
								Validating...
							} @else {
								Validate
							}
						</button>
					}
					@case ('preview') {
						<button mcms-button variant="outline" (click)="backToUpload()">Back</button>
						<button
							mcms-button
							[disabled]="!dryRunResult() || validCount(dryRunResult()!) === 0"
							(click)="executeImport()"
							data-testid="import-btn"
						>
							Import {{ validCount(dryRunResult()!) }} documents
						</button>
					}
					@case ('importing') {
						<button mcms-button variant="outline" [disabled]="true">Importing...</button>
					}
					@case ('results') {
						<button mcms-button (click)="done()" data-testid="done-btn">Done</button>
					}
				}
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class ImportDialog {
	readonly data = inject<ImportDialogData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef<ImportDialogResult | undefined>);
	private readonly importExport = inject(ImportExportService);
	private readonly feedback = inject(FeedbackService);

	readonly fileInput = viewChild.required('fileInput', { read: ElementRef });

	readonly step = signal<ImportStep>('upload');
	readonly file = signal<File | null>(null);
	readonly parseError = signal<string | null>(null);
	readonly isDragOver = signal(false);
	readonly isLoading = signal(false);
	readonly dryRunResult = signal<DryRunResult | null>(null);
	readonly importResult = signal<ImportResult | null>(null);

	readonly fileExtension = computed(() => {
		const name = this.file()?.name ?? '';
		const ext = name.split('.').pop() ?? '';
		return ext.toUpperCase();
	});

	private parsedBody: unknown = null;
	private parsedFormat: 'json' | 'csv' = 'json';

	triggerFileInput(): void {
		this.fileInput().nativeElement.click();
	}

	validCount(dr: DryRunResult | null): number {
		if (!dr) return 0;
		return dr.validation.filter((r) => r.valid).length;
	}

	invalidCount(dr: DryRunResult | null): number {
		if (!dr) return 0;
		return dr.validation.filter((r) => !r.valid).length;
	}

	statusClasses(successCount: number, total: number): string {
		if (successCount === total) {
			return 'border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200';
		}
		if (successCount > 0) {
			return 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200';
		}
		return 'border border-destructive/50 bg-destructive/10 text-destructive';
	}

	formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	onDragOver(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(true);
	}

	onDrop(event: DragEvent): void {
		event.preventDefault();
		this.isDragOver.set(false);
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			this.selectFile(files[0]);
		}
	}

	onFileSelected(event: Event): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- event.target is always HTMLInputElement from template binding
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			this.selectFile(input.files[0]);
			input.value = '';
		}
	}

	async validate(): Promise<void> {
		const f = this.file();
		if (!f) return;

		this.isLoading.set(true);
		this.parseError.set(null);

		try {
			const parsed = await this.importExport.parseFile(f);
			this.parsedFormat = parsed.format;
			this.parsedBody = parsed.format === 'csv' ? { data: parsed.data } : { docs: parsed.docs };

			const result = await this.importExport.dryRunImport(
				this.data.collection.slug,
				this.parsedFormat,
				this.parsedBody,
			);

			this.dryRunResult.set(result);
			this.step.set('preview');
		} catch (err) {
			this.parseError.set(err instanceof Error ? err.message : 'Validation failed');
		} finally {
			this.isLoading.set(false);
		}
	}

	async executeImport(): Promise<void> {
		if (!this.parsedBody) return;

		this.step.set('importing');

		try {
			const result = await this.importExport.importDocuments(
				this.data.collection.slug,
				this.parsedFormat,
				this.parsedBody,
			);

			this.importResult.set(result);
			this.step.set('results');

			const label = this.data.collection.labels?.plural ?? this.data.collection.slug;
			if (result.errors.length === 0) {
				this.feedback.importSuccess(label, result.imported);
			} else if (result.imported > 0) {
				this.feedback.importPartialSuccess(label, result.imported, result.errors.length);
			}
		} catch (err) {
			this.importResult.set({
				imported: 0,
				total: 0,
				errors: [{ index: 0, message: err instanceof Error ? err.message : 'Import failed' }],
				docs: [],
			});
			this.step.set('results');
		}
	}

	backToUpload(): void {
		this.step.set('upload');
		this.dryRunResult.set(null);
	}

	close(): void {
		this.dialogRef.close(undefined);
	}

	done(): void {
		const ir = this.importResult();
		this.dialogRef.close(ir && ir.imported > 0 ? { imported: ir.imported } : undefined);
	}

	private selectFile(file: File): void {
		const ext = file.name.split('.').pop()?.toLowerCase();
		if (ext !== 'json' && ext !== 'csv') {
			this.parseError.set('Please select a .json or .csv file.');
			return;
		}
		this.file.set(file);
		this.parseError.set(null);
		this.dryRunResult.set(null);
	}
}
