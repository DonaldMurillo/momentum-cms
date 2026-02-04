---
name: ui-audit
description: Comprehensive UI component audit for Momentum CMS. Use when asked to audit, review, check, or validate a UI component. Checks Storybook stories, interaction tests, variants, kitchen sink integration, admin dashboard usage, accessibility, and responsive design (mobile-first). Triggers include "audit button", "review the card component", "check accessibility of tabs", or "/ui-audit <component-name>".
argument-hint: <component-name>
allowed-tools: Bash(agent-browser:*), Bash(nx *), Read, Glob, Grep
---

# UI Component Audit

Comprehensive audit combining static code analysis with visual browser inspection via Storybook and kitchen sink.

## Quick Start

```bash
# Audit a component by name
/ui-audit button
/ui-audit data-table
/ui-audit sidebar
```

## Audit Workflow

### Phase 1: Component Discovery

Find all component files:

```bash
# Component location pattern
libs/ui/src/lib/<component>/
├── <component>.component.ts      # Main component
├── <component>.types.ts          # Type definitions (optional)
├── <component>.stories.ts        # Storybook stories
├── <component>.spec.ts           # Unit tests
└── index.ts                      # Barrel export (optional)
```

Verify export in `libs/ui/src/index.ts`.

### Phase 2: Static Code Analysis

Check component follows Angular 21 + Momentum patterns:

**Required Patterns:**

- [ ] Uses `input()` / `input.required()` (not `@Input()`)
- [ ] Uses `output()` (not `@Output()`)
- [ ] Uses `computed()` for derived state
- [ ] Uses `ChangeDetectionStrategy.OnPush`
- [ ] Host styling via `host: { '[class]': 'hostClasses()' }`
- [ ] Accepts `class` input for Tailwind customization
- [ ] Selector prefix: `mcms-`
- [ ] No `standalone: true` (default in Angular 21)

### Phase 3: Variant Coverage

Extract variants from types and verify story coverage:

```typescript
// Example: Button variants
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
```

**Required Stories:**

- [ ] One story per variant value
- [ ] `AllVariants` or combined story showing all
- [ ] `Sizes` story (if applicable)
- [ ] `Disabled` story
- [ ] Interaction story with `play` function

### Phase 4: Storybook Visual Inspection

Start Storybook and capture screenshots:

```bash
# Ensure Storybook is running
nx storybook ui --port 4400

# Navigate and screenshot
agent-browser open "http://localhost:4400/?path=/story/components-button--primary"
agent-browser wait --load networkidle
agent-browser screenshot ./audit/button-primary-light.png

# Toggle dark mode (click theme button in toolbar)
agent-browser snapshot -i
agent-browser click @e<theme-toggle-ref>
agent-browser wait 500
agent-browser screenshot ./audit/button-primary-dark.png
```

### Phase 5: Interaction Tests

Verify interaction tests pass:

```bash
# Run component tests
nx test ui --testNamePattern="<Component>"

# Check Storybook play functions work
agent-browser open "http://localhost:4400/?path=/story/components-button--click-interaction"
agent-browser wait --load networkidle
# The play function should auto-run
agent-browser screenshot ./audit/button-interaction.png
```

### Phase 6: Kitchen Sink Integration

Verify component appears in kitchen sink:

```bash
# Check import exists in kitchen-sink.page.ts
grep -l "<Component>" libs/ui/src/lib/kitchen-sink/kitchen-sink.page.ts

# Visual verification
nx serve example-angular
agent-browser open "http://localhost:4200/kitchen-sink"
agent-browser wait --load networkidle
agent-browser find text "Buttons" scrollintoview  # or component section
agent-browser screenshot ./audit/kitchen-sink-buttons.png
```

### Phase 7: Responsive Testing

Test at mobile-first breakpoints:

```bash
# Mobile (iPhone)
agent-browser set viewport 375 812
agent-browser screenshot ./audit/responsive-mobile.png

# Tablet (iPad)
agent-browser set viewport 768 1024
agent-browser screenshot ./audit/responsive-tablet.png

# Desktop
agent-browser set viewport 1280 800
agent-browser screenshot ./audit/responsive-desktop.png

# Large Desktop
agent-browser set viewport 1920 1080
agent-browser screenshot ./audit/responsive-desktop-lg.png
```

