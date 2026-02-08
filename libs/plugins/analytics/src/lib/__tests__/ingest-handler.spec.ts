import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createIngestRouter } from '../ingest-handler';
import { EventStore } from '../event-store';
import type { AnalyticsAdapter } from '../analytics-config.types';

function createMockAdapter(): AnalyticsAdapter {
	return { store: vi.fn().mockResolvedValue(undefined) };
}

function createApp(eventStore: EventStore, rateLimit?: number): express.Express {
	const app = express();
	app.use(express.json());
	app.use('/', createIngestRouter({ eventStore, rateLimit }));
	return app;
}

describe('createIngestRouter', () => {
	let adapter: AnalyticsAdapter;
	let eventStore: EventStore;
	let app: express.Express;

	beforeEach(() => {
		adapter = createMockAdapter();
		eventStore = new EventStore({ adapter });
		app = createApp(eventStore);
	});

	it('should accept valid events and return 202', async () => {
		const res = await request(app)
			.post('/')
			.send({
				events: [
					{ name: 'page_view', category: 'page' },
					{ name: 'button_click', category: 'action' },
				],
			});

		expect(res.status).toBe(202);
		expect(res.body.accepted).toBe(2);
	});

	it('should reject requests without events array', async () => {
		const res = await request(app).post('/').send({ notEvents: [] });

		expect(res.status).toBe(400);
		expect(res.body.error).toBe('Request body must contain an events array');
	});

	it('should reject requests with no valid events', async () => {
		const res = await request(app)
			.post('/')
			.send({
				events: [{ notName: 'invalid' }, { name: '' }, null],
			});

		expect(res.status).toBe(400);
		expect(res.body.error).toBe('No valid events in request');
	});

	it('should skip invalid events but accept valid ones', async () => {
		const res = await request(app)
			.post('/')
			.send({
				events: [{ name: 'valid_event' }, { notName: 'invalid' }, { name: 'another_valid' }],
			});

		expect(res.status).toBe(202);
		expect(res.body.accepted).toBe(2);
	});

	it('should assign server-side timestamps', async () => {
		const addBatchSpy = vi.spyOn(eventStore, 'addBatch');

		await request(app)
			.post('/')
			.send({ events: [{ name: 'test_event' }] });

		const storedEvents = addBatchSpy.mock.calls[0][0];
		expect(storedEvents[0].timestamp).toBeDefined();
		expect(new Date(storedEvents[0].timestamp).toISOString()).toBe(storedEvents[0].timestamp);
	});

	it('should assign unique IDs to events', async () => {
		const addBatchSpy = vi.spyOn(eventStore, 'addBatch');

		await request(app)
			.post('/')
			.send({
				events: [{ name: 'event_1' }, { name: 'event_2' }],
			});

		const storedEvents = addBatchSpy.mock.calls[0][0];
		expect(storedEvents[0].id).toBeDefined();
		expect(storedEvents[1].id).toBeDefined();
		expect(storedEvents[0].id).not.toBe(storedEvents[1].id);
	});

	it('should reject events with invalid categories', async () => {
		const res = await request(app)
			.post('/')
			.send({
				events: [{ name: 'test', category: 'INVALID_CATEGORY' }],
			});

		expect(res.status).toBe(400);
	});

	it('should default category to custom for events without category', async () => {
		const addBatchSpy = vi.spyOn(eventStore, 'addBatch');

		await request(app)
			.post('/')
			.send({ events: [{ name: 'no_category' }] });

		const storedEvents = addBatchSpy.mock.calls[0][0];
		expect(storedEvents[0].category).toBe('custom');
	});

	it('should capture user-agent from request headers', async () => {
		const addBatchSpy = vi.spyOn(eventStore, 'addBatch');

		await request(app)
			.post('/')
			.set('User-Agent', 'test-browser/1.0')
			.send({ events: [{ name: 'test' }] });

		const storedEvents = addBatchSpy.mock.calls[0][0];
		expect(storedEvents[0].context.userAgent).toBe('test-browser/1.0');
	});

	it('should set source to client for ingested events', async () => {
		const addBatchSpy = vi.spyOn(eventStore, 'addBatch');

		await request(app)
			.post('/')
			.send({ events: [{ name: 'test' }] });

		const storedEvents = addBatchSpy.mock.calls[0][0];
		expect(storedEvents[0].context.source).toBe('client');
	});

	it('should rate limit by IP', async () => {
		const limitedApp = createApp(eventStore, 2);

		const res1 = await request(limitedApp)
			.post('/')
			.send({ events: [{ name: 'test' }] });
		expect(res1.status).toBe(202);

		const res2 = await request(limitedApp)
			.post('/')
			.send({ events: [{ name: 'test' }] });
		expect(res2.status).toBe(202);

		const res3 = await request(limitedApp)
			.post('/')
			.send({ events: [{ name: 'test' }] });
		expect(res3.status).toBe(429);
	});

	it('should preserve sessionId and visitorId from client events', async () => {
		const addBatchSpy = vi.spyOn(eventStore, 'addBatch');

		await request(app)
			.post('/')
			.send({
				events: [
					{
						name: 'test',
						sessionId: 'sess-123',
						visitorId: 'vis-456',
					},
				],
			});

		const storedEvents = addBatchSpy.mock.calls[0][0];
		expect(storedEvents[0].sessionId).toBe('sess-123');
		expect(storedEvents[0].visitorId).toBe('vis-456');
	});
});
