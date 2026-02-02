import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
	docs?: T[];
	doc?: T;
	totalDocs?: number;
	error?: string;
	status?: number;
	deleted?: boolean;
}

/**
 * Momentum CMS API Service
 *
 * Handles communication with the Momentum CMS REST API.
 */
@Injectable({ providedIn: 'root' })
export class MomentumApiService {
	private readonly http = inject(HttpClient);
	private readonly baseUrl = '/api';

	/**
	 * Fetch all documents from a collection
	 */
	findAll(collection: string): Observable<Record<string, unknown>[]> {
		return this.http
			.get<ApiResponse<Record<string, unknown>>>(`${this.baseUrl}/${collection}`)
			.pipe(map((response) => response.docs ?? []));
	}

	/**
	 * Fetch a single document by ID
	 */
	findById(collection: string, id: string): Observable<Record<string, unknown> | null> {
		return this.http
			.get<ApiResponse<Record<string, unknown>>>(`${this.baseUrl}/${collection}/${id}`)
			.pipe(map((response) => response.doc ?? null));
	}

	/**
	 * Create a new document
	 */
	create(collection: string, data: Record<string, unknown>): Observable<Record<string, unknown>> {
		return this.http
			.post<ApiResponse<Record<string, unknown>>>(`${this.baseUrl}/${collection}`, data)
			.pipe(map((response) => response.doc ?? {}));
	}

	/**
	 * Update an existing document
	 */
	update(
		collection: string,
		id: string,
		data: Record<string, unknown>,
	): Observable<Record<string, unknown>> {
		return this.http
			.patch<ApiResponse<Record<string, unknown>>>(`${this.baseUrl}/${collection}/${id}`, data)
			.pipe(map((response) => response.doc ?? {}));
	}

	/**
	 * Delete a document
	 */
	delete(collection: string, id: string): Observable<boolean> {
		return this.http
			.delete<ApiResponse<unknown>>(`${this.baseUrl}/${collection}/${id}`)
			.pipe(map((response) => response.deleted ?? false));
	}
}
