# Fields

All field types available in Momentum CMS. Import field builders from `@momentumcms/core`.

## Common Options

Every field accepts these base options:

```typescript
{
  required?: boolean;        // Field is required
  unique?: boolean;          // Value must be unique
  defaultValue?: unknown;    // Default value
  label?: string;            // Display label (auto-generated from name if omitted)
  description?: string;      // Help text below the field
  admin?: {
    position?: 'sidebar' | 'main';
    width?: 'full' | 'half' | 'third';
    condition?: (data) => boolean;  // Show/hide conditionally
    readOnly?: boolean;
    hidden?: boolean;
    placeholder?: string;
  };
  access?: {                 // Field-level access control
    create?: (args) => boolean;
    read?: (args) => boolean;
    update?: (args) => boolean;
  };
  hooks?: {                  // Field-level hooks
    beforeValidate?: [...];
    beforeChange?: [...];
    afterChange?: [...];
    afterRead?: [...];
  };
  validate?: (value, { data, req }) => true | 'Error message';
}
```

---

## Data Fields

### text

Short text string.

```typescript
text('title', { required: true, minLength: 1, maxLength: 200 });
```

Options: `minLength`, `maxLength`

### textarea

Multi-line text.

```typescript
textarea('description', { rows: 4, maxLength: 5000 });
```

Options: `minLength`, `maxLength`, `rows`

### richText

Rich text editor (HTML content).

```typescript
richText('content');
```

### number

Numeric value.

```typescript
number('price', {
	min: 0,
	max: 99999,
	step: 0.01,
	displayFormat: { style: 'currency', currency: 'USD' },
});
```

Options: `min`, `max`, `step`, `displayFormat` (`{ style, currency, locale, minimumFractionDigits, maximumFractionDigits }`)

### date

Date or datetime.

```typescript
date('publishedAt', {
	displayFormat: { preset: 'medium', includeTime: true },
});
```

Options: `displayFormat` (`{ preset, locale, includeTime, timePreset }`)

Presets: `'short'`, `'medium'`, `'long'`, `'full'`

### checkbox

Boolean toggle.

```typescript
checkbox('featured', { defaultValue: false });
```

### select

Dropdown select. Supports single or multi-select.

```typescript
select('status', {
	options: [
		{ label: 'Draft', value: 'draft' },
		{ label: 'Published', value: 'published' },
		{ label: 'Archived', value: 'archived' },
	],
	defaultValue: 'draft',
	hasMany: false, // Set true for multi-select
});
```

Options: `options` (required), `hasMany`

### radio

Radio button group.

```typescript
radio('priority', {
	options: [
		{ label: 'Low', value: 'low' },
		{ label: 'Medium', value: 'medium' },
		{ label: 'High', value: 'high' },
	],
});
```

Options: `options` (required)

### email

Email field with built-in validation.

```typescript
email('contactEmail');
```

### password

Password field.

```typescript
password('secret', { minLength: 8 });
```

Options: `minLength`

### upload

File upload. References a media collection.

```typescript
upload('image', {
	relationTo: 'media',
	mimeTypes: ['image/*'],
	maxSize: 5 * 1024 * 1024, // 5MB
	hasMany: false,
});
```

Options: `relationTo` (required), `mimeTypes`, `maxSize`, `hasMany`

### relationship

Reference to another collection. Uses lazy reference to avoid circular imports.

```typescript
relationship('author', {
	collection: () => Users,
	hasMany: false,
	onDelete: 'set-null', // 'set-null' | 'restrict' | 'cascade'
});
```

Polymorphic relationships (multiple target collections):

```typescript
relationship('reference', {
	collection: () => Posts,
	relationTo: [() => Posts, () => Pages],
});
```

Options: `collection` (required, lazy ref), `hasMany`, `onDelete`, `relationTo`, `filterOptions`

### array

Repeating group of sub-fields. Stored as JSON.

```typescript
array('links', {
	fields: [text('label', { required: true }), text('url', { required: true })],
	minRows: 0,
	maxRows: 10,
	displayField: 'label', // Field to show as row summary
});
```

Options: `fields` (required), `minRows`, `maxRows`, `displayField`

### group

Nested field group. Fields are stored as prefixed columns (not JSON).

```typescript
group('seo', {
	fields: [text('metaTitle'), textarea('metaDescription')],
});
```

Options: `fields` (required)

### blocks

Content blocks for flexible layouts. Stored as JSON.

```typescript
blocks('content', {
	blocks: [
		{
			slug: 'hero',
			labels: { singular: 'Hero', plural: 'Heroes' },
			fields: [
				text('heading', { required: true }),
				richText('body'),
				upload('image', { relationTo: 'media' }),
			],
		},
		{
			slug: 'callToAction',
			fields: [text('text', { required: true }), text('url', { required: true })],
		},
	],
	minRows: 1,
	maxRows: 20,
});
```

Options: `blocks` (required), `minRows`, `maxRows`

### json

Raw JSON data.

```typescript
json('metadata');
```

### point

Geolocation coordinates (latitude/longitude).

```typescript
point('location');
```

### slug

Auto-generated URL slug from another field.

```typescript
slug('slug', { from: 'title' });
```

Options: `from` (required) — source field name

---

## Layout Fields

Layout fields organize the admin form visually. They do **not** store data.

### tabs

Organize fields into tabbed sections.

```typescript
tabs('mainTabs', {
	tabs: [
		{
			label: 'Content',
			fields: [text('title'), richText('body')],
		},
		{
			label: 'SEO',
			description: 'Search engine optimization',
			fields: [text('metaTitle'), textarea('metaDescription')],
		},
	],
});
```

### collapsible

Expandable/collapsible section.

```typescript
collapsible('advanced', {
	fields: [text('customCSS'), json('customData')],
	defaultOpen: false,
});
```

### row

Display fields in a horizontal row.

```typescript
row('nameRow', {
	fields: [
		text('firstName', { admin: { width: 'half' } }),
		text('lastName', { admin: { width: 'half' } }),
	],
});
```

## Related

- [Collection Overview](overview.md) — Full collection configuration
- [Access Control](access-control.md) — Field-level access
