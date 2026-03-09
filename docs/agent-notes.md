# Agent Notes

## 2026-03-07 - Headless dialog and radio a11y regressions

- Scope: headless
- Trigger: Hardening `@momentumcms/headless` before publish exposed two silent regressions: `HdlDialogService.closeAll()` could skip dialogs, and `HdlRadioGroup` had no tabbable item before selection.
- Approach: Iterate over a copy in `libs/headless/src/lib/dialog/dialog.service.ts`, unregister dialog labels on destroy, and compute the initial radio tab stop from the first enabled item.
- Evidence: `npx nx test headless`, `npx nx lint headless`, `npx nx build headless`, `docs/headless/overview.md`
- Next time: Add keyboard and lifecycle tests for every new headless primitive before treating a green build as proof.
- Status: active

## 2026-03-08 - Headless global styling contract

- Scope: headless
- Trigger: We wanted the entire headless library to be themeable from a global Tailwind layer without shipping library CSS.
- Approach: Add stable `data-slot` markers to hosts, expose normalized state attrs like `data-state` / `data-disabled` where the wrapper already knows state, and give overlay primitives stable panel/backdrop selectors.
- Evidence: `docs/headless/styling.md`, `libs/headless/src/lib/dialog/dialog.service.ts`, `npx nx test headless`
- Next time: Style against `data-slot` and overlay selectors first; treat raw tag names and incidental ARIA as fallback selectors, not the primary contract.
- Status: active

## 2026-03-08 - Headless customization testing

- Scope: headless
- Trigger: A global styling contract is only trustworthy if both the selectors and the rendered browser output are exercised.
- Approach: Keep fast contract assertions in `libs/headless`, use `/headless-styling-lab` in `example-angular` as the integration harness, and verify computed styles in `libs/e2e-tests/src/specs/headless-styling.spec.ts`.
- Evidence: `npx nx test headless`, `npx playwright test -c apps/example-angular-e2e/playwright.config.ts libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: Extend the styling lab first when adding a new primitive, then add the matching unit and browser assertions in the same change.
- Status: active

## 2026-03-08 - Global styling harness pitfalls

- Scope: headless
- Trigger: The first styling lab pass looked fine in light mode, but dark mode was ignored, a tab panel leaked white artifacts, and an ad hoc switch override was too blunt.
- Approach: Keep the lab token-driven with `.dark` overrides in `apps/example-angular/src/styles.css`, preserve native collapse semantics with slot-specific `[hidden] { display: none !important; }`, make one-off variants override host-scoped custom properties instead of raw child styles, and force bordered custom-element hosts like `tab-panel` to `display: block` so inline layout does not leave border artifacts.
- Evidence: `apps/example-angular/src/styles.css`, `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`, `libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: When a headless primitive gets showcased, test theme switching and hidden-state rendering in the browser before trusting the CSS recipe.
- Status: active

## 2026-03-08 - Popup and toast host layout gotchas

- Scope: headless
- Trigger: The styling lab still showed popup corner artifacts, inline menu rows, and a toast clipped into a tiny sliver even after the first global recipe pass.
- Approach: Style popup surfaces at the container level (`[data-slot='menu'] > [data-slot='menu-item']`, `[data-slot='listbox'] > [data-slot='option']`) so menubars can stay inline while popup menus stack vertically, add `overflow: hidden` to rounded popup hosts, and give the fixed `toast-container` an explicit width so the custom-element host cannot collapse to `0px`.
- Evidence: `apps/example-angular/src/styles.css`, `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`, `npx playwright test -c apps/example-angular-e2e/playwright.config.ts libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: When a custom-element surface looks visually wrong, inspect computed `display`, `overflow`, and width on both the host and its immediate children before blaming the primitive logic.
- Status: active

## 2026-03-08 - Styling lab e2e worker pressure

- Scope: headless
- Trigger: The targeted styling-lab Playwright spec exhausted Postgres with `sorry, too many clients already` under the default 4-worker local configuration.
- Approach: Keep `libs/e2e-tests/src/specs/headless-styling.spec.ts` serial so one worker reuses the same server and database, add a lightweight `libs/e2e-tests/src/fixtures/public.ts` path for public-page specs so they do not create auth users at all, set `MOMENTUM_DISABLE_BACKGROUND_WORKERS=true` in `libs/e2e-fixtures/src/worker-server.ts`, and cap the example app plus setup pool to a tiny number of Postgres clients during E2E runs with `MOMENTUM_DB_MAX_CLIENTS`.
- Evidence: `libs/e2e-tests/src/specs/headless-styling.spec.ts`, `libs/e2e-tests/src/fixtures/public.ts`, `libs/e2e-fixtures/src/worker-server.ts`, `apps/example-angular/src/momentum.config.ts`, `pnpm playwright test -c apps/example-angular-e2e/playwright.config.ts libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: If a spec only exercises public routes, use the lightweight public worker fixture instead of paying the full auth setup cost.
- Status: active

## 2026-03-08 - Behavior-driven headless showcase

