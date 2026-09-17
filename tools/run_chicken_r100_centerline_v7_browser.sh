#!/usr/bin/env bash
set -euo pipefail
: "${CHROME_PATH:?CHROME_PATH is required}"
export CHICKEN_R100_URL="${CHICKEN_R100_URL:-http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html}"

python -m http.server 8765 > /tmp/chicken-r100-http.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT
sleep 2

timeout --signal=TERM --kill-after=15s 300s node tools/capture_chicken_r100.mjs
timeout --signal=TERM --kill-after=15s 180s node tools/capture_chicken_r100_mesh_diagnostic.mjs
python tools/build_chicken_r100.py
python tools/verify_chicken_r100_centerline_v7_gate.py
