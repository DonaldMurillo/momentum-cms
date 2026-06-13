import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionConfig, MomentumConfig, UserContext } from '@momentumcms/core';
import { WORKFLOW_ERROR_CODES } from '@momentumcms/core';
import { handleListWorkflowHistoryRequest, handleTransitionRequest } from './workflow-handlers';
import { getMomentumAPI, initializeMomentumAPI, resetMomentumAPI } from './momentum-api';
import { createInMemoryAdapter } from './server-core';

const adminUser: UserContext = { id: 'u-admin', role: 'admin' };

function buildCollection(overrides: Partial<CollectionConfig> = {}): CollectionConfig {
	return {
		slug: 'articles',
		fields: [{ name: 'title', type: 'text' }],
		access: { read: () => true, update: () => true, create: () => true, delete: () => true },
		workflow: {
			stages: [
				{ id: 'draft', label: 'Draft', transitions: ['in-review'] },
				{ id: 'in-review', label: 'In Review', transitions: ['draft', 'approved'] },
				{
					id: 'approved',
					label: 'Approved',
					transitions: ['draft'],
					publishesOnEnter: true,
				},
				{ id: 'archived', label: 'Archived', transitions: [], unpublishesOnEnter: true },
			],
			initialStage: 'draft',
		},
		...overrides,
	};
}

async function seedDoc(
	slug = 'articles',
	stage = 'draft',
): Promise<{ id: string; updatedAt: string }> {
	// Use overrideAccess so the seed can set workflowStage/workflowUpdatedAt
	// directly. Production callers without override get the columns stripped,
	// which is the defense covered by the regression suite below.
	const api = getMomentumAPI().setContext({ overrideAccess: true });
	const doc = await api.collection(slug).create({
		title: 'hello',
		workflowStage: stage,
		workflowUpdatedAt: new Date().toISOString(),
	});
	return {
		id: String(doc['id']),
		updatedAt: String(doc['workflowUpdatedAt']),
	};
}

function setup(collection: CollectionConfig): MomentumConfig {
	const config: MomentumConfig = {
		collections: [collection],
		db: { adapter: createInMemoryAdapter() },
	};
	initializeMomentumAPI(config);
	return config;
}

