import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSchemaResources } from '../resources/schema-resources';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';

type ResourceCallback = (uri: URL, variables: Record<string, string>) => unknown;

function makeMockServer() {
	const resources = new Map<string, ResourceCallback>();
	return {
		registerResource: vi.fn(
			(name: string, _uriOrTemplate: unknown, _opts: unknown, callback: ResourceCallback) => {
				resources.set(name, callback);
			},
		),
		getResource(name: string): ResourceCallback | undefined {
			return resources.get(name);
		},
	};
}

function makeConfig(opts?: {
	collections?: Partial<CollectionConfig>[];
	globals?: Array<{ slug: string; label?: string; fields?: unknown[] }>;
}): MomentumConfig {
	return {
		collections: (opts?.collections ?? []).map((c) => ({
			slug: c.slug ?? 'test',
			fields: c.fields ?? [],
			labels: { singular: c.slug, plural: c.slug },
			...c,
		})),
		globals: opts?.globals ?? [],
	} as unknown as MomentumConfig;
}

const allowAll = () => true;
const allowNone = () => false;

describe('registerSchemaResources', () => {
	let server: ReturnType<typeof makeMockServer>;

	beforeEach(() => {
		server = makeMockServer();
	});

	it('should register 4 resources when globals are enabled', () => {
		registerSchemaResources(
			server as never,
			() => makeConfig(),
			() => null,
			allowAll,
			allowAll,
			{ globalsEnabled: true },
		);
		expect(server.registerResource).toHaveBeenCalledTimes(4);
		const names = server.registerResource.mock.calls.map((c: unknown[]) => c[0]);
		expect(names).toEqual(['collections', 'collection-schema', 'globals', 'global-document']);
	});

	it('should skip global resources when globalsEnabled is false', () => {
		registerSchemaResources(
			server as never,
			() => makeConfig(),
			() => null,
			allowAll,
			allowAll,
			{ globalsEnabled: false },
		);
		expect(server.registerResource).toHaveBeenCalledTimes(2);
		const names = server.registerResource.mock.calls.map((c: unknown[]) => c[0]);
		expect(names).toEqual(['collections', 'collection-schema']);
	});

	describe('collections resource', () => {
		it('should return filtered collection list', () => {
			const config = makeConfig({
				collections: [
					{ slug: 'posts', fields: [{ name: 'title', type: 'text' }] },
					{ slug: 'secrets', fields: [] },
				],
			});
			const filter = (slug: string) => slug !== 'secrets';
			registerSchemaResources(
				server as never,
				() => config,
				() => null,
				filter,
				allowAll,
			);

			const callback = server.getResource('collections');
			const result = callback?.(new URL('momentum://collections'), {}) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			const parsed = JSON.parse(result.contents[0].text);
			expect(parsed).toHaveLength(1);
			expect(parsed[0].slug).toBe('posts');
		});
	});

	describe('collection-schema resource', () => {
		it('should return serialized schema for an allowed collection', () => {
			const config = makeConfig({
				collections: [
					{
						slug: 'posts',
						fields: [
							{ name: 'title', type: 'text', required: true },
							{ name: 'body', type: 'richText' },
						],
					},
				],
			});
			registerSchemaResources(
				server as never,
				() => config,
				() => null,
				allowAll,
				allowAll,
			);

			const callback = server.getResource('collection-schema');
			const result = callback?.(new URL('momentum://collections/posts/schema'), {
				slug: 'posts',
			}) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(result.contents[0].mimeType).toBe('application/json');
			const parsed = JSON.parse(result.contents[0].text);
			expect(parsed.slug).toBe('posts');
			expect(parsed.fields).toHaveLength(2);
		});

		it('should return error for denied collection', () => {
			const config = makeConfig({ collections: [{ slug: 'secrets', fields: [] }] });
			registerSchemaResources(
				server as never,
				() => config,
				() => null,
				allowNone,
				allowAll,
			);

			const callback = server.getResource('collection-schema');
			const result = callback?.(new URL('momentum://collections/secrets/schema'), {
				slug: 'secrets',
			}) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(result.contents[0].text).toContain('not accessible');
		});

		it('should return error for unknown collection', () => {
			const config = makeConfig();
			registerSchemaResources(
				server as never,
				() => config,
				() => null,
				allowAll,
				allowAll,
			);

			const callback = server.getResource('collection-schema');
			const result = callback?.(new URL('momentum://collections/unknown/schema'), {
				slug: 'unknown',
			}) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(result.contents[0].text).toContain('not found');
		});
	});

	describe('globals resource', () => {
		it('should return only allowed globals', () => {
			const config = makeConfig({
				globals: [
					{ slug: 'site-settings', label: 'Site Settings' },
					{ slug: 'site-secrets', label: 'Site Secrets' },
				],
			});
			const filter = (slug: string) => slug !== 'site-secrets';
			registerSchemaResources(
				server as never,
				() => config,
				() => null,
				allowAll,
				filter,
			);

			const callback = server.getResource('globals');
			const result = callback?.(new URL('momentum://globals'), {}) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			const parsed = JSON.parse(result.contents[0].text);
			expect(parsed).toHaveLength(1);
			expect(parsed[0]).toMatchObject({ slug: 'site-settings', label: 'Site Settings' });
		});
	});

	describe('global-document resource', () => {
		it('should fetch and return global data when allowed', async () => {
			const findOne = vi.fn().mockResolvedValue({ siteName: 'My Site' });
			const mockApi = {
				global: vi.fn().mockReturnValue({ findOne }),
			};
			const config = makeConfig({ globals: [{ slug: 'site-settings' }] });
			registerSchemaResources(
				server as never,
				() => config,
				() => mockApi as unknown as MomentumAPI,
				allowAll,
				allowAll,
			);

			const callback = server.getResource('global-document');
			const result = (await callback?.(new URL('momentum://globals/site-settings'), {
				slug: 'site-settings',
			})) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			const parsed = JSON.parse(result.contents[0].text);
			expect(parsed.siteName).toBe('My Site');
		});

		it('should return "not accessible" for a denied known global without invoking the API', async () => {
			const findOne = vi.fn();
			const mockApi = {
				global: vi.fn().mockReturnValue({ findOne }),
			};
			const config = makeConfig({ globals: [{ slug: 'site-secrets' }] });
			registerSchemaResources(
				server as never,
				() => config,
				() => mockApi as unknown as MomentumAPI,
				allowAll,
				allowNone,
			);

			const callback = server.getResource('global-document');
			const result = (await callback?.(new URL('momentum://globals/site-secrets'), {
				slug: 'site-secrets',
			})) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(result.contents[0].text).toContain('not accessible');
			expect(mockApi.global).not.toHaveBeenCalled();
			expect(findOne).not.toHaveBeenCalled();
		});

		it('should return error when API is not ready', async () => {
			const config = makeConfig({ globals: [{ slug: 'site-settings' }] });
			registerSchemaResources(
				server as never,
				() => config,
				() => null,
				allowAll,
				allowAll,
			);

			const callback = server.getResource('global-document');
			const result = (await callback?.(new URL('momentum://globals/site-settings'), {
				slug: 'site-settings',
			})) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(result.contents[0].text).toContain('API not ready');
		});

		it('should return a text/plain error response when findOne throws (parity with handleGetGlobal)', async () => {
			// Access checks (e.g. AccessDeniedError) and adapter errors should be
			// surfaced as a plain-text resource read failure, not propagated to the
			// MCP SDK as an unhandled rejection.
			const findOne = vi.fn().mockRejectedValue(new Error('AccessDenied: not allowed'));
			const mockApi = {
				global: vi.fn().mockReturnValue({ findOne }),
			};
			const config = makeConfig({ globals: [{ slug: 'site-settings' }] });
			registerSchemaResources(
				server as never,
				() => config,
				() => mockApi as unknown as MomentumAPI,
				allowAll,
				allowAll,
			);

			const callback = server.getResource('global-document');
			const result = (await callback?.(new URL('momentum://globals/site-settings'), {
				slug: 'site-settings',
			})) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(result.contents[0].mimeType).toBe('text/plain');
			expect(result.contents[0].text).toContain('AccessDenied');
		});

		it('should return identical message for unknown vs. denied globals (no enumeration)', async () => {
			// Production filter returns false for both unknown and denied slugs.
			// Responses must be identical so callers can't probe deniedGlobals to
			// learn which slugs correspond to real globals.
			const mockApi = { global: vi.fn() };

			const deniedConfig = makeConfig({ globals: [{ slug: 'site-secrets' }] });
			registerSchemaResources(
				server as never,
				() => deniedConfig,
				() => mockApi as unknown as MomentumAPI,
				allowAll,
				allowNone,
			);
			const deniedCb = server.getResource('global-document');
			const deniedResult = (await deniedCb?.(new URL('momentum://globals/site-secrets'), {
				slug: 'site-secrets',
			})) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			// Reset and re-register with empty config so the same slug is "unknown".
			server = makeMockServer();
			const unknownConfig = makeConfig();
			registerSchemaResources(
				server as never,
				() => unknownConfig,
				() => mockApi as unknown as MomentumAPI,
				allowAll,
				allowNone,
			);
			const unknownCb = server.getResource('global-document');
			const unknownResult = (await unknownCb?.(new URL('momentum://globals/site-secrets'), {
				slug: 'site-secrets',
			})) as {
				contents: Array<{ uri: string; mimeType: string; text: string }>;
			};

			expect(deniedResult.contents[0].text).toBe(unknownResult.contents[0].text);
			expect(mockApi.global).not.toHaveBeenCalled();
		});
	});
});
