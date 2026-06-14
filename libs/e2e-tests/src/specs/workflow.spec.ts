import { test, expect, TEST_CREDENTIALS, TEST_EDITOR_CREDENTIALS } from '../fixtures';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';

/**
 * Workflow E2E coverage — exercises the live transition + history + publish-gate
 * surfaces against a real server. Admin user covers happy path; editor user
 * covers the permissions-denied branch where the workflow access function
 * blocks transitions outside the editor's lane.
 */

interface PostCreateResponse {
	doc: { id: string };
}

interface TransitionSuccess {
	id: string;
	fromStage: string;
	toStage: string;
	workflowUpdatedAt: string;
	historyId: string;
	published: boolean;
	unpublished: boolean;
}

interface TransitionConflict {
	error: string;
	code: string;
	currentStage?: string;
	currentUpdatedAt?: string;
	requiredStage?: string;
}

async function signIn(
	request: APIRequestContext,
	creds: { email: string; password: string },
): Promise<void> {
	const res = await request.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: creds,
	});
	expect(res.ok(), `Sign-in for ${creds.email} must succeed`).toBe(true);
}

async function createPost(request: APIRequestContext, title: string): Promise<string> {
	const res = await request.post('/api/posts', {
		headers: { 'Content-Type': 'application/json' },
		data: { title, content: '<p>workflow test body</p>' },
	});
	expect(res.status(), `Post create for "${title}" must return 201`).toBe(201);
	const body = (await res.json()) as PostCreateResponse;
	return body.doc.id;
}

async function transition(
	request: APIRequestContext,
	id: string,
	body: Record<string, unknown>,
): Promise<{ status: number; body: TransitionSuccess | TransitionConflict }> {
	const res = await request.post(`/api/posts/${id}/transition`, {
		headers: { 'Content-Type': 'application/json' },
		data: body,
	});
	const responseBody = (await res.json()) as TransitionSuccess | TransitionConflict;
	return { status: res.status(), body: responseBody };
}

