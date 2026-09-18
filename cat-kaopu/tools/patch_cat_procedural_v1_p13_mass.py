from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "cat-kaopu/procedural-cat-v1"
CORE = MODULE / "src/cat-procedural-core.mjs"
PAGE = MODULE / "index.html"
DEFAULT_DNA = MODULE / "DEFAULT_GREY_TABBY_A.catdna.json"
SCHEMA = MODULE / "CAT_DNA_SCHEMA.json"
CONTRACT = MODULE / "CAT_PROCEDURAL_CAT_V1_CONTRACT.json"
README = MODULE / "README.md"
CANDIDATE = MODULE / "P1_3_MASS_DISTRIBUTION_CANDIDATE.json"


def deep_merge(target: dict, source: dict) -> dict:
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_merge(target[key], value)
        else:
            target[key] = deepcopy(value)
    return target


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        print(f"{label}: already present")
        return text, False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return text.replace(old, new, 1), True


candidate = json.loads(CANDIDATE.read_text(encoding="utf-8"))
current_dna = json.loads(DEFAULT_DNA.read_text(encoding="utf-8"))
new_dna = deep_merge(deepcopy(current_dna), candidate["overrides"])
DEFAULT_DNA.write_text(json.dumps(new_dna, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("default CatDNA: P1.3 anatomical-mass candidate applied")

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
schema["properties"]["neck"]["properties"]["length"]["minimum"] = 0.05
SCHEMA.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

core = CORE.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")

start = core.index("export const DEFAULT_CAT_DNA = Object.freeze(")
end = core.index("\n\nexport const CAT_PARAMETER_DEFINITIONS", start)
core = core[:start] + "export const DEFAULT_CAT_DNA = Object.freeze(" + json.dumps(new_dna, ensure_ascii=False, indent=2) + ");" + core[end:]

core, _ = replace_once(
    core,
    "'neck.length': { group: '颈部', label: '颈部长度', min: 0.075, max: 0.17, step: 0.002 }",
    "'neck.length': { group: '颈部', label: '颈部长度', min: 0.05, max: 0.17, step: 0.001 }",
    "short-neck parameter range",
)

core, _ = replace_once(
    core,
    "  const neckBase = [thoraxX + dna.torso.thoraxLength * 0.55, 0, thoraxZ + dna.torso.thoraxDepth * 0.43];",
    "  const neckBase = [thoraxX + dna.torso.thoraxLength * 0.67, 0, thoraxZ + dna.torso.thoraxDepth * 0.41];",
    "embed neck root into cranial thorax",
)

core, _ = replace_once(
    core,
    "    d = smin(d, taperedCapsuleSdf(x, y, z, anchors.neckBase, anchors.neckTip, dna.neck.baseWidth * 0.48, dna.neck.headWidth * 0.48), 0.022);",
    "    d = smin(d, taperedCapsuleSdf(x, y, z, anchors.neckBase, anchors.neckTip, dna.neck.baseWidth * 0.38, dna.neck.headWidth * 0.40), 0.012);",
    "reduce visible tube neck",
)

core, _ = replace_once(
    core,
    "      d = smin(d, taperedCapsuleSdf(x, y, z, scapulaOrigin, shoulder, dna.forelimb.upperRadius * 1.18, dna.forelimb.upperRadius * 1.04), 0.012);\n      d = smin(d, ellipsoidSdf(x, y, z, shoulder, [dna.forelimb.scapulaLength * 0.31, dna.forelimb.upperRadius * 0.96, dna.forelimb.upperRadius * 1.18]), 0.010);",
    "      d = smin(d, taperedCapsuleSdf(x, y, z, scapulaOrigin, shoulder, dna.forelimb.upperRadius * 0.86, dna.forelimb.upperRadius * 0.82), 0.008);\n      d = smin(d, ellipsoidSdf(x, y, z, shoulder, [dna.forelimb.scapulaLength * 0.22, dna.forelimb.upperRadius * 0.78, dna.forelimb.upperRadius * 0.92]), 0.007);",
    "remove shoulder helper bulb",
)

core, _ = replace_once(
    core,
    "      d = smin(d, ellipsoidSdf(x, y, z, hip, [dna.hindlimb.femurLength * 0.55, dna.hindlimb.upperRadius * 1.20, dna.hindlimb.upperRadius * 1.55]), 0.016);",
    "      const glutealCenter = [hip[0] - dna.hindlimb.femurLength * 0.035, hip[1], hip[2] + dna.hindlimb.upperRadius * 0.08];\n      d = smin(d, ellipsoidSdf(x, y, z, glutealCenter, [dna.hindlimb.femurLength * 0.17, dna.hindlimb.upperRadius * 0.72, dna.hindlimb.upperRadius * 0.90]), 0.007);",
    "remove hip helper bulb",
)

core, _ = replace_once(
    core,
    "      const forePawCenter = [forePaw[0] + dna.paws.foreLength * 0.12, forePaw[1], dna.paws.height * 0.52];\n      d = smin(d, ellipsoidSdf(x, y, z, forePawCenter, [dna.paws.foreLength * 0.43, (dna.paws.foreWidth + dna.paws.toeSplay) * 0.46, dna.paws.height * 0.50]), 0.007);\n      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {\n        const toeCenter = [forePaw[0] + dna.paws.foreLength * (0.42 - Math.abs(toe) * 0.015), forePaw[1] + toe * dna.paws.foreWidth * 0.16, dna.paws.height * 0.48];\n        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.foreLength * 0.18, dna.paws.foreWidth * 0.105, dna.paws.height * 0.33]), 0.0035);\n      }",
    "      const forePawCenter = [forePaw[0] + dna.paws.foreLength * 0.16, forePaw[1], dna.paws.height * 0.50];\n      d = smin(d, ellipsoidSdf(x, y, z, forePawCenter, [dna.paws.foreLength * 0.40, (dna.paws.foreWidth + dna.paws.toeSplay) * 0.44, dna.paws.height * 0.48]), 0.0045);\n      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {\n        const toeCenter = [forePaw[0] + dna.paws.foreLength * (0.50 - Math.abs(toe) * 0.012), forePaw[1] + toe * (dna.paws.foreWidth + dna.paws.toeSplay) * 0.185, dna.paws.height * 0.46];\n        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.foreLength * 0.145, dna.paws.foreWidth * 0.105, dna.paws.height * 0.30]), 0.0015);\n      }",
    "forepaw mass and toe fan",
)

core, _ = replace_once(
    core,
    "      const hindPawCenter = [hindPaw[0] + dna.paws.hindLength * 0.12, hindPaw[1], dna.paws.height * 0.52];\n      d = smin(d, ellipsoidSdf(x, y, z, hindPawCenter, [dna.paws.hindLength * 0.45, (dna.paws.hindWidth + dna.paws.toeSplay) * 0.46, dna.paws.height * 0.50]), 0.007);\n      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {\n        const toeCenter = [hindPaw[0] + dna.paws.hindLength * (0.43 - Math.abs(toe) * 0.014), hindPaw[1] + toe * dna.paws.hindWidth * 0.16, dna.paws.height * 0.48];\n        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.hindLength * 0.18, dna.paws.hindWidth * 0.105, dna.paws.height * 0.33]), 0.0035);\n      }",
    "      const hindPawCenter = [hindPaw[0] + dna.paws.hindLength * 0.17, hindPaw[1], dna.paws.height * 0.50];\n      d = smin(d, ellipsoidSdf(x, y, z, hindPawCenter, [dna.paws.hindLength * 0.42, (dna.paws.hindWidth + dna.paws.toeSplay) * 0.44, dna.paws.height * 0.48]), 0.0045);\n      for (const toe of [-1.5, -0.5, 0.5, 1.5]) {\n        const toeCenter = [hindPaw[0] + dna.paws.hindLength * (0.51 - Math.abs(toe) * 0.012), hindPaw[1] + toe * (dna.paws.hindWidth + dna.paws.toeSplay) * 0.185, dna.paws.height * 0.46];\n        d = smin(d, ellipsoidSdf(x, y, z, toeCenter, [dna.paws.hindLength * 0.145, dna.paws.hindWidth * 0.105, dna.paws.height * 0.30]), 0.0015);\n      }",
    "hindpaw mass and toe fan",
)

core, _ = replace_once(
    core,
    "  const stripeAmount = smooth01((stripeSignal - stripeThreshold) / stripeWidth) * dna.coat.stripeContrast * 0.78;",
    "  const brokenStripe = stripeSignal * mix(0.56, 1.0, hashNoise(x * 7.1, y * 13.3, z * 6.7, seed + 19));\n  const stripeAmount = smooth01((brokenStripe - stripeThreshold) / stripeWidth) * dna.coat.stripeContrast * 0.45;",
    "subordinate broken tabby stripes",
)

page_pairs = [
    ("<title>CAT PROCEDURAL BODY V1 · P1.2 轮廓收敛</title>", "<title>CAT PROCEDURAL BODY V1 · P1.3 体量分配</title>"),
    ("<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.2 轮廓收敛</h1><p>把肩高、髋高重新解释为外部背线高度，降低躯干中心并收敛胸—腰—骨盆、短颈、耳廓、足掌和尾根；仍由 CatDNA 全程序化生成。</p></div>", "<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.3 体量分配</h1><p>保留测量尺度，移除肩髋辅助球、补足连续躯干体量、缩短可见颈段并提高足掌与趾端可读性；仍由 CatDNA 全程序化生成。</p></div>"),
    ("<div class=\"status\" id=\"status\"><b>P1.2 轮廓收敛：</b>直接测量长度保持不变；外部背线高度与内部骨架中心已经分离，继续以六视图检查身体是否像自然中性站立家猫，稳定拓扑与动作仍锁定。</div>", "<div class=\"status\" id=\"status\"><b>P1.3 体量分配：</b>直接测量长度保持不变；优先检查肩胸、腰腹、骨盆、大腿、短颈和足掌是否形成连续家猫轮廓，稳定拓扑与动作仍锁定。</div>"),
    ("anchors.head[0]+h.cranialLength*.27", "anchors.head[0]+h.cranialLength*.25"),
    ("eye.scale.set(h.eyeHeight*.42,h.eyeHeight*.33,h.eyeHeight*.44)", "eye.scale.set(h.eyeHeight*.39,h.eyeHeight*.31,h.eyeHeight*.41)"),
    ("eye.position.x+h.eyeHeight*.34", "eye.position.x+h.eyeHeight*.31"),
    ("anchors.muzzle[0]+h.muzzleLength*.34", "anchors.muzzle[0]+h.muzzleLength*.27"),
    ("nose.scale.set(h.muzzleLength*.11,h.muzzleWidth*.15,h.muzzleHeight*.13)", "nose.scale.set(h.muzzleLength*.10,h.muzzleWidth*.14,h.muzzleHeight*.12)"),
    ("controls.target.set(.005,0,.175);", "controls.target.set(.000,0,.165);"),
]
for old, new in page_pairs:
    page, _ = replace_once(page, old, new, old[:56])

if "__CAT_PROCEDURAL_MASS__" not in page:
    page = page.replace(
        "window.__CAT_PROCEDURAL_SILHOUETTE__='cat-procedural-body-v1-p1-2-silhouette-20260918';",
        "window.__CAT_PROCEDURAL_SILHOUETTE__='cat-procedural-body-v1-p1-2-silhouette-20260918';window.__CAT_PROCEDURAL_MASS__='cat-procedural-body-v1-p1-3-mass-20260918';",
        1,
    )

CORE.write_text(core, encoding="utf-8")
PAGE.write_text(page, encoding="utf-8")

contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
contract["buildId"] = "cat-procedural-body-v1-p1-3-mass-20260918"
contract["massCandidate"] = {
    "profile": "P1_3_MASS_DISTRIBUTION_CANDIDATE.json",
    "directMeasurementsUnchanged": True,
    "helperBulbsReduced": True,
    "stableTopology": False,
    "visualAcceptance": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

readme = README.read_text(encoding="utf-8")
if "## P1.3 体量分配" not in readme:
    readme += """

## P1.3 体量分配

P1.2 修正了背线高度语义，但六视图仍能看到肩髋辅助体形成的独立球团、腰腹过细、颈部像管、足掌像柱端，以及纹理对轮廓判断的干扰。P1.3 完成：

- 大幅缩小肩部和髋部辅助体，让胸廓、腰腹和骨盆的连续截面承担主体体量。
- 腰部软组织适度增宽，同时保留胸—腰—骨盆的家猫节奏。
- 可见颈段缩短并前移嵌入胸廓与头颅。
- 前后足掌从肢端圆柱中分离，并加大四趾扇形展开。
- 尾巴增加到 24 段采样。
- 虎斑变为低对比、断续侧腹条纹，不能再用高对比环纹伪造体节。
- P1 的直接测量骨段和体长保持不变。

P1.3 仍是稳定拓扑之前的视觉候选；只有固定六视图通过后，才允许进入 Surface Carrier。
"""
    README.write_text(readme, encoding="utf-8")

print("P1.3 anatomical mass repair applied: torso-led volume, reduced helper bulbs, embedded neck, readable paws and subordinate coat")
