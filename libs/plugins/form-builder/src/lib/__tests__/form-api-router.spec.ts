import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { MomentumAPI } from '@momentumcms/core';
import { createFormApiRouter } from '../middleware/form-api-router';

const PUBLISHED_FORM = {
	id: 'form-1',
	slug: 'contact-us',
	title: 'Contact Us',
	status: 'published',
	schema: {
		fields: [
			{ name: 'name', type: 'text', required: true },
			{ name: 'email', type: 'email', required: true },
			{ name: 'message', type: 'textarea' },
		],
	},
	webhooks: [],
	honeypot: true,
	submissionCount: 5,
	successMessage: 'Thank you!',
	redirectUrl: null,
};

const DRAFT_FORM = {
	...PUBLISHED_FORM,
	id: 'form-2',
	slug: 'draft-form',
	status: 'draft',
};

function createMockApi(forms: Record<string, unknown>[] = [PUBLISHED_FORM]): MomentumAPI & {
	_submissionsCreated: unknown[];
	_formsUpdate: ReturnType<typeof vi.fn>;
} {
	const submissionsCreated: unknown[] = [];
	const formsUpdate = vi.fn(async () => PUBLISHED_FORM);

	const formsOps = {
		findById: vi.fn(async (id: string) => {
			return forms.find((f) => (f as { id: string }).id === id) ?? null;
		}),
		find: vi.fn(async (opts: { where?: Record<string, unknown> }) => {
			const slugFilter = (opts.where?.['slug'] as { equals?: string })?.equals ?? null;
			const docs = slugFilter
				? forms.filter((f) => (f as { slug: string }).slug === slugFilter)
				: forms;
			return { docs, totalDocs: docs.length };
		}),
		update: formsUpdate,
	};

	const submissionsOps = {
		create: vi.fn(async (data: unknown) => {
			submissionsCreated.push(data);
			return { id: `sub-${submissionsCreated.length}`, ...data };
		}),
		find: vi.fn(async (opts: { where?: Record<string, unknown> }) => {
			const formIdFilter = (opts.where?.['formId'] as { equals?: string })?.equals ?? null;
			const docs = formIdFilter
				? submissionsCreated.filter(
						(s) => (s as Record<string, unknown>)['formId'] === formIdFilter,
					)
				: submissionsCreated;
			return { docs, totalDocs: docs.length };
		}),
	};

	return {
		collection: vi.fn((slug: string) => {
			if (slug === 'forms') return formsOps;
			if (slug === 'form-submissions') return submissionsOps;
			return {};
		}),
		_submissionsCreated: submissionsCreated,
		_formsUpdate: formsUpdate,
	} as unknown as MomentumAPI & {
		_submissionsCreated: unknown[];
		_formsUpdate: ReturnType<typeof vi.fn>;
	};
}

function createApp(
	apiOverride?: MomentumAPI | null,
	options?: { honeypot?: boolean; rateLimitPerMinute?: number },
): express.Express {
	const mockApi = apiOverride === undefined ? createMockApi() : apiOverride;
	const app = express();
	app.use(express.json());
	app.use(
		createFormApiRouter({
			getApi: () => mockApi,
			honeypot: options?.honeypot ?? true,
			rateLimitPerMinute: options?.rateLimitPerMinute ?? 100,
		}),
	);
	return app;
}

