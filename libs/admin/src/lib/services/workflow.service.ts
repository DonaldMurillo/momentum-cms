/**
 * Workflow Service for Angular Admin UI
 *
 * Wraps the `/api/:collection/:id/transition` and
 * `/api/:collection/:id/workflow-history` endpoints exposed by server-core.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { WorkflowHistoryEntry } from '@momentumcms/core';

export interface WorkflowHistoryQueryResult {
	docs: WorkflowHistoryEntry[];
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export interface TransitionResult {
	id: string;
	fromStage: string;
	toStage: string;
	workflowUpdatedAt: string;
	historyId: string;
	published: boolean;
	unpublished: boolean;
}

export interface TransitionRequest {
	toStage: string;
	comment?: string;
	expectedStage?: string;
	expectedUpdatedAt?: string;
}

export interface TransitionConflictBody {
	error: string;
	code: 'WORKFLOW_CONFLICT_STALE_STAGE';
	currentStage: string;
	currentUpdatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkflowService {
	private readonly http = inject(HttpClient);

	readonly isUpdating = signal(false);
	readonly error = signal<string | null>(null);

	/**
	 * Transition a document to a new stage. Returns the success envelope on
	 * 200 or throws an HttpErrorResponse on non-200 — including 409 stale-stage
	 * conflicts which carry the current state in the body.
	 */
	transition$(
		collection: string,
		docId: string,
		body: TransitionRequest,
	): Observable<TransitionResult> {
		return this.http.post<TransitionResult>(this.url(collection, docId, 'transition'), body);
	}

	async transition(
		collection: string,
		docId: string,
		body: TransitionRequest,
	): Promise<TransitionResult> {
		this.isUpdating.set(true);
		this.error.set(null);
		try {
			return await firstValueFrom(this.transition$(collection, docId, body));
		} finally {
			this.isUpdating.set(false);
		}
	}

	/** Paginated workflow history for a document, newest entries first. */
	listHistory$(
		collection: string,
		docId: string,
		options: { limit?: number; page?: number } = {},
	): Observable<WorkflowHistoryQueryResult> {
		const params: Record<string, string> = {};
		if (options.limit !== undefined) params['limit'] = String(options.limit);
		if (options.page !== undefined) params['page'] = String(options.page);
		return this.http.get<WorkflowHistoryQueryResult>(
			this.url(collection, docId, 'workflow-history'),
			{ params },
		);
	}

	async listHistory(
		collection: string,
		docId: string,
		options: { limit?: number; page?: number } = {},
	): Promise<WorkflowHistoryQueryResult> {
		return firstValueFrom(this.listHistory$(collection, docId, options));
	}

	private url(collection: string, docId: string, ...rest: string[]): string {
		// encodeURIComponent each dynamic segment so a docId or collection
		// containing '/' or other reserved chars can't escape into the rest of
		// the path. `rest` segments are caller-controlled literals
		// ('transition', 'workflow-history') so they don't need encoding, but
		// running them through encodeURIComponent is cheap and uniform.
		const segments = [collection, docId, ...rest].map((s) => encodeURIComponent(s));
		return ['/api', ...segments].join('/');
	}
}

export function injectWorkflowService(): WorkflowService {
	return inject(WorkflowService);
}
