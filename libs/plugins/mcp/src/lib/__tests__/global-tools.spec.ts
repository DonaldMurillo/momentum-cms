import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleListGlobals, handleGetGlobal, handleUpdateGlobal } from '../tools/global-tools';
import type { MomentumConfig } from '@momentumcms/core';

function makeGlobalOps() {
	return {
		findOne: vi.fn().mockResolvedValue({ siteName: 'Test Site', tagline: 'Hello' }),
		update: vi
			.fn()
			.mockImplementation((data: Record<string, unknown>) => Promise.resolve({ ...data })),
	};
}

function makeMockApi(expectedSlug = 'site-settings') {
	const ops = makeGlobalOps();
	return {
		ops,
		global: vi.fn().mockImplementation((slug: string) => {
			if (slug !== expectedSlug)
				throw new Error(`Unexpected global slug: "${slug}" (expected "${expectedSlug}")`);
			return ops;
		}),
	};
}

function makeConfig(
	globals: Array<{ slug: string; label?: string; fields: unknown[] }>,
): MomentumConfig {
	return { collections: [], globals } as unknown as MomentumConfig;
}

const allowAllGlobals = () => true;
const allowNoGlobals = () => false;

describe('handleListGlobals', () => {
	it('should list all globals with metadata', () => {
		const config = makeConfig([
			{
				slug: 'site-settings',
				label: 'Site Settings',
				fields: [{ name: 'siteName', type: 'text' }],
			},
			{ slug: 'nav', label: 'Navigation', fields: [] },
		]);
		const result = handleListGlobals(config, allowAllGlobals);
		expect(result.isError).toBeUndefined();
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toMatchObject({
			slug: 'site-settings',
			label: 'Site Settings',
			fieldCount: 1,
		});
		expect(parsed[1]).toMatchObject({ slug: 'nav', label: 'Navigation', fieldCount: 0 });
	});

	it('should fall back to slug when label is missing', () => {
		const config = makeConfig([{ slug: 'no-label', fields: [] }]);
		const result = handleListGlobals(config, allowAllGlobals);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed[0].label).toBe('no-label');
	});

	it('should return empty array when no globals', () => {
		const config = makeConfig([]);
		const result = handleListGlobals(config, allowAllGlobals);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toEqual([]);
	});

	it('should filter out denied globals', () => {
		const config = makeConfig([
			{ slug: 'site-settings', fields: [] },
			{ slug: 'site-secrets', fields: [] },
		]);
		const filter = (slug: string) => slug !== 'site-secrets';
		const result = handleListGlobals(config, filter);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].slug).toBe('site-settings');
	});
});

describe('handleGetGlobal', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should get a global document and return parsed content', async () => {
		const result = await handleGetGlobal(api as never, { slug: 'site-settings' }, allowAllGlobals);
		expect(result.isError).toBeUndefined();
		expect(api.global).toHaveBeenCalledWith('site-settings');
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toEqual({ siteName: 'Test Site', tagline: 'Hello' });
	});

	it('should pass depth option', async () => {
		await handleGetGlobal(api as never, { slug: 'site-settings', depth: 2 }, allowAllGlobals);
		expect(api.ops.findOne).toHaveBeenCalledWith({ depth: 2 });
	});

	it('should clamp depth to 3', async () => {
		await handleGetGlobal(api as never, { slug: 'site-settings', depth: 10 }, allowAllGlobals);
		expect(api.ops.findOne).toHaveBeenCalledWith({ depth: 3 });
	});

	it('should omit depth when not provided', async () => {
		await handleGetGlobal(api as never, { slug: 'site-settings' }, allowAllGlobals);
		expect(api.ops.findOne).toHaveBeenCalledWith(undefined);
	});

	it('should clamp negative depth to 0 (depth has min=0)', async () => {
		await handleGetGlobal(api as never, { slug: 'site-settings', depth: -5 }, allowAllGlobals);
		expect(api.ops.findOne).toHaveBeenCalledWith({ depth: 0 });
	});

	it('should return error for denied global without invoking the API', async () => {
		const result = await handleGetGlobal(api as never, { slug: 'site-secrets' }, allowNoGlobals);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('not accessible');
		expect(api.global).not.toHaveBeenCalled();
	});

	it('should return identical error for unknown vs. denied globals (no enumeration)', async () => {
		// Production filter (createGlobalFilter) returns false for both unknown
		// slugs and explicitly-denied known slugs. Responses must be identical
		// so callers can't probe deniedGlobals to learn which slugs are real.
		// The two scenarios are distinguished only by the filter result here —
		// any branching on existence inside the handler would surface as a
		// message difference.
		const denied = await handleGetGlobal(api as never, { slug: 'site-secrets' }, allowNoGlobals);
		const unknown = await handleGetGlobal(api as never, { slug: 'never-existed' }, allowNoGlobals);

		expect(denied.isError).toBe(true);
		expect(unknown.isError).toBe(true);
		// Both messages should differ only in the slug they echo back.
		expect(denied.content[0].text.replace('site-secrets', 'X')).toBe(
			unknown.content[0].text.replace('never-existed', 'X'),
		);
		expect(api.global).not.toHaveBeenCalled();
	});

	it('should catch and return API errors', async () => {
		api.ops.findOne.mockRejectedValue(new Error('DB connection failed'));
		const result = await handleGetGlobal(api as never, { slug: 'site-settings' }, allowAllGlobals);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('DB connection failed');
	});
});

