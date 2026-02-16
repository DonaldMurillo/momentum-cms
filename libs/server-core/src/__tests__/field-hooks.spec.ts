import { describe, it, expect } from 'vitest';
import { text, number, group, array, blocks, tabs, collapsible, row } from '@momentumcms/core';
import type { Field, RequestContext } from '@momentumcms/core';
import { hasFieldHooks, runFieldHooks } from '../lib/field-hooks';

const req: RequestContext = { user: { id: '1', email: 'test@test.com', role: 'admin' } };

describe('field-hooks', () => {
	describe('hasFieldHooks', () => {
		it('should return false when no fields have hooks', () => {
			const fields: Field[] = [text('title'), number('count')];
			expect(hasFieldHooks(fields)).toBe(false);
		});

		it('should return true when any field has hooks', () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
					},
				}),
			];
			expect(hasFieldHooks(fields)).toBe(true);
		});
	});

	describe('runFieldHooks - beforeChange', () => {
		it('should transform field values', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
					},
				}),
			];
			const data = { title: '  Hello World  ' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('Hello World');
		});

		it('should chain multiple hooks on same field', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							({ value }) => (typeof value === 'string' ? value.trim() : value),
							({ value }) => (typeof value === 'string' ? value.toLowerCase() : value),
						],
					},
				}),
			];
			const data = { title: '  HELLO  ' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('hello');
		});

		it('should not modify fields without hooks', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							({ value }) => (typeof value === 'string' ? value.toUpperCase() : value),
						],
					},
				}),
				text('description'),
			];
			const data = { title: 'hello', description: 'world' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('HELLO');
			expect(result.description).toBe('world');
		});

		it('should skip hooks for different hook types', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						afterChange: [() => 'should not run'],
					},
				}),
			];
			const data = { title: 'hello' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('hello');
		});

		it('should handle async hooks', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							async ({ value }) => {
								return typeof value === 'string' ? value.toUpperCase() : value;
							},
						],
					},
				}),
			];
			const data = { title: 'hello' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('HELLO');
		});
	});

	describe('runFieldHooks - beforeValidate', () => {
		it('should run beforeValidate hooks', async () => {
			const fields: Field[] = [
				text('slug', {
					hooks: {
						beforeValidate: [
							({ value }) =>
								typeof value === 'string'
									? value
											.toLowerCase()
											.replace(/\s+/g, '-')
											.replace(/[^a-z0-9-]/g, '')
									: value,
						],
					},
				}),
			];
			const data = { slug: 'Hello World!' };

			const result = await runFieldHooks('beforeValidate', fields, data, req, 'create');
			expect(result.slug).toBe('hello-world');
		});
	});

	describe('runFieldHooks - afterRead', () => {
		it('should transform values on read', async () => {
			const fields: Field[] = [
				number('price', {
					hooks: {
						afterRead: [({ value }) => (typeof value === 'number' ? value / 100 : value)],
					},
				}),
			];
			const data = { price: 1999 };

			const result = await runFieldHooks('afterRead', fields, data, req, 'read');
			expect(result.price).toBe(19.99);
		});
	});

	describe('nested field hooks', () => {
		it('should run hooks on fields inside groups', async () => {
			const fields: Field[] = [
				group('seo', {
					fields: [
						text('metaTitle', {
							hooks: {
								beforeChange: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
							},
						}),
					],
				}),
			];
			const data = { seo: { metaTitle: '  padded  ' } };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			const seo = result.seo as Record<string, unknown>;
			expect(seo.metaTitle).toBe('padded');
		});

		it('should run hooks on fields inside array rows', async () => {
			const fields: Field[] = [
				array('items', {
					fields: [
						text('name', {
							hooks: {
								beforeChange: [
									({ value }) => (typeof value === 'string' ? value.toUpperCase() : value),
								],
							},
						}),
					],
				}),
			];
			const data = { items: [{ name: 'widget' }, { name: 'gadget' }] };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			const items = result.items as Record<string, unknown>[];
			expect(items[0].name).toBe('WIDGET');
			expect(items[1].name).toBe('GADGET');
		});
	});

	describe('hook receives correct args', () => {
		it('should pass operation to hook', async () => {
			let receivedOperation: string | undefined;
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							({ value, operation }) => {
								receivedOperation = operation;
								return value;
							},
						],
					},
				}),
			];

			await runFieldHooks('beforeChange', fields, { title: 'hi' }, req, 'update');
			expect(receivedOperation).toBe('update');
		});

		it('should pass current data to hook', async () => {
			let receivedData: Record<string, unknown> | undefined;
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							({ value, data }) => {
								receivedData = data;
								return value;
							},
						],
					},
				}),
			];
			const data = { title: 'hi', other: 'value' };

			await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(receivedData).toEqual(data);
		});

		it('should pass req to hook', async () => {
			let receivedReq: unknown;
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							({ value, req: hookReq }) => {
								receivedReq = hookReq;
								return value;
							},
						],
					},
				}),
			];

			await runFieldHooks('beforeChange', fields, { title: 'hi' }, req, 'create');
			expect(receivedReq).toBe(req);
		});
	});

	describe('runFieldHooks - afterChange', () => {
		it('should run afterChange hooks and transform values', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						afterChange: [({ value }) => (typeof value === 'string' ? `[saved] ${value}` : value)],
					},
				}),
			];
			const data = { title: 'hello' };

			const result = await runFieldHooks('afterChange', fields, data, req, 'create');
			expect(result.title).toBe('[saved] hello');
		});
	});

	describe('hook returning undefined', () => {
		it('should preserve previous value when hook returns undefined', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							() => {
								// Intentionally return undefined (no explicit return)
							},
						],
					},
				}),
			];
			const data = { title: 'original' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('original');
		});
	});

	describe('hook error propagation', () => {
		it('should propagate errors from throwing hooks', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							() => {
								throw new Error('Hook failed');
							},
						],
					},
				}),
			];
			const data = { title: 'hello' };

			await expect(runFieldHooks('beforeChange', fields, data, req, 'create')).rejects.toThrow(
				'Hook failed',
			);
		});

		it('should propagate errors from async throwing hooks', async () => {
			const fields: Field[] = [
				text('title', {
					hooks: {
						beforeChange: [
							async () => {
								throw new Error('Async hook failed');
							},
						],
					},
				}),
			];
			const data = { title: 'hello' };

			await expect(runFieldHooks('beforeChange', fields, data, req, 'create')).rejects.toThrow(
				'Async hook failed',
			);
		});
	});

	describe('hooks inside blocks fields', () => {
		it('should run hooks on fields inside blocks', async () => {
			const fields: Field[] = [
				blocks('content', {
					blocks: [
						{
							slug: 'textBlock',
							fields: [
								text('body', {
									hooks: {
										beforeChange: [
											({ value }) => (typeof value === 'string' ? value.toUpperCase() : value),
										],
									},
								}),
							],
						},
					],
				}),
			];
			const data = {
				content: [
					{ blockType: 'textBlock', body: 'hello' },
					{ blockType: 'textBlock', body: 'world' },
				],
			};

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			const content = result.content as Record<string, unknown>[];
			expect(content[0].body).toBe('HELLO');
			expect(content[1].body).toBe('WORLD');
		});

		it('should detect hooks inside blocks for hasFieldHooks', () => {
			const fields: Field[] = [
				blocks('content', {
					blocks: [
						{
							slug: 'textBlock',
							fields: [
								text('body', {
									hooks: { beforeChange: [({ value }) => value] },
								}),
							],
						},
					],
				}),
			];
			expect(hasFieldHooks(fields)).toBe(true);
		});
	});

	describe('hooks inside layout fields', () => {
		it('should run hooks on fields inside tabs', async () => {
			const fields: Field[] = [
				tabs('layout', {
					tabs: [
						{
							label: 'Main',
							fields: [
								text('title', {
									hooks: {
										beforeChange: [
											({ value }) => (typeof value === 'string' ? value.trim() : value),
										],
									},
								}),
							],
						},
					],
				}),
			];
			const data = { title: '  padded  ' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.title).toBe('padded');
		});

		it('should run hooks on fields inside collapsible', async () => {
			const fields: Field[] = [
				collapsible('section', {
					fields: [
						text('name', {
							hooks: {
								beforeChange: [
									({ value }) => (typeof value === 'string' ? value.toLowerCase() : value),
								],
							},
						}),
					],
				}),
			];
			const data = { name: 'LOUD' };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.name).toBe('loud');
		});

		it('should run hooks on fields inside row', async () => {
			const fields: Field[] = [
				row('details', {
					fields: [
						number('price', {
							hooks: {
								beforeChange: [
									({ value }) =>
										typeof value === 'number' ? Math.round(value * 100) / 100 : value,
								],
							},
						}),
					],
				}),
			];
			const data = { price: 9.999 };

			const result = await runFieldHooks('beforeChange', fields, data, req, 'create');
			expect(result.price).toBe(10);
		});

		it('should detect hooks inside tabs for hasFieldHooks', () => {
			const fields: Field[] = [
				tabs('layout', {
					tabs: [
						{
							label: 'Main',
							fields: [
								text('title', {
									hooks: { beforeChange: [({ value }) => value] },
								}),
							],
						},
					],
				}),
			];
			expect(hasFieldHooks(fields)).toBe(true);
		});

		it('should detect hooks inside collapsible for hasFieldHooks', () => {
			const fields: Field[] = [
				collapsible('section', {
					fields: [
						text('name', {
							hooks: { afterRead: [({ value }) => value] },
						}),
					],
				}),
			];
			expect(hasFieldHooks(fields)).toBe(true);
		});
	});
});
