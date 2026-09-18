from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "cat-kaopu/procedural-cat-v1"
CORE = MODULE / "src/cat-procedural-core.mjs"
PAGE = MODULE / "index.html"
DEFAULT_DNA = MODULE / "DEFAULT_GREY_TABBY_A.catdna.json"
CONTRACT = MODULE / "CAT_PROCEDURAL_CAT_V1_CONTRACT.json"
README = MODULE / "README.md"
CANDIDATE = MODULE / "P1_2_SILHOUETTE_CANDIDATE.json"


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
print("default CatDNA: P1.2 silhouette candidate applied")

core = CORE.read_text(encoding="utf-8")
page = PAGE.read_text(encoding="utf-8")

# Keep the browser's source of truth identical to the exported CatDNA.
start = core.index("export const DEFAULT_CAT_DNA = Object.freeze(")
end = core.index("\n\nexport const CAT_PARAMETER_DEFINITIONS", start)
core = core[:start] + "export const DEFAULT_CAT_DNA = Object.freeze(" + json.dumps(new_dna, ensure_ascii=False, indent=2) + ");" + core[end:]

core, _ = replace_once(
    core,
    "  const pelvisZ = dna.global.hipHeight;\n  const thoraxZ = dna.global.shoulderHeight + dna.torso.thoraxDepth * 0.08;\n  const neckPitch = dna.neck.pitchDeg * DEG;\n  const neckBase = [thoraxX + dna.torso.thoraxLength * 0.34, 0, thoraxZ + dna.torso.thoraxDepth * 0.20];",
    "  const pelvisZ = dna.global.hipHeight - dna.torso.pelvisDepth * 0.49;\n  const thoraxZ = dna.global.shoulderHeight - dna.torso.thoraxDepth * 0.48;\n  const neckPitch = dna.neck.pitchDeg * DEG;\n  const neckBase = [thoraxX + dna.torso.thoraxLength * 0.55, 0, thoraxZ + dna.torso.thoraxDepth * 0.43];",
    "separate external dorsal heights from internal torso centers",
)

core, _ = replace_once(
    core,
    "  const head = [\n    neckTip[0] + dna.head.cranialLength * 0.10,\n    0,\n    neckTip[2] + dna.head.height * 0.03\n  ];\n  const muzzle = [head[0] + dna.head.cranialLength * 0.37 + dna.head.muzzleLength * 0.48, 0, head[2] - dna.head.height * 0.105];",
    "  const head = [\n    neckTip[0] + dna.head.cranialLength * 0.08,\n    0,\n    neckTip[2] + dna.head.height * 0.02\n  ];\n  const muzzle = [head[0] + dna.head.cranialLength * 0.34 + dna.head.muzzleLength * 0.44, 0, head[2] - dna.head.height * 0.08];",
    "compact feline head placement",
)

core, _ = replace_once(
    core,
    "    tailRoot: [pelvisX - dna.torso.pelvisLength * 0.52, 0, pelvisZ + dna.torso.pelvisDepth * 0.10]",
    "    tailRoot: [pelvisX - dna.torso.pelvisLength * 0.52, 0, pelvisZ + dna.torso.pelvisDepth * 0.25]",
    "tail root into dorsal sacral region",
)

