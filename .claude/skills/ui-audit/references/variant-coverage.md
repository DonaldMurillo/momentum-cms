# Variant Coverage Reference

Requirements for Storybook story coverage of component variants.

## Story File Structure

Each component with variants must have a stories file:

```typescript
// button.stories.ts
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './button.component';

const meta: Meta<Button> = {
	title: 'Components/Button',
	component: Button,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Button],
		}),
	],
	argTypes: {
		variant: {
			control: 'select',
			options: ['primary', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
			description: 'Visual style variant',
		},
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg', 'icon'],
		},
		disabled: {
			control: 'boolean',
		},
	},
};
export default meta;
type Story = StoryObj<Button>;
```

## Required Story Coverage

### 1. Individual Variant Stories

Create one story per variant value:

```typescript
export const Primary: Story = {
	args: { variant: 'primary' },
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant">Primary</button>`,
	}),
};

export const Secondary: Story = {
	args: { variant: 'secondary' },
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant">Secondary</button>`,
	}),
};

// ... one for each variant
```

### 2. All Variants Story

Show all variants together for comparison:

```typescript
export const AllVariants: Story = {
	render: () => ({
		template: `
      <div class="flex flex-wrap gap-4">
        <button mcms-button variant="primary">Primary</button>
        <button mcms-button variant="secondary">Secondary</button>
        <button mcms-button variant="destructive">Destructive</button>
        <button mcms-button variant="outline">Outline</button>
        <button mcms-button variant="ghost">Ghost</button>
        <button mcms-button variant="link">Link</button>
      </div>
    `,
	}),
};
```

### 3. Sizes Story (If Applicable)

Show all size variations:

```typescript
export const Sizes: Story = {
	render: () => ({
		template: `
      <div class="flex items-center gap-4">
        <button mcms-button size="sm">Small</button>
        <button mcms-button size="md">Medium</button>
        <button mcms-button size="lg">Large</button>
        <button mcms-button size="icon">
          <svg>...</svg>
        </button>
      </div>
    `,
	}),
};
```

### 4. Disabled Story

Show disabled state:

```typescript
export const Disabled: Story = {
	args: { disabled: true },
	render: (args) => ({
		props: args,
		template: `
      <div class="flex gap-4">
        <button mcms-button [disabled]="disabled">Disabled Primary</button>
        <button mcms-button variant="secondary" [disabled]="disabled">Disabled Secondary</button>
      </div>
    `,
	}),
};
```

### 5. Interaction Story (Required)

Must have `play` function for automated testing:

```typescript
export const ClickInteraction: Story = {
	render: () => ({
		template: `
      <button mcms-button data-testid="click-button" (click)="onClick()">
        {{ clicked ? 'Clicked!' : 'Click Me' }}
      </button>
    `,
		props: {
			clicked: false,
			onClick() {
				this.clicked = true;
			},
		},
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByTestId('click-button');

		// Verify initial state
		await expect(button).toHaveTextContent('Click Me');

		// Perform interaction
		await userEvent.click(button);

		// Verify result
		await expect(button).toHaveTextContent('Clicked!');
	},
};
```

## Interaction Test Patterns

### Click Interaction

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const button = canvas.getByRole('button');
  await userEvent.click(button);
  await expect(button).toHaveClass('active');
},
```

### Keyboard Interaction

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const input = canvas.getByRole('textbox');

  await userEvent.tab();  // Focus input
  await expect(input).toHaveFocus();

  await userEvent.keyboard('Hello');
  await expect(input).toHaveValue('Hello');

  await userEvent.keyboard('{Enter}');
  // Verify form submission...
},
```

### Dropdown/Select Interaction

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('combobox');

  await userEvent.click(trigger);

  const option = canvas.getByRole('option', { name: 'Option 1' });
  await expect(option).toBeVisible();

  await userEvent.click(option);
  await expect(trigger).toHaveTextContent('Option 1');
},
```

### Toggle Interaction

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const checkbox = canvas.getByRole('checkbox');

  await expect(checkbox).not.toBeChecked();
  await userEvent.click(checkbox);
  await expect(checkbox).toBeChecked();
},
```

## URL Pattern for Stories

Storybook URLs follow this pattern:

```
http://localhost:4400/?path=/story/components-<component>--<story-name>
```

Story names are kebab-case:

- `Primary` → `primary`
- `AllVariants` → `all-variants`
- `ClickInteraction` → `click-interaction`

Examples:

- `http://localhost:4400/?path=/story/components-button--primary`
- `http://localhost:4400/?path=/story/components-button--all-variants`
- `http://localhost:4400/?path=/story/components-data-table--with-selection`

## Coverage Audit Checklist

For a component with variants, verify:

**Variant Stories:**

- [ ] One story per variant value
- [ ] AllVariants story exists

**Size Stories (if applicable):**

- [ ] All sizes shown in Sizes story
- [ ] Icon size demonstrated

**State Stories:**

- [ ] Disabled state story
- [ ] Loading state story (if applicable)
- [ ] Error state story (if applicable)

**Interaction Stories:**

- [ ] At least one story has `play` function
- [ ] Play function tests primary interaction
- [ ] Uses `data-testid` for element selection
- [ ] Includes assertions with `expect`

**Story Quality:**

- [ ] Uses `argTypes` for controls
- [ ] Has `tags: ['autodocs']` for auto documentation
- [ ] Each story has descriptive name
- [ ] Props are realistic/meaningful

## Example Coverage Matrix

| Component | Variants | Sizes | States                  | Interaction          |
| --------- | -------- | ----- | ----------------------- | -------------------- |
| Button    | 6/6      | 4/4   | Disabled                | Click                |
| Card      | -        | -     | -                       | -                    |
| Input     | -        | -     | Disabled, Error         | Type, Clear          |
| Select    | -        | -     | Disabled, Error         | Open, Select         |
| Checkbox  | -        | -     | Disabled, Indeterminate | Check                |
| Tabs      | -        | -     | Disabled                | Switch               |
| DataTable | -        | -     | Loading, Empty          | Sort, Filter, Select |
