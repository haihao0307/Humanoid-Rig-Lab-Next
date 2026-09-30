#!/usr/bin/env python3
"""Focused real-browser review for Natural Turn R27.

This reuses the existing Human motion QA harness but limits capture to turning,
so unrelated carry/push failures cannot hide the quality of the turn system.
"""
from __future__ import annotations

import motion_visual_qa as qa
import motion_visual_qa_v2  # noqa: F401 - installs DOM-dispatched body controls
from motion_visual_qa import Scenario, Step

qa.SCENARIOS = (
    Scenario("turn-left-15", "原地左转 15°", (Step("向左转15度", .28, 22),), ("front", "side"), "front"),
    Scenario("turn-right-15", "原地右转 15°", (Step("向右转15度", .28, 22),), ("front", "side"), "front"),
    Scenario("turn-left-45", "原地左转 45°", (Step("向左转45度", .52, 28),), ("front", "side", "back"), "front"),
    Scenario("turn-right-45", "原地右转 45°", (Step("向右转45度", .52, 28),), ("front", "side", "back"), "front"),
    Scenario("turn-left-90", "原地左转 90°", (Step("向左转90度", .88, 36),), ("front", "side", "back"), "front"),
    Scenario("turn-right-90", "原地右转 90°", (Step("向右转90度", .88, 36),), ("front", "side", "back"), "front"),
    Scenario("turn-left-180", "原地左转 180°", (Step("向左转180度", 1.45, 48),), ("front", "side"), "front"),
    Scenario("turn-right-180", "原地右转 180°", (Step("向右转180度", 1.45, 48),), ("front", "side"), "front"),
)
qa.AB = ()

if __name__ == "__main__":
    raise SystemExit(qa.main())
