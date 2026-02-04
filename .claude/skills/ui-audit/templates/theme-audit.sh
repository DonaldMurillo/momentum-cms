#!/bin/bash
# Template: Light/Dark Theme Audit
# Usage: ./theme-audit.sh <url> [output-dir]
# Example: ./theme-audit.sh http://localhost:4200/admin ./audit/theme

set -euo pipefail

URL="${1:?Usage: $0 <url> [output-dir]}"
OUTPUT_DIR="${2:-./audit/theme}"

echo "=== Theme Audit ==="
echo "URL: $URL"
echo "Output: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Check if agent-browser is installed
if ! command -v agent-browser &> /dev/null; then
    echo "ERROR: agent-browser is not installed"
    echo "Install with: npm install -g agent-browser"
    exit 1
fi

echo ""
echo "--- Loading page ---"
agent-browser open "$URL"
agent-browser wait --load networkidle
echo "Page loaded"

echo ""
echo "--- Phase 1: Detect current theme ---"

IS_DARK=$(agent-browser eval "document.documentElement.classList.contains('dark')" 2>/dev/null || echo "false")
echo "Current theme: $([ "$IS_DARK" = "true" ] && echo "dark" || echo "light")"

echo ""
echo "--- Phase 2: Capture light mode ---"

# Ensure light mode
if [ "$IS_DARK" = "true" ]; then
    echo "Switching to light mode..."
    agent-browser eval "document.documentElement.classList.remove('dark')" 2>/dev/null || true
    agent-browser wait 500
fi

agent-browser screenshot "$OUTPUT_DIR/light-mode.png"
echo "Captured: light-mode.png"

# Capture full page in light mode
agent-browser screenshot --full "$OUTPUT_DIR/light-mode-full.png"
echo "Captured: light-mode-full.png"

echo ""
echo "--- Phase 3: Capture dark mode ---"

# Switch to dark mode
echo "Switching to dark mode..."
agent-browser eval "document.documentElement.classList.add('dark')" 2>/dev/null || true
agent-browser wait 500

# Verify dark mode
IS_DARK=$(agent-browser eval "document.documentElement.classList.contains('dark')" 2>/dev/null || echo "false")
if [ "$IS_DARK" != "true" ]; then
    echo "Warning: Could not activate dark mode via class toggle"
    echo "Trying theme button..."

    # Try clicking theme toggle button
    agent-browser snapshot -i > /tmp/theme-snapshot.txt 2>/dev/null || true
    agent-browser find role button click --name "Toggle theme" 2>/dev/null || \
    agent-browser find role button click --name "theme" 2>/dev/null || \
    agent-browser find text "dark" click 2>/dev/null || true
    agent-browser wait 500
fi

agent-browser screenshot "$OUTPUT_DIR/dark-mode.png"
echo "Captured: dark-mode.png"

# Capture full page in dark mode
agent-browser screenshot --full "$OUTPUT_DIR/dark-mode-full.png"
echo "Captured: dark-mode-full.png"

echo ""
echo "--- Phase 4: Verify CSS variables ---"

echo "Checking CSS variable values..."

# Check key CSS variables in both modes
CSS_VARS=(
    "--mcms-background"
    "--mcms-foreground"
    "--mcms-primary"
    "--mcms-muted"
    "--mcms-border"
)

echo "" > "$OUTPUT_DIR/css-variables.txt"
for var in "${CSS_VARS[@]}"; do
    VALUE=$(agent-browser eval "getComputedStyle(document.documentElement).getPropertyValue('$var')" 2>/dev/null || echo "not found")
    echo "$var: $VALUE" >> "$OUTPUT_DIR/css-variables.txt"
done

echo "CSS variables saved to: css-variables.txt"
cat "$OUTPUT_DIR/css-variables.txt"

echo ""
echo "--- Phase 5: Reset to light mode ---"
agent-browser eval "document.documentElement.classList.remove('dark')" 2>/dev/null || true

echo ""
echo "--- Audit Complete ---"
echo "Screenshots saved to: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"

# Cleanup
agent-browser close 2>/dev/null || true

echo ""
echo "Theme checklist:"
echo "- [ ] Light mode colors are correct"
echo "- [ ] Dark mode colors are correct"
echo "- [ ] Sufficient contrast in both modes"
echo "- [ ] Focus indicators visible in both modes"
echo "- [ ] No color-only information conveyance"
echo "- [ ] CSS variables apply correctly"
