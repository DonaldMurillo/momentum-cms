# Troubleshooting

Common issues when running the doc-visual skill and how to fix them.

**Related**: [SKILL.md](../SKILL.md) for workflow, [capture-conventions.md](capture-conventions.md) for standards.

## Dev Server Not Running

**Symptom**: `agent-browser open` hangs or returns connection error.

**Fix**:

```bash
# Check if port 4200 is in use
lsof -i :4200

# Start the dev server
nx serve example-angular &

# Wait for compilation (usually 10-20 seconds)
sleep 15

# Verify
agent-browser open "http://localhost:4200"
agent-browser wait --load networkidle
agent-browser get title
```

**IMPORTANT**: The correct command is `nx serve example-angular`, NOT `nx serve cms-admin`. The CLAUDE.md previously had this wrong (fixed in this PR).

## Auth State Expired

**Symptom**: Navigating to `/admin` redirects to `/admin/login` even after loading auth state.

**Fix**:

```bash
# Delete stale auth state
rm -f docs/visuals/.auth-state.json

# Re-authenticate
agent-browser open "http://localhost:4200/admin/login"
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser fill @e1 "admin@test.com"
agent-browser fill @e2 "TestPassword123!"
agent-browser click @e3
agent-browser wait --load networkidle

# Save fresh state
agent-browser state save docs/visuals/.auth-state.json
```

## Screenshots Are Empty/Black

**Symptom**: PNG files are created but show a blank or black screen.

**Possible causes**:

1. **Page not loaded**: Add `agent-browser wait --load networkidle` before screenshots
2. **Angular not hydrated**: Add `agent-browser wait 1000` after networkidle to wait for Angular hydration
3. **Wrong viewport**: Ensure viewport is set before screenshot

```bash
agent-browser open "<url>"
agent-browser wait --load networkidle
agent-browser wait 1000  # Wait for Angular hydration
agent-browser set viewport 1280 800
agent-browser screenshot output.png
```

## Dark Mode Toggle Not Working

**Symptom**: JS class manipulation doesn't change the theme.

**Possible causes**:

1. **Theme uses `McmsThemeService`**: The theme service stores preference in localStorage. Direct class manipulation might be overridden.

**Fix**: Use the theme service's storage key:

```bash
agent-browser eval "localStorage.setItem('mcms-theme', 'dark'); document.documentElement.classList.add('dark')"
agent-browser wait 500
agent-browser screenshot output-dark.png
```

Or find and click the actual theme toggle button:

```bash
agent-browser snapshot -i
# Look for a theme toggle button (usually sun/moon icon in sidebar or header)
agent-browser click @e<theme-toggle>
agent-browser wait 500
```

## Video Recording Fails

**Symptom**: `agent-browser record start` errors or produces empty WebM.

**Possible causes**:

1. **Headless mode codec issue**: Some headless environments lack video codecs.

**Fix**: Try headed mode:

```bash
agent-browser --headed record start output.webm
```

2. **Path doesn't exist**: Ensure the output directory exists:

```bash
mkdir -p docs/visuals/auth/
agent-browser record start docs/visuals/auth/login-flow.webm
```

## ffmpeg Not Installed

**Symptom**: WebM to GIF conversion fails.

**Fix**:

```bash
# Install on macOS
brew install ffmpeg

# Verify
ffmpeg -version

# Convert
ffmpeg -i input.webm -vf "fps=10,scale=800:-1:flags=lanczos" -loop 0 output.gif
```

This is optional. WebM files work fine — they just don't render inline on GitHub. Link them instead:

```markdown
[Watch the login flow](auth/login-flow.webm)
```

## Storybook Not Running

**Symptom**: Port 4400 connection refused for Storybook captures.

**Fix**:

```bash
nx storybook ui --port 4400 &
sleep 10

agent-browser open "http://localhost:4400"
agent-browser wait --load networkidle
```

Note: Storybook captures are optional and supplementary to kitchen-sink captures.

## Zero-Size Files

**Symptom**: PNG files are 0 bytes.

**Fix**: The screenshot command likely failed silently. Check that:

1. The page is loaded (`agent-browser get url` returns expected URL)
2. The element is visible (if using element-specific screenshot)
3. The path is writable

```bash
# Verify page is correct
agent-browser get url
agent-browser get title

# Retry screenshot
agent-browser screenshot output.png

# Check file
ls -la output.png
```

## Element Refs Stale

**Symptom**: `agent-browser click @e3` fails with "element not found".

**Fix**: Refs are invalidated when the page changes. Always re-snapshot after navigation:

```bash
agent-browser click @e5           # This navigated to a new page
agent-browser wait --load networkidle
agent-browser snapshot -i         # MUST re-snapshot for fresh refs
agent-browser click @e1           # Now use new refs
```

## Port Already In Use

**Symptom**: `nx serve example-angular` fails because port 4200 is taken.

**Fix**:

```bash
# Find and kill the process
lsof -i :4200 | awk 'NR>1 {print $2}' | xargs kill -9

# Restart
nx serve example-angular
```

## Known CLI Discrepancy

The `CLAUDE.md` file previously referenced `nx serve cms-admin` and `nx build cms-admin`. These were incorrect — the actual app project name is `example-angular`. This has been fixed. If you see other references to `cms-admin`, they are likely stale.

The correct commands:

- `nx serve example-angular` — start dev server
- `nx build example-angular` — production build
- `nx test <lib-name>` — run tests for a library
