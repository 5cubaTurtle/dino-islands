#!/usr/bin/env bash
# Start Dino Island on http://localhost:8080 (Ctrl+C to stop).
cd "$(dirname "$0")" || exit 1
PORT="${1:-8080}"
echo "Dino Island is running: open http://localhost:${PORT} in Firefox or Chrome"
# Serve with caching switched off, so a plain reload always picks up code changes.
exec python3 - "$PORT" <<'PY'
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), NoCache).serve_forever()
PY
