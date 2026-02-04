#!/bin/bash
# Template: Responsive Breakpoint Audit
# Usage: ./responsive-audit.sh <url> [output-dir]
# Example: ./responsive-audit.sh http://localhost:4200/kitchen-sink ./audit/responsive

set -euo pipefail

URL="${1:?Usage: $0 <url> [output-dir]}"
OUTPUT_DIR="${2:-./audit/responsive}"

echo "=== Responsive Audit ==="
echo "URL: $URL"
echo "Output: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Check if agent-browser is installed
if ! command -v agent-browser &> /dev/null; then
    echo "ERROR: agent-browser is not installed"
    echo "Install with: npm install -g agent-browser"
    exit 1
fi

# Mobile-first breakpoints
declare -a BREAKPOINTS=(
    "320:568:mobile-xs:iPhone SE"
    "375:812:mobile:iPhone 12/13"
    "414:896:mobile-lg:iPhone Plus"
    "640:480:sm:Tailwind sm"
    "768:1024:md:Tailwind md (iPad)"
    "1024:768:lg:Tailwind lg"
    "1280:800:xl:Tailwind xl"
    "1536:864:2xl:Tailwind 2xl"
    "1920:1080:desktop:Full HD"
)

echo ""
echo "--- Loading page ---"
agent-browser open "$URL"
agent-browser wait --load networkidle
echo "Page loaded"

echo ""
echo "--- Testing breakpoints ---"

for bp in "${BREAKPOINTS[@]}"; do
    IFS=':' read -r width height name desc <<< "$bp"

    echo ""
    echo "[$name] $desc (${width}x${height})"

    agent-browser set viewport $width $height
    agent-browser wait 500

    # Capture screenshot
    agent-browser screenshot "$OUTPUT_DIR/${name}-${width}x${height}.png"
    echo "  Captured: ${name}-${width}x${height}.png"

    # Check for horizontal overflow
    BODY_WIDTH=$(agent-browser eval "document.body.scrollWidth" 2>/dev/null || echo "0")
    if [[ "$BODY_WIDTH" -gt "$width" ]]; then
        echo "  WARNING: Horizontal overflow detected (body: ${BODY_WIDTH}px > viewport: ${width}px)"
    fi
done

echo ""
echo "--- Audit Complete ---"
echo "Screenshots saved to: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"

# Cleanup
agent-browser close 2>/dev/null || true

echo ""
echo "Responsive checklist:"
echo "- [ ] No horizontal overflow at any breakpoint"
echo "- [ ] Text readable at mobile sizes (16px minimum)"
echo "- [ ] Touch targets 44x44px minimum"
echo "- [ ] Layout adapts appropriately"
echo "- [ ] Images scale correctly"
echo "- [ ] Navigation is accessible on mobile"
