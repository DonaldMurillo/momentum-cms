# Visual Design Quality Checklist

Critical design quality checks discovered through real UI audits. These issues are often missed by static code analysis and require actual visual inspection.

## Theme CSS Variable Analysis

### The Problem

In dark mode, multiple CSS variables can be set to identical values, causing elements to be **invisible** against their backgrounds.

### How to Check

```bash
# Search for duplicate color values in dark mode
grep -A 30 ".dark {" libs/admin/src/styles/theme.css | grep "mcms-"
grep -A 30 ".dark {" apps/example-angular/src/styles.css | grep "mcms-"
```

### What to Look For

**Bad Example (Real Bug Found):**

```css
.dark {
	--mcms-card: 217 33% 17%; /* Card background */
	--mcms-secondary: 217 33% 17%; /* Badge background - SAME! */
	--mcms-muted: 217 33% 17%; /* Muted background - SAME! */
	--mcms-accent: 217 33% 17%; /* Hover background - SAME! */
	--mcms-border: 217 33% 17%; /* Border color - SAME! */
}
```

**Result**: Badges, borders, and hover states are completely invisible.

**Good Example (Fixed):**

```css
.dark {
	--mcms-card: 217 33% 15%; /* Card - base level */
	--mcms-secondary: 215 28% 25%; /* Badge - visibly distinct */
	--mcms-muted: 217 33% 20%; /* Muted - subtle but visible */
	--mcms-accent: 217 33% 22%; /* Hover - noticeable change */
	--mcms-border: 217 33% 22%; /* Border - clearly visible */
}
```

### Color Differentiation Rules

| Variable           | Purpose                   | Lightness Relative to Card |
| ------------------ | ------------------------- | -------------------------- |
| `--mcms-card`      | Base card background      | Base (e.g., 15%)           |
| `--mcms-secondary` | Badges, secondary buttons | +8-10% lighter (e.g., 25%) |
| `--mcms-muted`     | Subtle backgrounds        | +5% lighter (e.g., 20%)    |
| `--mcms-accent`    | Hover states              | +5-7% lighter (e.g., 22%)  |
| `--mcms-border`    | Visible borders           | +5-7% lighter (e.g., 22%)  |

## Card Component Quality

### Required Hover Effects

Cards MUST have visual feedback on hover:

```typescript
styles: `
  :host {
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--mcms-border));
    background-color: hsl(var(--mcms-card));
    box-shadow:
      0 1px 3px 0 rgb(0 0 0 / 0.1),
      0 1px 2px -1px rgb(0 0 0 / 0.1);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  :host(:hover) {
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
    border-color: hsl(var(--mcms-border) / 0.8);
  }
`,
```

### Shadow Depth Guidelines

| State        | Shadow        | Description      |
| ------------ | ------------- | ---------------- |
| Default      | `0 1px 3px`   | Subtle elevation |
| Hover        | `0 4px 6px`   | Noticeable lift  |
| Active/Focus | `0 10px 15px` | Strong elevation |

## Dashboard/Page Layout Quality

### Required Structure

Every dashboard page should have:

1. **Header with hierarchy**

   ```html
   <header class="mb-10">
   	<h1 class="text-4xl font-bold tracking-tight">Dashboard</h1>
   	<p class="text-muted-foreground mt-3 text-lg">Descriptive subtitle here</p>
   </header>
   ```

2. **Section headers**

   ```html
   <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
   	Collections
   </h2>
   ```

3. **Proper empty states** (not just "No data")
   ```html
   <div
   	class="flex flex-col items-center justify-center p-16 bg-card/50 rounded-xl border border-dashed border-border/60"
   >
   	<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
   		<svg class="w-8 h-8 text-muted-foreground">...</svg>
   	</div>
   	<p class="text-foreground font-medium text-lg">No collections configured</p>
   	<p class="text-sm text-muted-foreground mt-2">Helpful action guidance here</p>
   </div>
   ```

### Common Layout Issues

