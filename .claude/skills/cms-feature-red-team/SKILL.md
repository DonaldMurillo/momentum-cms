---
name: cms-feature-red-team
description: Adversarial review checklist for stateful Momentum CMS features (workflow, versions, scheduled publish, permissions inheritance, branches, anything that adds writeable state + access control). Use BEFORE merging a feature that introduces new mutating routes, new system-managed columns, new access functions, or new audit trails. Trigger phrases include "red-team this", "adversarial review", "security review of <feature>", "before merging <feature>", "/cms-feature-red-team".
argument-hint: <feature-name-or-branch>
allowed-tools: Read, Glob, Grep, Bash(git diff *), Bash(git status *), Bash(git log *), Bash(nx test *), Bash(nx affected *)
---

# CMS Feature Red-Team

A repeatable adversarial checklist for new state-changing CMS features. Designed for features shaped like the workflow PR: a new collection-level config block, new system-managed columns, new mutating REST routes, new access functions, and a new audit table.

This is not a generic security review. The patterns here are tuned to **what goes wrong in headless CMSes** — column tampering, audit-trail split-brain, race-condition information leaks, "no access function = allow all" defaults, snapshot/restore as a sideways write, etc.

## RULE 0: ASSUME THE IMPLEMENTER ALREADY DID THE OBVIOUS PASS

The author has almost certainly already prevented basic SQLi and XSS. Your job is to find the **second-order** bugs — the ones that survive the first audit because they look fine until you ask "what about under concurrency / partial failure / a missing config field / a sideways write path?"

If you find yourself writing "this should use parameterized queries" — you are doing the wrong review. Read the diff first, find the actual second-order risk, then surface it with a concrete attack scenario.

**Default to "no findings worth flagging" as a valid output.** A short report that says "I tried these 14 attacks, here's the one that worked" is more valuable than a long list of "consider adding more validation."

## Workflow

1. **Read the diff first.** `git diff origin/main --stat`, then read every file >50 lines. Skim tests last — they tell you what the author thought to defend against, which is exactly the wrong place to start finding what they missed.

2. **For each attack pattern below, ask: "Could this happen here?"** Most will be N/A. The ones that aren't N/A get a finding with a concrete scenario, not a generic suggestion.

3. **Verify before claiming.** If you think a defense is missing, grep for the defense first. Half the "findings" in a first pass already have a comment in the code explaining why they're not findings.

4. **Surface what the author already nailed.** A red-team report that only lists holes is misleading — it implies the author missed everything else. List the attacks you tried that bounced off the existing defenses. This is the part that builds trust in the report.

## The attack patterns

### 1. System-managed columns via direct PATCH/POST

The feature added columns like `workflowStage`, `scheduledPublishAt`, `branchId`, `lockedBy`. The transition/schedule/lock handlers gate writes to these columns. **Does the regular `update`/`create` path also strip them?**

- Find the columns: grep for the new column names in the adapter's `CREATE TABLE`/`ALTER TABLE`.
- Find the strip: grep for `strip<FeatureName>Columns` or equivalent in `momentum-api.ts`.
- Verify both create AND update strip them.
- Verify `overrideAccess` bypasses the strip (so the handler itself can write).
- Verify version restore strips them too (snapshots are a sideways write).

**Attack scenario to write up if missing:** "User with `update` access PATCHes `{workflowStage: 'approved'}` directly, bypassing the transition graph, the access function, and the publish gate."

### 2. "No access function = allow all" default on new mutating endpoint

When a new endpoint inherits the codebase's existing "undefined access = permit" default, it can ship as anonymous-write-enabled by accident.

- Find the new POST/PUT/PATCH/DELETE routes.
- For each: trace the access check. Is there a path where `access.foo === undefined && access.bar === undefined` results in 200?
- The fix is usually a default-deny line in the handler with `overrideAccess` as the only escape hatch.

**Attack scenario:** "A collection that declares the feature but omits both access slots accepts anonymous writes to the new endpoint."

### 3. Error body leaks state that the per-stage / per-branch / per-X read gate is meant to hide

