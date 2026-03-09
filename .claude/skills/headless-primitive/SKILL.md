---
name: headless-primitive
description: Author, extend, or repair primitives in libs/headless. Use when adding a new headless primitive, changing its accessibility contract, updating slots/state attrs, wiring overlay behavior, or expanding the example styling lab and tests.
argument-hint: <primitive-or-family>
---

# Headless Primitive Maintenance

Use this skill when working on `@momentumcms/headless` itself.

## Start Here

Read these files before changing behavior:

1. `libs/headless/CLAUDE.md`
2. `docs/headless/overview.md`
3. `docs/headless/styling.md`

Read these too when the styling surface or demos change:

1. `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`
2. `libs/e2e-tests/src/specs/headless-styling.spec.ts`
3. `docs/agent-notes.md`

## Non-Negotiable Rules

- Keep primitives unstyled. No bundled CSS, no visual classes, no theme tokens inside `libs/headless`.
- Expose behavior on the host element. Prefer `template: '<ng-content />'` and avoid wrapper elements unless the platform forces one.
- Preserve the global styling contract. Stable `data-slot` selectors and normalized state attributes matter as much as the public TypeScript API.
- Favor Angular CDK and Angular Aria primitives over custom behavior when they fit.
- If a primitive participates in the styling lab, pair it with a visible readout or outcome that browser tests can assert.

## Implementation Workflow

1. Check the current export surface in `libs/headless/src/index.ts`.
2. Follow the existing family pattern before inventing a new one.
3. Add or update unit specs next to the primitive.
4. If the styling or interaction contract changes, update `/headless-styling-lab` and its Playwright spec.
5. Update `docs/headless/overview.md` and `docs/headless/styling.md` when the public surface changes.
6. Add a note to `docs/agent-notes.md` for any bug, workaround, or testing heuristic worth keeping.

## Verification

Run the narrowest useful set first:

```bash
pnpm nx test headless
pnpm nx lint headless
pnpm nx build headless
```

If you touched the styling contract, example route, or browser behavior, also run:

```bash
pnpm nx test example-angular
pnpm nx lint example-angular
pnpm nx build example-angular
pnpm playwright test -c apps/example-angular-e2e/playwright.config.ts libs/e2e-tests/src/specs/headless-styling.spec.ts
```

## Common Pitfalls

- Do not let effects both track and mutate shared field signals. Registration helpers that read signal state usually need `untracked(...)`.
- Do not make the coverage inventory act like navigation. Inventory should state scope, not bounce users out of the lab.
- Do not trust visual polish without a behavior assertion. Filtering, selection, open state, dismissals, and keyboard flow should all have observable outcomes.
