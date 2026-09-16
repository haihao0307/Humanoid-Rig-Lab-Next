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

# The V4.46 bilateral face carrier is historical close-up research. In the
# environment-NPC gate its invalid-domain triangles can stretch toward clip-space
# corners and corrupt whole-body silhouette evidence. Keep the implementation and
# toggle for regression, but do not render it in the Phase 1 production default.
html = replace_once(
    html,
    "blinkLayerEnabled=true",
    "blinkLayerEnabled=false",
    "disable secondary face carrier by default",
)
html = replace_once(
    html,
    "resize();setView('quarter',true);setAction('stand');",
    "const phase1BlinkToggle=$('#blinkToggle'),phase1BlinkToolbar=$('#blinkLayer');if(phase1BlinkToggle)phase1BlinkToggle.classList.remove('active');if(phase1BlinkToolbar)phase1BlinkToolbar.classList.remove('active');resize();setView('quarter',true);setAction('stand');",
    "synchronize secondary face carrier controls",
)
html = replace_once(
    html,
    "groupRuntime:false,variationRuntime:false,externalModel:false",
    "groupRuntime:false,variationRuntime:false,secondaryFaceCarrierDefault:false,externalModel:false",
    "phase1 secondary-layer stat",
)
html = replace_once(
    html,
    "collision:{proxyCount:3,obstacleCount:1,response:'post-contact-bounded-pushout-plus-grounded-gait-brake'},gates:",
    "collision:{proxyCount:3,obstacleCount:1,response:'post-contact-bounded-pushout-plus-grounded-gait-brake'},presentation:{secondaryFaceCarrierDefault:false,reason:'whole_body_silhouette_first'},gates:",
    "phase1 presentation audit",
)

WORKBENCH.write_text(html, encoding="utf-8")
INDEX.write_text(html, encoding="utf-8")

note = """

## Gate A 整体轮廓显示修复

浏览器四视图证据发现，V4.46 的双眼面部载体在整猫远景中存在无效域三角形向裁剪空间角点拉伸的问题，形成从头部伸向画面边缘的长条伪影。该表现层属于此前眼区近景研究，不属于当前环境 NPC 第一阶段的核心形态。Gate A 现已默认关闭这层载体，只保留实现和手动回归开关；整体形态、动作与碰撞验收直接读取稳定猫体和最终骨架姿势，不再让次要眼区实验污染全身轮廓证据。

这不是删除历史功能，也不把眼区问题宣称为完成。后续若重新启用，必须先修复载体无效域拓扑，而不能把长条伪影视为正常外形。
"""
report_text = REPORT.read_text(encoding="utf-8")
if "## Gate A 整体轮廓显示修复" not in report_text:
    REPORT.write_text(report_text.rstrip() + note + "\n", encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
outputs = {entry["path"]: entry for entry in manifest.get("outputs", [])}
for path in (WORKBENCH, INDEX, REPORT):
    rel = str(path.relative_to(ROOT))
    if rel not in outputs:
        raise SystemExit(f"manifest output missing: {rel}")
    outputs[rel]["bytes"] = path.stat().st_size
    outputs[rel]["sha256"] = sha256(path)
manifest["secondaryFaceCarrierDefault"] = False
manifest["wholeBodySilhouetteUnobstructed"] = True
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(
    json.dumps(
        {
            "patched": True,
            "secondaryFaceCarrierDefault": False,
            "workbenchBytes": WORKBENCH.stat().st_size,
        },
        ensure_ascii=False,
    )
)
