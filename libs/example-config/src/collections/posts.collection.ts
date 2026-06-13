import {
	defineCollection,
	text,
	richText,
	isAuthenticated,
	allowAll,
	hasRole,
	or,
} from '@momentumcms/core';

/**
 * Editorial Posts collection — the home of the editorial review workflow demo.
 *
 * Deliberately separate from `Articles`: the versioning/publishing/scheduled-
 * publishing E2E suites exercise *direct* publish on `articles` and must keep
 * that behaviour. A workflow with `publishesOnEnter` gates direct publish
 * behind reaching the `approved` stage, which is incompatible with those
 * direct-publish assertions. Hosting the workflow here keeps both features
 * honestly tested on their own collections.
 *
 * Workflow: Draft → In Review → Approved (publishes).
 * - Editors push from draft → in-review.
 * - Reviewers (and admins) approve (publish) or send back to draft.
 * - Entering `approved` auto-publishes via the existing publish flow.
 */
export const Posts = defineCollection({
	slug: 'posts',
	labels: {
		singular: 'Post',
		plural: 'Posts',
	},
	admin: {
		group: 'Content',
	},
	fields: [
		text('title', { required: true, label: 'Title' }),
		richText('content', { label: 'Content' }),
	],
	// Drafts/versions are required for the `publishesOnEnter` stage to publish.
	versions: {
		drafts: true,
		maxPerDoc: 10,
	},
	access: {
		read: allowAll(),
		create: or(hasRole('admin'), hasRole('editor')),
		update: or(hasRole('admin'), hasRole('editor'), hasRole('reviewer')),
		delete: hasRole('admin'),
		admin: isAuthenticated(),
		readDrafts: or(hasRole('admin'), hasRole('editor'), hasRole('reviewer')),
		readVersions: isAuthenticated(),
		publishVersions: or(hasRole('admin'), hasRole('reviewer')),
		restoreVersions: hasRole('admin'),
	},
	workflow: {
		stages: [
			{ id: 'draft', label: 'Draft', color: 'gray', transitions: ['in-review'] },
			{
				id: 'in-review',
				label: 'In Review',
				color: 'amber',
				transitions: ['draft', 'approved'],
			},
			{
				id: 'approved',
				label: 'Approved',
				color: 'green',
				transitions: ['draft'],
				publishesOnEnter: true,
			},
		],
		initialStage: 'draft',
		access: {
			// NOTE: the `reviewer` role below is intentionally not (yet) part of
			// AUTH_ROLES (admin/editor/user/viewer). No seeded user holds it, so
			// in tests the admin user covers the reviewer lane and the editor
			// user exercises the denial path. Add `reviewer` to AUTH_ROLES plus a
			// seeded reviewer user to demonstrate the reviewer-but-not-admin path.
			transition: ({ from, to, req }) => {
				const role = req.user?.role;
				// Editors (and admins) can push drafts forward into review.
				if (from === 'draft' && to === 'in-review') {
					return role === 'admin' || role === 'editor';
				}
				// Reviewers (and admins) can approve or bounce back.
				if (from === 'in-review' && (to === 'approved' || to === 'draft')) {
					return role === 'admin' || role === 'reviewer';
				}
				// Everything else (e.g. admin reset-to-draft) is admin-only.
				return role === 'admin';
			},
		},
	},
});
