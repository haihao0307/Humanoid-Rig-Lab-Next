#!/usr/bin/env python3
"""Apply the reproducible R1 motion convergence delta.

The patch starts from the clean main assembly, registers only selected motion
modules, keeps clothing out, preserves the filtered support query and wires a
read-only MotionRuntimeState mirror into NaturalLocomotion. Repeated execution
must produce no further changes.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSEMBLY = ROOT / "source" / "assembly.json"
RUNTIME = ROOT / "source" / "runtime.template.js"
LOCOMOTION = ROOT / "body" / "NaturalLocomotion.js"

BOX_MODULE = "body/BoxHandling.js"
STATE_MODULE = "body/MotionRuntimeState.js"
ACTIONS_MARKER = "/*__SOURCE:body/MotionLabActions.js__*/"
BOX_MARKER = "/*__SOURCE:body/BoxHandling.js__*/"
STATE_MARKER = "/*__SOURCE:body/MotionRuntimeState.js__*/"

OLD_SUPPORT_HEAD = (
    "minimumBoneY(frames=null){let min=Infinity,id=null;for(const b of this.bones){"
    "const f=frames?frames.get(b.joint.id):b.joint.world"
)
NEW_SUPPORT_HEAD = (
    "minimumBoneY(frames=null,jointIds=null){let min=Infinity,id=null;for(const b of this.bones){"
    "if(jointIds&&!jointIds.has(b.joint.id))continue;const f=frames?frames.get(b.joint.id):b.joint.world"
)
OLD_SUPPORT_SKIN = "this.tissue?.minimumSupportY(frames);"
NEW_SUPPORT_SKIN = "this.tissue?.minimumSupportY(frames,jointIds);"

LOCOMOTION_PATCHES = [
    (
        "constructor-runtime-state",
        "  this.pose=new MotionLabPose(agent.h,this.engine);agent.h.motionDriver=this.pose;\n"
        "  this.resetFromPose();",
        "  this.pose=new MotionLabPose(agent.h,this.engine);agent.h.motionDriver=this.pose;\n"
        "  this.runtimeState=typeof MotionRuntimeState==='function'?new MotionRuntimeState(agent):null;agent.h.motionRuntimeState=this.runtimeState;\n"
        "  this.resetFromPose();",
    ),
    (
        "snapshot-runtime-state",
        "lastPoseAdoption:this.lastPoseAdoption,lastContinuousWalkHandoff:this.lastContinuousWalkHandoff,routePassThroughCount:this.routePassThroughCount});}",
        "lastPoseAdoption:this.lastPoseAdoption,lastContinuousWalkHandoff:this.lastContinuousWalkHandoff,routePassThroughCount:this.routePassThroughCount,runtime:this.runtimeState?.snapshot?.()||null});}",
    ),
    (
        "restore-runtime-state-head",
        "  const {phase,turn,...state}=structuredClone(saved);Object.assign(this,state);",
        "  const {phase,turn,runtime,...state}=structuredClone(saved);Object.assign(this,state);",
    ),
    (
        "restore-runtime-state-body",
        "  this.phaseController.restore(phase);Object.assign(this.turnFilter,turn);",
        "  this.phaseController.restore(phase);Object.assign(this.turnFilter,turn);\n"
        "  if(this.runtimeState){if(runtime)this.runtimeState.restore(runtime);else this.runtimeState.reset();}",
    ),
    (
        "reset-runtime-state",
        "};this.sync();\n  return structuredClone(this.lastPoseAdoption);",
        "};this.sync();\n  this.runtimeState?.reset();this.runtimeState?.observe(this,0);\n  return structuredClone(this.lastPoseAdoption);",
    ),
    (
        "request-runtime-intent",
        "  this.requested=true;const key=JSON.stringify(command);\n"
        "  if(this.requestKey===key&&this.engine.state.command)return;\n"
        "  const answer=this.engine.command(command);if(!answer.accepted)throw Error(answer.reason);this.requestKey=key;",
        "  this.requested=true;const key=JSON.stringify(command);\n"
        "  if(this.requestKey===key&&this.engine.state.command){this.runtimeState?.setIntent(command,this.engine.state,this.tempo);return;}\n"
        "  const answer=this.engine.command(command);if(!answer.accepted)throw Error(answer.reason);this.requestKey=key;this.runtimeState?.setIntent(command,this.engine.state,this.tempo);",
    ),
    (
        "stop-runtime-intent",
        " stop(){if(this.kernelSettled()){this.requested=true;return;}if(!this.engine.state.fault)this.request({type:'stop'});}",
        " stop(){const command={type:'stop'};if(this.kernelSettled()){this.requested=true;this.runtimeState?.setIntent(command,this.engine.state,this.tempo);return;}if(!this.engine.state.fault)this.request(command);}",
    ),
    (
        "observe-runtime-state",
        "  this.updateSupportLift(dt*this.tempo);\n  this.sync();\n }",
        "  this.updateSupportLift(dt*this.tempo);\n  this.sync();\n  this.runtimeState?.observe(this,dt);\n }",
    ),
    (
        "report-runtime-state",
        "  contactBasis:'flat placement anchors with explicit heel/forefoot support pivots',pose:this.pose.report(),visualAcceptance:false};}",
        "  contactBasis:'flat placement anchors with explicit heel/forefoot support pivots',pose:this.pose.report(),runtimeState:this.runtimeState?.report?.()||null,visualAcceptance:false};}",
    ),
]


def insert_after(items: list[str], value: str, after: str) -> bool:
    if items.count(value) > 1:
        raise SystemExit(f"source/assembly.json: duplicated {value}")
    if value in items:
        if after not in items or items.index(value) != items.index(after) + 1:
            raise SystemExit(f"{value} must load immediately after {after}")
        return False
    if after not in items:
        raise SystemExit(f"source/assembly.json: missing {after}")
    items.insert(items.index(after) + 1, value)
    return True


def update_assembly() -> bool:
    data = json.loads(ASSEMBLY.read_text(encoding="utf-8"))
    modules = data.get("modules")
    if not isinstance(modules, list):
        raise SystemExit("source/assembly.json: modules must be an array")
    if any(str(path).startswith("clothing/") for path in modules):
        raise SystemExit("clean motion branch must not register clothing/ modules")
    changed = insert_after(modules, BOX_MODULE, "body/MotionLabActions.js")
    changed = insert_after(modules, STATE_MODULE, BOX_MODULE) or changed
    ASSEMBLY.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


def update_runtime_modules() -> bool:
    text = RUNTIME.read_text(encoding="utf-8")
    if text.count(ACTIONS_MARKER) != 1:
        raise SystemExit("source/runtime.template.js: MotionLabActions marker is not unique")
    if text.count(BOX_MARKER) > 1 or text.count(STATE_MARKER) > 1:
        raise SystemExit("source/runtime.template.js: duplicated motion convergence marker")
    changed = False
    if BOX_MARKER not in text:
        text = text.replace(ACTIONS_MARKER, ACTIONS_MARKER + "\n" + BOX_MARKER, 1)
        changed = True
    elif ACTIONS_MARKER + "\n" + BOX_MARKER not in text:
        raise SystemExit("BoxHandling marker is in the wrong assembly position")
    if STATE_MARKER not in text:
        text = text.replace(BOX_MARKER, BOX_MARKER + "\n" + STATE_MARKER, 1)
        changed = True
    elif BOX_MARKER + "\n" + STATE_MARKER not in text:
        raise SystemExit("MotionRuntimeState marker is in the wrong assembly position")
    RUNTIME.write_text(text, encoding="utf-8")
    return changed


def update_support_query() -> bool:
    text = RUNTIME.read_text(encoding="utf-8")
    if text.count(NEW_SUPPORT_HEAD) == 1 and text.count(NEW_SUPPORT_SKIN) == 1:
        return False
    if text.count(OLD_SUPPORT_HEAD) != 1 or text.count(OLD_SUPPORT_SKIN) != 1:
        raise SystemExit("source/runtime.template.js: support-query contract is ambiguous")
    text = text.replace(OLD_SUPPORT_HEAD, NEW_SUPPORT_HEAD, 1)
    text = text.replace(OLD_SUPPORT_SKIN, NEW_SUPPORT_SKIN, 1)
    RUNTIME.write_text(text, encoding="utf-8")
    return True


def update_locomotion_runtime_state() -> bool:
    text = LOCOMOTION.read_text(encoding="utf-8")
    changed = False
    for label, old, new in LOCOMOTION_PATCHES:
        new_count = text.count(new)
        old_count = text.count(old)
        if new_count == 1:
            if old_count > 1:
                raise SystemExit(f"body/NaturalLocomotion.js: ambiguous {label} old fragment")
            continue
        if new_count != 0 or old_count != 1:
            raise SystemExit(
                f"body/NaturalLocomotion.js: unexpected {label} patch state "
                f"(old={old_count}, new={new_count})"
            )
        text = text.replace(old, new, 1)
        changed = True
    LOCOMOTION.write_text(text, encoding="utf-8")
    return changed


def main() -> None:
    changed = {
        "assembly": update_assembly(),
        "runtime_modules": update_runtime_modules(),
        "support_query": update_support_query(),
        "locomotion_runtime_state": update_locomotion_runtime_state(),
    }
    print(json.dumps({"schema": "human/motion-convergence-assembly@1", **changed}))


if __name__ == "__main__":
    main()