If the feature has per-something read access (`readStage`, `readBranch`, `readRevision`), then error responses on mutating endpoints can leak that state to readers the gate denies.

- Read the body returned on InvalidTransition / NotAllowed / Conflict.
- Does any field carry the doc's current X? (current stage, current branch, current lock holder, etc.)
- If yes — even with a sensible reason like "for client retry UX" — it leaks past readX gates.

**The defense is usually:** keep the field that the caller supplied, drop the field that came from the doc, and add a regression test that asserts no body value equals the actual state string.

### 4. CAS race surfaces wrong error code

When two clients race the same state transition, the loser should get 409 with the canonical "current state was X" envelope — NOT 400 InvalidTransition.

- Find the handler's "is this transition allowed" check. Does it run against the doc's current state read AFTER the winner committed?
- If yes, the loser's `current → target` check fails (no self-loop), returning 400 with the wrong reason.
- Fix: validate the graph against the caller's `expectedX` too, so the CAS layer fires and returns the right code.

**Write up a parallel-POST test that asserts `statuses.sort() === [200, 409]`.** Mocked unit tests aren't enough — exercise real concurrency in the e2e suite.

### 5. Compensation paths leak operational detail into the audit trail

When step 1 commits (write the state) and step 2 fails (fire the side effect), the handler should compensate (revert step 1). If the revert writes a row to an audit table whose `comment` field embeds the step-2 error message, **operational detail flows into a user-visible audit log** — constraint names, plugin paths, gateway hostnames.

- Find the auto-revert code (search for "revert" or "compensation").
- Read the comment / metadata field it writes.
- Confirm the comment is a fixed string with NO interpolated error text. The error stays in server logs.

### 6. Pagination math breaks when access filter applied app-side

If the feature paginates a list AND filters rows by a per-stage / per-row access function, the filter must run inside the adapter — not after the page slice.

- Find the list endpoint. Trace the pagination + access flow.
- If access filtering runs after `adapter.find(...)` returns a page, `totalDocs` is the unfiltered count and `hasNextPage` lies.
- Fix: push the visibility set down to the adapter so counts and rows match.

**Write the regression: list 5 items where 2 are denied, request limit=2 page=1, assert totalDocs=3 (not 5) and page 2 is non-empty.**

### 7. SQL identifier interpolation outside the parameter binding