| Issue            | Problem                       | Fix                                        |
| ---------------- | ----------------------------- | ------------------------------------------ |
| Flat header      | `text-3xl` with no subtitle   | Use `text-4xl` + descriptive subtitle      |
| No sections      | Cards dumped without grouping | Add section headers with uppercase styling |
| Weak empty state | Just "No data" text           | Icon + title + description + action hint   |
| Cramped buttons  | `gap-2` between actions       | Use `gap-3` or `gap-4`                     |

## Badge/Count Visibility

### The Problem

Count badges in cards often disappear in dark mode due to identical background colors.

### How to Verify

1. Navigate to admin dashboard in dark mode
2. Check if the "0" count badge is clearly visible
3. Badge should have distinct background from card

### Required Contrast

```css
/* Badge must be visually distinct from card */
--mcms-card: 217 33% 15%;
--mcms-secondary: 215 28% 25%; /* 10% lighter = visible badge */
```

## Visual Verification Process

### Step-by-Step Browser Check

```typescript
// 1. Navigate to admin dashboard
mcp__claude-in-chrome__navigate({ url: "http://localhost:4200/admin", tabId })

// 2. Wait for full load
mcp__claude-in-chrome__computer({ action: "wait", duration: 2, tabId })

// 3. Take screenshot for analysis
mcp__claude-in-chrome__computer({ action: "screenshot", tabId })

// 4. Test hover effects
mcp__claude-in-chrome__computer({ action: "hover", coordinate: [400, 240], tabId })
mcp__claude-in-chrome__computer({ action: "screenshot", tabId })

// 5. Check responsive at mobile
mcp__claude-in-chrome__resize_window({ width: 375, height: 812, tabId })
mcp__claude-in-chrome__computer({ action: "screenshot", tabId })
```

### What to Look For in Screenshots

1. **Badge visibility**: Can you clearly see count badges?
2. **Border visibility**: Are card borders distinguishable?
3. **Hover feedback**: Does the card visually change on hover?
4. **Text contrast**: Is all text readable?
5. **Visual hierarchy**: Is the most important info prominent?
6. **Empty space**: Is there excessive unused space?

## Auto-Fix Examples

### Fixing Invisible Badges

**Before (in theme.css):**

```css
.dark {
	--mcms-secondary: 217 33% 17%;
}
```

**After:**

```css
.dark {
	--mcms-secondary: 215 28% 25%; /* Distinct from card background */
}
```

### Adding Card Hover Effects

**Before:**

```typescript
styles: `
  :host {
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
`,
```

**After:**

```typescript
styles: `
  :host {
    box-shadow:
      0 1px 3px 0 rgb(0 0 0 / 0.1),
      0 1px 2px -1px rgb(0 0 0 / 0.1);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }

  :host(:hover) {
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
  }
`,
```

### Improving Dashboard Layout

**Before:**

```typescript
host: { class: 'block max-w-5xl' },
template: `
  <header class="mb-8">
    <h1 class="text-3xl font-bold">Dashboard</h1>
    <p class="text-muted-foreground mt-2">Welcome to CMS</p>
  </header>
  <div class="grid gap-6">...</div>
`,
```

**After:**

```typescript
host: { class: 'block max-w-6xl' },
template: `
  <header class="mb-10">
    <h1 class="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
    <p class="text-muted-foreground mt-3 text-lg">
      Manage your content and collections
    </p>
  </header>
  <section>
    <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
      Collections
    </h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">...</div>
  </section>
`,
```

## Quick Checklist

Before marking a UI audit complete, verify:

- [ ] All CSS color variables are distinct in dark mode
- [ ] Badges are visible against card backgrounds
- [ ] Borders are visible in both themes
- [ ] Cards have hover effects with transitions
- [ ] Dashboard has section headers
- [ ] Empty states have icons and helpful text
- [ ] Button spacing is adequate (gap-3 minimum)
- [ ] Visual hierarchy is clear (headings sized properly)
