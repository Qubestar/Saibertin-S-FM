#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
echo "Saibertin S-FM Browser Companion: http://localhost:${PORT}"
python3 -m http.server "${PORT}" --directory "${ROOT}/web/companion"
