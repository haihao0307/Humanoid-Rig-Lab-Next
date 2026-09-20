#!/usr/bin/env python3
"""Compatibility entrypoint for isolated real-browser hand proof."""
import motion_hand_visual_proof_full_adapter  # readiness, batches, proof-scene isolation
import motion_hand_visual_proof_fast as implementation

if __name__ == "__main__":
    raise SystemExit(implementation.main())
