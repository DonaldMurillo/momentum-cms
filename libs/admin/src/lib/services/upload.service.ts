import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, Subject, finalize } from 'rxjs';
import type { MediaDocument } from '@momentum-cms/core';

/**
 * Upload progress state.
 */
export interface UploadProgress {
	/** Current status of the upload */
	status: 'pending' | 'uploading' | 'complete' | 'error';
	/** Upload progress percentage (0-100) */
	progress: number;
	/** Original file being uploaded */
	file: File;
	/** Created media document (when complete) */
	result?: MediaDocument;
	/** Error message (when error) */
	error?: string;
}

/**
 * Upload response from the API.
 */
interface UploadApiResponse {
	doc?: MediaDocument;
	error?: string;
	status: number;
}

/**
 * Service for handling file uploads to Momentum CMS.
 *
 * @example
 * ```typescript
 * const uploadService = inject(UploadService);
 * uploadService.upload(file).subscribe(progress => {
 *   console.log(`Progress: ${progress.progress}%`);
 *   if (progress.status === 'complete') {
 *     console.log('Uploaded:', progress.result);
 *   }
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
	private readonly http = inject(HttpClient);
	private readonly uploadUrl = '/api/media/upload';

	/** Active uploads signal */
	private readonly activeUploadsSignal = signal<Map<File, UploadProgress>>(new Map());

	/** Number of active uploads */
	readonly activeUploadCount = computed(() => {
		const uploads = this.activeUploadsSignal();
		let count = 0;
		for (const progress of uploads.values()) {
			if (progress.status === 'pending' || progress.status === 'uploading') {
				count++;
			}
		}
		return count;
	});

	/** Whether any uploads are in progress */
	readonly isUploading = computed(() => this.activeUploadCount() > 0);

	/**
	 * Upload a single file.
	 *
	 * @param file - The file to upload
	 * @param alt - Optional alt text for images
	 * @returns Observable emitting upload progress
	 */
	upload(file: File, alt?: string): Observable<UploadProgress> {
		const subject = new Subject<UploadProgress>();

		// Create FormData with file
		const formData = new FormData();
		formData.append('file', file);
		if (alt) {
			formData.append('alt', alt);
		}

		// Initialize progress state
		const initialProgress: UploadProgress = {
			status: 'pending',
			progress: 0,
			file,
		};

		this.updateActiveUpload(file, initialProgress);
		subject.next(initialProgress);

		// Create request with progress reporting
		const request = new HttpRequest('POST', this.uploadUrl, formData, {
			reportProgress: true,
		});

		this.http
			.request<UploadApiResponse>(request)
			.pipe(
				finalize(() => {
					// Remove from active uploads when complete
					const uploads = new Map(this.activeUploadsSignal());
					uploads.delete(file);
					this.activeUploadsSignal.set(uploads);
					subject.complete();
				}),
			)
			.subscribe({
				next: (event) => {
					if (event.type === HttpEventType.UploadProgress) {
						const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
						const uploadingProgress: UploadProgress = {
							status: 'uploading',
							progress,
							file,
						};
						this.updateActiveUpload(file, uploadingProgress);
						subject.next(uploadingProgress);
					} else if (event.type === HttpEventType.Response) {
						const body = event.body;
						if (body?.doc) {
							const completeProgress: UploadProgress = {
								status: 'complete',
								progress: 100,
								file,
								result: body.doc,
							};
							this.updateActiveUpload(file, completeProgress);
							subject.next(completeProgress);
						} else {
							const errorProgress: UploadProgress = {
								status: 'error',
								progress: 0,
								file,
								error: body?.error ?? 'Upload failed',
							};
							this.updateActiveUpload(file, errorProgress);
							subject.next(errorProgress);
						}
					}
				},
				error: (error: Error) => {
					const errorProgress: UploadProgress = {
						status: 'error',
						progress: 0,
						file,
						error: error.message ?? 'Upload failed',
					};
					this.updateActiveUpload(file, errorProgress);
					subject.next(errorProgress);
					subject.error(error);
				},
			});

		return subject.asObservable();
	}

	/**
	 * Upload multiple files.
	 *
	 * @param files - Array of files to upload
	 * @returns Array of observables for each file's progress
	 */
	uploadMultiple(files: File[]): Observable<UploadProgress>[] {
		return files.map((file) => this.upload(file));
	}

	/**
	 * Get the URL for a media document.
	 *
	 * @param media - Media document or ID
	 * @returns URL to access the file
	 */
	getMediaUrl(media: MediaDocument | string): string {
		if (typeof media === 'string') {
			return `/api/media/file/${media}`;
		}
		return media.url ?? `/api/media/file/${media.path}`;
	}

	/**
	 * Update active upload progress.
	 */
	private updateActiveUpload(file: File, progress: UploadProgress): void {
		const uploads = new Map(this.activeUploadsSignal());
		uploads.set(file, progress);
		this.activeUploadsSignal.set(uploads);
	}
}
