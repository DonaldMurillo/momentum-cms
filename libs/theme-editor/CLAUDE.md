# Theme Editor Library

Visual theme editor for styling Momentum CMS headless components. Generates CSS custom properties with live preview.

## Key Rules

- **Styled components allowed** — unlike `libs/headless`, this library contains fully styled UI with Tailwind classes
- **OKLCH color format** — all color values use OKLCH for perceptually uniform manipulation
- **CSS injection protection** — all user-provided values are sanitized via `sanitizeCSSValue()` before CSS generation
- **Signal-based store** — `ThemeEditorStore` uses Angular signals with undo/redo and localStorage persistence
- Selector prefix: `hdl-theme-` (components reuse the `hdl-` namespace with `theme-` qualifier)
- All components: `ChangeDetectionStrategy.OnPush`, signal inputs/outputs

## Architecture

### Store (`ThemeEditorStore`)

- Signal-based state with `ThemeEditorState` (light + dark `ThemeStyleProps`, current mode, preset ID)
- `COMMON_STYLE_KEYS` — properties synced across both modes (fonts, radius, shadows, letter-spacing)
- Debounced history for undo/redo (500ms window, max 30 entries)
- localStorage persistence with `isValidThemeEditorState()` runtime guard

### CSS Generator (`generateThemeCSS`)

- Pure function: `ThemeConfig` + options → CSS string
- Generates `:root` variables, `.dark` overrides (only differing values), and `[data-slot]` component styles
- `sanitizeCSSValue()` strips dangerous patterns: `url()`, `expression()`, `@import`, `javascript:`, escape sequences
- Optional `scopeSelector` for preview isolation

### Presets

- Built-in presets: default, ocean, warm, minimal, neon
- Partial overrides — missing keys fall back to `defaultLightStyles`/`defaultDarkStyles`
