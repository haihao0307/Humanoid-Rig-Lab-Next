from __future__ import annotations

import json
import re
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
CALIBRATION = MODULE / "P1_AUTHORITATIVE_CALIBRATION.json"


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


def set_schema_range(schema: dict, path: str, minimum: float, maximum: float) -> None:
    section, field = path.split('.', 1)
    node = schema["properties"][section]["properties"][field]
    node["minimum"] = minimum
    node["maximum"] = maximum


calibration = json.loads(CALIBRATION.read_text(encoding="utf-8"))
calibrated = calibration["calibratedCatDNA"]
current_dna = json.loads(DEFAULT_DNA.read_text(encoding="utf-8"))
new_dna = deep_merge(deepcopy(current_dna), calibrated)
new_dna["schema"] = "cat_kaopu/cat_dna@1.0"
new_dna["meta"]["units"] = "meter"
new_dna["meta"]["coordinateSystem"] = {"forward": "+X", "left": "+Y", "up": "+Z"}
DEFAULT_DNA.write_text(json.dumps(new_dna, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("default CatDNA: calibrated from P1 evidence")

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
range_map = {
    "global.bodyLength": (0.40, 0.68),
    "global.shoulderHeight": (0.20, 0.34),
    "global.hipHeight": (0.21, 0.36),
    "global.frontStanceWidth": (0.075, 0.16),
    "global.hindStanceWidth": (0.085, 0.18),
    "torso.pelvisLength": (0.08, 0.17),
    "torso.lumbarLength": (0.07, 0.16),
    "torso.thoraxLength": (0.12, 0.23),
    "torso.pelvisWidth": (0.10, 0.18),
    "torso.lumbarWidth": (0.075, 0.14),
    "torso.thoraxWidth": (0.11, 0.20),
    "torso.pelvisDepth": (0.10, 0.20),
    "torso.lumbarDepth": (0.085, 0.16),
    "torso.thoraxDepth": (0.13, 0.23),
    "neck.length": (0.075, 0.17),
    "neck.baseWidth": (0.085, 0.15),
    "neck.headWidth": (0.065, 0.12),
    "neck.baseDepth": (0.10, 0.18),
    "neck.headDepth": (0.075, 0.13),
    "head.cranialLength": (0.075, 0.14),
    "head.width": (0.075, 0.14),
    "head.height": (0.075, 0.14),
    "head.muzzleLength": (0.015, 0.060),
    "head.muzzleWidth": (0.040, 0.080),
    "head.muzzleHeight": (0.030, 0.060),
    "head.jawDepth": (0.025, 0.055),
    "head.eyeSpacing": (0.038, 0.075),
    "head.eyeHeight": (0.016, 0.032),
    "head.earHeight": (0.050, 0.105),
    "head.earWidth": (0.032, 0.065),
    "forelimb.scapulaLength": (0.050, 0.10),
    "forelimb.humerusLength": (0.075, 0.125),
    "forelimb.radiusLength": (0.070, 0.120),
    "forelimb.metacarpalLength": (0.024, 0.055),
    "forelimb.upperRadius": (0.018, 0.038),
    "forelimb.lowerRadius": (0.012, 0.028),
    "forelimb.wristRadius": (0.008, 0.020),
    "forelimb.humerusBackDeg": (8, 34),
    "forelimb.radiusForwardDeg": (0, 20),
    "forelimb.metacarpalForwardDeg": (5, 30),
    "hindlimb.femurLength": (0.10, 0.165),
    "hindlimb.tibiaLength": (0.090, 0.150),
    "hindlimb.tarsusLength": (0.060, 0.115),
    "hindlimb.upperRadius": (0.026, 0.050),
    "hindlimb.lowerRadius": (0.018, 0.036),
    "hindlimb.hockRadius": (0.010, 0.023),
    "hindlimb.femurForwardDeg": (18, 46),
    "hindlimb.tibiaBackDeg": (5, 38),
    "hindlimb.tarsusForwardDeg": (30, 60),
    "paws.foreLength": (0.030, 0.065),
    "paws.foreWidth": (0.022, 0.050),
    "paws.hindLength": (0.032, 0.072),
    "paws.hindWidth": (0.024, 0.052),
    "paws.height": (0.012, 0.026),
    "tail.length": (0.22, 0.42),
    "tail.baseRadius": (0.017, 0.034),
    "tail.tipRadius": (0.004, 0.013),
}
for path, limits in range_map.items():
    set_schema_range(schema, path, *limits)
SCHEMA.write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("CatDNA schema: P1 anatomical ranges applied")

core = CORE.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")

# Replace the in-code source of truth with the calibrated JSON. JSON is valid
# JavaScript object-literal syntax and keeps the browser build dependency-free.
start = core.index("export const DEFAULT_CAT_DNA = Object.freeze(")
end = core.index("\n\nexport const CAT_PARAMETER_DEFINITIONS", start)
new_default = (
    "export const CAT_CALIBRATION_PROFILE_ID = 'cat-procedural-body-v1-p1-calibration-20260918';\n"
    "export const DEFAULT_CAT_DNA = Object.freeze("
    + json.dumps(new_dna, ensure_ascii=False, indent=2)
    + ");"
)
core = core[:start] + new_default + core[end:]

# Keep the editor bounds consistent with the schema. All fields remain
# versioned CatDNA parameters; these limits prevent the old oversized P0 cat
# from being regenerated by stale sliders.
for path, (minimum, maximum) in range_map.items():
    escaped = re.escape(path)
    pattern = re.compile(
        rf"('{escaped}':\s*\{{[^\n]*?min:\s*)-?[0-9.]+(,\s*max:\s*)-?[0-9.]+",
        re.MULTILINE,
    )
    core, count = pattern.subn(rf"\g<1>{minimum}\g<2>{maximum}", core, count=1)
    if count != 1:
        raise SystemExit(f"parameter definition range marker missing: {path}")

core, _ = replace_once(
    core,
    "  const head = [\n    neckTip[0] + dna.head.cranialLength * 0.18,\n    0,\n    neckTip[2] + dna.head.height * 0.04\n  ];\n  const muzzle = [head[0] + dna.head.cranialLength * 0.46 + dna.head.muzzleLength * 0.42, 0, head[2] - dna.head.height * 0.18];",
    "  const head = [\n    neckTip[0] + dna.head.cranialLength * 0.10,\n    0,\n    neckTip[2] + dna.head.height * 0.03\n  ];\n  const muzzle = [head[0] + dna.head.cranialLength * 0.37 + dna.head.muzzleLength * 0.48, 0, head[2] - dna.head.height * 0.105];",
    "short feline craniofacial placement",
)

helper = """
function continuousTorsoSdf(x, y, z, sections) {
  const first = sections[0];
  const last = sections.at(-1);
  const clampedX = clamp(x, first.x, last.x);
  let a = first;
  let b = sections[1];
  for (let i = 0; i < sections.length - 1; i += 1) {
    if (clampedX >= sections[i].x && clampedX <= sections[i + 1].x) {
      a = sections[i];
      b = sections[i + 1];
      break;
    }
  }
  const span = Math.max(1e-6, b.x - a.x);
  const t = smooth01((clampedX - a.x) / span);
  const centerZ = mix(a.z, b.z, t);
  const ry = mix(a.ry, b.ry, t);
  const rz = mix(a.rz, b.rz, t);
  const capRadius = x < first.x ? 0.055 : x > last.x ? 0.060 : 1e6;
  const dx = x - clampedX;
  const q = Math.sqrt((dx / capRadius) ** 2 + (y / ry) ** 2 + ((z - centerZ) / rz) ** 2) - 1;
  return q * Math.min(ry, rz, capRadius);
}
"""
if "function continuousTorsoSdf" not in core:
    marker = "\nexport function deriveTailPoints(input = DEFAULT_CAT_DNA) {"
    if marker not in core:
        raise SystemExit("continuous torso insertion marker missing")
    core = core.replace(marker, helper + marker, 1)
    print("continuous torso field: inserted")
else:
    print("continuous torso field: already present")

core, _ = replace_once(
    core,
    "    let d = Infinity;\n    for (const section of sections) {\n      d = smin(d, ellipsoidSdf(x, y, z, [section.x, 0, section.z], [0.085, section.ry, section.rz]), bodySmooth);\n    }",
    "    let d = continuousTorsoSdf(x, y, z, sections);",
    "remove scalloped ellipsoid torso",
)

# A measured P1 cat is smaller than the exploratory P0 body. Reframe the
# authoring workbench so the fixed views compare morphology rather than empty
# space and legacy oversized bounds.
text_pairs = [
    ("<title>CAT PROCEDURAL BODY V1 · 全参数化程序化猫</title>", "<title>CAT PROCEDURAL BODY V1 · P1 权威测量校准</title>"),
    ("<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P0</h1><p>全部形态、骨架锚点、碰撞代理和灰虎斑材质由 CatDNA 程序生成；运行时不读取外部猫模型或图像贴图。</p></div>", "<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1 测量校准</h1><p>身体尺度与肢段比例已接入公开兽医 CT、形态学和步态研究；外部资料只保留数值证据，运行时仍只生成我们自己的 CatDNA 猫。</p></div>"),
    ("<div class=\"status\" id=\"status\"><b>P0 参数内核：</b>先审正确身体与自然中性站立；稳定拓扑、蒙皮和动作仍锁定。任何群体或品种变化都必须从同一 CatDNA 与约束内核派生。</div>", "<div class=\"status\" id=\"status\"><b>P1 权威测量校准：</b>先检查 47.48 cm 头体长、25.25 cm 肩高和真实前后肢段比例；未测量软组织仍明确保持候选状态，稳定拓扑、蒙皮和动作继续锁定。</div>"),
    ("const bounds={minX:-1.24,maxX:.78,minY:-.34,maxY:.34,minZ:-.025,maxZ:.82};const resolution=72;", "const bounds={minX:-.62,maxX:.52,minY:-.24,maxY:.24,minZ:-.02,maxZ:.48};const resolution=76;"),
    ("const grid=new THREE.GridHelper(2.6,52,0x2d7f91,0x15343e);", "const grid=new THREE.GridHelper(1.6,40,0x2d7f91,0x15343e);"),
    ("new THREE.PlaneGeometry(4,2.8)", "new THREE.PlaneGeometry(2.2,1.6)"),
    ("scene.fog=new THREE.Fog(0x071015,2.3,4.2);", "scene.fog=new THREE.Fog(0x071015,1.45,2.8);"),
    ("const views={front:{p:[1.65,0,.38],u:[0,0,1]},left:{p:[-.08,1.65,.38],u:[0,0,1]},right:{p:[-.08,-1.65,.38],u:[0,0,1]},top:{p:[-.10,0,1.85],u:[1,0,0]},'quarter-front':{p:[1.38,.98,.78],u:[0,0,1]},'quarter-rear':{p:[-1.40,.98,.76],u:[0,0,1]}};", "const views={front:{p:[1.08,0,.25],u:[0,0,1]},left:{p:[.02,1.08,.25],u:[0,0,1]},right:{p:[.02,-1.08,.25],u:[0,0,1]},top:{p:[.02,0,1.15],u:[1,0,0]},'quarter-front':{p:[.88,.66,.50],u:[0,0,1]},'quarter-rear':{p:[-.86,.66,.48],u:[0,0,1]}};"),
    ("controls.target.set(-.10,0,.28);", "controls.target.set(.015,0,.205);"),
]
for old, new in text_pairs:
    page, _ = replace_once(page, old, new, old[:48])

if "__CAT_PROCEDURAL_CALIBRATION__" not in page:
    page = page.replace(
        "window.__CAT_PROCEDURAL_SET_VIEW__=setView;",
        "window.__CAT_PROCEDURAL_CALIBRATION__='cat-procedural-body-v1-p1-calibration-20260918';window.__CAT_PROCEDURAL_SET_VIEW__=setView;",
        1,
    )

CORE.write_text(core, encoding="utf-8")
PAGE.write_text(page, encoding="utf-8")

contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
contract["buildId"] = "cat-procedural-body-v1-p1-calibration-20260918"
contract["calibration"] = {
    "profile": "P1_AUTHORITATIVE_CALIBRATION.json",
    "directMeasuredFields": calibration["classification"]["directlyMeasured"],
    "ratioDerivedFields": calibration["classification"]["ratioDerived"],
    "candidateFields": calibration["classification"]["anatomicallyConstrainedCandidate"],
    "externalReferenceLoadedAtRuntime": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

README.write_text(
    """# CAT PROCEDURAL BODY V1\n\n## 当前阶段：P1 权威测量校准\n\n本目录构建我们自己的全参数化、全程序化家猫母体。运行时不加载第三方猫模型或外部图像贴图。公开兽医 CT、形态学和步态资料仅用于提取可追溯的数值，最终身体、骨架锚点、碰撞体、材质和后续变体全部由第一方 CatDNA 与程序公式生成。\n\n## P1 已完成\n\n- `P1_AUTHORITATIVE_CALIBRATION.json` 区分直接测量、比例推导和仍待验证的软组织候选。\n- 头体长校准为 0.475 m，肩高校准为 0.2525 m。\n- 前肢肩胛、肱骨、桡骨和腕掌段接入实验测量。\n- 后肢股骨、胫骨和跖段接入放射与 CT 测量及 Felidae 比例。\n- 头颅尺度接入 European Shorthair CT 研究，软组织头面仍标记为候选。\n- P0 离散椭球躯干改为连续截面场，避免背部和腹部沿纵轴形成周期鼓包。\n- 75 个 CatDNA 参数继续统一驱动几何、骨架锚点、碰撞代理和程序化材质。\n\n## 永久边界\n\n1. 形态、绑定、姿势、动画分层。\n2. Pose 和 Animation 不得通过骨骼缩放改变猫体比例。\n3. 身体、骨架锚点、碰撞代理和材质必须读取同一 CatDNA revision。\n4. 所有参数先通过约束归一化，再进入几何和运行时。\n5. 稳定拓扑冻结之前，不进入正式蒙皮与动作生产。\n6. 单只猫的形态、变形和核心动作通过之前，不进入猫群。\n7. 品种和个体差异必须由受限 DNA 派生，禁止各部位无约束随机缩放。\n8. 原始参考证据与最终生成资产分开保存。\n\n## 仍未通过\n\nP1 只证明尺度和主要骨段不再沿用 P0 的超长候选。胸腹、颈肩、足掌、尾根及软组织头面尚需六视图视觉复核，因此仍保持：\n\n```text\nvisualAcceptance = false\nstableTopology = false\nbindAcceptance = false\nmotionAcceptance = false\nproductionReady = false\n```\n\n## 后续生产门\n\n1. P1.1 根据固定六视图继续校准胸腹、颈肩、头面、足掌和尾根。\n2. P2 用户视觉验收并冻结 Grey Tabby A 中性站立母体。\n3. P3 稳定拓扑 Surface Carrier。\n4. P4 `cat_body_bind_v1`、新蒙皮权重与姿势修形。\n5. P5 关节应力和破损检查。\n6. P6 核心动作。\n7. P7 单体碰撞与环境 NPC。\n8. P8 受限变体、猫群和品种扩展。\n""",
    encoding="utf-8",
)

print("P1 authoritative calibration applied to CatDNA, continuous body field and workbench")
