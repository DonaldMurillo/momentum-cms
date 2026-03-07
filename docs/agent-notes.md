# Agent Notes

## 2026-03-07 - Headless dialog and radio a11y regressions

- Scope: headless
- Trigger: Hardening `@momentumcms/headless` before publish exposed two silent regressions: `HdlDialogService.closeAll()` could skip dialogs, and `HdlRadioGroup` had no tabbable item before selection.
- Approach: Iterate over a copy in `libs/headless/src/lib/dialog/dialog.service.ts`, unregister dialog labels on destroy, and compute the initial radio tab stop from the first enabled item.
- Evidence: `npx nx test headless`, `npx nx lint headless`, `npx nx build headless`, `docs/headless/overview.md`
- Next time: Add keyboard and lifecycle tests for every new headless primitive before treating a green build as proof.
- Status: active
