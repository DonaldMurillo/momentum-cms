import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerContentPrompts } from '../prompts/content-prompts';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';

type PromptCallback = (args: Record<string, string>) => unknown;

function makeMockServer() {
	const prompts = new Map<string, PromptCallback>();
	return {
		registerPrompt: vi.fn((name: string, _opts: unknown, callback: PromptCallback) => {
			prompts.set(name, callback);
		}),
		getPrompt(name: string): PromptCallback | undefined {
			return prompts.get(name);
		},
	};
}

function makeConfig(collections: Partial<CollectionConfig>[] = []): MomentumConfig {
	return {
		collections: collections.map((c) => ({
			slug: c.slug ?? 'test',
			fields: c.fields ?? [],
			...c,
		})),
		globals: [],
	} as unknown as MomentumConfig;
}

describe('registerContentPrompts', () => {
	let server: ReturnType<typeof makeMockServer>;

	beforeEach(() => {
		server = makeMockServer();
	});

	it('should register create_content and translate_content prompts', () => {
		registerContentPrompts(
			server as never,
			() => makeConfig(),
			() => null,
			() => true,
		);
		expect(server.registerPrompt).toHaveBeenCalledTimes(2);
		expect(server.registerPrompt.mock.calls[0][0]).toBe('create_content');
		expect(server.registerPrompt.mock.calls[1][0]).toBe('translate_content');
	});

	describe('create_content', () => {
		it('should return schema-based prompt for a valid collection', () => {
			const config = makeConfig([
				{
					slug: 'posts',
					fields: [
						{ name: 'title', type: 'text', required: true },
						{ name: 'body', type: 'richText' },
					],
				},
			]);
			registerContentPrompts(
				server as never,
				() => config,
				() => null,
				() => true,
			);

			const callback = server.getPrompt('create_content');
			const result = callback?.({ collection: 'posts', topic: 'AI', tone: 'casual' }) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages).toHaveLength(1);
			expect(result.messages[0].role).toBe('user');
			const text = result.messages[0].content.text;
			expect(text).toContain('posts');
			expect(text).toContain('AI');
			expect(text).toContain('casual');
			expect(text).toContain('title');
			expect(text).toContain('create_document');
		});

		it('should return error message for denied collection', () => {
			const config = makeConfig([{ slug: 'posts', fields: [] }]);
			registerContentPrompts(
				server as never,
				() => config,
				() => null,
				() => false,
			);

			const callback = server.getPrompt('create_content');
			const result = callback?.({ collection: 'posts' }) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages[0].content.text).toContain('not accessible');
		});

		it('should return error message for unknown collection', () => {
			const config = makeConfig([]);
			registerContentPrompts(
				server as never,
				() => config,
				() => null,
				() => true,
			);

			const callback = server.getPrompt('create_content');
			const result = callback?.({ collection: 'nonexistent' }) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages[0].content.text).toContain('not found');
		});
	});

	describe('translate_content', () => {
		it('should fetch document and include it in translation prompt', async () => {
			const mockApi = {
				collection: vi.fn().mockReturnValue({
					findById: vi
						.fn()
						.mockResolvedValue({ id: '1', title: 'Hello World', body: 'Test content' }),
				}),
			};
			const config = makeConfig([{ slug: 'posts', fields: [] }]);
			registerContentPrompts(
				server as never,
				() => config,
				() => mockApi as unknown as MomentumAPI,
				() => true,
			);

			const callback = server.getPrompt('translate_content');
			const result = (await callback?.({
				collection: 'posts',
				id: '1',
				targetLanguage: 'Spanish',
			})) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages).toHaveLength(1);
			const text = result.messages[0].content.text;
			expect(text).toContain('Spanish');
			expect(text).toContain('Hello World');
			expect(text).toContain('posts');
		});

		it('should return error when API is not ready', async () => {
			registerContentPrompts(
				server as never,
				() => makeConfig(),
				() => null,
				() => true,
			);

			const callback = server.getPrompt('translate_content');
			const result = (await callback?.({
				collection: 'posts',
				id: '1',
				targetLanguage: 'French',
			})) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages[0].content.text).toContain('API not ready');
		});

		it('should return error for denied collection', async () => {
			const mockApi = { collection: vi.fn() };
			registerContentPrompts(
				server as never,
				() => makeConfig(),
				() => mockApi as unknown as MomentumAPI,
				() => false,
			);

			const callback = server.getPrompt('translate_content');
			const result = (await callback?.({
				collection: 'posts',
				id: '1',
				targetLanguage: 'French',
			})) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages[0].content.text).toContain('not accessible');
		});

		it('should handle API errors when fetching document', async () => {
			const mockApi = {
				collection: vi.fn().mockReturnValue({
					findById: vi.fn().mockRejectedValue(new Error('Document not found')),
				}),
			};
			registerContentPrompts(
				server as never,
				() => makeConfig([{ slug: 'posts', fields: [] }]),
				() => mockApi as unknown as MomentumAPI,
				() => true,
			);

			const callback = server.getPrompt('translate_content');
			const result = (await callback?.({
				collection: 'posts',
				id: '999',
				targetLanguage: 'French',
			})) as {
				messages: Array<{ role: string; content: { type: string; text: string } }>;
			};

			expect(result.messages[0].content.text).toContain('Document not found');
		});
	});
});
