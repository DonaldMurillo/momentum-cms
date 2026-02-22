#!/bin/bash
# Template: Video Recording of a Flow
# Purpose: Record a WebM video of a browser workflow with pacing for clarity
# Usage: ./record-video-flow.sh <start-url> <output-dir> <name-prefix>
#
# Outputs:
#   - <prefix>-flow.webm: Video recording of the flow
#
# This template records a simple navigate-and-browse flow.
# Customize the middle section with your specific interaction steps.
#
# Requires: agent-browser, auth state at docs/visuals/.auth-state.json

set -euo pipefail

URL="${1:?Usage: $0 <start-url> <output-dir> <name-prefix>}"
OUTPUT_DIR="${2:?Provide output directory}"
PREFIX="${3:?Provide name prefix}"

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/${PREFIX}-flow.webm"

# Load auth state if available
AUTH_STATE="docs/visuals/.auth-state.json"
if [[ -f "$AUTH_STATE" ]]; then
    echo "Loading auth state..."
    agent-browser state load "$AUTH_STATE"
fi

# Ensure cleanup on exit
cleanup() {
    agent-browser record stop 2>/dev/null || true
}
trap cleanup EXIT

# Set desktop viewport
agent-browser set viewport 1280 800

# Start recording
echo "Recording to: $OUTPUT_FILE"
agent-browser record start "$OUTPUT_FILE"

# Navigate to start URL
agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser wait 1500  # Pause for viewer to see the page

# ======================================
# CUSTOMIZE: Add your interaction steps here
# Each step should have a wait after it for pacing
#
# Example:
#   agent-browser snapshot -i
#   agent-browser fill @e1 "Example text"
#   agent-browser wait 500
#   agent-browser click @e2
#   agent-browser wait --load networkidle
#   agent-browser wait 1000
# ======================================

# Take a snapshot to show interactive elements
agent-browser snapshot -i
agent-browser wait 1000

# Scroll down to show more content
agent-browser scroll down 500
agent-browser wait 1000

# Scroll back up
agent-browser scroll up 500
agent-browser wait 1000

# Stop recording
agent-browser record stop
trap - EXIT

echo ""
echo "Recorded: $OUTPUT_FILE"
echo ""
echo "To convert to GIF (requires ffmpeg):"
echo "  ffmpeg -i \"$OUTPUT_FILE\" -vf \"fps=10,scale=800:-1:flags=lanczos\" -loop 0 \"$OUTPUT_DIR/${PREFIX}-flow.gif\""
