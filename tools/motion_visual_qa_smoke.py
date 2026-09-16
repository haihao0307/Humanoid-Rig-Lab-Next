#!/usr/bin/env python3
"""Fast real-browser smoke matrix for motion visual QA v2."""
from __future__ import annotations

import motion_visual_qa_v2  # noqa: F401 - installs DOM-dispatched controls
import motion_visual_qa as qa


qa.SCENARIOS = (
    qa.Scenario(
        "walk-stop-smoke",
        "直线行走并停止（快速验收）",
        (qa.Step("向前走1米", 1.05, 36),),
        ("front", "side"),
        None,
        True,
    ),
    qa.Scenario(
        "turn-left-90-smoke",
        "原地左转 90°（快速验收）",
        (qa.Step("向左转90度", 0.95, 34),),
        ("front", "side"),
    ),
    qa.Scenario(
        "sit-stand-smoke",
        "坐下、稳定坐姿并起身（快速验收）",
        (qa.Step("坐下", 0.95, 42, "坐"), qa.Step("起身", 0.90, 42, "站")),
        ("side",),
    ),
    qa.Scenario(
        "wave-smoke",
        "挥手（快速验收）",
        (qa.Step("挥手", 0.78, 28),),
        ("front", "side"),
    ),
)
qa.AB = ()


if __name__ == "__main__":
    raise SystemExit(qa.main())
