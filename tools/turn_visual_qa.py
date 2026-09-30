#!/usr/bin/env python3
"""Focused real-browser review for in-place human turning.

This reuses the proven browser/preflight/report stack, but removes unrelated
walking, posture and manipulation scenarios so left/right 45/90/180-degree
turns can be reviewed without a long full-system capture masking the result.
"""
from __future__ import annotations

import motion_visual_qa as qa
import motion_visual_qa_v2  # noqa: F401 -- installs embedded-workbench DOM actions

Step = qa.Step
Scenario = qa.Scenario

qa.SCENARIOS = (
    Scenario("turn-left-45", "原地左转 45°", (Step("向左转45度", 0.85, 26),), ("front", "side", "back"), "front"),
    Scenario("turn-right-45", "原地右转 45°", (Step("向右转45度", 0.85, 26),), ("front", "side", "back"), "front"),
    Scenario("turn-left-90", "原地左转 90°", (Step("向左转90度", 1.55, 34),), ("front", "side", "back"), "front"),
    Scenario("turn-right-90", "原地右转 90°", (Step("向右转90度", 1.55, 34),), ("front", "side", "back"), "front"),
    Scenario("turn-left-180", "原地左转 180°", (Step("向左转180度", 2.75, 46),), ("front", "side", "back"), "front"),
    Scenario("turn-right-180", "原地右转 180°", (Step("向右转180度", 2.75, 46),), ("front", "side", "back"), "front"),
)
qa.AB = ()

if __name__ == "__main__":
    raise SystemExit(qa.main())