old_sections = """  const sections = [
    { x: pelvisX - dna.torso.pelvisLength * 0.50, z: zPelvis - 0.005, ry: dna.torso.pelvisWidth * 0.34 * bulk, rz: dna.torso.pelvisDepth * 0.38 * bulk },
    { x: pelvisX, z: zPelvis, ry: dna.torso.pelvisWidth * 0.50 * bulk, rz: dna.torso.pelvisDepth * 0.50 * bulk },
    { x: anchors.lumbar[0] - dna.torso.lumbarLength * 0.28, z: zLumbar - dna.torso.abdomenTuck * 0.10 - dna.torso.ventralSag * 0.30, ry: dna.torso.lumbarWidth * 0.50 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.35) * 0.50 * bulk },
    { x: anchors.lumbar[0] + dna.torso.lumbarLength * 0.30, z: zLumbar + dna.torso.dorsalArc * 0.18 - dna.torso.ventralSag * 0.42, ry: dna.torso.lumbarWidth * 0.54 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.42) * 0.48 * bulk },
    { x: thoraxX - dna.torso.thoraxLength * 0.24, z: zThorax, ry: dna.torso.thoraxWidth * 0.50 * bulk, rz: dna.torso.thoraxDepth * 0.50 * bulk },
    { x: thoraxX + dna.torso.thoraxLength * 0.24, z: zThorax + dna.torso.dorsalArc * 0.12, ry: dna.torso.thoraxWidth * 0.44 * bulk, rz: dna.torso.thoraxDepth * 0.46 * bulk },
    { x: thoraxX + dna.torso.thoraxLength * 0.46, z: zThorax + dna.torso.dorsalArc * 0.15, ry: dna.neck.baseWidth * 0.48 * bulk, rz: dna.neck.baseDepth * 0.46 * bulk }
  ];
"""
new_sections = """  const sections = [
    { x: pelvisX - dna.torso.pelvisLength * 0.50, z: zPelvis - 0.004, ry: dna.torso.pelvisWidth * 0.34 * bulk, rz: dna.torso.pelvisDepth * 0.36 * bulk },
    { x: pelvisX - dna.torso.pelvisLength * 0.24, z: zPelvis - 0.001, ry: dna.torso.pelvisWidth * 0.47 * bulk, rz: dna.torso.pelvisDepth * 0.48 * bulk },
    { x: pelvisX, z: zPelvis, ry: dna.torso.pelvisWidth * 0.50 * bulk, rz: dna.torso.pelvisDepth * 0.50 * bulk },
    { x: mix(pelvisX, anchors.lumbar[0], 0.58), z: mix(zPelvis, zLumbar, 0.58), ry: mix(dna.torso.pelvisWidth * 0.48, dna.torso.lumbarWidth * 0.50, 0.64) * bulk, rz: mix(dna.torso.pelvisDepth * 0.46, dna.torso.lumbarDepth * 0.50, 0.64) * bulk },
    { x: anchors.lumbar[0], z: zLumbar - dna.torso.abdomenTuck * 0.08, ry: dna.torso.lumbarWidth * 0.50 * bulk, rz: (dna.torso.lumbarDepth + dna.torso.ventralSag * 0.28) * 0.50 * bulk },
    { x: mix(anchors.lumbar[0], thoraxX, 0.46), z: mix(zLumbar, zThorax, 0.46), ry: mix(dna.torso.lumbarWidth * 0.52, dna.torso.thoraxWidth * 0.48, 0.58) * bulk, rz: mix(dna.torso.lumbarDepth * 0.49, dna.torso.thoraxDepth * 0.48, 0.58) * bulk },
    { x: thoraxX - dna.torso.thoraxLength * 0.18, z: zThorax, ry: dna.torso.thoraxWidth * 0.48 * bulk, rz: dna.torso.thoraxDepth * 0.48 * bulk },
    { x: thoraxX + dna.torso.thoraxLength * 0.16, z: zThorax + dna.torso.dorsalArc * 0.08, ry: dna.torso.thoraxWidth * 0.46 * bulk, rz: dna.torso.thoraxDepth * 0.46 * bulk },
    { x: thoraxX + dna.torso.thoraxLength * 0.38, z: zThorax + dna.torso.dorsalArc * 0.11, ry: dna.neck.baseWidth * 0.43 * bulk, rz: dna.neck.baseDepth * 0.42 * bulk },
    { x: neckBase[0], z: neckBase[2] - dna.neck.baseDepth * 0.12, ry: dna.neck.baseWidth * 0.39 * bulk, rz: dna.neck.baseDepth * 0.38 * bulk }
  ];
"""
core, _ = replace_once(core, old_sections, new_sections, "ten-section torso silhouette")

old_torso = """  const centerZ = mix(a.z, b.z, t);
  const ry = mix(a.ry, b.ry, t);
  const rz = mix(a.rz, b.rz, t);
  const capRadius = x < first.x ? 0.055 : x > last.x ? 0.060 : 1e6;
  const dx = x - clampedX;
  const q = Math.sqrt((dx / capRadius) ** 2 + (y / ry) ** 2 + ((z - centerZ) / rz) ** 2) - 1;
  return q * Math.min(ry, rz, capRadius);
"""
new_torso = """  const centerZ = mix(a.z, b.z, t);
  const ry = mix(a.ry, b.ry, t);
  const rz = mix(a.rz, b.rz, t);
  const capRadius = x < first.x ? 0.050 : x > last.x ? 0.052 : 1e6;
  const dx = x - clampedX;
  const localRz = z >= centerZ ? rz * 0.91 : rz * 1.09;
  const horizontal = Math.abs(y / ry);
  const vertical = Math.abs((z - centerZ) / localRz);
  const q = Math.pow(Math.pow(horizontal, 2.15) + Math.pow(vertical, 2.15) + Math.pow(Math.abs(dx / capRadius), 2.15), 1 / 2.15) - 1;
  return q * Math.min(ry, localRz, capRadius);
"""
core, _ = replace_once(core, old_torso, new_torso, "asymmetric continuous torso section")

