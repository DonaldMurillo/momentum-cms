import { defineEventHandler, getMethod } from 'h3';
import { ensureInitialized, events } from '../../utils/momentum-init';
import {
	eventBusLog,
	eventBusListenerRegistered,
	markEventBusListenerRegistered,
} from '../../utils/test-state';
import type { CollectionEvent } from '@momentum-cms/plugins/core';

export default defineEventHandler(async (event) => {
	await ensureInitialized();

	// Register event bus listener once
	if (!eventBusListenerRegistered && events?.bus) {
		events.bus.on('*', (ev: CollectionEvent) => eventBusLog.push(ev));
		markEventBusListenerRegistered();
	}

	const method = getMethod(event);

	if (method === 'GET') {
		return { events: eventBusLog, count: eventBusLog.length };
	}
	if (method === 'DELETE') {
		eventBusLog.length = 0;
		return { cleared: true };
	}
	return { error: 'Method not allowed' };
});
