import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	handleFindDocuments,
	handleGetDocument,
	handleCreateDocument,
	handleUpdateDocument,
	handleDeleteDocument,
	handleSearchDocuments,
	handleCountDocuments,
} from '../tools/collection-tools';

function makeCollectionOps() {
	return {
		find: vi.fn().mockResolvedValue({
			docs: [{ id: '1', title: 'Hello' }],
			totalDocs: 1,
			totalPages: 1,
			page: 1,
			limit: 10,
			hasNextPage: false,
			hasPrevPage: false,
		}),
		findById: vi.fn().mockResolvedValue({ id: '1', title: 'Hello' }),
		create: vi
			.fn()
			.mockImplementation((data: Record<string, unknown>) =>
				Promise.resolve({ id: 'new-1', ...data }),
			),
		update: vi
			.fn()
			.mockImplementation((id: string, data: Record<string, unknown>) =>
				Promise.resolve({ id, ...data }),
			),
		delete: vi.fn().mockImplementation((id: string) => Promise.resolve({ id, deleted: true })),
		search: vi.fn().mockResolvedValue({
			docs: [{ id: '1', title: 'Hello' }],
			totalDocs: 1,
		}),
		count: vi.fn().mockResolvedValue(42),
	};
}

function makeMockApi(expectedSlug = 'posts') {
	const ops = makeCollectionOps();
	return {
		ops,
		collection: vi.fn().mockImplementation((slug: string) => {
			if (slug !== expectedSlug)
				throw new Error(`Unexpected collection slug: "${slug}" (expected "${expectedSlug}")`);
			return ops;
		}),
	};
}

const allowAll = () => true;
const allowNone = () => false;