### Phase 8: Accessibility Audit

Check accessibility requirements:

**ARIA Attributes:**

- [ ] Proper `role` attribute (if not native element)
- [ ] `aria-label` for non-text content
- [ ] `aria-expanded` for expandable elements
- [ ] `aria-selected` for selectable items
- [ ] `aria-disabled` for disabled state

**Focus Management:**

- [ ] Visible focus ring (`:focus-visible`)
- [ ] Logical tab order
- [ ] Keyboard navigation (Arrow keys for lists)

**Color Contrast:**

- [ ] Minimum 4.5:1 for text
- [ ] Focus indicators visible in both themes

### Phase 9: Generate Report

Create markdown audit report:

```markdown
# UI Audit Report: <Component>

**Date**: YYYY-MM-DD
**Component**: libs/ui/src/lib/<component>/

## Summary

| Category          | Status | Issues |
| ----------------- | ------ | ------ |
| Code Patterns     | PASS   | 0      |
| Variant Coverage  | PASS   | 0      |
| Interaction Tests | PASS   | 0      |
| Accessibility     | WARN   | 1      |
| Visual (Light)    | PASS   | 0      |
| Visual (Dark)     | PASS   | 0      |
| Responsive        | PASS   | 0      |
| Kitchen Sink      | PASS   | 0      |

**Overall**: PASS with warnings

## Detailed Findings

[Checklists from each phase]

## Screenshots

[Visual evidence]

## Recommendations

[Actionable fixes]
```

## Deep-Dive Documentation

| Reference                                                                      | When to Use                              |
| ------------------------------------------------------------------------------ | ---------------------------------------- |
| [references/component-patterns.md](references/component-patterns.md)           | Angular 21 signal patterns, host styling |
| [references/variant-coverage.md](references/variant-coverage.md)               | Story requirements, interaction tests    |
| [references/accessibility-checklist.md](references/accessibility-checklist.md) | ARIA, focus, keyboard navigation         |
| [references/visual-inspection.md](references/visual-inspection.md)             | Storybook URLs, viewport sizes           |

## Ready-to-Use Templates

| Template                                                           | Description                            |
| ------------------------------------------------------------------ | -------------------------------------- |
| [templates/storybook-audit.sh](templates/storybook-audit.sh)       | Screenshot all variants in Storybook   |
| [templates/kitchen-sink-audit.sh](templates/kitchen-sink-audit.sh) | Verify kitchen sink integration        |
| [templates/responsive-audit.sh](templates/responsive-audit.sh)     | Test mobile/tablet/desktop breakpoints |
| [templates/theme-audit.sh](templates/theme-audit.sh)               | Light/dark theme validation            |

## Prerequisites

Before running audit:

1. **Storybook running**: `nx storybook ui --port 4400`
2. **Dev server running**: `nx serve example-angular`
3. **agent-browser installed**: `npm install -g agent-browser`

## Example Audit Output

```
Auditing: button

Phase 1: Discovery
  Found: button.component.ts
  Found: button.stories.ts (9 stories)
  Found: button.spec.ts
  Exported: YES

Phase 2: Static Analysis
  [PASS] Uses input() signals
  [PASS] Uses computed() for hostClasses
  [PASS] ChangeDetectionStrategy.OnPush
  [PASS] Host styling (no wrapper div)
  [PASS] Accepts class input

Phase 3: Variant Coverage
  Variants: primary, secondary, destructive, outline, ghost, link
  Stories: 9/9 covered
  [PASS] All variants have stories

Phase 4: Storybook Visual
  [PASS] Primary renders correctly
  [PASS] All variants render in light mode
  [PASS] All variants render in dark mode
  Screenshots: 12 captured

Phase 5: Interaction Tests
  [PASS] ClickInteraction play function works
  [PASS] Tests pass: nx test ui --testNamePattern=Button

Phase 6: Kitchen Sink
  [PASS] Component imported
  [PASS] Renders in showcase

Phase 7: Responsive
  [PASS] Mobile (375px): Buttons scale properly
  [PASS] Tablet (768px): No issues
  [PASS] Desktop (1280px): No issues

Phase 8: Accessibility
  [PASS] Uses native <button> element
  [PASS] Focus ring visible
  [WARN] Icon-only variant missing aria-label

Overall: PASS with 1 warning
```
