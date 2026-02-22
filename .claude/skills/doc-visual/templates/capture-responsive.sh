#!/bin/bash
# Template: Responsive Breakpoint Capture
# Purpose: Capture a page at 4 standard breakpoints
# Usage: ./capture-responsive.sh <url> <output-dir> <name-prefix>
#
# Outputs:
#   - <prefix>-mobile.png: 375x812
#   - <prefix>-tablet.png: 768x1024
#   - <prefix>-desktop.png: 1280x800
#   - <prefix>-desktop-lg.png: 1920x1080
#
# Requires: agent-browser, auth state at docs/visuals/.auth-state.json

set -euo pipefail

URL="${1:?Usage: $0 <url> <output-dir> <name-prefix>}"
OUTPUT_DIR="${2:?Provide output directory}"
PREFIX="${3:?Provide name prefix}"

mkdir -p "$OUTPUT_DIR"

# Load auth state if available
AUTH_STATE="docs/visuals/.auth-state.json"
if [[ -f "$AUTH_STATE" ]]; then
    echo "Loading auth state..."
    agent-browser state load "$AUTH_STATE"
fi

# Navigate and wait for load
echo "Navigating to: $URL"
agent-browser open "$URL"
agent-browser wait --load networkidle

# Mobile (375x812 - iPhone)
echo "Capturing mobile (375x812)..."
agent-browser set viewport 375 812
agent-browser wait 500
agent-browser screenshot "$OUTPUT_DIR/${PREFIX}-mobile.png"

# Tablet (768x1024 - iPad)
echo "Capturing tablet (768x1024)..."
agent-browser set viewport 768 1024
agent-browser wait 500
agent-browser screenshot "$OUTPUT_DIR/${PREFIX}-tablet.png"

# Desktop (1280x800 - Laptop)
echo "Capturing desktop (1280x800)..."
agent-browser set viewport 1280 800
agent-browser wait 500
agent-browser screenshot "$OUTPUT_DIR/${PREFIX}-desktop.png"

# Large Desktop (1920x1080 - Full HD)
echo "Capturing large desktop (1920x1080)..."
agent-browser set viewport 1920 1080
agent-browser wait 500
agent-browser screenshot "$OUTPUT_DIR/${PREFIX}-desktop-lg.png"

# Reset to default viewport
agent-browser set viewport 1280 800

echo ""
echo "Captured 4 breakpoints:"
echo "  $OUTPUT_DIR/${PREFIX}-mobile.png (375x812)"
echo "  $OUTPUT_DIR/${PREFIX}-tablet.png (768x1024)"
echo "  $OUTPUT_DIR/${PREFIX}-desktop.png (1280x800)"
echo "  $OUTPUT_DIR/${PREFIX}-desktop-lg.png (1920x1080)"