describe('Form API Router', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe('GET /forms/:idOrSlug/schema', () => {
		it('should return schema for a published form by slug', async () => {
			const app = createApp();
			const res = await request(app).get('/forms/contact-us/schema');

			expect(res.status).toBe(200);
			expect(res.body.slug).toBe('contact-us');
			expect(res.body.schema).toBeDefined();
			expect(res.body.schema.fields).toHaveLength(3);
		});

		it('should return schema for a published form by id', async () => {
			const app = createApp();
			const res = await request(app).get('/forms/form-1/schema');

			expect(res.status).toBe(200);
			expect(res.body.id).toBe('form-1');
		});

		it('should return 404 for non-existent form', async () => {
			const app = createApp();
			const res = await request(app).get('/forms/nonexistent/schema');

			expect(res.status).toBe(404);
			expect(res.body.error).toBe('Form not found');
		});

		it('should return 404 for draft forms', async () => {
			const mockApi = createMockApi([DRAFT_FORM]);
			const app = createApp(mockApi);
			const res = await request(app).get('/forms/draft-form/schema');

			expect(res.status).toBe(404);
		});

		it('should return 503 when API is not ready', async () => {
			const app = createApp(null);
			const res = await request(app).get('/forms/contact-us/schema');

			expect(res.status).toBe(503);
		});

		it('should include honeypot flag in response', async () => {
			const app = createApp();
			const res = await request(app).get('/forms/contact-us/schema');

			expect(res.body.honeypot).toBe(true);
		});
	});

	describe('POST /forms/:idOrSlug/validate', () => {
		it('should return valid=true for valid data', async () => {
			const app = createApp();
			const res = await request(app)
				.post('/forms/contact-us/validate')
				.send({ name: 'John', email: 'john@example.com' });

			expect(res.status).toBe(200);
			expect(res.body.valid).toBe(true);
			expect(res.body.errors).toHaveLength(0);
		});

		it('should return 422 for invalid data', async () => {
			const app = createApp();
			const res = await request(app)
				.post('/forms/contact-us/validate')
				.send({ name: '', email: 'not-an-email' });

			expect(res.status).toBe(422);
			expect(res.body.valid).toBe(false);
			expect(res.body.errors.length).toBeGreaterThan(0);
		});

		it('should return 404 for non-existent form', async () => {
			const app = createApp();
			const res = await request(app).post('/forms/nonexistent/validate').send({ name: 'John' });

			expect(res.status).toBe(404);
		});
	});

	describe('POST /forms/:idOrSlug/submit', () => {
		it('should accept valid submission and return success', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			const res = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'John', email: 'john@example.com', message: 'Hello' });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.message).toBe('Thank you!');
		});

		it('should save the submission', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'John', email: 'john@example.com' });

			expect(mockApi._submissionsCreated).toHaveLength(1);
			const submission = mockApi._submissionsCreated[0] as Record<string, unknown>;
			expect(submission['formSlug']).toBe('contact-us');
			expect(submission['data']).toEqual({ name: 'John', email: 'john@example.com' });
		});

		it('should return 422 for invalid submission', async () => {
			const app = createApp();
			const res = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: '', email: 'bad' });

			expect(res.status).toBe(422);
			expect(res.body.success).toBe(false);
			expect(res.body.errors.length).toBeGreaterThan(0);
		});

		it('should silently reject honeypot submissions with 200', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			const res = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'Bot', email: 'bot@spam.com', _hp_field: 'gotcha' });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			// No submission should be created
			expect(mockApi._submissionsCreated).toHaveLength(0);
		});

		it('should increment submission count by 1', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'John', email: 'john@example.com' });

			// PUBLISHED_FORM has submissionCount: 5, so after submission it's 6
			expect(mockApi._formsUpdate).toHaveBeenCalledWith('form-1', { submissionCount: 6 });
		});

		it('should include metadata in submission', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			await request(app)
				.post('/forms/contact-us/submit')
				.set('User-Agent', 'TestAgent/1.0')
				.send({ name: 'John', email: 'john@example.com' });

			const submission = mockApi._submissionsCreated[0] as Record<string, unknown>;
			const metadata = submission['metadata'] as Record<string, unknown>;
			expect(metadata['userAgent']).toBe('TestAgent/1.0');
			expect(metadata['submittedAt']).toBeDefined();
		});

		it('should return 404 for non-existent form', async () => {
			const app = createApp();
			const res = await request(app).post('/forms/nonexistent/submit').send({ name: 'John' });

			expect(res.status).toBe(404);
		});

		it('should enforce rate limiting', async () => {
			const app = createApp(undefined, { rateLimitPerMinute: 2 });

			// First two should succeed
			await request(app).post('/forms/contact-us/submit').send({ name: 'A', email: 'a@test.com' });
			await request(app).post('/forms/contact-us/submit').send({ name: 'B', email: 'b@test.com' });

			// Third should be rate limited
			const res = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'C', email: 'c@test.com' });

			expect(res.status).toBe(429);
		});

		it('should not be bypassable via X-Forwarded-For header spoofing', async () => {
			const app = createApp(undefined, { rateLimitPerMinute: 2 });

			// Exhaust rate limit
			await request(app).post('/forms/contact-us/submit').send({ name: 'A', email: 'a@test.com' });
			await request(app).post('/forms/contact-us/submit').send({ name: 'B', email: 'b@test.com' });

			// Spoofed X-Forwarded-For should NOT bypass rate limiting
			const res = await request(app)
				.post('/forms/contact-us/submit')
				.set('X-Forwarded-For', '8.8.8.8')
				.send({ name: 'C', email: 'c@test.com' });

			expect(res.status).toBe(429);
		});

		it('should only store schema-defined fields in submission data', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			await request(app).post('/forms/contact-us/submit').send({
				name: 'John',
				email: 'john@example.com',
				extraField: 'should-be-stripped',
				__proto__: 'attack',
				constructor: 'attack',
			});

			expect(mockApi._submissionsCreated).toHaveLength(1);
			const submission = mockApi._submissionsCreated[0] as Record<string, unknown>;
			const data = submission['data'] as Record<string, unknown>;
			// Only schema-defined fields should be stored
			expect(data['name']).toBe('John');
			expect(data['email']).toBe('john@example.com');
			expect(data['message']).toBeUndefined(); // optional schema field not sent
			expect(data['extraField']).toBeUndefined();
			expect(Object.prototype.hasOwnProperty.call(data, '__proto__')).toBe(false);
			expect(Object.prototype.hasOwnProperty.call(data, 'constructor')).toBe(false);
		});

		it('should strip honeypot field from stored data', async () => {
			const mockApi = createMockApi();
			// Honeypot enabled but field is empty (legitimate user)
			const app = createApp(mockApi, { honeypot: true });

			await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'John', email: 'john@example.com', _hp_field: '' });

			expect(mockApi._submissionsCreated).toHaveLength(1);
			const submission = mockApi._submissionsCreated[0] as Record<string, unknown>;
			const data = submission['data'] as Record<string, unknown>;
			expect(data['_hp_field']).toBeUndefined();
		});
	});

	describe('conditional field validation', () => {
		const CONDITIONAL_FORM = {
			...PUBLISHED_FORM,
			id: 'form-cond',
			slug: 'conditional-form',
			schema: {
				fields: [
					{
						name: 'contactMethod',
						type: 'select',
						required: true,
						options: [
							{ label: 'Email', value: 'email' },
							{ label: 'Phone', value: 'phone' },
						],
					},
					{
						name: 'phone',
						type: 'text',
						required: true,
						conditions: [{ field: 'contactMethod', operator: 'equals', value: 'phone' }],
					},
				],
			},
		};

		it('should skip validation of hidden required fields on /submit', async () => {
			const mockApi = createMockApi([CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			const res = await request(app)
				.post('/forms/conditional-form/submit')
				.send({ contactMethod: 'email' }); // phone is hidden, should not be required

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it('should skip validation of hidden required fields on /validate', async () => {
			const mockApi = createMockApi([CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			const res = await request(app)
				.post('/forms/conditional-form/validate')
				.send({ contactMethod: 'email' });

			expect(res.status).toBe(200);
			expect(res.body.valid).toBe(true);
		});

		it('should still validate visible required fields on /submit', async () => {
			const mockApi = createMockApi([CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			// contactMethod = phone makes phone visible and required, but phone is missing
			const res = await request(app)
				.post('/forms/conditional-form/submit')
				.send({ contactMethod: 'phone' });

			expect(res.status).toBe(422);
			expect(res.body.errors.some((e: { field: string }) => e.field === 'phone')).toBe(true);
		});

		it('should still validate visible required fields on /validate', async () => {
			const mockApi = createMockApi([CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			const res = await request(app)
				.post('/forms/conditional-form/validate')
				.send({ contactMethod: 'phone' });

			expect(res.status).toBe(422);
			expect(res.body.errors.some((e: { field: string }) => e.field === 'phone')).toBe(true);
		});
	});

	describe('rate limiting on /validate', () => {
		it('should enforce rate limit on /validate endpoint', async () => {
			const app = createApp(undefined, { rateLimitPerMinute: 2 });

			await request(app)
				.post('/forms/contact-us/validate')
				.send({ name: 'A', email: 'a@test.com' });
			await request(app)
				.post('/forms/contact-us/validate')
				.send({ name: 'B', email: 'b@test.com' });

			const res = await request(app)
				.post('/forms/contact-us/validate')
				.send({ name: 'C', email: 'c@test.com' });

			expect(res.status).toBe(429);
		});
	});

	describe('submission counter', () => {
		it('should increment submission count by 1 from current value', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'John', email: 'john@example.com' });

			// PUBLISHED_FORM.submissionCount is 5, so after one submission it should be 6
			expect(mockApi._formsUpdate).toHaveBeenCalledWith('form-1', { submissionCount: 6 });
		});

		it('should not make an extra find query to count submissions', async () => {
			const mockApi = createMockApi();
			const app = createApp(mockApi);

			await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'John', email: 'john@example.com' });

			// form-submissions should only have create called, not find
			const submissionsOps = mockApi.collection('form-submissions') as Record<
				string,
				ReturnType<typeof vi.fn>
			>;
			expect(submissionsOps['create']).toHaveBeenCalledOnce();
			expect(submissionsOps['find']).not.toHaveBeenCalled();
		});
	});

	describe('rate limiter IP resolution', () => {
		it('should use socket remoteAddress when req.ip is undefined', async () => {
			// When req.ip is undefined (proxy without trust-proxy), should use socket address
			const mockApi = createMockApi();
			const app = createApp(mockApi, { rateLimitPerMinute: 2 });

			// supertest creates requests with socket.remoteAddress but req.ip can be undefined
			// All requests should succeed since they share the same socket address
			const res1 = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'A', email: 'a@test.com' });
			const res2 = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'B', email: 'b@test.com' });
			const res3 = await request(app)
				.post('/forms/contact-us/submit')
				.send({ name: 'C', email: 'c@test.com' });

			expect(res1.status).toBe(200);
			expect(res2.status).toBe(200);
			// Third should be rate limited (same IP bucket via socket)
			expect(res3.status).toBe(429);
		});
	});

	describe('condition evaluation hardening', () => {
		const HARDENED_CONDITIONAL_FORM = {
			...PUBLISHED_FORM,
			id: 'form-hardened',
			slug: 'hardened-form',
			schema: {
				fields: [
					{
						name: 'accountType',
						type: 'select',
						required: true,
						options: [
							{ label: 'Personal', value: 'personal' },
							{ label: 'Business', value: 'business' },
						],
					},
					{
						name: 'companyName',
						type: 'text',
						required: true,
						conditions: [{ field: 'accountType', operator: 'equals', value: 'business' }],
					},
				],
			},
		};

		it('should validate conditional fields when controlling field has invalid value', async () => {
			const mockApi = createMockApi([HARDENED_CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			// Attacker sends invalid option value to manipulate condition evaluation
			const res = await request(app)
				.post('/forms/hardened-form/submit')
				.send({ accountType: 'hacker-value' });

			// Should fail — invalid accountType AND companyName should be required
			expect(res.status).toBe(422);
			const fieldNames = res.body.errors.map((e: { field: string }) => e.field);
			expect(fieldNames).toContain('accountType');
		});

		it('should validate conditional fields when controlling field is missing', async () => {
			const mockApi = createMockApi([HARDENED_CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			// Missing required controlling field — conditional field should be treated as visible
			const res = await request(app).post('/forms/hardened-form/submit').send({});

			expect(res.status).toBe(422);
			const fieldNames = res.body.errors.map((e: { field: string }) => e.field);
			expect(fieldNames).toContain('accountType');
			// companyName should also be validated since controller is invalid
			expect(fieldNames).toContain('companyName');
		});

		it('should propagate errors through multi-level conditional chains (A -> B -> C)', async () => {
			// Two-level chain: A is unconditional, B depends on A, C depends on B
			const CHAIN_FORM = {
				...PUBLISHED_FORM,
				id: 'form-chain',
				slug: 'chain-form',
				schema: {
					fields: [
						{
							name: 'level',
							type: 'select',
							required: true,
							options: [
								{ label: 'Basic', value: 'basic' },
								{ label: 'Advanced', value: 'advanced' },
							],
						},
						{
							name: 'category',
							type: 'select',
							required: true,
							options: [
								{ label: 'Tech', value: 'tech' },
								{ label: 'Science', value: 'science' },
							],
							conditions: [{ field: 'level', operator: 'equals', value: 'advanced' }],
						},
						{
							name: 'subcategory',
							type: 'text',
							required: true,
							conditions: [{ field: 'category', operator: 'equals', value: 'tech' }],
						},
					],
				},
			};
			const mockApi = createMockApi([CHAIN_FORM]);
			const app = createApp(mockApi);

			// Attacker sends invalid 'category' to hide 'subcategory'
			// level=advanced shows category, but category='hacker' is invalid
			// subcategory should still be validated because its controller (category) has errors
			const res = await request(app)
				.post('/forms/chain-form/submit')
				.send({ level: 'advanced', category: 'hacker' });

			expect(res.status).toBe(422);
			const fieldNames = res.body.errors.map((e: { field: string }) => e.field);
			expect(fieldNames).toContain('category');
			// C's controller (B=category) has errors, so C should be treated as visible
			expect(fieldNames).toContain('subcategory');
		});

		it('should still hide conditional fields when controller value is valid', async () => {
			const mockApi = createMockApi([HARDENED_CONDITIONAL_FORM]);
			const app = createApp(mockApi);

			// Valid "personal" selection — companyName should be hidden, no error
			const res = await request(app)
				.post('/forms/hardened-form/submit')
				.send({ accountType: 'personal' });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});
	});
});