- Scope: headless
- Trigger: The styling lab was too easy to mistake for a decorative gallery, and that made it too easy to miss whether a primitive actually behaved correctly.
- Approach: Start `/headless-styling-lab` with a coverage matrix for every exported primitive family, then give each demo a visible outcome or readout that Playwright can assert, such as combobox filtering, menu actions, toolbar values, and toast actions.
- Evidence: `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`, `libs/e2e-tests/src/specs/headless-styling.spec.ts`, `pnpm playwright test -c apps/example-angular-e2e/playwright.config.ts libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: Add the user-visible outcome first, then write the browser test against that outcome before polishing the CSS.
- Status: active

## 2026-03-08 - Coverage matrix should inventory, not navigate

- Scope: headless
- Trigger: The first coverage matrix pass used clickable cards, and in the routed example app that could bounce users away from the lab instead of simply showing the export surface.
- Approach: Keep the matrix as a non-interactive inventory card grid, label which demo section owns each primitive, and update the copy as soon as a previously missing primitive ships so the lab does not keep lying about gaps that were already closed.
- Evidence: `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`, `apps/example-angular/src/styles.css`, `libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: If a page says it shows "all" primitives, make sure it either inventories the current exports plainly or names the gaps instead of smuggling in broken navigation.
- Status: active

## 2026-03-08 - Headless form foundations

- Scope: headless
- Trigger: The library had strong selection and overlay primitives, but no reusable field semantics, generic text entry, or chips foundation, which made the styling lab and export surface visibly incomplete.
- Approach: Add `HdlField` context plus `HdlLabel`, `HdlDescription`, `HdlError`, `HdlInput`, `HdlTextarea`, and chips primitives, then verify them in both `libs/headless` specs and the `/headless-styling-lab` form-foundations section.
- Evidence: `libs/headless/src/lib/field/field.component.ts`, `libs/headless/src/lib/field/field.spec.ts`, `libs/headless/src/lib/chips/chips.spec.ts`, `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`
- Next time: When adding a headless form primitive, wire it into field semantics and the styling lab in the same change instead of shipping an orphaned directive.
- Status: active

## 2026-03-08 - Keep the styling lab off SSR

- Scope: headless
- Trigger: `/headless-styling-lab` could pin the example app server at 100% CPU and never finish an SSR response, even though normal public routes still rendered.
- Approach: Mark the lab route as `RenderMode.Client` in `apps/example-angular/src/app/app.routes.server.ts` because it is a behavior demo/test harness, not SEO content. Keep the example route browsable, but do not let its heavy interactive surface hold the server hostage.
- Evidence: `apps/example-angular/src/app/app.routes.server.ts`, `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`, `curl -I http://localhost:4307/headless-styling-lab`
- Next time: If a route exists to exercise interactive primitives rather than deliver indexed content, make it client-rendered before spending hours trying to make SSR love it back.
- Status: active

## 2026-03-08 - Untrack field registration effects

- Scope: headless
- Trigger: `/headless-styling-lab` looked like it had an infinite client loop after the form-foundations demos landed, and isolated probing showed any `hdl-field` demo with `hdl-description` could keep the browser renderer pegged.
- Approach: Treat field registration as imperative bookkeeping, not reactive state derivation. Wrap `registerControl`, `unregisterControl`, `registerDescription`, `unregisterDescription`, `registerError`, and `unregisterError` calls in `untracked(...)` inside the input, textarea, description, and error effects so those effects do not subscribe to the field signals they mutate.
- Evidence: `libs/headless/src/lib/input/input.component.ts`, `libs/headless/src/lib/textarea/textarea.component.ts`, `libs/headless/src/lib/field/description.component.ts`, `libs/headless/src/lib/field/error.component.ts`, `node + playwright` load probe against `/headless-styling-lab`
- Next time: If an effect calls a registration method that reads or writes signals on shared context, wrap the registration in `untracked` before you ship a self-licking ice cream cone.
- Status: active

## 2026-03-08 - Keep headless docs and Claude skills aligned

- Scope: headless
- Trigger: The public docs, root README, and Claude skill surface can drift separately, which is how you end up with agents treating shipped headless primitives like vaporware or consuming them without the global styling contract.
- Approach: When the headless export surface changes, update `README.md`, `docs/headless/overview.md`, `docs/headless/usage.md`, and `docs/headless/styling.md` together, and keep the repo skill in `.claude/skills/headless-primitive/SKILL.md` plus the generated-app skill in `apps/create-momentum-app/templates/shared/.claude/skills/headless-ui/SKILL.md` in sync with that workflow.
- Evidence: `README.md`, `docs/headless/overview.md`, `docs/headless/usage.md`, `.claude/skills/headless-primitive/SKILL.md`, `apps/create-momentum-app/templates/shared/.claude/skills/headless-ui/SKILL.md`
- Next time: If a headless primitive ships and the docs or skills still talk like it does not exist, fix the words in the same change instead of letting the repo gaslight the next agent.
- Status: active

## 2026-03-08 - Drawer and list host display contracts matter

- Scope: headless
- Trigger: The styling lab showed `select` and `command` items collapsing into inline rows, and the new drawer rendered like a floating dialog card in the corner instead of occupying the drawer pane.
- Approach: In the app-level global recipes, force custom-element list descendants like `select-item`, `command-item`, and `command-group` to `display: block` with `width: 100%`, and make the drawer host plus its focus-trap wrapper fill the overlay pane (`width: 100%`, `height: 100%`) with side-aware border radii.
- Evidence: `apps/example-angular/src/styles.css`, `apps/example-angular/src/app/pages/headless-styling-lab.page.ts`, `libs/e2e-tests/src/specs/headless-styling.spec.ts`
- Next time: If a custom-element surface looks horizontally cursed or an overlay component is not occupying its pane, inspect the host display contract before assuming the primitive logic is wrong.
- Status: active
