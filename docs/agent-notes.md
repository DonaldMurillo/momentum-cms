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
