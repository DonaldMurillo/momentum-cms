import { test, expect } from '../fixtures';

/**
 * OpenAPI / Swagger Documentation E2E Tests
 *
 * Tests that the auto-generated OpenAPI spec is served correctly
 * and contains the expected structure based on the configured collections.
 */

test.describe('OpenAPI Documentation', () => {
	test('GET /api/docs/openapi.json returns valid OpenAPI 3.0 spec', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		expect(response.ok()).toBe(true);

		const spec = await response.json();
		expect(spec.openapi).toBe('3.0.3');
		expect(spec.info).toBeDefined();
		expect(spec.info.title).toBeTruthy();
		expect(spec.info.version).toBeTruthy();
		expect(spec.paths).toBeDefined();
		expect(spec.components).toBeDefined();
		expect(spec.components.schemas).toBeDefined();
	});

	test('spec contains schemas for all configured collections', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		// The example-config has these static collections plus auth plugin collections.
		// Schema names use PascalCase: 'auth-user' → 'AuthUser', 'categories' → 'Categories'
		const expectedSchemas = [
			'Categories',
			'Articles',
			'Products',
			'Pages',
			'Settings',
			'Events',
			'Media',
			'AuthUser',
		];

		for (const schemaName of expectedSchemas) {
			expect(
				spec.components.schemas[schemaName],
				`Schema '${schemaName}' should be defined`,
			).toBeDefined();
			expect(
				spec.components.schemas[`${schemaName}Input`],
				`Schema '${schemaName}Input' should be defined`,
			).toBeDefined();
		}
	});

	test('spec contains CRUD paths for each collection', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		// Check articles collection has all standard CRUD paths
		expect(spec.paths['/articles']).toBeDefined();
		expect(spec.paths['/articles'].get).toBeDefined();
		expect(spec.paths['/articles'].post).toBeDefined();
		expect(spec.paths['/articles/{id}']).toBeDefined();
		expect(spec.paths['/articles/{id}'].get).toBeDefined();
		expect(spec.paths['/articles/{id}'].patch).toBeDefined();
		expect(spec.paths['/articles/{id}'].delete).toBeDefined();
	});

	test('spec contains search paths for collections', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		expect(spec.paths['/articles/search']).toBeDefined();
		expect(spec.paths['/articles/search'].get).toBeDefined();
		expect(spec.paths['/articles/search'].get.parameters).toBeDefined();

		const qParam = spec.paths['/articles/search'].get.parameters.find(
			(p: { name: string }) => p.name === 'q',
		);
		expect(qParam).toBeDefined();
		expect(qParam.required).toBe(true);
	});

	test('spec contains batch operation paths', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		expect(spec.paths['/articles/batch']).toBeDefined();
		expect(spec.paths['/articles/batch'].post).toBeDefined();
	});

	test('spec contains version paths for versioned collections', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		// Articles collection has versioning enabled
		expect(spec.paths['/articles/{id}/versions']).toBeDefined();
		expect(spec.paths['/articles/{id}/publish']).toBeDefined();
		expect(spec.paths['/articles/{id}/unpublish']).toBeDefined();
		expect(spec.paths['/articles/{id}/versions/restore']).toBeDefined();
	});

	test('spec contains media upload endpoints', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		expect(spec.paths['/media/upload']).toBeDefined();
		expect(spec.paths['/media/upload'].post).toBeDefined();
		expect(spec.paths['/media/file/{path}']).toBeDefined();
		expect(spec.paths['/media/file/{path}'].get).toBeDefined();
	});

	test('spec contains GraphQL endpoint', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		expect(spec.paths['/graphql']).toBeDefined();
		expect(spec.paths['/graphql'].post).toBeDefined();
	});

	test('spec contains access endpoint', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		expect(spec.paths['/access']).toBeDefined();
		expect(spec.paths['/access'].get).toBeDefined();
	});

	test('spec contains security schemes', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		expect(spec.components.securitySchemes).toBeDefined();
		expect(spec.components.securitySchemes.cookieAuth).toBeDefined();
		expect(spec.components.securitySchemes.apiKeyAuth).toBeDefined();
	});

	test('collection schemas have correct field types', async ({ request }) => {
		const response = await request.get('/api/docs/openapi.json');
		const spec = await response.json();

		// Articles schema should have text fields as strings
		const articlesSchema = spec.components.schemas['Articles'];
		expect(articlesSchema).toBeDefined();
		expect(articlesSchema.properties.title.type).toBe('string');
		expect(articlesSchema.properties.id.type).toBe('string');
		expect(articlesSchema.properties.createdAt.type).toBe('string');

		// Products schema should have number fields
		const productsSchema = spec.components.schemas['Products'];
		expect(productsSchema).toBeDefined();
		expect(productsSchema.properties.price.type).toBe('number');
	});

	test('GET /api/docs serves Swagger UI HTML', async ({ request }) => {
		const response = await request.get('/api/docs');
		expect(response.ok()).toBe(true);

		const html = await response.text();
		expect(html).toContain('swagger-ui');
		expect(html).toContain('openapi.json');
	});

	test('spec is cached (identical on second request)', async ({ request }) => {
		const response1 = await request.get('/api/docs/openapi.json');
		const spec1 = await response1.json();

		const response2 = await request.get('/api/docs/openapi.json');
		const spec2 = await response2.json();

		expect(JSON.stringify(spec1)).toBe(JSON.stringify(spec2));
	});
});