describe('handleTransitionRequest', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('returns 404 when collection does not exist', async () => {
		setup(buildCollection());
		const result = await handleTransitionRequest({
			collectionSlug: 'ghost',
			id: '1',
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(404);
	});

	it('returns 400 when collection has no workflow', async () => {
		setup({ slug: 'tags', fields: [{ name: 'name', type: 'text' }] });
		const result = await handleTransitionRequest({
			collectionSlug: 'tags',
			id: '1',
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.WorkflowNotConfigured });
	});

	it('returns 400 when toStage is missing', async () => {
		setup(buildCollection());
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: {},
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.UnknownStage });
	});

	it('returns 400 when toStage references an unknown stage', async () => {
		setup(buildCollection());
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'ghost' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.UnknownStage });
	});

	it('returns 400 when transition is not declared from current stage', async () => {
		setup(buildCollection());
		const { id } = await seedDoc('articles', 'draft');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'approved' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.InvalidTransition });
	});

	// Red-team finding #3: InvalidTransition body must not leak the current
	// stage. A caller with read+transition access on a doc could already see
	// the stage via findById, but the per-stage readStage gate exists to allow
	// stricter scoping — and the body field `from` would expose stage state to
	// callers the readStage gate intends to deny. Drop it.
	it('does not leak current stage in InvalidTransition body', async () => {
		setup(buildCollection());
		const { id } = await seedDoc('articles', 'draft');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'approved' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		const body = result.body as Record<string, unknown>;
		expect(body['from']).toBeUndefined();
		expect(body['fromStage']).toBeUndefined();
		// `to` is fine — caller supplied it.
		expect(body).toMatchObject({ to: 'approved' });
		// Belt-and-suspenders: no field anywhere in the body should equal
		// the doc's actual current stage. Catches the case where the leak
		// resurfaces under a different key name (currentStage, current, etc).
		const stagesInBody = Object.values(body).filter((v) => typeof v === 'string' && v === 'draft');
		expect(stagesInBody).toEqual([]);
	});

	it('returns 404 when document does not exist', async () => {
		setup(buildCollection());
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: 'missing',
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(404);
	});

	it('returns 403 when workflow.access.transition denies', async () => {
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: { transition: () => false },
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(403);
	});

	it('runs beforeTransition hooks and aborts on throw', async () => {
		const before = vi.fn(() => {
			throw new Error('not allowed');
		});
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					hooks: { beforeTransition: [before] },
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(before).toHaveBeenCalledOnce();
	});

	it('returns 200 + history id on successful transition and runs afterTransition', async () => {
		const after = vi.fn();
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					hooks: { afterTransition: [after] },
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review', comment: 'looks good' },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({
			id,
			fromStage: 'draft',
			toStage: 'in-review',
			published: false,
			unpublished: false,
		});
		expect(after).toHaveBeenCalledOnce();
		expect(after.mock.calls[0]?.[0]).toMatchObject({
			from: 'draft',
			to: 'in-review',
			comment: 'looks good',
		});
	});

	it('returns 409 ConflictStaleStage when expectedUpdatedAt does not match', async () => {
		setup(buildCollection());
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: {
				toStage: 'in-review',
				expectedUpdatedAt: new Date(0).toISOString(),
			},
			user: adminUser,
		});
		expect(result.status).toBe(409);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.ConflictStaleStage });
	});

	it('returns 409 ConflictStaleStage when expectedStage does not match', async () => {
		setup(buildCollection());
		const { id } = await seedDoc('articles', 'in-review');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'approved', expectedStage: 'draft' },
			user: adminUser,
		});
		expect(result.status).toBe(409);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.ConflictStaleStage });
	});

	// Red-team finding: concurrent transition race. Two callers race the
	// same transition (e.g. both POST {toStage: 'in-review', expectedStage:
	// 'draft'}). Tx 1 commits, moving the doc to 'in-review'. Tx 2's
	// handler then reads the doc AFTER tx 1 committed: fromStage is now
	// 'in-review'. The naive canTransition('in-review', 'in-review') check
	// returns false (no self-loop) so the handler returns 400
	// InvalidTransition. The caller's expectedStage was honest — they
	// believed the doc was in 'draft' — and the adapter's CAS would surface
	// the canonical 409 ConflictStaleStage with currentStage. The fix is to
	// validate canTransition against the caller's expectedStage when
	// provided, so the CAS layer is reached and returns the right code.
	it('returns 409 (not 400) when doc moved between caller read and handler read', async () => {
		setup(buildCollection());
		// Caller's view: doc is in 'draft'. Reality: another tx already
		// moved it to 'in-review' (simulated by seeding directly in
		// 'in-review' while the caller still believes it's in 'draft').
		const { id, updatedAt } = await seedDoc('articles', 'in-review');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: {
				toStage: 'in-review',
				expectedStage: 'draft',
				expectedUpdatedAt: new Date(Date.parse(updatedAt) - 1000).toISOString(),
			},
			user: adminUser,
		});
		expect(result.status).toBe(409);
		expect(result.body).toMatchObject({
			code: WORKFLOW_ERROR_CODES.ConflictStaleStage,
			currentStage: 'in-review',
		});
	});

	// Red-team finding: the 409 ConflictStaleStage body must not leak the
	// post-conflict stage past a per-stage `readStage` gate. The `findById`
	// readStage→404 gate only covers the stage at the handler's read time; a
	// concurrent transition can move the doc into a hidden stage AFTER that
	// read, and the adapter CAS then reports that hidden stage as
	// `currentStage`. We simulate the race by reading a readable doc (draft)
	// and forcing the CAS to report a conflict in the hidden 'in-review' stage.
	it('does not leak currentStage in 409 ConflictStaleStage body when readStage denies that stage', async () => {
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: {
						readStage: { draft: () => true, 'in-review': () => false, approved: () => true },
					},
				},
			}),
		);
		const { id } = await seedDoc('articles', 'draft');
		const api = getMomentumAPI();
		const adapter = api.getConfig().db.adapter;
		vi.spyOn(adapter, 'transitionWorkflowStage').mockResolvedValue({
			conflict: true,
			currentStage: 'in-review',
			currentUpdatedAt: new Date().toISOString(),
		});
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(409);
		const body = result.body as Record<string, unknown>;
		expect(body).toMatchObject({ code: WORKFLOW_ERROR_CODES.ConflictStaleStage });
		expect(body['currentStage']).toBeUndefined();
		expect(body['currentUpdatedAt']).toBeUndefined();
		// Belt-and-suspenders: the hidden stage string must not appear under any key.
		const leaked = Object.values(body).filter((v) => typeof v === 'string' && v === 'in-review');
		expect(leaked).toEqual([]);
	});

	// Positive control: when readStage ALLOWS the post-conflict stage, the
	// retry envelope keeps currentStage for client retry UX.
	it('includes currentStage in 409 body when readStage allows that stage', async () => {
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: { readStage: { draft: () => true, 'in-review': () => true } },
				},
			}),
		);
		const { id } = await seedDoc('articles', 'draft');
		const api = getMomentumAPI();
		const adapter = api.getConfig().db.adapter;
		vi.spyOn(adapter, 'transitionWorkflowStage').mockResolvedValue({
			conflict: true,
			currentStage: 'in-review',
			currentUpdatedAt: new Date().toISOString(),
		});
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(409);
		expect(result.body).toMatchObject({
			code: WORKFLOW_ERROR_CODES.ConflictStaleStage,
			currentStage: 'in-review',
		});
	});

	// Red-team finding (coverage): the `reviewer` access lane on the demo
	// `posts` collection is only ever exercised by admin in e2e (no seeded
	// reviewer user; `reviewer` is intentionally not yet in AUTH_ROLES). Pin
	// the three predicate branches directly so a refactor/typo of the
	// reviewer-only comparison can't pass while silently breaking the lane.
	it('enforces the reviewer-only lane independently of admin/editor', async () => {
		const reviewerLane = buildCollection({
			versions: { drafts: true },
			access: { read: () => true, create: () => true, update: () => true, delete: () => true },
			workflow: {
				...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
				access: {
					transition: ({ from, to, req }) => {
						const role = req.user?.role;
						if (from === 'draft' && to === 'in-review') {
							return role === 'admin' || role === 'editor';
						}
						if (from === 'in-review' && (to === 'approved' || to === 'draft')) {
							return role === 'admin' || role === 'reviewer';
						}
						return role === 'admin';
					},
				},
			},
		});
		const reviewerUser: UserContext = { id: 'u-rev', role: 'reviewer' };
		const editorUser: UserContext = { id: 'u-ed', role: 'editor' };

		// (a) reviewer CAN act on the in-review lane. We use the non-publishing
		// in-review → draft bounce (same `from === 'in-review'` predicate branch
		// as the approve) so the access result isn't masked by the in-memory
		// adapter's lack of publish support that `approved` (publishesOnEnter)
		// would trigger.
		setup(reviewerLane);
		const a = await seedDoc('articles', 'in-review');
		const reviewerBounce = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: a.id,
			body: { toStage: 'draft' },
			user: reviewerUser,
		});
		expect(reviewerBounce.status).toBe(200);

		// (b) reviewer CANNOT drive the editor lane (draft → in-review).
		setup(reviewerLane);
		const b = await seedDoc('articles', 'draft');
		const reviewerPush = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: b.id,
			body: { toStage: 'in-review' },
			user: reviewerUser,
		});
		expect(reviewerPush.status).toBe(403);

		// (c) editor CANNOT approve (the lane the e2e editor test asserts).
		setup(reviewerLane);
		const c = await seedDoc('articles', 'in-review');
		const editorApprove = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: c.id,
			body: { toStage: 'approved' },
			user: editorUser,
		});
		expect(editorApprove.status).toBe(403);
	});

	it('exposes afterTransition hook errors silently (transition still 200)', async () => {
		const after = vi.fn(() => {
			throw new Error('webhook failed');
		});
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					hooks: { afterTransition: [after] },
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(after).toHaveBeenCalledOnce();
	});

	// Red-team finding: secure-by-default. A collection with a workflow but
	// no access.update AND no workflow.access.transition would, under the
	// "no access function = allow all" default, let anonymous callers
	// transition stages — including stages with publishesOnEnter: true,
	// bypassing the publish gate entirely. The handler must default-deny
	// when neither guard is configured (overrideAccess still passes for
	// internal use).
	it('returns 403 when neither access.update nor workflow.access.transition is configured (anonymous)', async () => {
		setup(
			buildCollection({
				// Intentionally omit access entirely so both update and transition
				// are undefined. Read defaults to allow-all so seedDoc still works.
				access: undefined,
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			// No user — anonymous request.
		});
		expect(result.status).toBe(403);
	});

	it('returns 403 when neither access.update nor workflow.access.transition is configured (authenticated)', async () => {
		setup(
			buildCollection({
				access: undefined,
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		// An authenticated request without configured guards must still be
		// denied — defaulting to allow-on-auth is the kind of footgun the
		// publish gate exists to prevent.
		expect(result.status).toBe(403);
	});

	// Finding 1: workflow transition must AND-compose with collection update access.
	// Without this, a collection that omits workflow.access.transition lets any
	// reader transition stages regardless of update access.
	it('returns 403 when collection update access denies and workflow.access.transition is omitted', async () => {
		setup(
			buildCollection({
				access: {
					read: () => true,
					create: () => true,
					update: () => false,
					delete: () => true,
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(403);
	});

	it('returns 403 when both workflow.access.transition and collection update return true only individually (AND, not OR)', async () => {
		// update=false, transition=true → must deny (AND-composition)
		setup(
			buildCollection({
				access: {
					read: () => true,
					create: () => true,
					update: () => false,
					delete: () => true,
				},
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: { transition: () => true },
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(403);
	});

	// Finding 2: workflow callbacks must receive a full RequestContext (with `api`),
	// matching every other access/hook callsite in the codebase. The assertions
	// invoke `req.api.collection('articles')` and confirm the returned object is
	// a usable CollectionOperations — a stub like `{ collection: () => undefined }`
	// would fail the `findById` typeof check.
	it('passes a usable RequestContext with api.collection() to workflow.access.transition', async () => {
		const transitionFn = vi.fn(
			async ({ req }: { req: { api?: { collection?: (slug: string) => unknown } } }) => {
				// Exercise the api inside the access function to mirror real use.
				const ops = req.api?.collection?.('articles');
				expect(ops).toBeDefined();
				return true;
			},
		);
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: { transition: transitionFn },
				},
			}),
		);
		const seeded = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: seeded.id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(transitionFn).toHaveBeenCalledOnce();
		const args = transitionFn.mock.calls[0]?.[0] as {
			req: { user?: unknown; api?: { collection?: (slug: string) => unknown } };
		};
		expect(args.req.user).toBeDefined();
		expect(typeof args.req.api?.collection).toBe('function');
		const ops = args.req.api?.collection?.('articles') as { findById?: unknown } | undefined;
		// Real CollectionOperations must expose `findById` — a stub returning undefined
		// or `{}` would not.
		expect(ops).toBeDefined();
		expect(typeof ops?.findById).toBe('function');
		// And the returned ops must actually be wired to data — round-trip a read
		// on the seeded doc to prove the api isn't a no-op.
		const fetched = await (ops as { findById: (id: string) => Promise<unknown> }).findById(
			seeded.id,
		);
		expect(fetched).toMatchObject({ id: seeded.id });
	});

	// Red-team finding #2: a transition into a `publishesOnEnter` stage must
	// short-circuit with 403 when the caller lacks `publishVersions` access,
	// BEFORE the stage transition is committed. Without this check, the stage
	// commits, the publish flow throws AccessDeniedError, the handler runs
	// auto-revert, and the audit trail picks up bogus `[auto-revert]` noise
	// even though the right answer is just "you can't do that."
	it('returns 403 without committing stage when caller lacks publishVersions access for publishesOnEnter', async () => {
		setup(
			buildCollection({
				versions: { drafts: true },
				access: {
					read: () => true,
					create: () => true,
					update: () => true,
					delete: () => true,
					publishVersions: () => false,
				},
			}),
		);
		const seeded = await seedDoc('articles', 'in-review');
		const api = getMomentumAPI();
		const adapter = api.getConfig().db.adapter;
		const transitionSpy = vi.spyOn(adapter, 'transitionWorkflowStage');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: seeded.id,
			body: { toStage: 'approved' },
			user: adminUser,
		});
		expect(result.status).toBe(403);
		// Adapter MUST NOT have been called — no DB write, no history row.
		expect(transitionSpy).not.toHaveBeenCalled();
		// And the doc's stage is unchanged.
		const fresh = await api
			.setContext({ overrideAccess: true })
			.collection('articles')
			.findById(seeded.id);
		expect(fresh?.['workflowStage']).toBe('in-review');
	});

	it('returns 403 without committing stage when caller lacks publishVersions access for unpublishesOnEnter', async () => {
		// Build a workflow where 'approved' transitions to 'archived'
		// (unpublishesOnEnter). 'archived' has no incoming transition in
		// the default `buildCollection`, so we add one explicitly.
		const customCollection = buildCollection({
			versions: { drafts: true },
			access: {
				read: () => true,
				create: () => true,
				update: () => true,
				delete: () => true,
				publishVersions: () => false,
			},
		});
		const wf = customCollection.workflow as NonNullable<CollectionConfig['workflow']>;
		const approvedStage = wf.stages.find((s) => s.id === 'approved');
		if (approvedStage) approvedStage.transitions = [...approvedStage.transitions, 'archived'];
		setup(customCollection);

		const seeded = await seedDoc('articles', 'approved');
		const api = getMomentumAPI();
		const adapter = api.getConfig().db.adapter;
		const transitionSpy = vi.spyOn(adapter, 'transitionWorkflowStage');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id: seeded.id,
			body: { toStage: 'archived' },
			user: adminUser,
		});
		expect(result.status).toBe(403);
		expect(transitionSpy).not.toHaveBeenCalled();
		// Round-trip read confirms no write slipped past the pre-check.
		const fresh = await api
			.setContext({ overrideAccess: true })
			.collection('articles')
			.findById(seeded.id);
		expect(fresh?.['workflowStage']).toBe('approved');
	});

	it('does NOT pre-check publish access for non-publishing transitions', async () => {
		// publishVersions: () => false but the transition (draft → in-review)
		// has neither publishesOnEnter nor unpublishesOnEnter, so the pre-check
		// must not run and the transition must succeed.
		setup(
			buildCollection({
				versions: { drafts: true },
				access: {
					read: () => true,
					create: () => true,
					update: () => true,
					delete: () => true,
					publishVersions: () => false,
				},
			}),
		);
		const { id } = await seedDoc('articles', 'draft');
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(200);
	});

	it('passes a usable RequestContext with api.collection() to beforeTransition/afterTransition hooks', async () => {
		const before = vi.fn(
			async ({ req }: { req: { api?: { collection?: (slug: string) => unknown } } }) => {
				const ops = req.api?.collection?.('articles');
				expect(typeof (ops as { findById?: unknown } | undefined)?.findById).toBe('function');
			},
		);
		const after = vi.fn(
			async ({ req }: { req: { api?: { collection?: (slug: string) => unknown } } }) => {
				const ops = req.api?.collection?.('articles');
				expect(typeof (ops as { findById?: unknown } | undefined)?.findById).toBe('function');
			},
		);
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					hooks: { beforeTransition: [before], afterTransition: [after] },
				},
			}),
		);
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(before).toHaveBeenCalledOnce();
		expect(after).toHaveBeenCalledOnce();
	});
});

