import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Relationship Integrity E2E Tests
 *
 * Verifies that FK constraints enforce referential integrity:
 * - Default behavior (set-null): deleting a referenced document nullifies the FK column
 * - Articles → Categories uses ON DELETE SET NULL
 */
test.describe('Relationship integrity on delete', () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test.describe('set-null (default behavior)', () => {
		test('deleting a referenced category nullifies article.category', async ({ request }) => {
			// Create a test category
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Integrity Test Cat', slug: 'integrity-test' },
			});
			expect(catResponse.status()).toBe(201);
			const catBody = (await catResponse.json()) as { doc: { id: string } };
			const catId = catBody.doc.id;

			// Create an article referencing it
			const artResponse = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Integrity Test Article', content: 'Test', category: catId },
			});
			expect(artResponse.status()).toBe(201);
			const artBody = (await artResponse.json()) as { doc: { id: string; category: string } };
			const artId = artBody.doc.id;
			expect(artBody.doc.category).toBe(catId);

			// Delete the category
			const deleteResponse = await request.delete(`/api/categories/${catId}`);
			expect(deleteResponse.ok()).toBe(true);

			// Article's category should now be null (FK ON DELETE SET NULL)
			const getResponse = await request.get(`/api/articles/${artId}`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as { doc: { category: string | null } };
			expect(getBody.doc.category).toBeNull();

			// Clean up
			const cleanupResponse = await request.delete(`/api/articles/${artId}`);
			expect(cleanupResponse.ok()).toBe(true);
		});

		test('deleting a category nullifies multiple referencing articles', async ({ request }) => {
			// Create a category
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Multi Ref Cat', slug: 'multi-ref' },
			});
			expect(catResponse.status()).toBe(201);
			const catBody = (await catResponse.json()) as { doc: { id: string } };
			const catId = catBody.doc.id;

			// Create 3 articles referencing it
			const articleIds: string[] = [];
			for (let i = 1; i <= 3; i++) {
				const artResponse = await request.post('/api/articles', {
					headers: { 'Content-Type': 'application/json' },
					data: { title: `Multi Ref Article ${i}`, content: 'Test', category: catId },
				});
				expect(artResponse.status()).toBe(201);
				const artBody = (await artResponse.json()) as { doc: { id: string } };
				articleIds.push(artBody.doc.id);
			}

			// Delete the category
			const deleteResponse = await request.delete(`/api/categories/${catId}`);
			expect(deleteResponse.ok()).toBe(true);

			// All 3 articles should have null category
			for (const artId of articleIds) {
				const getResponse = await request.get(`/api/articles/${artId}`);
				expect(getResponse.ok()).toBe(true);
				const getBody = (await getResponse.json()) as { doc: { category: string | null } };
				expect(getBody.doc.category).toBeNull();
			}

			// Clean up
			for (const artId of articleIds) {
				const cleanupResponse = await request.delete(`/api/articles/${artId}`);
				expect(cleanupResponse.ok()).toBe(true);
			}
		});

		test('set-null only affects articles referencing the deleted category', async ({ request }) => {
			// Create two categories
			const cat1Response = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Delete Me Cat', slug: 'delete-me' },
			});
			expect(cat1Response.status()).toBe(201);
			const cat1Body = (await cat1Response.json()) as { doc: { id: string } };
			const cat1Id = cat1Body.doc.id;

			const cat2Response = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Keep Me Cat', slug: 'keep-me' },
			});
			expect(cat2Response.status()).toBe(201);
			const cat2Body = (await cat2Response.json()) as { doc: { id: string } };
			const cat2Id = cat2Body.doc.id;

			// Create articles: A1 → cat1, A2 → cat2
			const art1Response = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Article for Cat1', content: 'Test', category: cat1Id },
			});
			expect(art1Response.status()).toBe(201);
			const art1Id = ((await art1Response.json()) as { doc: { id: string } }).doc.id;

			const art2Response = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Article for Cat2', content: 'Test', category: cat2Id },
			});
			expect(art2Response.status()).toBe(201);
			const art2Id = ((await art2Response.json()) as { doc: { id: string } }).doc.id;

			// Delete only cat1
			const deleteResponse = await request.delete(`/api/categories/${cat1Id}`);
			expect(deleteResponse.ok()).toBe(true);

			// A1 should be nullified
			const get1Response = await request.get(`/api/articles/${art1Id}`);
			expect(get1Response.ok()).toBe(true);
			const get1Body = (await get1Response.json()) as { doc: { category: string | null } };
			expect(get1Body.doc.category).toBeNull();

			// A2 should still reference cat2
			const get2Response = await request.get(`/api/articles/${art2Id}`);
			expect(get2Response.ok()).toBe(true);
			const get2Body = (await get2Response.json()) as { doc: { category: string | null } };
			expect(get2Body.doc.category).toBe(cat2Id);

			// Clean up
			await request.delete(`/api/articles/${art1Id}`);
			await request.delete(`/api/articles/${art2Id}`);
			await request.delete(`/api/categories/${cat2Id}`);
		});

		// Note: depth=1 behavior for nullified relationships is tested in relationship-depth.spec.ts

		test('articles without category are unaffected by category deletion', async ({ request }) => {
			// Create a category and an article WITHOUT a category
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Unrelated Cat', slug: 'unrelated' },
			});
			expect(catResponse.status()).toBe(201);
			const catId = ((await catResponse.json()) as { doc: { id: string } }).doc.id;

			const artResponse = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'No Category Article', content: 'Test' },
			});
			expect(artResponse.status()).toBe(201);
			const artId = ((await artResponse.json()) as { doc: { id: string } }).doc.id;

			// Delete the category
			await request.delete(`/api/categories/${catId}`);

			// Article should still have null category (unchanged)
			const getResponse = await request.get(`/api/articles/${artId}`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as { doc: { category: string | null } };
			expect(getBody.doc.category ?? null).toBeNull();

			// Clean up
			await request.delete(`/api/articles/${artId}`);
		});
	});

	test.describe('edge cases', () => {
		test('deleting a document with no reverse references succeeds', async ({ request }) => {
			// Create a standalone category (no articles reference it)
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Standalone Cat', slug: 'standalone' },
			});
			expect(catResponse.status()).toBe(201);
			const catId = ((await catResponse.json()) as { doc: { id: string } }).doc.id;

			// Delete should succeed normally
			const deleteResponse = await request.delete(`/api/categories/${catId}`);
			expect(deleteResponse.ok()).toBe(true);

			// Verify it's gone
			const getResponse = await request.get(`/api/categories/${catId}`);
			expect(getResponse.ok()).toBe(false);
		});

		test('can re-assign relationship after previous reference was deleted', async ({ request }) => {
			// Create two categories
			const cat1Response = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'First Cat', slug: 'first-cat' },
			});
			expect(cat1Response.status()).toBe(201);
			const cat1Id = ((await cat1Response.json()) as { doc: { id: string } }).doc.id;

			const cat2Response = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Second Cat', slug: 'second-cat' },
			});
			expect(cat2Response.status()).toBe(201);
			const cat2Id = ((await cat2Response.json()) as { doc: { id: string } }).doc.id;

			// Create article → cat1
			const artResponse = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Reassign Test', content: 'Test', category: cat1Id },
			});
			expect(artResponse.status()).toBe(201);
			const artId = ((await artResponse.json()) as { doc: { id: string } }).doc.id;

			// Delete cat1 → article.category becomes null
			await request.delete(`/api/categories/${cat1Id}`);

			const midResponse = await request.get(`/api/articles/${artId}`);
			expect(midResponse.ok()).toBe(true);
			const midBody = (await midResponse.json()) as { doc: { category: string | null } };
			expect(midBody.doc.category).toBeNull();

			// Re-assign to cat2
			const updateResponse = await request.patch(`/api/articles/${artId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { category: cat2Id },
			});
			expect(updateResponse.ok()).toBe(true);

			// Verify it's now cat2
			const finalResponse = await request.get(`/api/articles/${artId}`);
			expect(finalResponse.ok()).toBe(true);
			const finalBody = (await finalResponse.json()) as { doc: { category: string } };
			expect(finalBody.doc.category).toBe(cat2Id);

			// Clean up
			await request.delete(`/api/articles/${artId}`);
			await request.delete(`/api/categories/${cat2Id}`);
		});
	});

	test.describe('restrict (required relationship auto-override)', () => {
		test('deleting a category referenced by a required relationship returns 409', async ({
			request,
		}) => {
			// Create a category
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Required Ref Cat', slug: 'required-ref' },
			});
			expect(catResponse.status()).toBe(201);
			const catId = ((await catResponse.json()) as { doc: { id: string } }).doc.id;

			// Create a tag with required category relationship
			const tagResponse = await request.post('/api/tags', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Required Tag', category: catId },
			});
			expect(tagResponse.status()).toBe(201);
			const tagId = ((await tagResponse.json()) as { doc: { id: string } }).doc.id;

			// Try to delete the category — should fail with 409 (FK RESTRICT)
			const deleteResponse = await request.delete(`/api/categories/${catId}`);
			expect(deleteResponse.status()).toBe(409);

			// Category should still exist
			const catGetResponse = await request.get(`/api/categories/${catId}`);
			expect(catGetResponse.ok()).toBe(true);

			// Tag should still reference the category
			const tagGetResponse = await request.get(`/api/tags/${tagId}`);
			expect(tagGetResponse.ok()).toBe(true);
			const tagBody = (await tagGetResponse.json()) as { doc: { category: string } };
			expect(tagBody.doc.category).toBe(catId);

			// Clean up: delete tag first (removes the FK reference), then category
			await request.delete(`/api/tags/${tagId}`);
			await request.delete(`/api/categories/${catId}`);
		});

		test('can delete category after removing all required references', async ({ request }) => {
			// Create a category
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Removable Ref Cat', slug: 'removable-ref' },
			});
			expect(catResponse.status()).toBe(201);
			const catId = ((await catResponse.json()) as { doc: { id: string } }).doc.id;

			// Create a tag referencing the category
			const tagResponse = await request.post('/api/tags', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Removable Tag', category: catId },
			});
			expect(tagResponse.status()).toBe(201);
			const tagId = ((await tagResponse.json()) as { doc: { id: string } }).doc.id;

			// Deleting the category should fail while tag references it
			const blockedDelete = await request.delete(`/api/categories/${catId}`);
			expect(blockedDelete.status()).toBe(409);

			// Delete the tag (removes the FK reference)
			const tagDeleteResponse = await request.delete(`/api/tags/${tagId}`);
			expect(tagDeleteResponse.ok()).toBe(true);

			// Now deleting the category should succeed
			const successDelete = await request.delete(`/api/categories/${catId}`);
			expect(successDelete.ok()).toBe(true);

			// Verify it's gone
			const catGetResponse = await request.get(`/api/categories/${catId}`);
			expect(catGetResponse.ok()).toBe(false);
		});

		test('required relationship blocks deletion even with multiple tags', async ({ request }) => {
			// Create a category
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Multi Tag Cat', slug: 'multi-tag' },
			});
			expect(catResponse.status()).toBe(201);
			const catId = ((await catResponse.json()) as { doc: { id: string } }).doc.id;

			// Create 3 tags referencing it
			const tagIds: string[] = [];
			for (let i = 1; i <= 3; i++) {
				const tagResponse = await request.post('/api/tags', {
					headers: { 'Content-Type': 'application/json' },
					data: { name: `Multi Tag ${i}`, category: catId },
				});
				expect(tagResponse.status()).toBe(201);
				tagIds.push(((await tagResponse.json()) as { doc: { id: string } }).doc.id);
			}

			// Can't delete category while any tag references it
			const deleteResponse = await request.delete(`/api/categories/${catId}`);
			expect(deleteResponse.status()).toBe(409);

			// Delete all tags, then category succeeds
			for (const tagId of tagIds) {
				await request.delete(`/api/tags/${tagId}`);
			}
			const successDelete = await request.delete(`/api/categories/${catId}`);
			expect(successDelete.ok()).toBe(true);
		});
	});
});