Adapters often have legitimate SQL-identifier interpolation (table names, column names — these can't be parameterized in Postgres). The audit point is: **does the interpolated value come from a path that runs the validator?**

- Find every backtick template literal in the adapter that contains `${...}`.
- For each non-parameter placeholder, trace the source. Is there a validator (`validateColumnName`, `validateCollectionSlug`, `assertSafeForSql`) called at the interpolation site OR at config-load time?
- The risky case: a value that's validated at config-load BUT can be mutated by a plugin after load. Adapters must re-validate at the interpolation site.
- Equally risky: a value derived from `collection.dbName ?? collection.slug` — only the slug got validated; the dbName silently inherits trust.

### 8. Pre-flight access checks that _should_ run early

When a mutation flow has multiple steps (commit state → fire side effect that needs separate permission), running the second permission check only when step 2 actually executes means:

- Step 1 commits.
- Step 2 trips the permission check and throws.
- The handler runs auto-revert → audit log fills with `[auto-revert]` noise.
- The user sees a 500 when the right answer was 403.

**Fix:** pre-check the step-2 permission BEFORE step 1 commits. Add a spy-on-adapter test asserting the adapter was NEVER called when the user lacks step-2 permission.

### 9. Restore-as-sideways-write

If the system supports versioning, "restore version N" is a write path that bypasses every gate built on the current document state. A snapshot that captured `workflowStage: 'approved'` would restore the live doc into `approved` — clearing the publish gate from a draft.

- Find the restore handler.
- Confirm it strips system-managed columns from the snapshot before re-applying it.
- Confirm it also applies the publish gate if restore-with-publish=true.

### 10. CSRF on the new mutating route

Cookie-auth + state-changing POST + no Origin/Referer/CSRF check = CSRF.

- Better-Auth typically guards `/api/auth/*`. CMS routes mounted under `/api/:collection/*` are usually NOT covered.
- Check for an `Origin` / `Sec-Fetch-Site` middleware on the new route.
- `SameSite=Lax` cookies prevent top-level CSRF on modern browsers but not iframe-form-submit.
- If the feature is the FIRST route that can publish content with a single forged POST, flag it even though the issue is cross-cutting.

### 11. Log injection via user-controlled identifiers

If the handler logs `${params.id}` or `${params.collectionSlug}` into a single-line message, a `\n` in the value spoofs log lines.

- Check whether the logger has structured-field support or escapes newlines.
- Low priority unless logs feed into an alerting pipeline that trusts line boundaries.

### 12. Concurrency on the audit "creation" anchor

If the feature writes a creation-anchor row when a doc enters the system (e.g. `fromStage=null → initialStage`), the call is usually wrapped in `try { ... } catch { log.warn(...) }` so a transient failure doesn't strand the user's create. **The audit gap is silent** — no easy way to detect which docs are missing anchors.

- Look for the warn log. If that's the only signal, suggest emitting a structured event so operators can alert on the gap.

### 13. Backfill that runs as one giant transaction

Init-time backfills (when a feature is added to an existing collection) often do `UPDATE` + per-row INSERTs in a single tx. On a 5M-row collection this is a multi-minute lock.

- If you find a backfill, check whether it batches. If not, suggest batching with idempotency via an init-log table.

### 14. Init-log doesn't notice when config drifts

When the init-log records `initialStage: 'draft'` and later the developer renames `initialStage` to `idea`, the backfill won't re-run. **Old docs sit on the old initial stage forever.** Auto-migrating is wrong (don't touch in-flight docs); silent divergence is also wrong. The fix is a boot-time warning when `recorded.initialStage !== config.initialStage`.

### 15. Frontend "raw identifier" UX debt

Audit-log UIs often render `userId` as a raw UUID. Not a security finding, but expect every reviewer to file the same ticket. Either fix it in the same PR or open a follow-up.

## Output format

Structure the report as:

1. **Verdict** — one paragraph. Ship / ship with caveats / hold.
2. **Already defended** — table of attacks you tried that the author already blocked, with the file:line of the defense. This is the trust-building section.
3. **Real findings** — ranked HIGH / MEDIUM / LOW / NIT. Each finding has:
   - One-sentence summary
   - Concrete attack scenario (not "consider adding validation")
   - File:line of the gap
   - File:line of where the fix goes
   - Whether the fix is in-scope for this PR or a cross-cutting follow-up
4. **What I checked and found nothing wrong with** — short bullet list of the auditable surfaces you confirmed clean.

## Exemplars in this repo

When in doubt, read the workflow PR's review notes — most of the second-order patterns above were caught and defended there:

- `libs/server-core/src/lib/workflow-handlers.ts` — secure-by-default gating, pre-flight publish access check, compensation comment scrubbing, InvalidTransition body sanitization, readStage push-down for pagination consistency.
- `libs/server-core/src/lib/momentum-api.ts` — `stripWorkflowColumns` on create + update; readStage gate on findById returning 404 (not 403); `defaultStageFilter` using adapter-facing `$in`.
- `libs/db-drizzle/src/lib/db-postgres.ts` — `assertStageIdSafeForSql` at the DDL interpolation site; `restoreVersion` stripping `workflowStage`/`workflowUpdatedAt`; per-row backfill inside a single tx (with the init-log gate).
- `libs/core/src/lib/workflow/workflow-validators.ts` — boot-time validation that runs at `defineCollection` time, not at first transition.

## What this skill is NOT

- Not a generic OWASP checklist. Use `/security-review` for cross-cutting code that isn't CMS-shaped.
- Not a substitute for the `code-quality` agent (DRY/KISS/SRP) or `a11y-auditor` (WCAG).
- Not a place to add findings about formatting, comment style, or "consider extracting this function." Those are review-restraint violations.
