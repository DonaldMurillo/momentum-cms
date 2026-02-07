import { describe, it, expect } from 'vitest';
import { text, number, group, array, blocks, tabs, collapsible, row } from '@momentum-cms/core';
import type { Field, RequestContext } from '@momentum-cms/core';
import {
	hasFieldAccessControl,
	filterReadableFields,
	filterCreatableFields,
	filterUpdatableFields,
} from '../lib/field-access';

const adminUser: RequestContext = { user: { id: '1', email: 'admin@test.com', role: 'admin' } };
const regularUser: RequestContext = { user: { id: '2', email: 'user@test.com', role: 'user' } };
const noUser: RequestContext = { user: undefined };

describe('field-access', () => {
	describe('hasFieldAccessControl', () => {
		it('should return false when no fields have access config', () => {
			const fields: Field[] = [text('title'), number('count')];
			expect(hasFieldAccessControl(fields)).toBe(false);
		});

		it('should return true when any field has access config', () => {
			const fields: Field[] = [
				text('title'),
				text('secret', {
					access: { read: ({ req }) => (req as RequestContext).user?.role === 'admin' },
				}),
			];
			expect(hasFieldAccessControl(fields)).toBe(true);
		});
	});

	describe('filterReadableFields', () => {
		it('should keep all fields when no access control', () => {
			const fields: Field[] = [text('title'), number('count')];
			const doc = { id: '1', title: 'Hello', count: 5 };

			return filterReadableFields(fields, doc, adminUser).then((result) => {
				expect(result).toEqual(doc);
			});
		});

		it('should remove fields the user cannot read', () => {
			const fields: Field[] = [
				text('title'),
				text('secret', {
					access: { read: ({ req }) => (req as RequestContext).user?.role === 'admin' },
				}),
			];
			const doc = { id: '1', title: 'Hello', secret: 'classified' };

			return filterReadableFields(fields, doc, regularUser).then((result) => {
				expect(result).toEqual({ id: '1', title: 'Hello' });
			});
		});

		it('should keep fields when user has read access', () => {
			const fields: Field[] = [
				text('title'),
				text('secret', {
					access: { read: ({ req }) => (req as RequestContext).user?.role === 'admin' },
				}),
			];
			const doc = { id: '1', title: 'Hello', secret: 'classified' };

			return filterReadableFields(fields, doc, adminUser).then((result) => {
				expect(result).toEqual(doc);
			});
		});

		it('should handle async access functions', () => {
			const fields: Field[] = [
				text('secret', {
					access: { read: async () => false },
				}),
			];
			const doc = { id: '1', secret: 'classified' };

			return filterReadableFields(fields, doc, noUser).then((result) => {
				expect(result).toEqual({ id: '1' });
			});
		});
	});

	describe('filterCreatableFields', () => {
		it('should remove fields the user cannot create', () => {
			const fields: Field[] = [
				text('title'),
				text('adminOnly', {
					access: { create: ({ req }) => (req as RequestContext).user?.role === 'admin' },
				}),
			];
			const data = { title: 'Hello', adminOnly: 'value' };

			return filterCreatableFields(fields, data, regularUser).then((result) => {
				expect(result).toEqual({ title: 'Hello' });
			});
		});

		it('should keep fields when user has create access', () => {
			const fields: Field[] = [
				text('title'),
				text('adminOnly', {
					access: { create: ({ req }) => (req as RequestContext).user?.role === 'admin' },
				}),
			];
			const data = { title: 'Hello', adminOnly: 'value' };

			return filterCreatableFields(fields, data, adminUser).then((result) => {
				expect(result).toEqual(data);
			});
		});
	});

	describe('filterUpdatableFields', () => {
		it('should remove fields the user cannot update', () => {
			const fields: Field[] = [
				text('title'),
				text('readOnlyField', {
					access: { update: () => false },
				}),
			];
			const data = { title: 'Updated', readOnlyField: 'changed' };

			return filterUpdatableFields(fields, data, regularUser).then((result) => {
				expect(result).toEqual({ title: 'Updated' });
			});
		});
	});

	describe('nested field access (group)', () => {
		it('should filter fields inside groups', () => {
			const fields: Field[] = [
				group('seo', {
					fields: [
						text('metaTitle'),
						text('internalNotes', {
							access: { read: ({ req }) => (req as RequestContext).user?.role === 'admin' },
						}),
					],
				}),
			];
			const doc = { id: '1', seo: { metaTitle: 'Hello', internalNotes: 'secret' } };

			return filterReadableFields(fields, doc, regularUser).then((result) => {
				expect(result).toEqual({ id: '1', seo: { metaTitle: 'Hello' } });
			});
		});
	});

	describe('nested field access (array)', () => {
		it('should filter fields inside array rows', () => {
			const fields: Field[] = [
				array('items', {
					fields: [
						text('name'),
						number('cost', {
							access: { read: ({ req }) => (req as RequestContext).user?.role === 'admin' },
						}),
					],
				}),
			];
			const doc = {
				id: '1',
				items: [
					{ name: 'Widget', cost: 10 },
					{ name: 'Gadget', cost: 20 },
				],
			};

			return filterReadableFields(fields, doc, regularUser).then((result) => {
				expect(result).toEqual({
					id: '1',
					items: [{ name: 'Widget' }, { name: 'Gadget' }],
				});
			});
		});
	});

	describe('filterUpdatableFields - positive case', () => {
		it('should keep fields when user has update access', () => {
			const fields: Field[] = [
				text('title'),
				text('adminField', {
					access: { update: ({ req }) => (req as RequestContext).user?.role === 'admin' },
				}),
			];
			const data = { title: 'Updated', adminField: 'changed' };

			return filterUpdatableFields(fields, data, adminUser).then((result) => {
				expect(result).toEqual(data);
			});
		});
	});

	describe('hasFieldAccessControl with layout and blocks fields', () => {
		it('should detect access control inside blocks', () => {
			const fields: Field[] = [
				blocks('content', {
					blocks: [
						{
							slug: 'textBlock',
							fields: [
								text('body', {
									access: { read: () => false },
								}),
							],
						},
					],
				}),
			];
			expect(hasFieldAccessControl(fields)).toBe(true);
		});

		it('should detect access control inside tabs', () => {
			const fields: Field[] = [
				tabs('layout', {
					tabs: [
						{
							label: 'Main',
							fields: [
								text('secret', {
									access: { read: () => false },
								}),
							],
						},
					],
				}),
			];
			expect(hasFieldAccessControl(fields)).toBe(true);
		});

		it('should detect access control inside collapsible', () => {
			const fields: Field[] = [
				collapsible('section', {
					fields: [
						text('internal', {
							access: { update: () => false },
						}),
					],
				}),
			];
			expect(hasFieldAccessControl(fields)).toBe(true);
		});

		it('should detect access control inside row', () => {
			const fields: Field[] = [
				row('details', {
					fields: [
						number('cost', {
							access: { create: () => false },
						}),
					],
				}),
			];
			expect(hasFieldAccessControl(fields)).toBe(true);
		});

		it('should return false when blocks/layout have no access control', () => {
			const fields: Field[] = [
				blocks('content', {
					blocks: [{ slug: 'textBlock', fields: [text('body')] }],
				}),
				tabs('layout', {
					tabs: [{ label: 'Main', fields: [text('title')] }],
				}),
			];
			expect(hasFieldAccessControl(fields)).toBe(false);
		});
	});

	describe('access function error propagation', () => {
		it('should propagate errors from throwing access functions', () => {
			const fields: Field[] = [
				text('title'),
				text('broken', {
					access: {
						read: () => {
							throw new Error('Access check failed');
						},
					},
				}),
			];
			const doc = { id: '1', title: 'Hello', broken: 'value' };

			return expect(
				filterReadableFields(fields, doc, regularUser),
			).rejects.toThrow('Access check failed');
		});
	});
});
