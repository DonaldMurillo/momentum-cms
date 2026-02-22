# Capture Conventions

Standards for naming, sizing, and formatting visual documentation assets.

**Related**: [SKILL.md](../SKILL.md) for quick start, [flow-catalog.md](flow-catalog.md) for flow details.

## Naming

### Pattern

```
<subject>-<modifier>.{png|webm|gif}
```

- **Subject**: The feature or page (e.g., `dashboard`, `login`, `list`, `create`, `sidebar`)
- **Modifier**: Theme, viewport, or state qualifier
- **Format**: `.png` for screenshots, `.webm` for video, `.gif` for converted video

### Modifiers

| Modifier      | Meaning                    |
| ------------- | -------------------------- |
| `light`       | Light theme                |
| `dark`        | Dark theme                 |
| `mobile`      | 375px viewport             |
| `tablet`      | 768px viewport             |
| `desktop`     | 1280px viewport            |
| `desktop-lg`  | 1920px viewport            |
| `empty-state` | Page with no data          |
| `flow`        | Multi-step video recording |

### Examples

```
login-light.png
login-dark.png
login-mobile.png
login-flow.webm
dashboard-light.png
dashboard-empty-state.png
list-light.png
create-flow.webm
sidebar-mobile.png
```

### Rules

- **kebab-case** exclusively
- **No spaces** in filenames
- **No timestamps** — captures are idempotent (re-running overwrites)
- **No sequential numbers** (`step1`, `step2`) — use descriptive names instead
- **Lowercase only**

## Viewport Sizes

| Name          | Width | Height | Use Case                |
| ------------- | ----- | ------ | ----------------------- |
| Mobile        | 375   | 812    | iPhone-class devices    |
| Tablet        | 768   | 1024   | iPad-class devices      |
| Desktop       | 1280  | 800    | Standard laptop/desktop |
| Large Desktop | 1920  | 1080   | Full HD monitors        |

### Setting Viewports

```bash
agent-browser set viewport 375 812    # Mobile
agent-browser set viewport 768 1024   # Tablet
agent-browser set viewport 1280 800   # Desktop (default)
agent-browser set viewport 1920 1080  # Large desktop
```

Always wait 500ms after viewport change before capturing to allow re-layout:

```bash
agent-browser set viewport 375 812
agent-browser wait 500
agent-browser screenshot output.png
```

## Screenshot Settings

### Default (Viewport Only)

```bash
agent-browser screenshot output.png
```

Captures only what's visible in the viewport. Good for above-the-fold content.

### Full Page

```bash
agent-browser screenshot --full output.png
```

Captures the entire scrollable page. Use for:

- Kitchen sink (all component sections)
- Field types showcase (long forms)
- Any page where content extends below the fold

### Element-Specific

```bash
agent-browser snapshot -i
agent-browser screenshot @e1 output.png  # Capture specific element
```

Good for isolating individual components.

## Theme Captures

### Via JavaScript (Reliable)

```bash
# Light mode
agent-browser eval "document.documentElement.classList.remove('dark')"
agent-browser wait 500
agent-browser screenshot output-light.png

# Dark mode
agent-browser eval "document.documentElement.classList.add('dark')"
agent-browser wait 500
agent-browser screenshot output-dark.png

# Reset
agent-browser eval "document.documentElement.classList.remove('dark')"
```

### Via Theme Toggle Button

```bash
agent-browser snapshot -i
# Find the theme toggle button (usually in the sidebar footer or header)
agent-browser click @e<theme-toggle>
agent-browser wait 500
agent-browser screenshot output-dark.png
```

Prefer the JavaScript method for consistency. The toggle button approach depends on the UI state.

## Video Recording

### Format

- Native format: **WebM** (VP8/VP9 codec)
- GitHub rendering: WebM does NOT render inline — use GIF for inline display
- Conversion: `ffmpeg -i input.webm -vf "fps=10,scale=800:-1:flags=lanczos" -loop 0 output.gif`

### Pacing

Add pauses between actions for viewer comprehension:

```bash
agent-browser record start output.webm

agent-browser open "<url>"
agent-browser wait --load networkidle
agent-browser wait 1000   # Let viewer see the page

agent-browser fill @e1 "text"
agent-browser wait 500    # Let viewer see the typing

agent-browser click @e2
agent-browser wait 1000   # Let viewer see the result

agent-browser record stop
```

### Duration

Keep videos under 30 seconds. For longer flows, break into multiple recordings:

- `login-flow.webm` (login steps)
- `create-flow.webm` (create document steps)
- `edit-flow.webm` (edit steps)

## Auth State

### File Location

```
docs/visuals/.auth-state.json
```

### Rules

- **Gitignored** — contains session tokens
- **Save after login**: `agent-browser state save docs/visuals/.auth-state.json`
- **Load before captures**: `agent-browser state load docs/visuals/.auth-state.json`
- **Expires** — if captures redirect to login, delete and re-authenticate

### Default Credentials (Example App)

```
Email: admin@test.com
Password: TestPassword123!
```

Source of truth: `libs/example-config/src/test-users.ts` (`TEST_ADMIN` export). These are seeded automatically when the example app starts.

## Output Organization

```
docs/visuals/
  README.md                    # Auto-generated index (committed)
  .auth-state.json             # Session state (gitignored)
  auth/                        # Authentication pages
  dashboard/                   # Dashboard screenshots
  collections/                 # CRUD operation screenshots
  fields/                      # Field type showcases
  media/                       # Media library
  navigation/                  # Sidebar, drawers, sheets
  plugins/                     # Plugin dashboards
  theme/                       # Light/dark comparisons
  responsive/                  # Breakpoint screenshots
  kitchen-sink/                # UI component showcase
```

All directories and their contents are committed to git (only `.auth-state.json` is ignored).
