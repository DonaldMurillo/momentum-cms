import { describe, it, expect } from 'vitest';
import { RedirectsCollection } from '../redirects-collection';

describe('RedirectsCollection', () => {
	it('should have slug "redirects"', () => {
		expect(RedirectsCollection.slug).toBe('redirects');
	});

	it('should have from, to, type, active fields', () => {
		const fieldNames = RedirectsCollection.fields.map((f) => f.name);
		expect(fieldNames).toEqual(['from', 'to', 'type', 'active']);
	});

	it('should have "from" as text, required', () => {
		const from = RedirectsCollection.fields.find((f) => f.name === 'from');
		expect(from?.type).toBe('text');
		expect(from?.required).toBe(true);
	});

	it('should have "to" as text, required', () => {
		const to = RedirectsCollection.fields.find((f) => f.name === 'to');
		expect(to?.type).toBe('text');
		expect(to?.required).toBe(true);
	});

	it('should have "type" as select with redirect status codes', () => {
		const type = RedirectsCollection.fields.find((f) => f.name === 'type');
		expect(type?.type).toBe('select');
		const options = (type as { options?: { value: string }[] }).options ?? [];
		const values = options.map((o) => o.value);
		expect(values).toContain('permanent');
		expect(values).toContain('temporary');
		expect(values).toContain('temporary_preserve');
		expect(values).toContain('permanent_preserve');
	});

	it('should default type to permanent (301)', () => {
		const type = RedirectsCollection.fields.find((f) => f.name === 'type');
		expect(type?.defaultValue).toBe('permanent');
	});

	it('should have "active" as checkbox, defaulting to true', () => {
		const active = RedirectsCollection.fields.find((f) => f.name === 'active');
		expect(active?.type).toBe('checkbox');
		expect(active?.defaultValue).toBe(true);
	});

	it('should have a unique index on "from"', () => {
		const fromIndex = RedirectsCollection.indexes?.find((i) => i.columns.includes('from'));
		expect(fromIndex).toBeDefined();
		expect(fromIndex?.unique).toBe(true);
	});

	it('should allow public read access', () => {
		const result = RedirectsCollection.access?.read?.({ req: {} });
		expect(result).toBe(true);
	});

	it('should restrict create/update/delete to admin role', () => {
		const adminReq = { user: { id: '1', role: 'admin' } };
		const userReq = { user: { id: '2', role: 'user' } };

		expect(RedirectsCollection.access?.create?.({ req: adminReq })).toBe(true);
		expect(RedirectsCollection.access?.update?.({ req: adminReq })).toBe(true);
		expect(RedirectsCollection.access?.delete?.({ req: adminReq })).toBe(true);

		expect(RedirectsCollection.access?.create?.({ req: userReq })).toBe(false);
		expect(RedirectsCollection.access?.update?.({ req: userReq })).toBe(false);
		expect(RedirectsCollection.access?.delete?.({ req: userReq })).toBe(false);
	});

	it('should have admin config with useAsTitle "from" and group "Settings"', () => {
		expect(RedirectsCollection.admin?.useAsTitle).toBe('from');
		expect(RedirectsCollection.admin?.group).toBe('Settings');
	});
});
