#!/usr/bin/env bash
# Start Dino Island on http://localhost:8080 (Ctrl+C to stop).
cd "$(dirname "$0")" || exit 1
PORT="${1:-8080}"
echo "Dino Island is running: open http://localhost:${PORT} in Firefox or Chrome"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