test.describe('Workflow API', { tag: ['@api', '@workflow'] }, () => {
	const postIds: string[] = [];

	test.afterAll(async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		for (const id of postIds) {
			await request.delete(`/api/posts/${id}`).catch(() => undefined);
		}
	});

	test('happy path: draft → in-review → approved auto-publishes', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-HappyPath');
		postIds.push(id);

		const toReview = await transition(request, id, { toStage: 'in-review', comment: 'review pls' });
		expect(toReview.status).toBe(200);
		const reviewBody = toReview.body as TransitionSuccess;
		expect(reviewBody).toMatchObject({
			fromStage: 'draft',
			toStage: 'in-review',
			published: false,
		});

		const toApproved = await transition(request, id, {
			toStage: 'approved',
			expectedStage: 'in-review',
			expectedUpdatedAt: reviewBody.workflowUpdatedAt,
		});
		expect(toApproved.status).toBe(200);
		const approvedBody = toApproved.body as TransitionSuccess;
		expect(approvedBody).toMatchObject({
			fromStage: 'in-review',
			toStage: 'approved',
			published: true,
		});

		const historyRes = await request.get(`/api/posts/${id}/workflow-history`);
		expect(historyRes.status()).toBe(200);
		const historyBody = (await historyRes.json()) as { totalDocs: number };
		// 2 transitions (draft→in-review, in-review→approved) + 1 creation anchor.
		expect(historyBody.totalDocs).toBe(3);
	});

	test('rejects undeclared transition with WORKFLOW_INVALID_TRANSITION', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-InvalidTransition');
		postIds.push(id);

		const skip = await transition(request, id, { toStage: 'approved' });
		expect(skip.status).toBe(400);
		expect((skip.body as TransitionConflict).code).toBe('WORKFLOW_INVALID_TRANSITION');
	});

	test('returns 409 ConflictStaleStage when expectedUpdatedAt is stale', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-Conflict');
		postIds.push(id);

		const stale = await transition(request, id, {
			toStage: 'in-review',
			expectedUpdatedAt: new Date(0).toISOString(),
		});
		expect(stale.status).toBe(409);
		const body = stale.body as TransitionConflict;
		expect(body.code).toBe('WORKFLOW_CONFLICT_STALE_STAGE');
		expect(body.currentStage).toBe('draft');
	});

	test('publish endpoint blocked by workflow gate when stage is draft', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-PublishGated');
		postIds.push(id);

		const publishRes = await request.post(`/api/posts/${id}/publish`);
		expect(publishRes.status()).toBe(409);
		const body = (await publishRes.json()) as TransitionConflict;
		expect(body.code).toBe('WORKFLOW_PUBLISH_GATE_NOT_MET');
		expect(body.currentStage).toBe('draft');
	});

	test('schedule-publish endpoint blocked by workflow gate when stage is draft', async ({
		request,
	}) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-ScheduleGated');
		postIds.push(id);

		const futureDate = new Date(Date.now() + 3_600_000).toISOString();
		const res = await request.post(`/api/posts/${id}/schedule-publish`, {
			headers: { 'Content-Type': 'application/json' },
			data: { publishAt: futureDate },
		});
		expect(res.status()).toBe(409);
		const body = (await res.json()) as TransitionConflict;
		expect(body.code).toBe('WORKFLOW_PUBLISH_GATE_NOT_MET');
	});

	test('editor cannot transition in-review → approved (reviewer-only lane)', async ({
		request,
		workerBaseURL,
	}) => {
		// Move post to in-review as admin first.
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-EditorBlocked');
		postIds.push(id);
		const toReview = await transition(request, id, { toStage: 'in-review' });
		expect(toReview.status).toBe(200);

		// Switch identity to editor using an ISOLATED context. Better Auth will
		// not establish a second session over the admin session cookie already
		// on the shared `request` jar, so a fresh context whose cookie jar holds
		// only the editor session is required (same pattern as the multi-user
		// versioning specs).
		const editorCtx = await playwrightRequest.newContext({ baseURL: workerBaseURL });
		try {
			await signIn(editorCtx, TEST_EDITOR_CREDENTIALS);
			// Confirm the editor identity actually landed (email AND role) —
			// otherwise the test could pass for the wrong reason (anonymous/admin
			// returning 403, or a silently-elevated editor seed).
			const sessionRes = await editorCtx.get('/api/auth/get-session');
			const session = (await sessionRes.json()) as {
				user?: { role?: string; email?: string };
			} | null;
			expect(session?.user?.email).toBe(TEST_EDITOR_CREDENTIALS.email);
			expect(session?.user?.role).toBe('editor');

			// Positive control: the editor CAN perform its own lane
			// (draft → in-review) on a fresh post. This proves the editor is not
			// globally blocked, so the 403 below is specifically the reviewer-only
			// lane denial — not the secure-by-default guard or a publish-access
			// 403 that would also surface as 403 if the transition access fn were
			// removed.
			const ownId = await createPost(editorCtx, 'WF-EditorAllowedLane');
			postIds.push(ownId);
			const editorOwnLane = await editorCtx.post(`/api/posts/${ownId}/transition`, {
				headers: { 'Content-Type': 'application/json' },
				data: { toStage: 'in-review' },
			});
			expect(editorOwnLane.status()).toBe(200);

			// Negative: editor attempts to approve the in-review post — denied by
			// workflow.access.transition (reviewer/admin only).
			const editorAttempt = await editorCtx.post(`/api/posts/${id}/transition`, {
				headers: { 'Content-Type': 'application/json' },
				data: { toStage: 'approved' },
			});
			expect(editorAttempt.status()).toBe(403);
			const denyBody = (await editorAttempt.json()) as { error?: string };
			expect(denyBody.error).toBe('Access denied');
		} finally {
			await editorCtx.dispose();
		}
	});

	test('history records each transition newest-first with comment', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-History');
		postIds.push(id);

		await transition(request, id, { toStage: 'in-review', comment: 'first review' });
		await transition(request, id, { toStage: 'draft', comment: 'send back' });
		await transition(request, id, { toStage: 'in-review', comment: 'second review' });

		const historyRes = await request.get(`/api/posts/${id}/workflow-history`);
		const historyBody = (await historyRes.json()) as {
			docs: Array<{ fromStage: string | null; toStage: string; comment: string | null }>;
			totalDocs: number;
		};
		// 3 transitions + 1 creation anchor (fromStage=null → initialStage),
		// newest-first. The anchor is the oldest row and is always recorded on
		// create (see momentum-api create path / db adapter recordWorkflowCreation).
		expect(historyBody.totalDocs).toBe(4);
		expect(historyBody.docs[0]).toMatchObject({
			fromStage: 'draft',
			toStage: 'in-review',
			comment: 'second review',
		});
		expect(historyBody.docs[2]).toMatchObject({
			fromStage: 'draft',
			toStage: 'in-review',
			comment: 'first review',
		});
		// Oldest row is the creation anchor: null → draft, no transition comment.
		expect(historyBody.docs[3]).toMatchObject({
			fromStage: null,
			toStage: 'draft',
			comment: null,
		});
	});

	test('concurrent transition attempts: exactly one succeeds, one returns 409', async ({
		request,
	}) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-Race');
		postIds.push(id);

		const stateRes = await request.get(`/api/posts/${id}`);
		const stateBody = (await stateRes.json()) as { doc: { workflowUpdatedAt: string } };
		const expectedUpdatedAt = stateBody.doc.workflowUpdatedAt;

		const [a, b] = await Promise.all([
			transition(request, id, {
				toStage: 'in-review',
				expectedStage: 'draft',
				expectedUpdatedAt,
			}),
			transition(request, id, {
				toStage: 'in-review',
				expectedStage: 'draft',
				expectedUpdatedAt,
			}),
		]);

		const statuses = [a.status, b.status].sort();
		expect(statuses).toEqual([200, 409]);
		const conflict = (a.status === 409 ? a.body : b.body) as TransitionConflict;
		expect(conflict.code).toBe('WORKFLOW_CONFLICT_STALE_STAGE');
		expect(conflict.currentStage).toBe('in-review');
	});

	test('unknown toStage returns 400 WORKFLOW_UNKNOWN_STAGE', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-UnknownStage');
		postIds.push(id);

		const res = await transition(request, id, { toStage: 'ghost' });
		expect(res.status).toBe(400);
		expect((res.body as TransitionConflict).code).toBe('WORKFLOW_UNKNOWN_STAGE');
	});

	test('missing toStage in body returns 400', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-EmptyBody');
		postIds.push(id);

		const res = await request.post(`/api/posts/${id}/transition`, {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		expect(res.status()).toBe(400);
	});

	test('history endpoint returns 404 for non-existent document', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const res = await request.get('/api/posts/nonexistent-id-zzz/workflow-history');
		expect(res.status()).toBe(404);
	});

	test('transition endpoint returns 404 for non-existent document', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const res = await request.post('/api/posts/nonexistent-id-zzz/transition', {
			headers: { 'Content-Type': 'application/json' },
			data: { toStage: 'in-review' },
		});
		expect(res.status()).toBe(404);
	});

	test('publish gate clears once stage reaches approved', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-GateClears');
		postIds.push(id);

		// Move to in-review then approved (which auto-publishes)
		const review = await transition(request, id, { toStage: 'in-review' });
		expect(review.status).toBe(200);
		const approve = await transition(request, id, { toStage: 'approved' });
		expect(approve.status).toBe(200);
		expect((approve.body as TransitionSuccess).published).toBe(true);

		// Status should now be published — verify via /api endpoint
		const docRes = await request.get(`/api/posts/${id}`);
		const docBody = (await docRes.json()) as { doc: { _status?: string } };
		expect(docBody.doc._status).toBe('published');
	});

	test('back-and-forth transition preserves history audit trail', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-BackForth');
		postIds.push(id);

		await transition(request, id, { toStage: 'in-review', comment: 'r1' });
		await transition(request, id, { toStage: 'draft', comment: 'bounce' });
		await transition(request, id, { toStage: 'in-review', comment: 'r2' });
		await transition(request, id, { toStage: 'draft', comment: 'bounce again' });
		await transition(request, id, { toStage: 'in-review', comment: 'r3' });

		const res = await request.get(`/api/posts/${id}/workflow-history`);
		const body = (await res.json()) as { totalDocs: number };
		// 5 transitions + 1 creation anchor = 6.
		expect(body.totalDocs).toBe(6);
	});

	test('comment field is stored verbatim in history', async ({ request }) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-Comment');
		postIds.push(id);

		const longComment = 'A'.repeat(500) + ' — édge cases & ünicode';
		await transition(request, id, { toStage: 'in-review', comment: longComment });

		const res = await request.get(`/api/posts/${id}/workflow-history`);
		const body = (await res.json()) as { docs: Array<{ comment: string | null }> };
		expect(body.docs[0]?.comment).toBe(longComment);
	});

	test('expectedStage mismatch returns 409 even when expectedUpdatedAt matches', async ({
		request,
	}) => {
		await signIn(request, TEST_CREDENTIALS);
		const id = await createPost(request, 'WF-StageMismatch');
		postIds.push(id);

		// Move to in-review
		const r1 = await transition(request, id, { toStage: 'in-review' });
		expect(r1.status).toBe(200);
		const updatedAt = (r1.body as TransitionSuccess).workflowUpdatedAt;

		// Try to transition assuming the stage is still 'draft'
		const stale = await transition(request, id, {
			toStage: 'draft',
			expectedStage: 'draft',
			expectedUpdatedAt: updatedAt,
		});
		expect(stale.status).toBe(409);
	});
});
