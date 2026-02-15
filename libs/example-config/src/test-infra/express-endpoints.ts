import type { Router } from 'express';
import type { AnalyticsPluginInstance } from '@momentum-cms/plugins/analytics';
import type { MemoryAnalyticsAdapter } from '@momentum-cms/plugins/analytics';
import type { EventBusPlugin, CollectionEvent } from '@momentum-cms/plugins/core';
import {
	getHookLog,
	clearHookLog,
	getHookBehavior,
	setHookBehavior,
} from '../collections/hook-test-items.collection';
import type { HookBehaviorConfig } from '../collections/hook-test-items.collection';
import { getFieldHookLog, clearFieldHookLog } from '../collections/field-test-items.collection';

/**
 * Options for mounting test infrastructure endpoints.
 */
export interface TestEndpointsOptions {
	/** Analytics plugin instance */
	analytics: AnalyticsPluginInstance;
	/** Analytics adapter instance (for querying stored events) */
	analyticsAdapter: MemoryAnalyticsAdapter;
	/** Event bus plugin instance */
	events: EventBusPlugin;
}

/**
 * In-memory webhook receiver storage.
 * Stores received webhook payloads so tests can verify delivery.
 */
const receivedWebhooks: Array<{
	headers: Record<string, string>;
	body: unknown;
	timestamp: number;
}> = [];

/**
 * Mount test infrastructure endpoints on an Express router/app.
 *
 * These endpoints are used by E2E tests to observe hook invocations,
 * webhook deliveries, event bus events, and analytics data.
 *
 * Endpoints:
 * - GET/DELETE /api/test-hook-log
 * - GET/POST /api/test-hook-config
 * - GET/DELETE /api/test-field-hook-log
 * - GET/POST/DELETE /api/test-webhook-receiver
 * - GET/DELETE /api/test-event-bus-log
 * - GET/DELETE /api/test-analytics-events
 */
export function mountTestEndpoints(app: Router, options: TestEndpointsOptions): void {
	const { analytics, analyticsAdapter, events } = options;

	// --- Hook test endpoints ---
	app.get('/api/test-hook-log', (_req, res) => {
		const invocations = getHookLog();
		res.json({ invocations, count: invocations.length });
	});

	app.delete('/api/test-hook-log', (_req, res) => {
		clearHookLog();
		res.json({ cleared: true });
	});

	app.get('/api/test-hook-config', (_req, res) => {
		res.json(getHookBehavior());
	});

	app.post('/api/test-hook-config', (req, res) => {
		if (!req.body || typeof req.body !== 'object') {
			res.status(400).json({ error: 'Invalid request body' });
			return;
		}
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test infrastructure, validated above
		setHookBehavior(req.body as HookBehaviorConfig);
		res.json({ configured: true });
	});

	// --- Field hook test endpoints ---
	app.get('/api/test-field-hook-log', (_req, res) => {
		const invocations = getFieldHookLog();
		res.json({ invocations, count: invocations.length });
	});

	app.delete('/api/test-field-hook-log', (_req, res) => {
		clearFieldHookLog();
		res.json({ cleared: true });
	});

	// --- Webhook receiver endpoints ---
	app.post('/api/test-webhook-receiver', (req, res) => {
		receivedWebhooks.push({
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Headers are string values
			headers: Object.fromEntries(
				Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
			) as Record<string, string>,
			body: req.body,
			timestamp: Date.now(),
		});
		res.status(200).json({ received: true });
	});

	app.get('/api/test-webhook-receiver', (_req, res) => {
		res.json({ webhooks: receivedWebhooks, count: receivedWebhooks.length });
	});

	app.delete('/api/test-webhook-receiver', (_req, res) => {
		receivedWebhooks.length = 0;
		res.json({ cleared: true });
	});

	// --- Event bus test endpoints ---
	const eventBusLog: CollectionEvent[] = [];
	events.bus.on('*', (event) => eventBusLog.push(event));

	app.get('/api/test-event-bus-log', (_req, res) => {
		res.json({ events: eventBusLog, count: eventBusLog.length });
	});

	app.delete('/api/test-event-bus-log', (_req, res) => {
		eventBusLog.length = 0;
		res.json({ cleared: true });
	});

	// --- Analytics test endpoints ---
	app.get('/api/test-analytics-events', async (_req, res) => {
		// Flush pending events first so tests see them immediately
		await analytics.eventStore.flush();
		const result = await analyticsAdapter.query({ limit: 500 });
		res.json(result);
	});

	app.delete('/api/test-analytics-events', (_req, res) => {
		analyticsAdapter.events.length = 0;
		res.json({ cleared: true });
	});
}
