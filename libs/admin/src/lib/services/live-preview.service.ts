import { Injectable, signal } from '@angular/core';

/**
 * Global service for sharing live form data with preview components.
 *
 * The edit page syncs form state into this service.
 * Preview components inject it and read `.documentData()` for instant signal-based reactivity.
 */
@Injectable({ providedIn: 'root' })
export class LivePreviewService {
	/** Current entity ID (undefined in create mode) */
	readonly entityId = signal<string | undefined>(undefined);

	/** Current collection slug */
	readonly collectionSlug = signal<string | undefined>(undefined);

	/** Current form data — updates instantly as the user types */
	readonly documentData = signal<Record<string, unknown>>({});
}