describe('workflow read access composition', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('findById returns 404 (DocumentNotFoundError) when readStage denies', async () => {
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: {
						readStage: {
							draft: () => false,
							'in-review': () => true,
							approved: () => true,
						},
					},
				},
			}),
		);
		const { id } = await seedDoc('articles', 'draft');
		const api = getMomentumAPI();
		await expect(api.collection('articles').findById(id)).rejects.toThrow(/not found/);
	});

	it('findById succeeds when readStage allows', async () => {
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: {
						readStage: { draft: () => true },
					},
				},
			}),
		);
		const { id } = await seedDoc('articles', 'draft');
		const api = getMomentumAPI();
		await expect(api.collection('articles').findById(id)).resolves.toMatchObject({ id });
	});

	it('list applies defaultStageFilter when no explicit where (asserted via adapter spy)', async () => {
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					defaultStageFilter: () => ['in-review'],
				},
			}),
		);
		await seedDoc('articles', 'draft');
		await seedDoc('articles', 'in-review');
		const api = getMomentumAPI();
		// Spy on the adapter so we can prove the filter reached the query
		// payload — the in-memory adapter doesn't honour where filtering, so
		// asserting `totalDocs >= 1` (the previous version) passes even when
		// the filter is silently dropped.
		const seen: Record<string, unknown>[] = [];
		const adapter = api.getConfig().db.adapter;
		const originalFind = adapter.find.bind(adapter);
		adapter.find = async (slug, query) => {
			seen.push(query as Record<string, unknown>);
			return originalFind(slug, query);
		};
		await api.collection('articles').find();
		const stageFilter = seen[0]?.['workflowStage'];
		expect(stageFilter).toEqual({ $in: ['in-review'] });
	});

	// Finding 3: defaultStageFilter must emit the adapter-facing `$in` operator,
	// not the user-facing `in`. Postgres adapter only dispatches on `$in`, so
	// using bare `in` makes the filter a no-op (or worse, JSON equality).
	it('defaultStageFilter passes $in to the adapter (not bare `in`)', async () => {
		const seen: Record<string, unknown>[] = [];
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					defaultStageFilter: () => ['in-review', 'approved'],
				},
			}),
		);
		// Spy on the configured adapter's `find` to capture the query shape.
		const api = getMomentumAPI();
		const adapter = api.getConfig().db.adapter;
		const originalFind = adapter.find.bind(adapter);
		adapter.find = async (slug, query) => {
			seen.push(query as Record<string, unknown>);
			return originalFind(slug, query);
		};
		await api.collection('articles').find();
		expect(seen.length).toBeGreaterThan(0);
		const stageFilter = seen[0]?.['workflowStage'];
		expect(stageFilter).toEqual({ $in: ['in-review', 'approved'] });
	});
});