describe('handleFindDocuments', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should find documents and return valid JSON result', async () => {
		const result = await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		expect(result.content[0].type).toBe('text');
		expect(api.collection).toHaveBeenCalledWith('posts');
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.docs).toHaveLength(1);
		expect(parsed.docs[0]).toEqual({ id: '1', title: 'Hello' });
		expect(parsed.totalDocs).toBe(1);
	});

	it('should use default values for limit, page, and depth when not provided', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
			},
			allowAll,
		);
		expect(api.collection).toHaveBeenCalledWith('posts');
		expect(api.ops.find).toHaveBeenCalledWith({
			where: undefined,
			sort: undefined,
			limit: 10,
			page: 1,
			depth: 0,
		});
	});

	it('should pass query options to the API', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				where: '{"status":{"equals":"published"}}',
				sort: '-createdAt',
				limit: 5,
				page: 2,
				depth: 1,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith({
			where: { status: { equals: 'published' } },
			sort: '-createdAt',
			limit: 5,
			page: 2,
			depth: 1,
		});
	});

	it('should clamp limit to 100', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				limit: 500,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
	});

	it('should preserve explicit depth: 0 instead of bumping it to 1', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				depth: 0,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ depth: 0 }));
	});

	it('should clamp negative depth to 0 (depth has min=0)', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				depth: -5,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ depth: 0 }));
	});

	it('should clamp limit below 1 up to 1 (limit has min=1)', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				limit: 0,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
	});

	it('should clamp page below 1 up to 1 (page has min=1)', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				page: 0,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
	});

	it('should clamp negative page to 1', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				page: -10,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
	});

	it('should clamp page to 100_000 upper bound', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				page: 1_000_000,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ page: 100_000 }));
	});

	it('should fall back to default page=1 when page is NaN', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				page: Number.NaN,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
	});

	it('should fall back to default limit=10 when limit is Infinity (non-finite)', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				limit: Number.POSITIVE_INFINITY,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
	});

	it('should clamp depth to 3', async () => {
		await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				depth: 10,
			},
			allowAll,
		);
		expect(api.ops.find).toHaveBeenCalledWith(expect.objectContaining({ depth: 3 }));
	});

	it('should return error for denied collection', async () => {
		const result = await handleFindDocuments(
			api as never,
			{
				collection: 'secrets',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('not accessible');
	});

	it('should return error for invalid where JSON', async () => {
		const result = await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				where: 'not-json',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Invalid JSON');
	});

	it.each([
		['a string', '"oops"'],
		['a number', '42'],
		['an array', '[1,2,3]'],
		['null', 'null'],
	])('should reject where that parses to %s without invoking the API', async (_label, raw) => {
		const result = await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
				where: raw,
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/object/i);
		expect(api.ops.find).not.toHaveBeenCalled();
	});

	it('should catch and return API errors', async () => {
		api.ops.find.mockRejectedValue(new Error('DB error'));
		const result = await handleFindDocuments(
			api as never,
			{
				collection: 'posts',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('DB error');
	});
});

describe('handleGetDocument', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should get a document by ID and return parsed content', async () => {
		const result = await handleGetDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		expect(api.collection).toHaveBeenCalledWith('posts');
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toEqual({ id: '1', title: 'Hello' });
		expect(api.ops.findById).toHaveBeenCalledWith('1', { depth: 0 });
	});

	it('should pass depth option', async () => {
		await handleGetDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
				depth: 2,
			},
			allowAll,
		);
		expect(api.ops.findById).toHaveBeenCalledWith('1', { depth: 2 });
	});

	it('should return error for denied collection', async () => {
		const result = await handleGetDocument(
			api as never,
			{
				collection: 'secrets',
				id: '1',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
	});

	it('should catch and return API errors', async () => {
		api.ops.findById.mockRejectedValue(new Error('Not found'));
		const result = await handleGetDocument(
			api as never,
			{
				collection: 'posts',
				id: '999',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Not found');
	});
});

describe('handleCreateDocument', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should create a document and return the result with echoed input', async () => {
		const result = await handleCreateDocument(
			api as never,
			{
				collection: 'posts',
				data: '{"title":"New Post"}',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		expect(api.collection).toHaveBeenCalledWith('posts');
		expect(api.ops.create).toHaveBeenCalledWith({ title: 'New Post' });
		const parsed = JSON.parse(result.content[0].text);
		// Mock echoes input, so title should match what was sent
		expect(parsed.id).toBe('new-1');
		expect(parsed.title).toBe('New Post');
	});

	it('should return error for invalid data JSON', async () => {
		const result = await handleCreateDocument(
			api as never,
			{
				collection: 'posts',
				data: 'bad-json',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Invalid JSON');
	});

	it('should return error for empty data string', async () => {
		const result = await handleCreateDocument(
			api as never,
			{
				collection: 'posts',
				data: '',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/object/i);
	});

	it.each([
		['a string', '"oops"'],
		['a number', '42'],
		['an array', '[{"title":"x"}]'],
		['null', 'null'],
	])('should reject data that parses to %s without invoking create()', async (_label, raw) => {
		const result = await handleCreateDocument(
			api as never,
			{
				collection: 'posts',
				data: raw,
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/object/i);
		expect(api.ops.create).not.toHaveBeenCalled();
	});

	it('should return error for denied collection', async () => {
		const result = await handleCreateDocument(
			api as never,
			{
				collection: 'secrets',
				data: '{}',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
	});

	it('should catch and return API errors', async () => {
		api.ops.create.mockRejectedValue(new Error('Validation failed'));
		const result = await handleCreateDocument(
			api as never,
			{
				collection: 'posts',
				data: '{"title":"Bad"}',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Validation failed');
	});
});

describe('handleUpdateDocument', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should update a document and return the result with echoed input', async () => {
		const result = await handleUpdateDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
				data: '{"title":"Updated Title"}',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		expect(api.collection).toHaveBeenCalledWith('posts');
		expect(api.ops.update).toHaveBeenCalledWith('1', { title: 'Updated Title' });
		const parsed = JSON.parse(result.content[0].text);
		// Mock echoes id + input data, verifying data flows through
		expect(parsed.id).toBe('1');
		expect(parsed.title).toBe('Updated Title');
	});

	it('should return error for invalid data JSON', async () => {
		const result = await handleUpdateDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
				data: 'bad',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
	});

	it.each([
		['a string', '"oops"'],
		['a number', '42'],
		['an array', '[1,2,3]'],
		['null', 'null'],
	])('should reject data that parses to %s without invoking update()', async (_label, raw) => {
		const result = await handleUpdateDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
				data: raw,
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/object/i);
		expect(api.ops.update).not.toHaveBeenCalled();
	});

	it('should return error for denied collection', async () => {
		const result = await handleUpdateDocument(
			api as never,
			{
				collection: 'secrets',
				id: '1',
				data: '{}',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('not accessible');
	});

	it('should catch and return API errors', async () => {
		api.ops.update.mockRejectedValue(new Error('Conflict'));
		const result = await handleUpdateDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
				data: '{"title":"X"}',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Conflict');
	});
});

describe('handleDeleteDocument', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should delete a document and return the result with echoed id', async () => {
		const result = await handleDeleteDocument(
			api as never,
			{
				collection: 'posts',
				id: 'doc-42',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		expect(api.collection).toHaveBeenCalledWith('posts');
		expect(api.ops.delete).toHaveBeenCalledWith('doc-42');
		const parsed = JSON.parse(result.content[0].text);
		// Mock echoes the id back, verifying the correct id was passed
		expect(parsed.id).toBe('doc-42');
		expect(parsed.deleted).toBe(true);
	});

	it('should return error for denied collection', async () => {
		const result = await handleDeleteDocument(
			api as never,
			{
				collection: 'secrets',
				id: '1',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
	});

	it('should catch and return API errors', async () => {
		api.ops.delete.mockRejectedValue(new Error('Cannot delete'));
		const result = await handleDeleteDocument(
			api as never,
			{
				collection: 'posts',
				id: '1',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Cannot delete');
	});
});

describe('handleSearchDocuments', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should search documents and return parsed content', async () => {
		const result = await handleSearchDocuments(
			api as never,
			{
				collection: 'posts',
				query: 'hello',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		expect(api.collection).toHaveBeenCalledWith('posts');
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.docs).toHaveLength(1);
		expect(parsed.docs[0]).toEqual({ id: '1', title: 'Hello' });
		expect(api.ops.search).toHaveBeenCalledWith('hello', {
			limit: 10,
			page: 1,
		});
	});

	it('should clamp limit to 100', async () => {
		await handleSearchDocuments(
			api as never,
			{
				collection: 'posts',
				query: 'hello',
				limit: 500,
			},
			allowAll,
		);
		expect(api.ops.search).toHaveBeenCalledWith('hello', {
			limit: 100,
			page: 1,
		});
	});

	it('should clamp page below 1 up to 1', async () => {
		await handleSearchDocuments(
			api as never,
			{
				collection: 'posts',
				query: 'hello',
				page: -3,
			},
			allowAll,
		);
		expect(api.ops.search).toHaveBeenCalledWith('hello', expect.objectContaining({ page: 1 }));
	});

	it('should fall back to default page=1 when page is NaN', async () => {
		await handleSearchDocuments(
			api as never,
			{
				collection: 'posts',
				query: 'hello',
				page: Number.NaN,
			},
			allowAll,
		);
		expect(api.ops.search).toHaveBeenCalledWith('hello', expect.objectContaining({ page: 1 }));
	});

	it('should return error for denied collection', async () => {
		const result = await handleSearchDocuments(
			api as never,
			{
				collection: 'secrets',
				query: 'hello',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('not accessible');
	});

	it('should catch and return API errors', async () => {
		api.ops.search.mockRejectedValue(new Error('Search unavailable'));
		const result = await handleSearchDocuments(
			api as never,
			{
				collection: 'posts',
				query: 'hello',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Search unavailable');
	});
});

describe('handleCountDocuments', () => {
	let api: ReturnType<typeof makeMockApi>;

	beforeEach(() => {
		api = makeMockApi();
	});

	it('should count documents and return parsed count', async () => {
		const result = await handleCountDocuments(
			api as never,
			{
				collection: 'posts',
			},
			allowAll,
		);
		expect(result.isError).toBeUndefined();
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.count).toBe(42);
	});

	it('should pass where clause', async () => {
		await handleCountDocuments(
			api as never,
			{
				collection: 'posts',
				where: '{"status":{"equals":"published"}}',
			},
			allowAll,
		);
		expect(api.collection).toHaveBeenCalledWith('posts');
		expect(api.ops.count).toHaveBeenCalledWith({ status: { equals: 'published' } });
	});

	it('should return error for invalid where JSON', async () => {
		const result = await handleCountDocuments(
			api as never,
			{
				collection: 'posts',
				where: 'bad',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
	});

	it.each([
		['a string', '"oops"'],
		['a number', '42'],
		['an array', '[1,2]'],
		['null', 'null'],
	])('should reject where that parses to %s without invoking count()', async (_label, raw) => {
		const result = await handleCountDocuments(
			api as never,
			{
				collection: 'posts',
				where: raw,
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/object/i);
		expect(api.ops.count).not.toHaveBeenCalled();
	});

	it('should return error for denied collection', async () => {
		const result = await handleCountDocuments(
			api as never,
			{
				collection: 'secrets',
			},
			allowNone,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('not accessible');
	});

	it('should catch and return API errors', async () => {
		api.ops.count.mockRejectedValue(new Error('DB timeout'));
		const result = await handleCountDocuments(
			api as never,
			{
				collection: 'posts',
			},
			allowAll,
		);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('DB timeout');
	});
});
