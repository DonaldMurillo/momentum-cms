#!/bin/bash
# Template: Kitchen Sink Component Audit
# Usage: ./kitchen-sink-audit.sh <section-name> [output-dir]
# Example: ./kitchen-sink-audit.sh buttons ./audit/buttons/kitchen-sink

set -euo pipefail

SECTION="${1:?Usage: $0 <section-name> [output-dir]}"
OUTPUT_DIR="${2:-./audit/$SECTION/kitchen-sink}"
APP_URL="${APP_URL:-http://localhost:4200/kitchen-sink}"

echo "=== Kitchen Sink Audit: $SECTION ==="
echo "Output: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Check if agent-browser is installed
if ! command -v agent-browser &> /dev/null; then
    echo "ERROR: agent-browser is not installed"
    echo "Install with: npm install -g agent-browser"
    exit 1
fi

# Check if app is running
if ! curl -s "http://localhost:4200" > /dev/null 2>&1; then
    echo "ERROR: App not running at http://localhost:4200"
    echo "Start with: nx serve example-angular"
    exit 1
fi

# Section name mapping for common variations
# Maps user input to likely kitchen sink section identifiers
declare -A SECTION_MAP=(
    ["button"]="Buttons"
    ["buttons"]="Buttons"
    ["card"]="Cards"
    ["cards"]="Cards"
    ["input"]="Form Inputs"
    ["inputs"]="Form Inputs"
    ["form"]="Form Inputs"
    ["forms"]="Form Inputs"
    ["checkbox"]="Form Inputs"
    ["select"]="Form Inputs"
    ["alert"]="Alerts"
    ["alerts"]="Alerts"
    ["badge"]="Badges"
    ["badges"]="Badges"
    ["avatar"]="Avatars"
    ["avatars"]="Avatars"
    ["tab"]="Tabs"
    ["tabs"]="Tabs"
    ["accordion"]="Accordion"
    ["breadcrumb"]="Breadcrumbs"
    ["breadcrumbs"]="Breadcrumbs"
    ["pagination"]="Pagination"
    ["sidebar"]="Sidebar"
    ["table"]="Tables"
    ["tables"]="Tables"
    ["data-table"]="DataTable"
    ["datatable"]="DataTable"
    ["toast"]="Toasts"
    ["toasts"]="Toasts"
    ["dialog"]="Dialogs"
    ["dialogs"]="Dialogs"
    ["tooltip"]="Tooltips"
    ["tooltips"]="Tooltips"
    ["popover"]="Popovers"
    ["popovers"]="Popovers"
    ["dropdown"]="Dropdowns"
    ["dropdowns"]="Dropdowns"
    ["command"]="Command Palette"
    ["command-palette"]="Command Palette"
    ["spinner"]="Spinners"
    ["spinners"]="Spinners"
    ["skeleton"]="Skeletons"
    ["skeletons"]="Skeletons"
    ["progress"]="Progress"
    ["empty-state"]="Empty States"
    ["field-display"]="Field Display"
    ["search-input"]="Search Input"
)

# Get mapped section name or use original
SECTION_LOWER=$(echo "$SECTION" | tr '[:upper:]' '[:lower:]')
SECTION_DISPLAY="${SECTION_MAP[$SECTION_LOWER]:-$SECTION}"

echo "Looking for section: $SECTION_DISPLAY (from input: $SECTION)"

echo ""
echo "--- Phase 1: Navigate to kitchen sink ---"
agent-browser open "$APP_URL"
agent-browser wait --load networkidle
echo "Kitchen sink loaded"

echo ""
echo "--- Phase 2: Find and scroll to section ---"

