#!/bin/bash
# Template: Storybook Component Visual Audit
# Usage: ./storybook-audit.sh <component-name> [output-dir]
# Example: ./storybook-audit.sh button ./audit/button

set -euo pipefail

COMPONENT="${1:?Usage: $0 <component-name> [output-dir]}"
OUTPUT_DIR="${2:-./audit/$COMPONENT/storybook}"
STORYBOOK_URL="${STORYBOOK_URL:-http://localhost:4400}"

echo "=== Storybook Audit: $COMPONENT ==="
echo "Output: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Check if agent-browser is installed
if ! command -v agent-browser &> /dev/null; then
    echo "ERROR: agent-browser is not installed"
    echo "Install with: npm install -g agent-browser"
    exit 1
fi

# Check if Storybook is running
if ! curl -s "$STORYBOOK_URL" > /dev/null 2>&1; then
    echo "ERROR: Storybook not running at $STORYBOOK_URL"
    echo "Start with: nx storybook ui --port 4400"
    exit 1
fi

echo ""
echo "--- Phase 1: Discover stories from Storybook API ---"

# Fetch stories from Storybook's index.json API (auto-detect all stories)
STORIES_JSON=$(curl -s "$STORYBOOK_URL/index.json" 2>/dev/null || echo "{}")

# Extract story IDs for this component (e.g., "components-button--primary")
COMPONENT_LOWER=$(echo "$COMPONENT" | tr '[:upper:]' '[:lower:]' | tr '-' '-')
DISCOVERED_STORIES=$(echo "$STORIES_JSON" | grep -oE "\"components-${COMPONENT_LOWER}--[^\"]+\"" | tr -d '"' | sed 's/components-[^-]*--//' | sort -u || echo "")

if [[ -n "$DISCOVERED_STORIES" ]]; then
    echo "Discovered stories from Storybook API:"
    echo "$DISCOVERED_STORIES" | while read -r story; do echo "  - $story"; done
    # Convert to array
    readarray -t VARIANTS <<< "$DISCOVERED_STORIES"
else
    echo "Could not fetch from Storybook API, using fallback list"
    # Fallback: Common variants to check
    VARIANTS=(
        "default"
        "primary"
        "secondary"
        "destructive"
        "outline"
        "ghost"
        "link"
        "all-variants"
        "sizes"
        "disabled"
    )
fi

echo ""
echo "--- Phase 2: Navigate to docs ---"
DOCS_URL="$STORYBOOK_URL/?path=/docs/components-$COMPONENT--docs"
echo "Opening: $DOCS_URL"
agent-browser open "$DOCS_URL"
agent-browser wait --load networkidle
agent-browser screenshot "$OUTPUT_DIR/docs.png"
echo "Captured: docs.png"

echo ""
echo "--- Phase 3: Capture variants (${#VARIANTS[@]} found) ---"

# Function to toggle Storybook theme (more robust detection)
toggle_theme() {
    local target_theme="$1"  # "dark" or "light"

    # Method 1: Use Storybook's globals API via URL parameter
    # Storybook 7+ supports ?globals=theme:dark

    # Method 2: Click the theme toggle in toolbar
    # Look for common theme button patterns in Storybook toolbar
    agent-browser snapshot -i -s "[id*='storybook']" > /tmp/storybook-toolbar.txt 2>/dev/null || true

    # Try multiple selectors for theme toggle
    if agent-browser click "[title*='theme' i]" 2>/dev/null || \
       agent-browser click "[aria-label*='theme' i]" 2>/dev/null || \
       agent-browser click "button:has([data-testid='theme'])" 2>/dev/null || \
       agent-browser find role button click --name "Change theme" 2>/dev/null || \
       agent-browser find role button click --name "Toggle theme" 2>/dev/null; then
        agent-browser wait 300

        # If dropdown appeared, select the target theme
        agent-browser click "[data-value='$target_theme']" 2>/dev/null || \
        agent-browser find text "$target_theme" click 2>/dev/null || true
        agent-browser wait 300
        return 0
    fi

    # Method 3: Direct background toggle via Storybook addon
    if agent-browser click "[title='Change the background of the preview']" 2>/dev/null; then
        agent-browser wait 200
        agent-browser find text "$target_theme" click 2>/dev/null || true
        agent-browser wait 300
        return 0
    fi

    return 1
}