describe('workflow column tampering defenses (regression)', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('PATCH-style update strips workflowStage from payload', async () => {
		setup(buildCollection());
		const { id } = await seedDoc('articles', 'draft');
		const api = getMomentumAPI();
		const updated = await api
			.collection('articles')
			.update(id, { title: 'tampered', workflowStage: 'approved' });
		expect(updated['workflowStage']).toBe('draft');
	});

	it('PATCH-style update strips workflowUpdatedAt from payload', async () => {
		setup(buildCollection());
		const { id, updatedAt: originalUpdatedAt } = await seedDoc('articles', 'draft');
		const api = getMomentumAPI();
		const updated = await api
			.collection('articles')
			.update(id, { title: 'tampered', workflowUpdatedAt: '1970-01-01T00:00:00.000Z' });
		expect(updated['workflowUpdatedAt']).toBe(originalUpdatedAt);
	});

	it('create strips workflowStage so caller cannot start a doc in approved', async () => {
		setup(buildCollection());
		const api = getMomentumAPI();
		const created = await api
			.collection('articles')
			.create({ title: 'sneaky', workflowStage: 'approved' });
		// In-memory adapter does not auto-default the column; without a stage
		// in the payload the column is undefined, which is the desired
		// behavior — the workflow handler later sets it. Real adapter applies
		// the SQL DEFAULT.
		expect(created['workflowStage']).toBeUndefined();
	});

	it('overrideAccess context bypasses the strip (workflow handler internal use)', async () => {
		setup(buildCollection());
		const api = getMomentumAPI().setContext({ overrideAccess: true });
		const created = await api
			.collection('articles')
			.create({ title: 'workflow-handler-write', workflowStage: 'in-review' });
		expect(created['workflowStage']).toBe('in-review');
	});
});