# Function to find section using multiple strategies
find_section() {
    local section="$1"

    # Strategy 1: Find by ID (common pattern: id="buttons-section")
    local section_id=$(echo "$section" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    if agent-browser scrollintoview "#${section_id}" 2>/dev/null || \
       agent-browser scrollintoview "#${section_id}-section" 2>/dev/null; then
        echo "  Found by ID: #${section_id}"
        return 0
    fi

    # Strategy 2: Find by heading text (h2, h3 containing section name)
    if agent-browser find role heading click --name "$section" 2>/dev/null; then
        agent-browser scrollintoview 2>/dev/null || true
        echo "  Found by heading: $section"
        return 0
    fi

    # Strategy 3: Find by any text match and scroll
    if agent-browser find text "$section" scrollintoview 2>/dev/null; then
        echo "  Found by text: $section"
        return 0
    fi

    # Strategy 4: Case-insensitive text search
    local section_lower=$(echo "$section" | tr '[:upper:]' '[:lower:]')
    if agent-browser find text "$section_lower" scrollintoview 2>/dev/null; then
        echo "  Found by lowercase text: $section_lower"
        return 0
    fi

    return 1
}

SECTION_FOUND=false
if find_section "$SECTION_DISPLAY"; then
    agent-browser wait 500
    SECTION_FOUND=true
    echo "Successfully located section"
else
    echo "Warning: Could not find section '$SECTION_DISPLAY'"
    echo "Capturing full page instead"
fi

echo ""
echo "--- Phase 3: Desktop screenshot ---"
agent-browser set viewport 1280 800
agent-browser wait 500

# Re-find section after viewport change if we found it initially
if [[ "$SECTION_FOUND" == "true" ]]; then
    find_section "$SECTION_DISPLAY" || true
    agent-browser wait 300
fi

agent-browser screenshot "$OUTPUT_DIR/desktop.png"
echo "Captured: desktop.png (1280x800)"

echo ""
echo "--- Phase 4: Responsive testing ---"

# Test at each breakpoint (mobile-first order)
declare -a BREAKPOINT_ORDER=("mobile-sm" "mobile" "tablet" "desktop-lg")
declare -A BREAKPOINTS=(
    ["mobile-sm"]="320 568"
    ["mobile"]="375 812"
    ["tablet"]="768 1024"
    ["desktop-lg"]="1920 1080"
)

for name in "${BREAKPOINT_ORDER[@]}"; do
    dimensions=(${BREAKPOINTS[$name]})
    width=${dimensions[0]}
    height=${dimensions[1]}

    echo "Testing: $name (${width}x${height})"
    agent-browser set viewport $width $height
    agent-browser wait 500

    # Re-scroll to section after viewport change
    if [[ "$SECTION_FOUND" == "true" ]]; then
        find_section "$SECTION_DISPLAY" 2>/dev/null || true
        agent-browser wait 300
    fi

    agent-browser screenshot "$OUTPUT_DIR/$name.png"
    echo "  Captured: $name.png"

    # Check for horizontal overflow
    SCROLL_WIDTH=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null || echo "0")
    if [[ "$SCROLL_WIDTH" -gt "$width" ]]; then
        echo "  WARNING: Horizontal overflow detected (scroll: ${SCROLL_WIDTH}px > viewport: ${width}px)"
    fi
done

echo ""
echo "--- Phase 5: Theme toggle ---"

# Reset to desktop for theme test
agent-browser set viewport 1280 800
agent-browser wait 300

if [[ "$SECTION_FOUND" == "true" ]]; then
    find_section "$SECTION_DISPLAY" 2>/dev/null || true
    agent-browser wait 300
fi

# Function to toggle theme with multiple fallback strategies
toggle_to_dark() {
    # Strategy 1: Look for theme toggle button by common patterns
    if agent-browser click "[data-testid='theme-toggle']" 2>/dev/null || \
       agent-browser click "[aria-label*='theme' i]" 2>/dev/null || \
       agent-browser click "[aria-label*='dark' i]" 2>/dev/null; then
        return 0
    fi

    # Strategy 2: Find by role and name
    if agent-browser find role button click --name "Toggle theme" 2>/dev/null || \
       agent-browser find role button click --name "Dark mode" 2>/dev/null || \
       agent-browser find role button click --name "theme" 2>/dev/null; then
        return 0
    fi

    # Strategy 3: Direct class manipulation (fallback)
    agent-browser eval "document.documentElement.classList.add('dark')" 2>/dev/null
    return $?
}

echo "Looking for theme toggle..."
if toggle_to_dark; then
    agent-browser wait 500
    agent-browser screenshot "$OUTPUT_DIR/dark-theme.png"
    echo "Captured: dark-theme.png"

    # Verify dark mode is active
    IS_DARK=$(agent-browser eval "document.documentElement.classList.contains('dark')" 2>/dev/null || echo "unknown")
    echo "  Dark mode active: $IS_DARK"

    # Toggle back to light
    agent-browser eval "document.documentElement.classList.remove('dark')" 2>/dev/null || \
    agent-browser find role button click --name "Toggle theme" 2>/dev/null || true
else
    echo "  Theme toggle not found, trying direct class manipulation"
    agent-browser eval "document.documentElement.classList.add('dark')" 2>/dev/null || true
    agent-browser wait 500
    agent-browser screenshot "$OUTPUT_DIR/dark-theme-fallback.png"
    echo "Captured: dark-theme-fallback.png (via class manipulation)"
    agent-browser eval "document.documentElement.classList.remove('dark')" 2>/dev/null || true
fi

echo ""
echo "--- Audit Complete ---"
echo ""
echo "Summary:"
echo "  Section: $SECTION_DISPLAY"
echo "  Section found: $SECTION_FOUND"
echo "  Output: $OUTPUT_DIR"
echo ""

ls -la "$OUTPUT_DIR" 2>/dev/null || echo "No screenshots captured"

# Cleanup
agent-browser close 2>/dev/null || true

echo ""
echo "Review checklist:"
echo "- [ ] Component renders correctly at each breakpoint"
echo "- [ ] Text is readable at mobile sizes (16px minimum)"
echo "- [ ] Touch targets are large enough (44px minimum)"
echo "- [ ] No horizontal overflow warnings above"
echo "- [ ] Dark theme works correctly"
echo "- [ ] Layout adapts appropriately at each size"