describe('handleUpdateGlobal', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should update a global document and return result with echoed input', async () => {
		const result = await handleUpdateGlobal(
			api as never,
			{
				slug: 'site-settings',
				data: '{"siteName":"New Name","theme":"dark"}',
			},
			allowAllGlobals,
		);
		expect(result.isError).toBeUndefined();
		expect(api.global).toHaveBeenCalledWith('site-settings');
		expect(api.ops.update).toHaveBeenCalledWith({ siteName: 'New Name', theme: 'dark' });
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.siteName).toBe('New Name');
		expect(parsed.theme).toBe('dark');
	});

	it('should return error for invalid data JSON', async () => {
		const result = await handleUpdateGlobal(
			api as never,
			{
				slug: 'site-settings',
				data: 'bad-json',
			},
			allowAllGlobals,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Invalid JSON');
	});

	it.each([
		['a string', '"oops"'],
		['a number', '42'],
		['an array', '[{"x":1}]'],
		['null', 'null'],
	])('should reject data that parses to %s without invoking update()', async (_label, raw) => {
		const result = await handleUpdateGlobal(
			api as never,
			{
				slug: 'site-settings',
				data: raw,
			},
			allowAllGlobals,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/object/i);
		expect(api.ops.update).not.toHaveBeenCalled();
	});

	it('should return error for denied global without invoking the API', async () => {
		const result = await handleUpdateGlobal(
			api as never,
			{
				slug: 'site-secrets',
				data: '{"x":1}',
			},
			allowNoGlobals,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('not accessible');
		expect(api.global).not.toHaveBeenCalled();
	});

	it('should return identical error for unknown vs. denied globals (no enumeration)', async () => {
		const denied = await handleUpdateGlobal(
			api as never,
			{
				slug: 'site-secrets',
				data: '{"x":1}',
			},
			allowNoGlobals,
		);
		const unknown = await handleUpdateGlobal(
			api as never,
			{
				slug: 'never-existed',
				data: '{"x":1}',
			},
			allowNoGlobals,
		);

		expect(denied.isError).toBe(true);
		expect(unknown.isError).toBe(true);
		expect(denied.content[0].text.replace('site-secrets', 'X')).toBe(
			unknown.content[0].text.replace('never-existed', 'X'),
		);
		expect(api.global).not.toHaveBeenCalled();
	});

	it('should catch and return API errors', async () => {
		api.ops.update.mockRejectedValue(new Error('Permission denied'));
		const result = await handleUpdateGlobal(
			api as never,
			{
				slug: 'site-settings',
				data: '{"siteName":"X"}',
			},
			allowAllGlobals,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Permission denied');
	});
});