old_pinna = """function pinnaSdf(x, y, z, base, side, height, width, tiltDeg) {
  const tipZ = base[2] + height;
  const u = clamp((z - base[2]) / Math.max(height, 1e-6), 0, 1);
  const taper = Math.pow(1 - u, 0.72);
  const tilt = tiltDeg * DEG;
  const cx = base[0] - height * 0.09 * u;
  const cy = base[1] + side * Math.sin(tilt) * height * 0.62 * u;
  const halfWidth = Math.max(0.0022, width * (0.52 * taper + 0.045));
  const halfDepth = Math.max(0.0018, width * (0.23 * taper + 0.035));
  const radial = (Math.hypot((x - cx) / halfDepth, (y - cy) / halfWidth) - 1) * Math.min(halfWidth, halfDepth);
  return Math.max(radial, base[2] - z, z - tipZ);
}
"""
new_pinna = """function pinnaSdf(x, y, z, base, side, height, width, tiltDeg) {
  const tipZ = base[2] + height;
  const u = clamp((z - base[2]) / Math.max(height, 1e-6), 0, 1);
  const taper = Math.pow(1 - u, 0.82);
  const tilt = tiltDeg * DEG;
  const cx = base[0] - height * 0.10 * u;
  const cy = base[1] + side * Math.sin(tilt) * height * 0.52 * u;
  const halfWidth = Math.max(0.0012, width * 0.54 * taper);
  const halfDepth = Math.max(0.0012, width * (0.16 * taper + 0.025));
  const slabX = Math.abs(x - cx) - halfDepth;
  const wedgeY = Math.abs(y - cy) - halfWidth;
  return Math.max(slabX, wedgeY, base[2] - z, z - tipZ);
}
"""
core, _ = replace_once(core, old_pinna, new_pinna, "flat wedge pinnae")

old_tail = """  const p1 = [root[0] - length * 0.28, dna.tail.lateral * 0.30, root[2] - 0.03 + dna.tail.lift * 0.20];
  const p2 = [root[0] - length * 0.72, dna.tail.lateral * 0.75, root[2] + dna.tail.lift * 0.55 + dna.tail.curl * 0.12];
  const p3 = [root[0] - length, dna.tail.lateral, root[2] + dna.tail.lift + dna.tail.curl * 0.24];
"""
new_tail = """  const p1 = [root[0] - length * 0.24, dna.tail.lateral * 0.24, root[2] - 0.018 + dna.tail.lift * 0.10];
  const p2 = [root[0] - length * 0.66, dna.tail.lateral * 0.70, root[2] - 0.008 + dna.tail.lift * 0.28 + dna.tail.curl * 0.08];
  const p3 = [root[0] - length, dna.tail.lateral, root[2] + dna.tail.lift + dna.tail.curl * 0.18];
"""
core, _ = replace_once(core, old_tail, new_tail, "smooth low-energy tail curve")

core, _ = replace_once(
    core,
    "      d = smin(d, taperedCapsuleSdf(x, y, z, tailPoints[i], tailPoints[i + 1], mix(dna.tail.baseRadius, dna.tail.tipRadius, t0), mix(dna.tail.baseRadius, dna.tail.tipRadius, t1)), 0.009);",
    "      d = smin(d, taperedCapsuleSdf(x, y, z, tailPoints[i], tailPoints[i + 1], mix(dna.tail.baseRadius, dna.tail.tipRadius, t0), mix(dna.tail.baseRadius, dna.tail.tipRadius, t1)), 0.012);",
    "smoother tail union",
)

# The broad shoulder ellipsoid made P1.1 read as a sphere attached to a narrow
# waist. Retain the shoulder joint support but let the measured thorax carry the
# low-frequency mass.
core, _ = replace_once(
    core,
    "      d = smin(d, ellipsoidSdf(x, y, z, shoulder, [dna.forelimb.scapulaLength * 0.40, dna.forelimb.upperRadius * 1.04, dna.forelimb.upperRadius * 1.36]), 0.012);",
    "      d = smin(d, ellipsoidSdf(x, y, z, shoulder, [dna.forelimb.scapulaLength * 0.31, dna.forelimb.upperRadius * 0.96, dna.forelimb.upperRadius * 1.18]), 0.010);",
    "reduced shoulder bulb",
)

# Keep the coat subordinate to silhouette review.
core, _ = replace_once(
    core,
    "  const stripeAmount = smooth01((stripeSignal - stripeThreshold) / stripeWidth) * dna.coat.stripeContrast;",
    "  const stripeAmount = smooth01((stripeSignal - stripeThreshold) / stripeWidth) * dna.coat.stripeContrast * 0.78;",
    "subordinate coat contrast",
)