// Red-team finding #1: creation history row.
// Closes the audit gap where docs created at `initialStage` had no row in
// the *_workflow_history table — only the first user-initiated transition
// produced one. Compliance audits need a "this doc came into being at
// stage X on date Y" anchor, otherwise the first explicit transition looks
// like the document just sprang into existence in its source stage.
describe('workflow creation history row', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('inserts a fromStage=null history row when a workflow-enabled doc is created', async () => {
		setup(buildCollection());
		const api = getMomentumAPI().setContext({ overrideAccess: true });
		const created = await api.collection('articles').create({ title: 'fresh' });
		const id = String(created['id']);

		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: adminUser,
		});
		expect(result.status).toBe(200);
		const body = result.body as {
			docs: Array<{ fromStage: string | null; toStage: string }>;
			totalDocs: number;
		};
		expect(body.totalDocs).toBe(1);
		expect(body.docs[0]).toMatchObject({ fromStage: null, toStage: 'draft' });
	});

	it('does NOT insert a creation row for collections without a workflow', async () => {
		setup({ slug: 'tags', fields: [{ name: 'name', type: 'text' }] });
		const api = getMomentumAPI();
		// Should simply not crash — tags has no workflow, no history table.
		await expect(api.collection('tags').create({ name: 'urgent' })).resolves.toBeDefined();
	});

	it('attributes the creation row to the calling user when available', async () => {
		setup(buildCollection());
		const editorUser: UserContext = { id: 'u-editor-77', role: 'editor' };
		// Use overrideAccess so the create itself succeeds without going through
		// access.create — the user attribution should still kick in.
		const api = getMomentumAPI().setContext({ overrideAccess: true, user: editorUser });
		const created = await api.collection('articles').create({ title: 'first draft' });
		const id = String(created['id']);

		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: adminUser,
		});
		const body = result.body as {
			docs: Array<{ fromStage: string | null; toStage: string; userId: string | null }>;
		};
		expect(body.docs[0]).toMatchObject({
			fromStage: null,
			toStage: 'draft',
			userId: 'u-editor-77',
		});
	});

	it('creation row + transition row produce ordered (newest-first) history', async () => {
		setup(buildCollection());
		const api = getMomentumAPI().setContext({ overrideAccess: true });
		const created = await api.collection('articles').create({ title: 'flow' });
		const id = String(created['id']);
		// Stamp the doc with the workflow stage so the transition handler can
		// CAS off it. The in-memory adapter does not auto-default the column.
		await api.collection('articles').update(id, {
			workflowStage: 'draft',
			workflowUpdatedAt: new Date().toISOString(),
		});
		await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});

		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: adminUser,
		});
		const body = result.body as {
			docs: Array<{ fromStage: string | null; toStage: string }>;
			totalDocs: number;
		};
		expect(body.totalDocs).toBe(2);
		// Newest first: transition then creation.
		expect(body.docs[0]).toMatchObject({ fromStage: 'draft', toStage: 'in-review' });
		expect(body.docs[1]).toMatchObject({ fromStage: null, toStage: 'draft' });
	});

	// Red-team finding: the creation anchor is best-effort (try/catch + warn).
	// A transient anchor-write failure must NOT roll back the create (the user
	// already received the doc); history simply lacks the anchor. This pins the
	// degradation contract that the e2e exact-count assertions implicitly rely
	// on never triggering.
	it('create still succeeds and history degrades to 0 rows when the anchor write fails', async () => {
		setup(buildCollection());
		const api = getMomentumAPI().setContext({ overrideAccess: true });
		const adapter = api.getConfig().db.adapter;
		vi.spyOn(adapter, 'recordWorkflowCreation').mockRejectedValue(new Error('transient db hiccup'));
		const created = await api.collection('articles').create({ title: 'no-anchor' });
		expect(created['id']).toBeDefined();
		const id = String(created['id']);

		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: adminUser,
		});
		expect(result.status).toBe(200);
		const body = result.body as { totalDocs: number };
		expect(body.totalDocs).toBe(0);
	});
});

