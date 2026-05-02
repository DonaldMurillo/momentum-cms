---
name: mcp-setup
description: Set up the Momentum CMS MCP server plugin and generate Claude Code MCP config for AI tool integration. Use when connecting Claude Code (or any MCP client) to a Momentum CMS instance.
argument-hint: [base-url] (default: http://localhost:4200)
---

# MCP Setup for Momentum CMS

Set up the MCP (Model Context Protocol) server plugin so AI tools like Claude Code can read, query, and manage CMS content through standard MCP tools.

## Arguments

- `$ARGUMENTS` - Optional base URL of the running CMS (default: `http://localhost:4200`)

## What This Does

1. Wires the `@momentumcms/plugins/mcp` plugin into the app's `momentum.config.ts`
2. Creates an API key for MCP authentication
3. Generates `.mcp.json` at the project root for Claude Code auto-discovery

## Step 1: Wire the Plugin

Add the MCP plugin to the app's `momentum.config.ts`:

```typescript
// Add import
import { mcpPlugin } from '@momentumcms/plugins/mcp';

// Create instance (after other plugin instances)
export const mcp = mcpPlugin({
	path: '/mcp',
	apiKeyRequired: true,
	tools: {
		read: true, // find, get, search, count (default: true)
		write: false, // create, update, delete (default: false — opt-in for safety)
		globals: true, // list, get, update globals (default: true)
	},
	// Optional: restrict which collections are exposed
	// allowedCollections: ['articles', 'pages', 'categories'],
	// deniedCollections: ['internal-logs'],
});

// Add to plugins array
const config = defineMomentumConfig({
	// ...existing config
	plugins: [
		// ...existing plugins
		mcp,
	],
});
```

### Plugin Config Options

| Option               | Type       | Default          | Description                                           |
| -------------------- | ---------- | ---------------- | ----------------------------------------------------- |
| `enabled`            | `boolean`  | `true`           | Enable/disable the MCP endpoint                       |
| `path`               | `string`   | `'/mcp'`         | HTTP path for the MCP endpoint (served at `/api/mcp`) |
| `apiKeyRequired`     | `boolean`  | `true`           | Require API key authentication                        |
| `tools.read`         | `boolean`  | `true`           | Enable read tools (find, get, search, count)          |
| `tools.write`        | `boolean`  | `false`          | Enable write tools (create, update, delete)           |
| `tools.globals`      | `boolean`  | `true`           | Enable global document tools                          |
| `allowedCollections` | `string[]` | all              | Whitelist of collection slugs to expose               |
| `deniedCollections`  | `string[]` | none             | Blacklist of collection slugs to hide                 |
| `serverName`         | `string`   | `'momentum-cms'` | MCP server name reported to clients                   |
| `serverVersion`      | `string`   | package version  | MCP server version                                    |

### Security Notes

- Auth collections (users, sessions, accounts) are **always excluded** regardless of allow/deny lists
- Password fields are **always stripped** from schema responses
- Query `limit` is clamped to 100, `depth` to 3
- Write tools are **off by default** — enable explicitly with `tools.write: true`

## Step 2: Restart the Dev Server

```bash
nx serve example-angular  # or example-analog
```

The schema auto-syncs on startup. No migrations needed.

## Step 3: Create an API Key

Once the server is running, create an API key via the Admin UI or API:

### Via API (recommended for automation)

```bash
# Sign in first
COOKIES=$(curl -s -c - http://localhost:4200/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"Test1234!"}' | grep -o 'better-auth.session_token=[^;]*')

# Create API key
curl -s http://localhost:4200/api/auth/api-keys \
  -H 'Content-Type: application/json' \
  -H "Cookie: $COOKIES" \
  -d '{"name":"Claude Code MCP","role":"admin"}' | jq .key
```

### Via Admin UI

1. Navigate to `/admin` and sign in
2. Go to Settings > API Keys
3. Create a new key with name "Claude Code MCP" and role "admin"
4. Copy the key (shown only once)

## Step 4: Generate `.mcp.json`

Create `.mcp.json` at the project root for Claude Code auto-discovery:

```json
{
	"mcpServers": {
		"momentum-cms": {
			"type": "http",
			"url": "http://localhost:4200/api/mcp",
			"headers": {
				"X-API-Key": "mcms_YOUR_API_KEY_HERE"
			}
		}
	}
}
```

Replace `mcms_YOUR_API_KEY_HERE` with the actual API key from Step 3.

**Add `.mcp.json` to `.gitignore`** — it contains secrets:

```
# MCP config (contains API keys)
.mcp.json
```

## Step 5: Verify

Test that Claude Code can discover the MCP tools:

```bash
# Quick test — list collections (uses .mcp.json auto-discovery)
claude -p "Use the list_collections tool to list all CMS collections" --output-format text

# Or with an explicit config file (useful for CI)
claude -p "List all CMS collections via the list_collections tool" \
  --mcp-config .mcp.json \
  --strict-mcp-config \
  --output-format text

# Interactive — start Claude Code with MCP
claude
# Then ask: "What collections are available in the CMS?"
```

## Available MCP Tools

Once configured, Claude Code (and any MCP client) gets these tools:

### Schema Tools (always enabled)

- `list_collections` — List all accessible collections with slugs, labels, field counts
- `get_collection_schema` — Get detailed field schema for a collection

### Read Tools (default: enabled)

- `find_documents` — Query with where, sort, pagination, depth
- `get_document` — Get single document by ID
- `search_documents` — Full-text search
- `count_documents` — Count with optional where filter

### Write Tools (default: disabled)

- `create_document` — Create new document
- `update_document` — Partial update by ID
- `delete_document` — Delete by ID

### Global Tools (default: enabled)

- `list_globals` — List all globals with metadata
- `get_global` — Read a global document
- `update_global` — Update a global (requires `tools.write: true`)

### Resources (momentum:// URIs)

- `momentum://collections` — Collection list
- `momentum://collections/{slug}/schema` — Collection schema
- `momentum://globals` — Globals list
- `momentum://globals/{slug}` — Global document data

### Prompts

- `create_content` — Generate content creation prompt with schema context
- `translate_content` — Generate translation prompt with document data

## Troubleshooting

| Issue                  | Fix                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 401 Unauthorized       | Check API key is valid and not expired. Ensure `X-API-Key` header is set.                                                     |
| 503 API not ready      | The CMS server is starting up. Wait for the health check to pass.                                                             |
| 405 Method not allowed | MCP uses POST only. Check your MCP client config uses `"type": "http"` (Claude Code) or equivalent streamable-HTTP transport. |
| Collections missing    | Check `allowedCollections`/`deniedCollections` config. Auth collections are always hidden.                                    |
| Write tools missing    | Enable with `tools: { write: true }` in plugin config.                                                                        |