page_pairs = [
    ("<title>CAT PROCEDURAL BODY V1 · P1.1 形态修复</title>", "<title>CAT PROCEDURAL BODY V1 · P1.2 轮廓收敛</title>"),
    ("<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.1 形态修复</h1><p>保持权威长度测量，修复长颈、圆锥耳、骨段偷偷缩放、直后腿、无趾足掌和机械环纹；仍由 CatDNA 全程序化生成。</p></div>", "<div class=\"brand\"><h1>CAT PROCEDURAL BODY V1 · P1.2 轮廓收敛</h1><p>把肩高、髋高重新解释为外部背线高度，降低躯干中心并收敛胸—腰—骨盆、短颈、耳廓、足掌和尾根；仍由 CatDNA 全程序化生成。</p></div>"),
    ("<div class=\"status\" id=\"status\"><b>P1.1 形态修复：</b>直接测量长度保持不变；软组织头面、耳廓、颈肩、后肢折线、足掌和虎斑方向作为视觉候选继续复核，稳定拓扑与动作仍锁定。</div>", "<div class=\"status\" id=\"status\"><b>P1.2 轮廓收敛：</b>直接测量长度保持不变；外部背线高度与内部骨架中心已经分离，继续以六视图检查身体是否像自然中性站立家猫，稳定拓扑与动作仍锁定。</div>"),
    ("anchors.head[0]+h.cranialLength*.30", "anchors.head[0]+h.cranialLength*.27"),
    ("eye.scale.set(h.eyeHeight*.46,h.eyeHeight*.36,h.eyeHeight*.48)", "eye.scale.set(h.eyeHeight*.42,h.eyeHeight*.33,h.eyeHeight*.44)"),
    ("eye.position.x+h.eyeHeight*.37", "eye.position.x+h.eyeHeight*.34"),
    ("anchors.muzzle[0]+h.muzzleLength*.42", "anchors.muzzle[0]+h.muzzleLength*.34"),
    ("nose.scale.set(h.muzzleLength*.12,h.muzzleWidth*.17,h.muzzleHeight*.14)", "nose.scale.set(h.muzzleLength*.11,h.muzzleWidth*.15,h.muzzleHeight*.13)"),
    ("controls.target.set(.015,0,.205);", "controls.target.set(.005,0,.175);"),
]
for old, new in page_pairs:
    page, _ = replace_once(page, old, new, old[:56])

if "__CAT_PROCEDURAL_SILHOUETTE__" not in page:
    page = page.replace(
        "window.__CAT_PROCEDURAL_MORPHOLOGY__='cat-procedural-body-v1-p1-1-morphology-20260918';",
        "window.__CAT_PROCEDURAL_MORPHOLOGY__='cat-procedural-body-v1-p1-1-morphology-20260918';window.__CAT_PROCEDURAL_SILHOUETTE__='cat-procedural-body-v1-p1-2-silhouette-20260918';",
        1,
    )

CORE.write_text(core, encoding="utf-8")
PAGE.write_text(page, encoding="utf-8")

contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
contract["buildId"] = "cat-procedural-body-v1-p1-2-silhouette-20260918"
contract["silhouetteCandidate"] = {
    "profile": "P1_2_SILHOUETTE_CANDIDATE.json",
    "directMeasurementsUnchanged": True,
    "externalDorsalHeightSeparatedFromSpineCenter": True,
    "stableTopology": False,
    "visualAcceptance": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

readme = README.read_text(encoding="utf-8")
if "## P1.2 轮廓收敛" not in readme:
    readme += """

## P1.2 轮廓收敛

P1.1 证明测量骨段可以直接落地，但六视图仍显示躯干中心过高、胸腰骨盆像三个相连球体、颈部外露过长、耳廓像角、尾巴分节明显。P1.2 完成：

- 将文献中的肩高与髋高解释为外部背线高度，不再直接当作躯干中心或骨盆中心。
- 脊柱中心、肩关节、髋关节和外部轮廓高度分别计算。
- 使用 10 个连续截面和上下不对称超椭圆，收敛胸廓、腰腹和骨盆。
- 颈根前移并嵌入颅侧胸廓，缩短可见颈段。
- 耳廓改为扁平楔形场，降低角状读感。
- 尾巴增加至 20 段采样并提高局部连续融合。
- 保持 P1 的体长和主要前后肢骨段测量不变。

P1.2 仍然只是固定拓扑之前的作者态候选，必须先通过六视图视觉确认。
"""
    README.write_text(readme, encoding="utf-8")

print("P1.2 silhouette convergence applied: dorsal-height semantics, asymmetric torso, embedded neck, flat pinnae and smooth tail")
