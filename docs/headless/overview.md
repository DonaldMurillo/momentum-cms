# Headless UI

`@momentumcms/headless` provides unstyled Angular primitives for accessibility and interaction behavior. Components expose ARIA state, keyboard handling, and focus management without shipping presentation classes or CSS.

## Export Surface

Current primitive families:

- Accordion: `HdlAccordion`, `HdlAccordionItem`, `HdlAccordionTrigger`, `HdlAccordionContent`
- Tabs: `HdlTabs`, `HdlTabList`, `HdlTab`, `HdlTabPanel`
- Menu: `HdlMenu`, `HdlMenuItem`, `HdlMenuTrigger`, `HdlMenuBar`
- Listbox: `HdlListbox`, `HdlOption`
- Combobox: `HdlCombobox`, `HdlComboboxInput`, `HdlComboboxPopup`
- Grid: `HdlGrid`, `HdlGridRow`, `HdlGridCell`
- Tree: `HdlTree`, `HdlTreeItem`, `HdlTreeItemGroup`
- Toolbar: `HdlToolbar`, `HdlToolbarWidget`, `HdlToolbarWidgetGroup`
- Dialog: `HdlDialog`, `HdlDialogTitle`, `HdlDialogDescription`, `HdlDialogClose`, `HdlDialogService`
- Popover: `HdlPopoverTrigger`, `HdlPopoverContent`
- Tooltip: `HdlTooltipTrigger`, `HdlTooltipContent`
- Toast: `HdlToastService`, `HdlToastContainer`, `HdlToast`
- Form controls: `HdlSwitch`, `HdlCheckbox`, `HdlRadioGroup`, `HdlRadioItem`
- Field semantics: `HdlField`, `HdlLabel`, `HdlDescription`, `HdlError`
- Text entry: `HdlInput`, `HdlTextarea`
- Chips: `HdlChips`, `HdlChip`, `HdlChipInput`, `HdlChipRemove`
- Collapsible: `HdlCollapsible`, `HdlCollapsibleTrigger`, `HdlCollapsibleContent`
- Toggle: `HdlToggle`, `HdlToggleGroup`, `HdlToggleItem`
- Select: `HdlSelect`, `HdlSelectTrigger`, `HdlSelectValue`, `HdlSelectContent`, `HdlSelectItem`
- Command: `HdlCommand`, `HdlCommandInput`, `HdlCommandList`, `HdlCommandItem`, `HdlCommandEmpty`, `HdlCommandGroup`, `HdlCommandSeparator`
- Structural feedback: `HdlSeparator`, `HdlProgress`, `HdlSpinner`, `HdlSkeleton`
- Context: `HdlContextMenuTrigger`, `HdlContextMenuContent`, `HdlHoverCardTrigger`, `HdlHoverCardContent`
- Confirm and sheet overlays: `HdlAlertDialog`, `HdlAlertDialogTitle`, `HdlAlertDialogDescription`, `HdlAlertDialogAction`, `HdlAlertDialogCancel`, `HdlDrawer`, `HdlDrawerTitle`, `HdlDrawerDescription`, `HdlDrawerClose`, `HdlDrawerService`

## How To Use It

- Import the primitives directly into the Angular component that renders them.
- Style them from the app's global CSS layer through the stable `data-slot` and state attributes.
- Pair every interactive demo or app-specific wrapper with a visible outcome so browser tests can assert behavior, not just markup.

See [Usage](usage.md) for app integration patterns and [Styling](styling.md) for the global theming contract.

## Current Guarantees

- Form foundation primitives now ship with the library: `HdlField`, `HdlLabel`, `HdlDescription`, `HdlError`, `HdlInput`, `HdlTextarea`, and chips primitives for tag-style entry.
- Field primitives keep `for`, `aria-describedby`, and `aria-errormessage` synchronized as labels, descriptions, and errors are added or removed.
- Input and textarea primitives inherit `disabled`, `required`, and `invalid` state from the nearest `HdlField` while still preserving explicit control ids.
- Chips expose a stable host contract and support add, dedupe, remove, and empty-input backspace behavior without shipping visual markup.
- Collapsible exposes a simpler disclosure contract than accordion when you only need one trigger/content pair.
- Toggle primitives support both standalone pressed state and roving-focus toggle groups.
- Select exposes a stable trigger/value/content/item contract without bundling a design-system shell.
- Command exposes live filtering plus explicit item selection without coupling you to any visual palette design.
- Structural feedback primitives ship host semantics for separators, progress, spinners, and skeleton placeholders.
- Context menu and hover card provide stable overlay hooks for secondary interaction surfaces.
- Drawers expose side-aware overlay classes and alert dialogs expose a distinct `alertdialog` host contract for confirmation flows.
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
