import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import {
	BLOCK_ADMIN_MODE,
	BLOCK_COMPONENT_REGISTRY,
	BLOCK_FALLBACK_COMPONENT,
	provideBlockComponents,
} from './block-renderer.types';

@Component({ selector: 'mcms-test-comp', template: '' })
class TestComponent {}

@Component({ selector: 'mcms-test-comp-b', template: '' })
class TestComponentB {}

describe('block-renderer.types', () => {
	describe('BLOCK_COMPONENT_REGISTRY', () => {
		it('should be defined as an InjectionToken', () => {
			expect(BLOCK_COMPONENT_REGISTRY).toBeDefined();
			expect(BLOCK_COMPONENT_REGISTRY.toString()).toContain('BLOCK_COMPONENT_REGISTRY');
		});
	});

	describe('BLOCK_FALLBACK_COMPONENT', () => {
		it('should be defined as an InjectionToken', () => {
			expect(BLOCK_FALLBACK_COMPONENT).toBeDefined();
			expect(BLOCK_FALLBACK_COMPONENT.toString()).toContain('BLOCK_FALLBACK_COMPONENT');
		});
	});

	describe('BLOCK_ADMIN_MODE', () => {
		it('should be defined as an InjectionToken', () => {
			expect(BLOCK_ADMIN_MODE).toBeDefined();
			expect(BLOCK_ADMIN_MODE.toString()).toContain('BLOCK_ADMIN_MODE');
		});
	});

	describe('provideBlockComponents', () => {
		it('should return an array of providers', () => {
			const providers = provideBlockComponents({ hero: TestComponent });
			expect(Array.isArray(providers)).toBe(true);
			expect(providers.length).toBeGreaterThan(0);
		});

		it('should provide a Map with all entries', () => {
			const providers = provideBlockComponents({
				hero: TestComponent,
				textBlock: TestComponentB,
			});

			const provider = providers[0] as { provide: unknown; useValue: Map<string, unknown> };
			expect(provider.provide).toBe(BLOCK_COMPONENT_REGISTRY);
			expect(provider.useValue).toBeInstanceOf(Map);
			expect(provider.useValue.size).toBe(2);
			expect(provider.useValue.get('hero')).toBe(TestComponent);
			expect(provider.useValue.get('textBlock')).toBe(TestComponentB);
		});

		it('should return empty Map for empty registry', () => {
			const providers = provideBlockComponents({});
			const provider = providers[0] as { provide: unknown; useValue: Map<string, unknown> };
			expect(provider.useValue.size).toBe(0);
		});
	});
});