describe('handleListWorkflowHistoryRequest', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('returns 400 when collection has no workflow', async () => {
		setup({ slug: 'tags', fields: [{ name: 'name', type: 'text' }] });
		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'tags',
			id: '1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ code: WORKFLOW_ERROR_CODES.WorkflowNotConfigured });
	});

	it('returns 404 when document does not exist', async () => {
		setup(buildCollection());
		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id: 'missing',
			user: adminUser,
		});
		expect(result.status).toBe(404);
	});

	it('returns paginated history with newest entries first', async () => {
		setup(buildCollection());
		const { id } = await seedDoc();
		await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review' },
			user: adminUser,
		});
		await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'draft' },
			user: adminUser,
		});

		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: adminUser,
		});
		expect(result.status).toBe(200);
		const body = result.body as {
			docs: Array<{ fromStage: string | null; toStage: string }>;
			totalDocs: number;
		};
		// 3 rows: creation (null→draft) + draft→in-review + in-review→draft.
		expect(body.totalDocs).toBe(3);
		expect(body.docs[0]).toMatchObject({ fromStage: 'in-review', toStage: 'draft' });
		expect(body.docs[1]).toMatchObject({ fromStage: 'draft', toStage: 'in-review' });
		expect(body.docs[2]).toMatchObject({ fromStage: null, toStage: 'draft' });
	});

	// Regression: history endpoint must filter rows by per-stage readStage
	// access, otherwise a user with read access to the doc's CURRENT stage
	// can see comments authored while the doc was in stages they should NOT
	// be able to read (e.g. confidential intra-editorial notes from the
	// 'draft' phase).
	it('filters history rows when readStage denies a transition stage', async () => {
		// readStage allows admin everywhere, but editors only see 'in-review'
		// and 'approved'. The doc currently sits in 'in-review' so the
		// editor passes the current-stage gate, but rows touching 'draft'
		// must be suppressed.
		const editorUser: UserContext = { id: 'u-editor', role: 'editor' };
		setup(
			buildCollection({
				workflow: {
					...(buildCollection().workflow as NonNullable<CollectionConfig['workflow']>),
					access: {
						readStage: {
							draft: ({ req }) => req.user?.['role'] === 'admin',
							'in-review': () => true,
							approved: () => true,
							archived: () => true,
						},
					},
				},
			}),
		);
		// Build transition history as admin (readStage admin-permitted everywhere).
		const { id } = await seedDoc('articles', 'in-review');
		await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'draft', comment: 'kicked back' },
			user: adminUser,
		});
		await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review', comment: 'resubmitted' },
			user: adminUser,
		});

		// Admin sees the full history: creation (null→draft via initialStage,
		// even though seedDoc injected 'in-review') + 2 transitions = 3.
		const adminResult = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: adminUser,
		});
		const adminBody = adminResult.body as { totalDocs: number };
		expect(adminBody.totalDocs).toBe(3);

		// Editor: readStage['draft'] returns false → both transition rows AND
		// the creation row (toStage='draft') must be suppressed. Result: only
		// the in-review→approved-style rows the editor can see, plus any
		// approved↔in-review rows. Here only the resubmitted 'draft→in-review'
		// row touches draft on the fromStage side, so editor sees zero rows.
		const result = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			user: editorUser,
		});
		expect(result.status).toBe(200);
		const body = result.body as {
			docs: Array<{ fromStage: string | null; toStage: string; comment: string | null }>;
			totalDocs: number;
		};
		expect(body.docs.every((d) => d.fromStage !== 'draft' && d.toStage !== 'draft')).toBe(true);
		expect(body.totalDocs).toBe(body.docs.length);
		// The "kicked back" comment authored in the draft phase must not leak.
		expect(body.docs.find((d) => d.comment === 'kicked back')).toBeUndefined();
	});
});

