from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHASE1 = ROOT / "cat-kaopu/phase1"
WORKBENCH = PHASE1 / "CAT_KAOPU_PHASE1_GATE_A_SINGLE_NPC_2026-09-16.html"
INDEX = PHASE1 / "index.html"
MANIFEST = PHASE1 / "PHASE1_GATE_A_MANIFEST.json"
REPORT = ROOT / "cat-kaopu/docs/CAT_KAOPU_PHASE1_GATE_A_EXECUTION_REPORT_2026-09-16.md"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


for path in (WORKBENCH, INDEX, MANIFEST, REPORT):
    if not path.is_file():
        raise SystemExit(f"missing generated Gate A file: {path.relative_to(ROOT)}")

html = WORKBENCH.read_text(encoding="utf-8")

# Keep the default wall far enough ahead that the whole finite Gate A root-motion
# clip approaches it from one side. This prevents a discrete sample from choosing
# the far face of the thin wall as the nearest separation direction.
html = replace_once(
    html,
    "{id:'wall_A',label:'测试墙',min:[.355,-.19,0],max:[.375,.19,.245]}",
    "{id:'wall_A',label:'测试墙',min:[.42,-.19,0],max:[.44,.19,.245]}",
    "stable wall placement",
)

# Collision root correction must run after the paw-contact solve. Running it first
# moved the root while the contact solver still held anchors from another world
# position, which could drive the iterative leg solve into NaN. At a blocked wall,
# the gait is damped and all four paws are then reconciled to ground as a bounded
# stopping pose.
html = replace_once(
    html,
    "function resolveFinalPose(desired){const p=clonePose(desired),g=desired.meta&&desired.meta.gait;applyPhase1Collision(p,g);",
    "function resolveFinalPose(desired){const p=clonePose(desired),g=desired.meta&&desired.meta.gait;",
    "remove pre-contact collision solve",
)
html = replace_once(
    html,
    "motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;finalizePhase1Collision(p);motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);return p}",
    "motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;applyPhase1Collision(p,g);motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);return p}",
    "non-gait collision order",
)
html = replace_once(
    html,
    "motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;finalizePhase1Collision(p);motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);p.meta.final={contacts:motionDiagnostics.support,maxSlipM:max,maxPadTiltDeg:maxTilt,phase1Collision:JSON.parse(JSON.stringify(phase1Collision))};return p}",
    "motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;applyPhase1Collision(p,g);if(phase1Collision.blocked){resetContactRuntime();const blockedGroundErrorM=solvePostureGround(p),blockedMats=buildMatrices(p);motionDiagnostics.support=PAW_KEYS.slice();motionDiagnostics.paws={};motionDiagnostics.pads={};motionDiagnostics.anchors={};motionDiagnostics.maxSlipM=0;motionDiagnostics.meanSlipM=0;motionDiagnostics.maxPadTiltDeg=0;for(const k of PAW_KEYS){const frame=padFrame(blockedMats,k);motionDiagnostics.paws[k]=frame.center.slice();motionDiagnostics.pads[k]=JSON.parse(JSON.stringify(frame));motionDiagnostics.anchors[k]=JSON.parse(JSON.stringify(frame));motionDiagnostics.maxPadTiltDeg=Math.max(motionDiagnostics.maxPadTiltDeg,padTiltDeg(frame))}motionDiagnostics.phase1BlockedGroundErrorM=blockedGroundErrorM}motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;p.meta.final={contacts:motionDiagnostics.support,maxSlipM:motionDiagnostics.maxSlipM,maxPadTiltDeg:motionDiagnostics.maxPadTiltDeg,phase1Collision:JSON.parse(JSON.stringify(phase1Collision))};return p}",
    "gait collision order and blocked grounding",
)

# Mark the corrected runtime for automated evidence and future audits.
html = replace_once(
    html,
    "response:'bounded-pushout-plus-gait-brake'",
    "response:'post-contact-bounded-pushout-plus-grounded-gait-brake'",
    "collision response label",
)

WORKBENCH.write_text(html, encoding="utf-8")
INDEX.write_text(html, encoding="utf-8")

note = """

## Gate A 碰撞求解顺序修复

浏览器首轮证据发现：如果先修正根节点碰撞，再让足掌接触求解器追踪旧世界锚点，腿部迭代会产生非有限数值，整猫会消失。当前构建已经改为：先完成原有步态和足掌接触求解，再执行低成本碰撞代理修正；发生阻挡时降低步态幅度，并把四足重新收敛到地面停止姿势。默认测试墙也移动到有限根运动轨迹的单侧接近范围，避免薄墙离散采样选择错误分离面。

该修复解决的是 Gate A 技术稳定性，不代表绕行、群体避让或最终复杂环境物理已经完成。
"""
report_text = REPORT.read_text(encoding="utf-8")
if "## Gate A 碰撞求解顺序修复" not in report_text:
    REPORT.write_text(report_text.rstrip() + note + "\n", encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
outputs = {entry["path"]: entry for entry in manifest.get("outputs", [])}
for path in (WORKBENCH, INDEX, REPORT):
    rel = str(path.relative_to(ROOT))
    if rel not in outputs:
        raise SystemExit(f"manifest output missing: {rel}")
    outputs[rel]["bytes"] = path.stat().st_size
    outputs[rel]["sha256"] = sha256(path)
manifest["collisionSolveOrder"] = "paw_contact_then_collision_then_blocked_ground_reconcile"
manifest["collisionFiniteGuard"] = True
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(
    json.dumps(
        {
            "patched": True,
            "collisionSolveOrder": manifest["collisionSolveOrder"],
            "workbenchBytes": WORKBENCH.stat().st_size,
        },
        ensure_ascii=False,
    )
)
