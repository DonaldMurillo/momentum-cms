import { TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { BlockAdminModeService, provideBlockAdminMode } from './block-admin-mode.service';

describe('BlockAdminModeService', () => {
	it('should default isAdmin to false', () => {
		const service = new BlockAdminModeService();
		expect(service.isAdmin()).toBe(false);
	});

	it('should enable admin mode', () => {
		const service = new BlockAdminModeService();
		service.enable();
		expect(service.isAdmin()).toBe(true);
	});

	it('should disable admin mode', () => {
		const service = new BlockAdminModeService();
		service.enable();
		service.disable();
		expect(service.isAdmin()).toBe(false);
	});

	it('should toggle admin mode', () => {
		const service = new BlockAdminModeService();
		service.toggle();
		expect(service.isAdmin()).toBe(true);
		service.toggle();
		expect(service.isAdmin()).toBe(false);
	});
});

describe('provideBlockAdminMode', () => {
	it('should return a provider array', () => {
		const providers = provideBlockAdminMode();
		expect(Array.isArray(providers)).toBe(true);
		expect(providers.length).toBeGreaterThan(0);
	});

	it('should create service with isAdmin=false by default', () => {
		TestBed.configureTestingModule({ providers: [...provideBlockAdminMode()] });
		const service = TestBed.inject(BlockAdminModeService);
		expect(service.isAdmin()).toBe(false);
	});

	it('should create service with isAdmin=true when passed true', () => {
		TestBed.configureTestingModule({ providers: [...provideBlockAdminMode(true)] });
		const service = TestBed.inject(BlockAdminModeService);
		expect(service.isAdmin()).toBe(true);
	});

	it('should create service with isAdmin=false when passed false', () => {
		TestBed.configureTestingModule({ providers: [...provideBlockAdminMode(false)] });
		const service = TestBed.inject(BlockAdminModeService);
		expect(service.isAdmin()).toBe(false);
	});

	it('should accept a factory function for initial value', () => {
		TestBed.configureTestingModule({ providers: [...provideBlockAdminMode(() => true)] });
		const service = TestBed.inject(BlockAdminModeService);
		expect(service.isAdmin()).toBe(true);
	});

	it('should accept a factory function returning false', () => {
		TestBed.configureTestingModule({ providers: [...provideBlockAdminMode(() => false)] });
		const service = TestBed.inject(BlockAdminModeService);
		expect(service.isAdmin()).toBe(false);
	});

	it('should accept a Signal<boolean> as reactive source', () => {
		const source = signal(false);
		TestBed.configureTestingModule({ providers: [...provideBlockAdminMode(source)] });
		const service = TestBed.inject(BlockAdminModeService);
		expect(service.isAdmin()).toBe(false);
		source.set(true);
		expect(service.isAdmin()).toBe(true);
	});
});

describe('BlockAdminModeService — isAdmin replacement', () => {
	it('should allow replacing isAdmin with a computed signal', () => {
		const source = signal(false);
		const service = new BlockAdminModeService();
		service.isAdmin = computed(() => source());
		expect(service.isAdmin()).toBe(false);
		source.set(true);
		expect(service.isAdmin()).toBe(true);
	});
});