describe('handleListWorkflowHistoryRequest — readStage-filtered pagination', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	// Red-team finding: when readStage filtering kicks in, the previous
	// implementation did app-layer filtering AFTER paginated reads from the
	// adapter. That meant `totalDocs` was (unfiltered total) minus
	// (this-page suppressed), which is nonsense — it mixes a total-across-
	// pages count with a per-page count. The fix is to push the visibility
	// filter to the adapter so counts and rows match across every page.
	it('reports totalDocs as the actual visible total, not unfiltered minus this-page-suppressed', async () => {
		const editorUser: UserContext = { id: 'u-editor', role: 'editor' };
		// Custom triangular graph (no publishesOnEnter) so we can interleave
		// visible and denied transitions freely without dragging in version
		// ops or publish gates.
		setup({
			slug: 'articles',
			fields: [{ name: 'title', type: 'text' }],
			access: { read: () => true, create: () => true, update: () => true, delete: () => true },
			workflow: {
				stages: [
					{ id: 'a', label: 'A', transitions: ['b', 'c'] },
					{ id: 'b', label: 'B', transitions: ['a', 'c'] },
					{ id: 'c', label: 'C', transitions: ['a', 'b'] },
				],
				initialStage: 'a',
				access: {
					transition: () => true,
					// Editor cannot read rows that touch 'c'. Admin can.
					readStage: {
						a: () => true,
						b: () => true,
						c: ({ req }) => req.user?.['role'] === 'admin',
					},
				},
			},
		});
		const { id } = await seedDoc('articles', 'a');
		// 5 transitions: 3 visible (a↔b), 2 denied (touch 'c').
		const route = async (toStage: string): Promise<void> => {
			await handleTransitionRequest({
				collectionSlug: 'articles',
				id,
				body: { toStage },
				user: adminUser,
			});
		};
		await route('b'); // visible
		await route('a'); // visible
		await route('c'); // denied (touches c)
		await route('a'); // denied (touches c)
		await route('b'); // visible

		// Page 1 (limit 2, newest first): unfiltered rows are [a→b, c→a].
		// The c→a row must be suppressed for the editor. After the fix, the
		// adapter is told the visible stage set up-front, so:
		//   - totalDocs reflects the 3 visible rows across all pages
		//   - totalPages is ceil(3/2) = 2
		//   - hasNextPage is true (the third visible row is on page 2)
		const page1 = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			limit: 2,
			page: 1,
			user: editorUser,
		});
		expect(page1.status).toBe(200);
		const body1 = page1.body as {
			docs: Array<{ fromStage: string | null; toStage: string }>;
			totalDocs: number;
			totalPages: number;
			hasNextPage: boolean;
			hasPrevPage: boolean;
		};
		// No 'c' allowed to appear in either fromStage or toStage.
		expect(body1.docs.every((d) => d.fromStage !== 'c' && d.toStage !== 'c')).toBe(true);
		// 3 transition rows + 1 creation row (null→a, both endpoints visible
		// to editor) = 4 visible rows total. totalPages = ceil(4/2) = 2.
		expect(body1.totalDocs).toBe(4);
		expect(body1.totalPages).toBe(2);
		expect(body1.hasNextPage).toBe(true);

		// Page 2 must yield the remaining visible row(s) — not an empty page
		// because the adapter returned a c-touching row that got post-
		// filtered away.
		const page2 = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			limit: 2,
			page: 2,
			user: editorUser,
		});
		const body2 = page2.body as {
			docs: Array<{ fromStage: string | null; toStage: string }>;
			totalDocs: number;
			hasNextPage: boolean;
			hasPrevPage: boolean;
		};
		expect(body2.docs.length).toBe(2);
		expect(body2.docs.every((d) => d.fromStage !== 'c' && d.toStage !== 'c')).toBe(true);
		expect(body2.totalDocs).toBe(4);
		expect(body2.hasNextPage).toBe(false);
		expect(body2.hasPrevPage).toBe(true);

		// Sanity: admin sees the full unfiltered set: 5 transitions + 1
		// initial creation row = 6.
		const adminPage1 = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			limit: 10,
			user: adminUser,
		});
		const adminBody = adminPage1.body as { totalDocs: number };
		expect(adminBody.totalDocs).toBe(6);
	});
});

describe('handleTransitionRequest — comment length cap', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('rejects comments longer than the cap', async () => {
		setup(buildCollection());
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review', comment: 'A'.repeat(2001) },
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ maxLength: 2000 });
	});

	it('accepts comments at exactly the cap', async () => {
		setup(buildCollection());
		const { id } = await seedDoc();
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'in-review', comment: 'B'.repeat(2000) },
			user: adminUser,
		});
		expect(result.status).toBe(200);
	});
});