CAPTURED_COUNT=0
for variant in "${VARIANTS[@]}"; do
    # Skip empty variants
    [[ -z "$variant" ]] && continue

    STORY_URL="$STORYBOOK_URL/?path=/story/components-$COMPONENT--$variant"

    # Try to open, continue if story doesn't exist
    echo "Trying: $variant"
    if agent-browser open "$STORY_URL" 2>/dev/null; then
        agent-browser wait --load networkidle 2>/dev/null || true

        # Check if we got a valid story (not "Story not found")
        PAGE_TEXT=$(agent-browser get text body 2>/dev/null || echo "")
        if [[ "$PAGE_TEXT" != *"Story not found"* ]] && [[ "$PAGE_TEXT" != *"No story"* ]] && [[ "$PAGE_TEXT" != *"No component"* ]]; then
            # Light mode
            agent-browser screenshot "$OUTPUT_DIR/${variant}-light.png"
            echo "  Captured: ${variant}-light.png"
            ((CAPTURED_COUNT++))

            # Try to toggle to dark mode
            if toggle_theme "dark"; then
                agent-browser screenshot "$OUTPUT_DIR/${variant}-dark.png"
                echo "  Captured: ${variant}-dark.png"
                ((CAPTURED_COUNT++))

                # Toggle back to light for next iteration
                toggle_theme "light" || true
            fi
        else
            echo "  Skipped: Story not found"
        fi
    else
        echo "  Skipped: Could not open"
    fi
done

echo "Captured $CAPTURED_COUNT screenshots"

echo ""
echo "--- Phase 4: Interaction tests ---"

# Look for interaction stories (stories with play functions)
# These typically have names containing "interaction", "click", "play", etc.
INTERACTION_PATTERNS=("interaction" "click" "play" "test")
INTERACTION_FOUND=false

for pattern in "${INTERACTION_PATTERNS[@]}"; do
    # Check if any discovered story matches the pattern
    for variant in "${VARIANTS[@]}"; do
        if [[ "$variant" == *"$pattern"* ]]; then
            STORY_URL="$STORYBOOK_URL/?path=/story/components-$COMPONENT--$variant"
            echo "Testing interaction story: $variant"

            if agent-browser open "$STORY_URL" 2>/dev/null; then
                agent-browser wait --load networkidle 2>/dev/null || true

                PAGE_TEXT=$(agent-browser get text body 2>/dev/null || echo "")
                if [[ "$PAGE_TEXT" != *"Story not found"* ]]; then
                    # Wait for play function to complete (Storybook auto-runs play)
                    agent-browser wait 1500
                    agent-browser screenshot "$OUTPUT_DIR/interaction-${variant}.png"
                    echo "  Captured: interaction-${variant}.png"
                    INTERACTION_FOUND=true
                fi
            fi
        fi
    done
done

if [[ "$INTERACTION_FOUND" == "false" ]]; then
    echo "  No interaction stories found (stories with play functions)"
fi

echo ""
echo "--- Audit Complete ---"
echo ""
echo "Summary:"
echo "  Component: $COMPONENT"
echo "  Stories discovered: ${#VARIANTS[@]}"
echo "  Screenshots captured: $CAPTURED_COUNT"
echo "  Output directory: $OUTPUT_DIR"
echo ""

ls -la "$OUTPUT_DIR" 2>/dev/null || echo "No screenshots captured"

# Save story list to output for reference
echo "$DISCOVERED_STORIES" > "$OUTPUT_DIR/stories-discovered.txt" 2>/dev/null || true

# Cleanup
agent-browser close 2>/dev/null || true

echo ""
echo "Next steps:"
echo "1. Review screenshots for visual correctness"
echo "2. Check light/dark theme contrast"
echo "3. Verify interaction tests executed (look for state changes)"
echo "4. Check stories-discovered.txt for full story list"
