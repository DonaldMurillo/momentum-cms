import { test, expect, TEST_AUTHOR3_CREDENTIALS } from '../fixtures';

/**
 * GraphQL API E2E tests.
 * Verifies the auto-generated GraphQL schema, queries, and mutations
 * at the POST /api/graphql endpoint.
 */
test.describe('GraphQL API', { tag: ['@graphql', '@api'] }, () => {
	const createdIds: string[] = [];

	test.beforeAll(async ({ request }) => {
		// Sign in
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author3 sign-in must succeed').toBe(true);
	});

	test.afterAll(async ({ request }) => {
		// Sign in for cleanup
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});

		// Clean up via REST
		for (const id of createdIds) {
			await request.delete(`/api/categories/${id}`);
		}
	});

	test('introspection returns schema with collection types', async ({ request }) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `{
					__schema {
						queryType { name }
						mutationType { name }
						types { name }
					}
				}`,
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				__schema: {
					queryType: { name: string };
					mutationType: { name: string } | null;
					types: Array<{ name: string }>;
				};
			};
		};

		expect(data.data.__schema.queryType.name).toBe('Query');
		expect(data.data.__schema.mutationType?.name).toBe('Mutation');

		// Should have types for collections (Article, Category, etc.)
		const typeNames = data.data.__schema.types.map((t) => t.name);
		expect(typeNames).toContain('Article');
		expect(typeNames).toContain('Category');
	});

	test('query collection list returns documents', async ({ request }) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `{
					categories(limit: 5) {
						docs {
							id
							name
							slug
						}
						totalDocs
					}
				}`,
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				categories: {
					docs: Array<{ id: string; name: string; slug: string }>;
					totalDocs: number;
				};
			};
		};

		expect(data.data.categories).toBeDefined();
		expect(data.data.categories.docs).toBeInstanceOf(Array);
		expect(typeof data.data.categories.totalDocs).toBe('number');
	});

	test('create mutation creates a document', async ({ request }) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation CreateCategory($data: CategoryInput!) {
					createCategory(data: $data) {
						id
						name
						slug
					}
				}`,
				variables: {
					data: {
						name: 'GQL-Test Category',
						slug: 'gql-test-category',
					},
				},
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				createCategory: { id: string; name: string; slug: string };
			};
		};

		expect(data.data.createCategory.name).toBe('GQL-Test Category');
		expect(data.data.createCategory.slug).toBe('gql-test-category');
		expect(data.data.createCategory.id).toBeDefined();

		createdIds.push(data.data.createCategory.id);
	});

	test('query single document by ID', async ({ request }) => {
		// Create a document first
		const createResponse = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation { createCategory(data: { name: "GQL-FindById Test", slug: "gql-findbyid" }) { id } }`,
			},
		});
		expect(createResponse.ok()).toBe(true);

		const created = (await createResponse.json()) as {
			data: { createCategory: { id: string } };
		};
		const id = created.data.createCategory.id;
		createdIds.push(id);

		// Query by ID
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `query GetCategory($id: ID!) {
					category(id: $id) {
						id
						name
						slug
					}
				}`,
				variables: { id },
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				category: { id: string; name: string; slug: string };
			};
		};

		expect(data.data.category.id).toBe(id);
		expect(data.data.category.name).toBe('GQL-FindById Test');
	});

	test('update mutation modifies a document', async ({ request }) => {
		// Create first
		const createResponse = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation { createCategory(data: { name: "GQL-Update Original", slug: "gql-update" }) { id } }`,
			},
		});

		const created = (await createResponse.json()) as {
			data: { createCategory: { id: string } };
		};
		const id = created.data.createCategory.id;
		createdIds.push(id);

		// Update
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation UpdateCategory($id: ID!, $data: CategoryInput!) {
					updateCategory(id: $id, data: $data) {
						id
						name
						slug
					}
				}`,
				variables: {
					id,
					data: { name: 'GQL-Update Modified' },
				},
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				updateCategory: { id: string; name: string; slug: string };
			};
		};

		expect(data.data.updateCategory.name).toBe('GQL-Update Modified');
		// Slug should be unchanged
		expect(data.data.updateCategory.slug).toBe('gql-update');
	});

	test('delete mutation removes a document', async ({ request }) => {
		// Create first
		const createResponse = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation { createCategory(data: { name: "GQL-Delete Me", slug: "gql-delete" }) { id } }`,
			},
		});

		const created = (await createResponse.json()) as {
			data: { createCategory: { id: string } };
		};
		const id = created.data.createCategory.id;

		// Delete
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation DeleteCategory($id: ID!) {
					deleteCategory(id: $id) {
						id
						deleted
					}
				}`,
				variables: { id },
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				deleteCategory: { id: string; deleted: boolean };
			};
		};

		expect(data.data.deleteCategory.deleted).toBe(true);

		// Verify via REST that it's gone
		const verifyResponse = await request.get(`/api/categories/${id}`);
		expect(verifyResponse.status()).toBe(404);
	});

	test('mutation result can be verified via REST API', async ({ request }) => {
		// Create via GraphQL
		const gqlResponse = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation {
					createCategory(data: { name: "GQL-REST Verify", slug: "gql-rest-verify" }) {
						id
						name
					}
				}`,
			},
		});
		expect(gqlResponse.ok()).toBe(true);

		const gqlData = (await gqlResponse.json()) as {
			data: { createCategory: { id: string; name: string } };
		};
		const id = gqlData.data.createCategory.id;
		createdIds.push(id);

		// Verify via REST
		const restResponse = await request.get(`/api/categories/${id}`);
		expect(restResponse.ok()).toBe(true);

		const restData = (await restResponse.json()) as {
			doc: { id: string; name: string; slug: string };
		};
		expect(restData.doc.name).toBe('GQL-REST Verify');
		expect(restData.doc.slug).toBe('gql-rest-verify');
	});

	test('invalid query returns error', async ({ request }) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: '{ nonExistentField }',
			},
		});
		expect(response.ok()).toBe(true); // GraphQL returns 200 even for errors

		const data = (await response.json()) as {
			errors?: Array<{ message: string }>;
		};

		expect(data.errors).toBeDefined();
		expect(data.errors?.length).toBeGreaterThan(0);
	});
});