describe('handleTransitionRequest — publish-failure compensation', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	// Regression: if publishesOnEnter triggers and versions.publish throws,
	// the previous handler returned 500 with the stage already committed —
	// leaving the doc in approved+draft split-brain. The new handler issues
	// a best-effort revert and reports it back to the caller.
	it('reverts the stage when publish/unpublish fails', async () => {
		const collection = buildCollection();
		const versionedCollection: CollectionConfig = {
			...collection,
			versions: { drafts: { autosave: false } },
		};
		setup(versionedCollection);
		const { id } = await seedDoc('articles', 'in-review');
		const api = getMomentumAPI();
		const ops = api.collection<Record<string, unknown>>('articles');
		const versionOps = ops.versions();
		if (!versionOps) {
			// Hard fail rather than silent skip: a future refactor that breaks
			// versions() wiring would otherwise green this test without ever
			// exercising the compensation path.
			throw new Error(
				'test precondition violated: versions() returned null despite versioned config — refactor broke wiring',
			);
		}
		const originalPublish = versionOps.publish.bind(versionOps);
		versionOps.publish = async () => {
			throw new Error('publish gateway down');
		};
		try {
			const result = await handleTransitionRequest({
				collectionSlug: 'articles',
				id,
				body: { toStage: 'approved' },
				user: adminUser,
			});
			expect(result.status).toBe(500);
			expect(result.body).toMatchObject({ reverted: true });
			// Critical: trust but verify. The response body's `reverted: true`
			// could be set without actually reverting if the handler logic
			// drifts. Re-read the doc and assert the live stage is back to
			// 'in-review', not stuck at 'approved'.
			const stateAdapter = api.getConfig().db.adapter;
			if (!stateAdapter.getWorkflowState) {
				throw new Error('adapter must implement getWorkflowState for this assertion');
			}
			const state = await stateAdapter.getWorkflowState('articles', id);
			expect(state?.workflowStage).toBe('in-review');
		} finally {
			versionOps.publish = originalPublish;
		}
	});

	// Red-team finding: the auto-revert history row's comment used to embed
	// the sanitized publish error verbatim. Even with sanitizeErrorMessage
	// scrubbing stack traces, the surfaced text can include operational
	// detail (constraint names, plugin paths, gateway hostnames) that should
	// not flow into the user-visible audit trail. The comment must be a
	// fixed generic string; the underlying error stays in server logs.
	it('writes a generic auto-revert comment with no error detail', async () => {
		const collection = buildCollection();
		const versionedCollection: CollectionConfig = {
			...collection,
			versions: { drafts: { autosave: false } },
		};
		setup(versionedCollection);
		const { id } = await seedDoc('articles', 'in-review');
		// Trigger publish via approved stage. The in-memory adapter does not
		// implement updateStatus, so VersionOperationsImpl.publish throws
		// "Version operations not supported by database adapter" — a message
		// that historically would have flowed straight into the audit
		// comment. If the adapter ever grows updateStatus support this test
		// would silently stop exercising the compensation path, so hard-fail
		// loudly instead.
		const inMemoryAdapter = getMomentumAPI().getConfig().db.adapter;
		if (inMemoryAdapter.updateStatus !== undefined) {
			throw new Error(
				'test precondition violated: in-memory adapter now implements updateStatus — patch versionOps.publish directly to keep this test honest',
			);
		}
		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'approved' },
			user: adminUser,
		});
		expect(result.status).toBe(500);

		const historyResult = await handleListWorkflowHistoryRequest({
			collectionSlug: 'articles',
			id,
			limit: 10,
			user: adminUser,
		});
		const body = historyResult.body as {
			docs: Array<{ comment: string | null; fromStage: string | null; toStage: string }>;
		};
		const revertRow = body.docs.find(
			(d) => d.fromStage === 'approved' && d.toStage === 'in-review',
		);
		expect(revertRow).toBeDefined();
		// The revert row's comment must match a fixed, generic string with
		// no colon-delimited error detail.
		expect(revertRow?.comment).toBe('[auto-revert] publish/unpublish failed');
		// Belt and braces: nothing resembling the adapter's "not supported"
		// error text should appear in any comment.
		for (const entry of body.docs) {
			expect(entry.comment ?? '').not.toContain('Version operations not supported');
			expect(entry.comment ?? '').not.toContain('database adapter');
		}
	});

	// Red-team finding (round 2): the auto-revert can ITSELF conflict when a
	// third party moves the doc between the failed publish and the revert. The
	// handler must report `reverted: false` (not crash, not claim success) so
	// operators know manual reconciliation is required. This branch
	// (workflow-handlers.ts revert.conflict) was previously uncovered.
	it('returns 500 reverted:false when the auto-revert itself conflicts', async () => {
		const versionedCollection: CollectionConfig = {
			...buildCollection(),
			versions: { drafts: { autosave: false } },
		};
		setup(versionedCollection);
		const { id } = await seedDoc('articles', 'in-review');
		const api = getMomentumAPI();
		const versionOps = api.collection<Record<string, unknown>>('articles').versions();
		if (!versionOps) {
			throw new Error(
				'test precondition violated: versions() returned null despite versioned config',
			);
		}
		versionOps.publish = async () => {
			throw new Error('publish gateway down');
		};

		const adapter = api.getConfig().db.adapter;
		const nowIso = new Date().toISOString();
		const spy = vi
			.spyOn(adapter, 'transitionWorkflowStage')
			// 1st call: the real in-review → approved transition commits.
			.mockResolvedValueOnce({
				conflict: false,
				fromStage: 'in-review',
				toStage: 'approved',
				workflowUpdatedAt: nowIso,
				history: {
					id: 'h-1',
					parent: id,
					fromStage: 'in-review',
					toStage: 'approved',
					userId: null,
					comment: null,
					createdAt: nowIso,
				},
			})
			// 2nd call: the compensating revert conflicts (a concurrent
			// transition landed in between).
			.mockResolvedValueOnce({
				conflict: true,
				currentStage: 'archived',
				currentUpdatedAt: new Date(Date.now() + 1).toISOString(),
			});

		const result = await handleTransitionRequest({
			collectionSlug: 'articles',
			id,
			body: { toStage: 'approved' },
			user: adminUser,
		});
		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({ reverted: false });
		// Both the transition and the (conflicting) revert were attempted.
		expect(spy).toHaveBeenCalledTimes(2);
	});
});
