#!/usr/bin/env bash
set -euo pipefail
: "${CHROME_PATH:?CHROME_PATH is required}"
export CHICKEN_R100_URL="${CHICKEN_R100_URL:-http://127.0.0.1:8765/CHICKEN_V46_R10_0_SINGLE_AGENT.html}"

python -m http.server 8765 > /tmp/chicken-r100-http.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT
sleep 2

# Capture the isolated mesh evidence first. The main QA intentionally exits 1
# when a technical gate fails, but that failure must not erase the diagnostic
# views needed to identify which surface produced the deformation.
DIAGNOSTIC_STATUS=0
QA_STATUS=0
timeout --signal=TERM --kill-after=15s 180s node tools/capture_chicken_r100_mesh_diagnostic.mjs || DIAGNOSTIC_STATUS=$?
timeout --signal=TERM --kill-after=15s 300s node tools/capture_chicken_r100.mjs || QA_STATUS=$?

python tools/build_chicken_r100.py
if [[ "$DIAGNOSTIC_STATUS" -ne 0 ]]; then
  echo "V7.1 mesh diagnostic failed with status $DIAGNOSTIC_STATUS" >&2
fi
if [[ "$QA_STATUS" -ne 0 ]]; then
  echo "V7.1 browser QA reported an open technical gate with status $QA_STATUS" >&2
fi
python tools/verify_chicken_r100_centerline_v7_gate.py
