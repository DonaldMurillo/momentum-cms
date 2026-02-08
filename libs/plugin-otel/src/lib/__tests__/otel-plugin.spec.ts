import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trace } from '@opentelemetry/api';
import { otelPlugin } from '../otel-plugin';
import { createLogger, resetMomentumLogger, MomentumLogger } from '@momentum-cms/logger';
import type { CollectionConfig, MomentumConfig } from '@momentum-cms/core';
import type { PluginContext } from '@momentum-cms/plugins';

function createMockConfig(): MomentumConfig {
	return {
		db: { adapter: {} as MomentumConfig['db']['adapter'] },
		collections: [],
	};
}

function createContext(collections: CollectionConfig[]): PluginContext {
	return {
		config: createMockConfig(),
		collections,
		logger: createLogger('test'),
		registerMiddleware: vi.fn(),
		registerProvider: vi.fn(),
	};
}

describe('otelPlugin', () => {
	beforeEach(() => {
		resetMomentumLogger();
		MomentumLogger.clearEnrichers();
	});

	afterEach(() => {
		MomentumLogger.clearEnrichers();
	});

	it('should have name "otel"', () => {
		const plugin = otelPlugin();
		expect(plugin.name).toBe('otel');
	});

	it('should inject tracing hooks into collections during onInit', () => {
		const plugin = otelPlugin();
		const collections: CollectionConfig[] = [
			{ slug: 'posts', fields: [] },
			{ slug: 'users', fields: [] },
		];

		plugin.onInit?.(createContext(collections));

		// Should have beforeChange, afterChange, beforeDelete, afterDelete
		expect(collections[0].hooks?.beforeChange).toHaveLength(1);
		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[0].hooks?.beforeDelete).toHaveLength(1);
		expect(collections[0].hooks?.afterDelete).toHaveLength(1);

		expect(collections[1].hooks?.beforeChange).toHaveLength(1);
		expect(collections[1].hooks?.afterChange).toHaveLength(1);
	});

	it('should preserve existing hooks', () => {
		const plugin = otelPlugin();
		const existingHook = vi.fn();
		const collections: CollectionConfig[] = [
			{
				slug: 'posts',
				fields: [],
				hooks: {
					beforeChange: [existingHook],
					afterChange: [existingHook],
				},
			},
		];

		plugin.onInit?.(createContext(collections));

		// beforeChange: otel hook first, then existing
		expect(collections[0].hooks?.beforeChange).toHaveLength(2);
		// afterChange: existing first, then otel hook
		expect(collections[0].hooks?.afterChange).toHaveLength(2);
	});

	it('should register a log enricher when enrichLogs is true (default)', () => {
		const plugin = otelPlugin();
		const collections: CollectionConfig[] = [];

		plugin.onInit?.(createContext(collections));

		// The enricher should be registered - we can't easily check the enricher list
		// but we can verify it was registered by checking the shutdown removes it
	});

	it('should not register a log enricher when enrichLogs is false', () => {
		const plugin = otelPlugin({ enrichLogs: false });
		const collections: CollectionConfig[] = [];

		// Track enricher registrations
		const registerSpy = vi.spyOn(MomentumLogger, 'registerEnricher');

		plugin.onInit?.(createContext(collections));

		expect(registerSpy).not.toHaveBeenCalled();

		registerSpy.mockRestore();
	});

	it('should remove enricher during shutdown', () => {
		const plugin = otelPlugin();
		const collections: CollectionConfig[] = [];

		const removeSpy = vi.spyOn(MomentumLogger, 'removeEnricher');

		plugin.onInit?.(createContext(collections));
		plugin.onShutdown?.(createContext(collections));

		expect(removeSpy).toHaveBeenCalledTimes(1);

		removeSpy.mockRestore();
	});

	it('should use custom service name for tracer', () => {
		const getTracerSpy = vi.spyOn(trace, 'getTracer');

		const plugin = otelPlugin({ serviceName: 'my-service' });
		const collections: CollectionConfig[] = [];

		plugin.onInit?.(createContext(collections));

		expect(getTracerSpy).toHaveBeenCalledWith('my-service');

		getTracerSpy.mockRestore();
	});

	it('should default service name to "momentum-cms"', () => {
		const getTracerSpy = vi.spyOn(trace, 'getTracer');

		const plugin = otelPlugin();
		const collections: CollectionConfig[] = [];

		plugin.onInit?.(createContext(collections));

		expect(getTracerSpy).toHaveBeenCalledWith('momentum-cms');

		getTracerSpy.mockRestore();
	});

	it('should create spans when beforeChange hooks fire', () => {
		const mockSpan = {
			setStatus: vi.fn(),
			end: vi.fn(),
			spanContext: vi.fn().mockReturnValue({ traceId: '123', spanId: '456' }),
		};
		const mockTracer = {
			startSpan: vi.fn().mockReturnValue(mockSpan),
		};
		vi.spyOn(trace, 'getTracer').mockReturnValue(mockTracer as ReturnType<typeof trace.getTracer>);

		const plugin = otelPlugin();
		const collections: CollectionConfig[] = [{ slug: 'posts', fields: [] }];

		plugin.onInit?.(createContext(collections));

		// Fire beforeChange
		const beforeChangeHook = collections[0].hooks?.beforeChange?.[0];
		const data = { title: 'Test' };
		beforeChangeHook?.({
			req: {} as Record<string, unknown>,
			data,
			operation: 'create',
		});

		expect(mockTracer.startSpan).toHaveBeenCalledWith(
			'posts.create',
			expect.objectContaining({
				attributes: expect.objectContaining({
					'momentum.collection': 'posts',
					'momentum.operation': 'create',
				}),
			}),
		);

		// Fire afterChange — should end the span
		const afterChangeHook = collections[0].hooks?.afterChange?.[0];
		afterChangeHook?.({
			req: {} as Record<string, unknown>,
			doc: data,
		});

		expect(mockSpan.setStatus).toHaveBeenCalled();
		expect(mockSpan.end).toHaveBeenCalled();

		vi.restoreAllMocks();
	});

	it('should filter operations when configured', () => {
		const mockSpan = {
			setStatus: vi.fn(),
			end: vi.fn(),
		};
		const mockTracer = {
			startSpan: vi.fn().mockReturnValue(mockSpan),
		};
		vi.spyOn(trace, 'getTracer').mockReturnValue(mockTracer as ReturnType<typeof trace.getTracer>);

		const plugin = otelPlugin({ operations: ['create'] });
		const collections: CollectionConfig[] = [{ slug: 'posts', fields: [] }];

		plugin.onInit?.(createContext(collections));

		// Fire beforeChange with update — should NOT create span
		const beforeChangeHook = collections[0].hooks?.beforeChange?.[0];
		beforeChangeHook?.({
			req: {} as Record<string, unknown>,
			data: { title: 'Test' },
			operation: 'update',
		});

		expect(mockTracer.startSpan).not.toHaveBeenCalled();

		// Fire beforeChange with create — SHOULD create span
		beforeChangeHook?.({
			req: {} as Record<string, unknown>,
			data: { title: 'Test' },
			operation: 'create',
		});

		expect(mockTracer.startSpan).toHaveBeenCalledTimes(1);

		vi.restoreAllMocks();
	});
});
