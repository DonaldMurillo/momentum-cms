# Field Mappings

How each Momentum field type maps to SQL columns.

## Mapping Table

| Field Type     | PostgreSQL                             | SQLite                  |
| -------------- | -------------------------------------- | ----------------------- |
| `text`         | `varchar` / `text`                     | `text`                  |
| `textarea`     | `text`                                 | `text`                  |
| `richText`     | `text`                                 | `text`                  |
| `number`       | `integer` / `real` / `numeric`         | `integer` / `real`      |
| `date`         | `timestamp`                            | `text` (ISO string)     |
| `checkbox`     | `boolean`                              | `integer` (0/1)         |
| `select`       | `varchar` (single) / `jsonb` (hasMany) | `text` / `text` (JSON)  |
| `radio`        | `varchar`                              | `text`                  |
| `email`        | `varchar`                              | `text`                  |
| `password`     | — (handled by auth)                    | —                       |
| `upload`       | `varchar` (file path/URL)              | `text`                  |
| `relationship` | `varchar` / `integer` (FK)             | `text` / `integer` (FK) |
| `array`        | `jsonb`                                | `text` (JSON)           |
| `group`        | Flattened columns with prefix          | Flattened columns       |
| `blocks`       | `jsonb`                                | `text` (JSON)           |
| `json`         | `jsonb`                                | `text` (JSON)           |
| `point`        | `jsonb` (`{lat, lng}`)                 | `text` (JSON)           |
| `slug`         | `varchar` + unique constraint          | `text` + unique         |

## Key Differences

### PostgreSQL

- Uses native `jsonb` for complex types (efficient querying with JSON operators)
- Native `boolean` type
- Native `timestamp` type
- Foreign keys with `ON DELETE` actions

### SQLite

- JSON stored as `text` (parsed at application level)
- Booleans as `integer` (0/1)
- Dates as ISO text strings
- Foreign keys supported but simpler

## Layout Fields

Layout fields (`tabs`, `collapsible`, `row`) do **not** create any database columns. They only organize the admin form UI. Their child data fields are stored at the same level as sibling fields.

## Group Fields

Group fields flatten their children with a prefix. For example:

```typescript
group('seo', {
	fields: [text('metaTitle'), text('metaDescription')],
});
```

Creates columns: `seo_metaTitle`, `seo_metaDescription`

## Related

- [Fields Reference](../collections/fields.md) — All field types
- [Migrations](migrations.md) — Managing schema changes
