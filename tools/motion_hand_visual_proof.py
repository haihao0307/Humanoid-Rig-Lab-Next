#!/usr/bin/env python3
"""Compatibility entrypoint for the batched real-browser hand proof."""
import motion_hand_visual_proof_fast2  # patches the shared capture runner
import motion_hand_visual_proof_fast as implementation

if __name__ == "__main__":
    raise SystemExit(implementation.main())
