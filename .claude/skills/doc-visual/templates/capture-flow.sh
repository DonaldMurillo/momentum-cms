#!/bin/bash
# Template: Generic Flow Capture
# Purpose: Capture a page in light and dark mode
# Usage: ./capture-flow.sh <url> <output-dir> <name-prefix> [--full]
#
# Outputs:
#   - <prefix>-light.png: Light theme screenshot
#   - <prefix>-dark.png: Dark theme screenshot
#
# Requires: agent-browser, auth state at docs/visuals/.auth-state.json

set -euo pipefail

URL="${1:?Usage: $0 <url> <output-dir> <name-prefix> [--full]}"
OUTPUT_DIR="${2:?Provide output directory}"
PREFIX="${3:?Provide name prefix}"
FULL_FLAG="${4:-}"

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

# Set desktop viewport
agent-browser set viewport 1280 800
agent-browser wait 500

# Capture light mode
SCREENSHOT_FLAG=""
if [[ "$FULL_FLAG" == "--full" ]]; then
    SCREENSHOT_FLAG="--full"
fi

echo "Capturing light mode..."
agent-browser screenshot $SCREENSHOT_FLAG "$OUTPUT_DIR/${PREFIX}-light.png"

# Switch to dark mode
echo "Switching to dark mode..."
agent-browser eval "localStorage.setItem('mcms-theme', 'dark'); document.documentElement.classList.add('dark')"
agent-browser wait 500

# Capture dark mode
echo "Capturing dark mode..."
agent-browser screenshot $SCREENSHOT_FLAG "$OUTPUT_DIR/${PREFIX}-dark.png"

# Reset to light mode
agent-browser eval "localStorage.setItem('mcms-theme', 'light'); document.documentElement.classList.remove('dark')"

echo ""
echo "Captured:"
echo "  $OUTPUT_DIR/${PREFIX}-light.png"
echo "  $OUTPUT_DIR/${PREFIX}-dark.png"
