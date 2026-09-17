from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).resolve().parent / "capture_cat_body_motion_recovery_r1.mjs"
text = TARGET.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        print(f"{label}: already present")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    text = text.replace(old, new, 1)
    print(f"{label}: patched")


replace_once(
    "    apiPrefix: '__CAT_V439_',\n  },",
    "    apiPrefix: '__CAT_V439_',\n    morphologyOnly: true,\n  },",
    "V4.39 morphology-only metadata",
)

replace_once(
    "      candidateReport.assertions.coreRuntimeActionsAvailable = ['stand', 'walk_forward', 'turn_left', 'turn_right']\n        .every((action) => candidateReport.availableActions.includes(action));",
    "      candidateReport.assertions.coreRuntimeActionsAvailable = candidate.morphologyOnly === true\n        || ['stand', 'walk_forward', 'turn_left', 'turn_right']\n          .every((action) => candidateReport.availableActions.includes(action));",
    "morphology-only action assertion",
)

replace_once(
    "  report.crossCandidateAssertions.allCandidatesCaptured = candidates.every((candidate) => {\n    const item = report.candidates[candidate.id];\n    return item?.ready === candidate.readyValue && Object.keys(item.screenshots).length >= 10;\n  });",
    "  report.crossCandidateAssertions.allCandidatesCaptured = candidates.every((candidate) => {\n    const item = report.candidates[candidate.id];\n    const minimumEvidence = candidate.morphologyOnly === true ? requiredViews.length : 10;\n    return item?.ready === candidate.readyValue && Object.keys(item.screenshots).length >= minimumEvidence;\n  });",
    "candidate-specific evidence threshold",
)

TARGET.write_text(text, encoding="utf-8")
print("Recovery R1 capture contract corrected: V4.39 is a fixed-view morphology source, not a motion runtime")
