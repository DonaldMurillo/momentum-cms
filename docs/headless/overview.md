# Headless UI

`@momentumcms/headless` provides unstyled Angular primitives for accessibility and interaction behavior. Components expose ARIA state, keyboard handling, and focus management without shipping presentation classes or CSS.

## Current Guarantees

- Dialog labels stay in sync with `aria-labelledby` and `aria-describedby` when title or description nodes are added or removed.
- `HdlDialogService.closeAll()` closes every open dialog, even when the close operation mutates the internal registry.
- Radio groups always expose exactly one initial tab stop for keyboard users: the selected item, or the first enabled item when nothing is selected yet.
- Disabled radio groups do not move focus or change selection from arrow-key input.

## Verification

Run the library quality checks with:

```bash
npx nx test headless
npx nx lint headless
npx nx build headless
```
