# Headless UI

`@momentumcms/headless` provides unstyled Angular primitives for accessibility and interaction behavior. Components expose ARIA state, keyboard handling, and focus management without shipping presentation classes or CSS.

## Current Guarantees

- Form foundation primitives now ship with the library: `HdlField`, `HdlLabel`, `HdlDescription`, `HdlError`, `HdlInput`, `HdlTextarea`, and chips primitives for tag-style entry.
- Field primitives keep `for`, `aria-describedby`, and `aria-errormessage` synchronized as labels, descriptions, and errors are added or removed.
- Input and textarea primitives inherit `disabled`, `required`, and `invalid` state from the nearest `HdlField` while still preserving explicit control ids.
- Chips expose a stable host contract and support add, dedupe, remove, and empty-input backspace behavior without shipping visual markup.
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

See [Styling](styling.md) for the recommended global Tailwind layer and the stable `data-slot` / overlay selectors exposed by the primitives.
The example Angular app also exposes a behavior-driven harness at `/headless-styling-lab` where every exported primitive family is showcased and exercised from the global styling layer.
