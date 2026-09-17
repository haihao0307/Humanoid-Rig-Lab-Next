#!/usr/bin/env bash
set -euo pipefail

python tools/build_chicken_r991.py
python -m py_compile tools/build_chicken_r991.py tools/build_chicken_r100.py tools/verify_chicken_r100_centerline_v7_gate.py
node --check tools/chicken_r991_override.js
node --check tools/chicken_r100_motion_patch.js
node --check tools/chicken_r100_peck_patch.js
node --check tools/chicken_r100_centerline_patch.js
node --check tools/chicken_r100_manual_step_patch.js
node --check tools/capture_chicken_r100.mjs
node --check tools/capture_chicken_r100_mesh_diagnostic.mjs
node --check tools/verify_chicken_r100_centerline_v7.mjs
node --check runtime/chicken_phase1_npc_controller.mjs
node --check runtime/chicken_phase1_articulated_skin.mjs
node --check runtime/chicken_phase1_peck_adapter.mjs
node --check runtime/chicken_phase1_ring_coherent_adapter.mjs
node --check runtime/chicken_phase1_centerline_sweep_adapter.mjs
node --check runtime/chicken_phase1_centerline_sweep_v71_adapter.mjs
node --test tests/chicken_phase1_npc_controller.test.mjs
node --test tests/chicken_phase1_articulated_skin.test.mjs
node --test tests/chicken_phase1_centerline_sweep_adapter.test.mjs
node tools/verify_chicken_r100_centerline_v7.mjs
python tools/build_chicken_r100.py
