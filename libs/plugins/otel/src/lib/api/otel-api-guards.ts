/**
 * Shared type guards and interfaces for OTel API consumers.
 *
 * Used by both the query handler and the snapshot service to
 * duck-type the MomentumAPI and collection operations.
 */

export interface MomentumAPILike {
	collection(slug: string): unknown;
	setContext(ctx: Record<string, unknown>): MomentumAPILike;
}

export interface FindableCollection {
	find(query: Record<string, unknown>): Promise<{ docs?: unknown[]; totalDocs?: number; totalPages?: number }>;
}

export interface CreatableCollection {
	create(data: Record<string, unknown>): Promise<unknown>;
}

export interface DeletableCollection {
	delete(id: string): Promise<unknown>;
}

export function isFindable(val: unknown): val is FindableCollection {
	return val != null && typeof val === 'object' && 'find' in val;
}

export function isCreatable(val: unknown): val is CreatableCollection {
	return val != null && typeof val === 'object' && 'create' in val;
}

export function isDeletable(val: unknown): val is DeletableCollection {
	return val != null && typeof val === 'object' && 'delete' in val;
}

export function isRecord(val: unknown): val is Record<string, unknown> {
	return val != null && typeof val === 'object' && !Array.isArray(val);
}
