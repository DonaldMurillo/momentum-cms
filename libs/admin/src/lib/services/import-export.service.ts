import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

// ============================================
// Types (browser-safe, mirrored from server-core)
// ============================================

export type ExportFormat = 'json' | 'csv';

export interface ImportResult {
	imported: number;
	total: number;
	errors: ImportError[];
	docs: Record<string, unknown>[];
}

export interface ImportError {
	index: number;
	message: string;
	data?: Record<string, unknown>;
}

export interface ImportValidationResult {
	index: number;
	valid: boolean;
	errors: { field: string; message: string }[];
	coerced: Record<string, unknown>;
}

export interface DryRunResult {
	validation: ImportValidationResult[];
	total: number;
}

export interface ParsedFile {
	format: ExportFormat;
	docs?: unknown[];
	data?: string;
}

// ============================================
// Service
// ============================================

@Injectable({ providedIn: 'root' })
export class ImportExportService {
	private readonly http = inject(HttpClient);
	private readonly document = inject(DOCUMENT);

	/**
	 * Trigger a browser download of exported collection data.
	 */
	exportCollection(slug: string, format: ExportFormat): void {
		const params = new HttpParams().set('format', format);

		if (format === 'csv') {
			this.http.get(`/api/${slug}/export`, { params, responseType: 'text' }).subscribe((data) => {
				this.downloadFile(data, `${slug}-export.csv`, 'text/csv');
			});
		} else {
			this.http.get<{ docs: unknown[] }>(`/api/${slug}/export`, { params }).subscribe((data) => {
				const jsonStr = JSON.stringify(data, null, 2);
				this.downloadFile(jsonStr, `${slug}-export.json`, 'application/json');
			});
		}
	}

	/**
	 * Export selected entities as a JSON download.
	 */
	exportSelected(slug: string, format: ExportFormat, entities: Record<string, unknown>[]): void {
		const jsonStr = JSON.stringify({ docs: entities }, null, 2);
		this.downloadFile(
			jsonStr,
			`${slug}-selected.${format}`,
			format === 'csv' ? 'text/csv' : 'application/json',
		);
	}

	/**
	 * Parse a user-selected file into import-ready data.
	 */
	parseFile(file: File): Promise<ParsedFile> {
		return new Promise((resolve, reject) => {
			const ext = file.name.split('.').pop()?.toLowerCase();
			if (ext !== 'json' && ext !== 'csv') {
				reject(new Error('Unsupported file type. Please select a .json or .csv file.'));
				return;
			}

			const reader = new FileReader();
			reader.onload = () => {
				const content = String(reader.result ?? '');
				if (ext === 'json') {
					try {
						const parsed = JSON.parse(content);
						const docs = Array.isArray(parsed) ? parsed : (parsed.docs ?? parsed.data);
						if (!Array.isArray(docs)) {
							reject(new Error('Invalid JSON format. Expected an array or { docs: [...] }.'));
							return;
						}
						resolve({ format: 'json', docs });
					} catch {
						reject(new Error('Invalid JSON file.'));
					}
				} else {
					resolve({ format: 'csv', data: content });
				}
			};
			reader.onerror = () => reject(new Error('Failed to read file.'));
			reader.readAsText(file);
		});
	}

	/**
	 * Dry-run import — validates documents without creating them.
	 */
	async dryRunImport(slug: string, format: ExportFormat, body: unknown): Promise<DryRunResult> {
		return firstValueFrom(
			this.http.post<DryRunResult>(`/api/${slug}/import`, {
				...(typeof body === 'object' && body !== null ? body : {}),
				format,
				dryRun: true,
			}),
		);
	}

	/**
	 * Execute import — creates documents in the collection.
	 */
	async importDocuments(slug: string, format: ExportFormat, body: unknown): Promise<ImportResult> {
		return firstValueFrom(
			this.http.post<ImportResult>(`/api/${slug}/import`, {
				...(typeof body === 'object' && body !== null ? body : {}),
				format,
			}),
		);
	}

	private downloadFile(content: string, filename: string, mimeType: string): void {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const link = this.document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}
}
