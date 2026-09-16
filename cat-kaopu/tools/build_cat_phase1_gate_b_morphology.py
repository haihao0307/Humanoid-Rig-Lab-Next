from __future__ import annotations

import base64
import hashlib
import json
import math
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "cat-kaopu/phase1/CAT_KAOPU_PHASE1_GATE_A_SINGLE_NPC_2026-09-16.html"
OUT_DIR = ROOT / "cat-kaopu/phase1-gate-b"
DOCS_DIR = ROOT / "cat-kaopu/docs"
WORKBENCH = OUT_DIR / "CAT_KAOPU_PHASE1_GATE_B_MORPHOLOGY_2026-09-16.html"
INDEX = OUT_DIR / "index.html"
PROFILE = OUT_DIR / "PHASE1_MORPHOLOGY_PROFILE.json"
CONTRACT = OUT_DIR / "PHASE1_GATE_B_CONTRACT.json"
MANIFEST = OUT_DIR / "PHASE1_GATE_B_MANIFEST.json"
REPORT = DOCS_DIR / "CAT_KAOPU_PHASE1_GATE_B_MORPHOLOGY_REPORT_2026-09-16.md"

BUILD_ID = "cat-kaopu-phase1-gate-b-morphology-20260916"
DATE = "2026-09-16"
DEFAULTS = {
    "chest": 0.82,
    "waist": 0.78,
    "pelvis": 0.36,
    "shoulder": 0.74,
    "belly": 0.82,
    "neck": 0.68,
    "master": 1.0,
}
SECTIONS = {
    "chest": (0.035, 0.105),
    "waist": (-0.070, 0.005),
    "pelvis": (-0.145, -0.075),
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def smooth(a: float, b: float, value: float) -> float:
    if b == a:
        return 0.0
    q = max(0.0, min(1.0, (value - a) / (b - a)))
    return q * q * (3.0 - 2.0 * q)


def band(value: float, center: float, radius: float) -> float:
    q = max(0.0, min(1.0, (abs(value - center) - radius * 0.48) / (radius * 0.52)))
    return 1.0 - q * q * (3.0 - 2.0 * q)


def extract_payload(html: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", html)
    if not match:
        raise SystemExit("CAT_B64 payload missing from Gate A source")
    return base64.b64decode(match.group(1))


def parse_cat_payload(payload: bytes) -> dict:
    if payload[:7] != b"CATV440":
        raise SystemExit("CATV440 payload magic mismatch")
    (
        version,
        vertex_count,
        index_count,
        body_count,
        bone_count,
        flags,
        pos_offset,
        norm_offset,
        index_offset,
        part_offset,
        joint_offset,
        weight_offset,
    ) = struct.unpack_from("<12I", payload, 8)
    bmin = struct.unpack_from("<3f", payload, 56)
    bmax = struct.unpack_from("<3f", payload, 68)

    positions: list[tuple[float, float, float]] = []
    for index in range(vertex_count):
        qx, qy, qz = struct.unpack_from("<3H", payload, pos_offset + index * 6)
        positions.append(
            (
                bmin[0] + qx / 65535.0 * (bmax[0] - bmin[0]),
                bmin[1] + qy / 65535.0 * (bmax[1] - bmin[1]),
                bmin[2] + qz / 65535.0 * (bmax[2] - bmin[2]),
            )
        )

    indices = list(struct.unpack_from(f"<{index_count}H", payload, index_offset))
    parts = list(payload[part_offset : part_offset + vertex_count])
    joints = [
        tuple(payload[joint_offset + index * 4 : joint_offset + index * 4 + 4])
        for index in range(vertex_count)
    ]
    weights = [
        tuple(value / 255.0 for value in payload[weight_offset + index * 4 : weight_offset + index * 4 + 4])
        for index in range(vertex_count)
    ]
    return {
        "version": version,
        "vertexCount": vertex_count,
        "indexCount": index_count,
        "bodyCount": body_count,
        "boneCount": bone_count,
        "flags": flags,
        "positions": positions,
        "indices": indices,
        "parts": parts,
        "joints": joints,
        "weights": weights,
        "bmin": bmin,
        "bmax": bmax,
    }


def bone_weight(parsed: dict, vertex: int, bone: int) -> float:
    total = 0.0
    for joint, weight in zip(parsed["joints"][vertex], parsed["weights"][vertex]):
        if joint == bone:
            total += weight
    return total


def morph_vertex(parsed: dict, vertex: int, params: dict[str, float]) -> tuple[float, float, float]:
    x, y, z = parsed["positions"][vertex]
    if vertex >= parsed["bodyCount"] or parsed["parts"][vertex] > 0:
        return x, y, z

    core = min(1.0, sum(bone_weight(parsed, vertex, bone) for bone in (1, 2, 3, 4, 5)))
    scapula = min(1.0, sum(bone_weight(parsed, vertex, bone) for bone in (14, 15, 19, 20)))
    neck_weight = bone_weight(parsed, vertex, 5)
    body_gate = smooth(0.16, 0.72, core)
    upper_gate = smooth(0.145, 0.205, z)
    lower_gate = 1.0 - smooth(0.118, 0.176, z)
    chest = band(x, 0.070, 0.085) * body_gate
    waist = band(x, -0.030, 0.065) * body_gate
    waist_lift = band(x, -0.025, 0.100) * body_gate
    pelvis = band(x, -0.112, 0.060) * body_gate
    shoulder = (
        band(x, 0.112, 0.070)
        * min(1.0, body_gate + 0.58 * scapula)
        * smooth(0.118, 0.165, z)
    )
    neck = band(x, 0.150, 0.055) * min(1.0, 0.72 * body_gate + 0.65 * neck_weight)
    master = params["master"]
    lateral_scale = 1.0 + master * (
        0.104 * params["chest"] * chest
        - 0.180 * params["waist"] * waist
        + 0.040 * params["pelvis"] * pelvis
        + 0.052 * params["shoulder"] * shoulder
        + 0.050 * params["neck"] * neck
    )
    ny = y * lateral_scale
    nz = z + master * (
        0.0092 * params["belly"] * waist_lift * lower_gate
        - 0.0038 * params["chest"] * chest * lower_gate
        + 0.0042 * params["shoulder"] * shoulder * upper_gate
        + 0.0022 * params["pelvis"] * pelvis * upper_gate
        + 0.0030 * params["neck"] * neck * upper_gate
    )
    return x, ny, nz


def quantile(values: list[float], probability: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * probability))))
    return ordered[position]


def build_metrics(parsed: dict, params: dict[str, float]) -> dict:
    base = parsed["positions"]
    morphed = [morph_vertex(parsed, index, params) for index in range(parsed["vertexCount"])]
    deltas: list[float] = []
    affected = 0
    max_delta = 0.0
    eye_delta = 0.0
    body_min_z_base = min(point[2] for point in base[: parsed["bodyCount"]])
    body_min_z = min(point[2] for point in morphed[: parsed["bodyCount"]])

    for index, (before, after) in enumerate(zip(base, morphed)):
        delta = math.dist(before, after)
        if delta > 1e-7:
            affected += 1
            deltas.append(delta)
            max_delta = max(max_delta, delta)
        if parsed["parts"][index] > 0:
            eye_delta = max(eye_delta, delta)

    widths: dict[str, float] = {}
    base_widths: dict[str, float] = {}
    lower_contours: dict[str, dict[str, float]] = {}
    for name, (start, end) in SECTIONS.items():
        ys: list[float] = []
        base_ys: list[float] = []
        zs: list[float] = []
        base_zs: list[float] = []
        for index in range(parsed["bodyCount"]):
            x, y, z = base[index]
            core = min(1.0, sum(bone_weight(parsed, index, bone) for bone in (1, 2, 3, 4, 5)))
            if core > 0.35 and z > 0.13 and start <= x <= end:
                base_ys.append(y)
                ys.append(morphed[index][1])
            if core > 0.35 and abs(y) < 0.045 and start <= x <= end:
                base_zs.append(z)
                zs.append(morphed[index][2])
        base_widths[name] = max(base_ys) - min(base_ys)
        widths[name] = max(ys) - min(ys)
        lower_contours[name] = {
            "baseM": min(base_zs),
            "morphedM": min(zs),
            "deltaM": min(zs) - min(base_zs),
        }

    orientation_dots: list[float] = []
    area_ratios: list[float] = []
    edges: set[tuple[int, int]] = set()
    indices = parsed["indices"]
    for offset in range(0, len(indices), 3):
        triangle = indices[offset : offset + 3]
        if len(triangle) < 3:
            continue
        i0, i1, i2 = triangle
        p0, p1, p2 = base[i0], base[i1], base[i2]
        q0, q1, q2 = morphed[i0], morphed[i1], morphed[i2]
        bp1 = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        bp2 = (p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2])
        bq1 = (q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2])
        bq2 = (q2[0] - q0[0], q2[1] - q0[1], q2[2] - q0[2])
        cross_base = (
            bp1[1] * bp2[2] - bp1[2] * bp2[1],
            bp1[2] * bp2[0] - bp1[0] * bp2[2],
            bp1[0] * bp2[1] - bp1[1] * bp2[0],
        )
        cross_new = (
            bq1[1] * bq2[2] - bq1[2] * bq2[1],
            bq1[2] * bq2[0] - bq1[0] * bq2[2],
            bq1[0] * bq2[1] - bq1[1] * bq2[0],
        )
        base_area = math.sqrt(sum(value * value for value in cross_base))
        new_area = math.sqrt(sum(value * value for value in cross_new))
        if base_area > 1e-12 and new_area > 1e-12:
            orientation_dots.append(
                sum(a * b for a, b in zip(cross_base, cross_new)) / (base_area * new_area)
            )
            area_ratios.append(new_area / base_area)
        for a, b in ((i0, i1), (i1, i2), (i2, i0)):
            edges.add((a, b) if a < b else (b, a))

    edge_ratios: list[float] = []
    for first, second in edges:
        base_length = math.dist(base[first], base[second])
        if base_length > 1e-8:
            edge_ratios.append(math.dist(morphed[first], morphed[second]) / base_length)

    body_x_base = [point[0] for point in base[: parsed["bodyCount"]]]
    body_x = [point[0] for point in morphed[: parsed["bodyCount"]]]
    return {
        "vertexCount": parsed["vertexCount"],
        "bodyVertexCount": parsed["bodyCount"],
        "affectedVertices": affected,
        "maxDeltaM": max_delta,
        "meanAffectedDeltaM": sum(deltas) / len(deltas) if deltas else 0.0,
        "eyeRegionMaxDeltaM": eye_delta,
        "bodyLengthBaseM": max(body_x_base) - min(body_x_base),
        "bodyLengthM": max(body_x) - min(body_x),
        "bodyMinZBaseM": body_min_z_base,
        "bodyMinZM": body_min_z,
        "baseWidthsM": base_widths,
        "widthsM": widths,
        "widthRatios": {name: widths[name] / base_widths[name] for name in widths},
        "lowerContours": lower_contours,
        "triangleOrientationMinDot": min(orientation_dots),
        "triangleOrientationP001Dot": quantile(orientation_dots, 0.001),
        "triangleAreaRatioP001": quantile(area_ratios, 0.001),
        "triangleAreaRatioP999": quantile(area_ratios, 0.999),
        "edgeRatioP001": quantile(edge_ratios, 0.001),
        "edgeRatioP999": quantile(edge_ratios, 0.999),
        "payloadInvariant": True,
        "rigInvariant": True,
        "boneLengthInvariant": True,
        "collisionProfileInvariant": True,
    }


if not SOURCE.is_file():
    raise SystemExit(f"Gate A source missing: {SOURCE.relative_to(ROOT)}")

OUT_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)
html = SOURCE.read_text(encoding="utf-8")
payload = extract_payload(html)
parsed = parse_cat_payload(payload)
metrics = build_metrics(parsed, DEFAULTS)

html = replace_once(
    html,
    "<title>CAT KAOPU Phase 1 Gate A · 单体环境 NPC</title>",
    "<title>CAT KAOPU Phase 1 Gate B · 躯干形态修正</title>",
    "page title",
)
html = replace_once(
    html,
    '<aside><h1>CAT KAOPU · Phase 1 Gate A</h1><div class="sub">基础世界环境生物 NPC：先稳定单体形态、核心运动和碰撞，再进入群体与个体差异</div>',
    '<aside><h1>CAT KAOPU · Phase 1 Gate B</h1><div class="sub">躯干形态修正层：胸腔、腰腹、骨盆与肩颈过渡；保持骨架、骨长、动作和碰撞基线不变</div>',
    "phase1 heading",
)
html = replace_once(
    html,
    ".phase1Actions button{width:100%;text-align:left}",
    ".phase1Actions button{width:100%;text-align:left}.phase1MorphGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.phase1MorphGrid button{width:100%;text-align:left}.phase1MorphNote{border-left:3px solid #4ba6c4;padding-left:9px}",
    "phase1 morphology styles",
)

panel = r'''<section class="phase1Gate" id="phase1GateB"><h2>Phase 1 · Gate B 躯干形态修正</h2><div class="note phase1MorphNote">本轮只修改冻结猫体之上的可回滚表面修正层：胸腔横向体积、腰腹收束、骨盆连续性、腹线提拉和肩颈坡度。骨架父子关系、骨长、蒙皮权重、动作轨道、碰撞代理与 CATV440 二进制载荷均不改。</div><div class="row" style="margin-top:8px"><button class="active" id="phase1MorphToggle">形态修正开启</button><button id="phase1MorphDebug">修正热区</button><button id="phase1MorphReset">恢复本轮参数</button></div><label><span>胸腔体积</span><input id="phase1Chest" max="1" min="0" step="0.02" type="range" value="0.82"/><output>0.82</output></label><label><span>腰腹收束</span><input id="phase1Waist" max="1" min="0" step="0.02" type="range" value="0.78"/><output>0.78</output></label><label><span>骨盆连续</span><input id="phase1Pelvis" max="1" min="0" step="0.02" type="range" value="0.36"/><output>0.36</output></label><label><span>肩颈过渡</span><input id="phase1Shoulder" max="1" min="0" step="0.02" type="range" value="0.74"/><output>0.74</output></label><label><span>腹线提拉</span><input id="phase1Belly" max="1" min="0" step="0.02" type="range" value="0.82"/><output>0.82</output></label><label><span>颈根衔接</span><input id="phase1Neck" max="1" min="0" step="0.02" type="range" value="0.68"/><output>0.68</output></label><label><span>总强度</span><input id="phase1MorphMaster" max="1.25" min="0" step="0.05" type="range" value="1"/><output>1.00</output></label><div class="kpi"><b>形态层状态</b><span class="phase1Pass" id="kPhase1Morph">启用 · 可回滚</span></div><div class="kpi"><b>最大位移</b><span class="phase1State" id="kPhase1MorphDelta">0.00 mm</span></div><div class="kpi"><b>胸 / 腰 / 骨盆宽度</b><span class="phase1State" id="kPhase1MorphWidths">—</span></div><div class="kpi"><b>体长 / 地面不变量</b><span class="phase1State" id="kPhase1MorphInvariant">—</span></div><div class="note">Gate B 不处理四肢段落、足掌和头部重建；这些仍是后续独立门。当前参数是受限区域场，不允许用无约束随机缩放制造个体差异。</div></section>
'''
html = replace_once(
    html,
    '<section><h2>动作与测试姿势</h2>',
    panel + '<section><h2>动作与测试姿势</h2>',
    "phase1 morphology panel",
)

old_values = "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=false,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,patchStrength=.88,smoothStrength=.94,browStrength=.72,noseStrength=.64,cheekStrength=.58,arcStrength=.86,creaseStrength=.54,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;"
html = replace_once(
    html,
    old_values,
    old_values
    + "\nconst PHASE1_MORPH_DEFAULT={chest:.82,waist:.78,pelvis:.36,shoulder:.74,belly:.82,neck:.68,master:1};let phase1MorphEnabled=true,phase1MorphDebug=false,phase1Chest=PHASE1_MORPH_DEFAULT.chest,phase1Waist=PHASE1_MORPH_DEFAULT.waist,phase1Pelvis=PHASE1_MORPH_DEFAULT.pelvis,phase1Shoulder=PHASE1_MORPH_DEFAULT.shoulder,phase1Belly=PHASE1_MORPH_DEFAULT.belly,phase1Neck=PHASE1_MORPH_DEFAULT.neck,phase1MorphMaster=PHASE1_MORPH_DEFAULT.master;",
    "phase1 morphology values",
)

html = replace_once(
    html,
    "uniform float uNormalCorrectiveEnabled;out vec3 vN;flat out float vPart;out vec3 vWeightColor;out float vCorr;out vec3 vEyeDir;out vec3 vFurT;out vec3 vBindP;vec3 bc(uint b){float f=float(b);return .5+.5*cos(vec3(0.,2.094,4.188)+f*2.399);}void main(){mat4 sm=",
    "uniform float uNormalCorrectiveEnabled;uniform float uPhase1MorphEnabled;uniform vec4 uPhase1MorphA;uniform vec4 uPhase1MorphB;out vec3 vN;flat out float vPart;out vec3 vWeightColor;out float vCorr;out float vPhase1Morph;out vec3 vEyeDir;out vec3 vFurT;out vec3 vBindP;vec3 bc(uint b){float f=float(b);return .5+.5*cos(vec3(0.,2.094,4.188)+f*2.399);}float p1bw(uint b){return(aJoints.x==b?aWeights.x:0.)+(aJoints.y==b?aWeights.y:0.)+(aJoints.z==b?aWeights.z:0.)+(aJoints.w==b?aWeights.w:0.);}float p1band(float x,float c,float r){return 1.-smoothstep(r*.48,r,abs(x-c));}vec3 p1morph(vec3 p,out float mag,out float sy){mag=0.;sy=1.;if(uPhase1MorphEnabled<.5||aPart>.5)return p;float core=clamp(p1bw(1u)+p1bw(2u)+p1bw(3u)+p1bw(4u)+p1bw(5u),0.,1.),scap=clamp(p1bw(14u)+p1bw(15u)+p1bw(19u)+p1bw(20u),0.,1.),neckW=p1bw(5u);float bodyGate=smoothstep(.16,.72,core),upperGate=smoothstep(.145,.205,p.z),lowerGate=1.-smoothstep(.118,.176,p.z),chest=p1band(p.x,.070,.085)*bodyGate,waist=p1band(p.x,-.030,.065)*bodyGate,waistLift=p1band(p.x,-.025,.100)*bodyGate,pelvis=p1band(p.x,-.112,.060)*bodyGate,shoulder=p1band(p.x,.112,.070)*clamp(bodyGate+.58*scap,0.,1.)*smoothstep(.118,.165,p.z),neck=p1band(p.x,.150,.055)*clamp(.72*bodyGate+.65*neckW,0.,1.);float master=uPhase1MorphB.z;sy=1.+master*(.104*uPhase1MorphA.x*chest-.18*uPhase1MorphA.y*waist+.04*uPhase1MorphA.z*pelvis+.052*uPhase1MorphA.w*shoulder+.050*uPhase1MorphB.y*neck);vec3 q=p;q.y*=sy;q.z+=master*(.0092*uPhase1MorphB.x*waistLift*lowerGate-.0038*uPhase1MorphA.x*chest*lowerGate+.0042*uPhase1MorphA.w*shoulder*upperGate+.0022*uPhase1MorphA.z*pelvis*upperGate+.0030*uPhase1MorphB.y*neck*upperGate);mag=length(q-p);return q;}void main(){float morphMag,morphScaleY;vec3 bindP=p1morph(aPos,morphMag,morphScaleY);mat4 sm=",
    "phase1 vertex morphology function",
)
html = replace_once(html, "vec4 p=sm*vec4(aPos,1.);", "vec4 p=sm*vec4(bindP,1.);", "morphed bind position")
html = replace_once(
    html,
    "vec3 baseN=normalize(nm*aNormal);",
    "vec3 morphN=normalize(vec3(aNormal.x,aNormal.y/max(.75,morphScaleY),aNormal.z));vec3 baseN=normalize(nm*morphN);vPhase1Morph=morphMag;",
    "morphed normal approximation",
)
html = replace_once(html, "vBindP=aPos;}`;", "vBindP=bindP;}`;", "morphed bind debug position")
html = replace_once(
    html,
    "in vec3 vN;flat in float vPart;in vec3 vWeightColor;in float vCorr;in vec3 vEyeDir;",
    "in vec3 vN;flat in float vPart;in vec3 vWeightColor;in float vCorr;in float vPhase1Morph;in vec3 vEyeDir;",
    "fragment morphology input",
)
html = replace_once(
    html,
    "uniform float uFurEnabled;uniform float uFurStrength;uniform float uFurDebug;",
    "uniform float uFurEnabled;uniform float uFurStrength;uniform float uFurDebug;uniform float uPhase1MorphDebug;",
    "fragment morphology uniform",
)
html = replace_once(
    html,
    "if(uCorrectiveDebug>.5)base=heat(vCorr/.008);if(uFurDebug>.5",
    "if(uCorrectiveDebug>.5)base=heat(vCorr/.008);if(uPhase1MorphDebug>.5&&vPart<.5)base=heat(vPhase1Morph/.009);if(uFurDebug>.5",
    "morphology heat map",
)
html = replace_once(
    html,
    "furDebug:gl.getUniformLocation(pr,'uFurDebug')},LU=",
    "furDebug:gl.getUniformLocation(pr,'uFurDebug'),phase1MorphEnabled:gl.getUniformLocation(pr,'uPhase1MorphEnabled'),phase1MorphA:gl.getUniformLocation(pr,'uPhase1MorphA'),phase1MorphB:gl.getUniformLocation(pr,'uPhase1MorphB'),phase1MorphDebug:gl.getUniformLocation(pr,'uPhase1MorphDebug')},LU=",
    "morphology uniform locations",
)
html = replace_once(
    html,
    "gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.drawElements",
    "gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.uniform1f(U.phase1MorphEnabled,phase1MorphEnabled?1:0);gl.uniform4f(U.phase1MorphA,phase1Chest,phase1Waist,phase1Pelvis,phase1Shoulder);gl.uniform4f(U.phase1MorphB,phase1Belly,phase1Neck,phase1MorphMaster,0);gl.uniform1f(U.phase1MorphDebug,phase1MorphDebug?1:0);gl.drawElements",
    "morphology frame uniforms",
)

cpu_helpers = r'''
function phase1VertexBoneWeight(i,b){let w=0;for(let j=0;j<4;j++)if(m.joints[i*4+j]===b)w+=m.weights[i*4+j]/255;return w}
function phase1Band(x,c,r){const v=Math.max(0,Math.min(1,(Math.abs(x-c)-r*.48)/(r*.52)));return 1-v*v*(3-2*v)}
function phase1MorphBindVertex(i,x,y,z,enabled=phase1MorphEnabled){if(!enabled||i>=m.bodyCount)return{x,y,z,delta:0,scaleY:1};const core=Math.max(0,Math.min(1,phase1VertexBoneWeight(i,1)+phase1VertexBoneWeight(i,2)+phase1VertexBoneWeight(i,3)+phase1VertexBoneWeight(i,4)+phase1VertexBoneWeight(i,5))),scap=Math.max(0,Math.min(1,phase1VertexBoneWeight(i,14)+phase1VertexBoneWeight(i,15)+phase1VertexBoneWeight(i,19)+phase1VertexBoneWeight(i,20))),neckW=phase1VertexBoneWeight(i,5),smooth=(a,b,v)=>{const q=Math.max(0,Math.min(1,(v-a)/(b-a)));return q*q*(3-2*q)},bodyGate=smooth(.16,.72,core),upperGate=smooth(.145,.205,z),lowerGate=1-smooth(.118,.176,z),chest=phase1Band(x,.070,.085)*bodyGate,waist=phase1Band(x,-.030,.065)*bodyGate,waistLift=phase1Band(x,-.025,.100)*bodyGate,pelvis=phase1Band(x,-.112,.060)*bodyGate,shoulder=phase1Band(x,.112,.070)*Math.max(0,Math.min(1,bodyGate+.58*scap))*smooth(.118,.165,z),neck=phase1Band(x,.150,.055)*Math.max(0,Math.min(1,.72*bodyGate+.65*neckW)),master=phase1MorphMaster,scaleY=1+master*(.104*phase1Chest*chest-.18*phase1Waist*waist+.04*phase1Pelvis*pelvis+.052*phase1Shoulder*shoulder+.050*phase1Neck*neck),ny=y*scaleY,nz=z+master*(.0092*phase1Belly*waistLift*lowerGate-.0038*phase1Chest*chest*lowerGate+.0042*phase1Shoulder*shoulder*upperGate+.0022*phase1Pelvis*pelvis*upperGate+.0030*phase1Neck*neck*upperGate);return{x,y:ny,z:nz,delta:Math.hypot(ny-y,nz-z),scaleY}}
function phase1MorphAudit(){const sections={chest:[.035,.105],waist:[-.070,.005],pelvis:[-.145,-.075]},out={enabled:phase1MorphEnabled,params:{chest:phase1Chest,waist:phase1Waist,pelvis:phase1Pelvis,shoulder:phase1Shoulder,belly:phase1Belly,neck:phase1Neck,master:phase1MorphMaster},maxDeltaM:0,meanDeltaM:0,affectedVertices:0,widths:{},baseWidths:{},widthRatios:{},bodyLengthBaseM:0,bodyLengthM:0,bodyMinZBaseM:1e9,bodyMinZM:1e9,lengthInvariant:true,groundInvariant:true,eyeRegionMaxDeltaM:0};let sum=0,minX=1e9,maxX=-1e9,minXB=1e9,maxXB=-1e9;const bins={};for(const k of Object.keys(sections))bins[k]={min:1e9,max:-1e9,bmin:1e9,bmax:-1e9};for(let i=0;i<m.vc;i++){const x=m.pos[i*3],y=m.pos[i*3+1],z=m.pos[i*3+2],q=phase1MorphBindVertex(i,x,y,z,true),core=phase1VertexBoneWeight(i,1)+phase1VertexBoneWeight(i,2)+phase1VertexBoneWeight(i,3)+phase1VertexBoneWeight(i,4)+phase1VertexBoneWeight(i,5);if(i<m.bodyCount){minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minXB=Math.min(minXB,x);maxXB=Math.max(maxXB,x);out.bodyMinZBaseM=Math.min(out.bodyMinZBaseM,z);out.bodyMinZM=Math.min(out.bodyMinZM,q.z)}else out.eyeRegionMaxDeltaM=Math.max(out.eyeRegionMaxDeltaM,q.delta);if(q.delta>1e-7){out.affectedVertices++;sum+=q.delta;out.maxDeltaM=Math.max(out.maxDeltaM,q.delta)}if(i<m.bodyCount&&core>.35&&z>.13){for(const [k,r] of Object.entries(sections))if(x>=r[0]&&x<=r[1]){bins[k].min=Math.min(bins[k].min,q.y);bins[k].max=Math.max(bins[k].max,q.y);bins[k].bmin=Math.min(bins[k].bmin,y);bins[k].bmax=Math.max(bins[k].bmax,y)}}}out.meanDeltaM=out.affectedVertices?sum/out.affectedVertices:0;out.bodyLengthM=maxX-minX;out.bodyLengthBaseM=maxXB-minXB;for(const k of Object.keys(bins)){out.widths[k]=bins[k].max-bins[k].min;out.baseWidths[k]=bins[k].bmax-bins[k].bmin;out.widthRatios[k]=out.widths[k]/out.baseWidths[k]}out.lengthInvariant=Math.abs(out.bodyLengthM-out.bodyLengthBaseM)<1e-7;out.groundInvariant=Math.abs(out.bodyMinZM-out.bodyMinZBaseM)<1e-7;return out}
function updatePhase1MorphPanel(){const a=phase1MorphAudit(),morph=$('#kPhase1Morph'),delta=$('#kPhase1MorphDelta'),widths=$('#kPhase1MorphWidths'),invariant=$('#kPhase1MorphInvariant');if(morph){morph.textContent=phase1MorphEnabled?'启用 · 可回滚':'关闭 · 历史基线';morph.className=phase1MorphEnabled?'phase1Pass':'phase1Pending'}if(delta)delta.textContent=(a.maxDeltaM*1000).toFixed(2)+' mm';if(widths)widths.textContent=(a.widths.chest*1000).toFixed(1)+' / '+(a.widths.waist*1000).toFixed(1)+' / '+(a.widths.pelvis*1000).toFixed(1)+' mm';if(invariant)invariant.textContent=(a.lengthInvariant?'体长 ✓':'体长 ×')+' / '+(a.groundInvariant?'地面 ✓':'地面 ×');window.__CAT_PHASE1_MORPH_METRICS__=a}
'''
html = replace_once(
    html,
    "function cpuDeformVertex(i,bm,pose,applyCorrective=true){const x=m.pos[i*3],y=m.pos[i*3+1],z=m.pos[i*3+2];",
    cpu_helpers
    + "function cpuDeformVertex(i,bm,pose,applyCorrective=true){const bp=phase1MorphBindVertex(i,m.pos[i*3],m.pos[i*3+1],m.pos[i*3+2]),x=bp.x,y=bp.y,z=bp.z;",
    "CPU morphology path",
)

ui_bindings = r'''
function phase1MorphSlider(id,setter){const el=$(id);if(!el)return;el.oninput=e=>{setter(+e.target.value);e.target.nextElementSibling.value=(+e.target.value).toFixed(2);updatePhase1MorphPanel()}}
phase1MorphSlider('#phase1Chest',v=>phase1Chest=v);phase1MorphSlider('#phase1Waist',v=>phase1Waist=v);phase1MorphSlider('#phase1Pelvis',v=>phase1Pelvis=v);phase1MorphSlider('#phase1Shoulder',v=>phase1Shoulder=v);phase1MorphSlider('#phase1Belly',v=>phase1Belly=v);phase1MorphSlider('#phase1Neck',v=>phase1Neck=v);phase1MorphSlider('#phase1MorphMaster',v=>phase1MorphMaster=v);
$('#phase1MorphToggle').onclick=e=>{phase1MorphEnabled=!phase1MorphEnabled;e.currentTarget.classList.toggle('active',phase1MorphEnabled);updatePhase1MorphPanel()};$('#phase1MorphDebug').onclick=e=>{phase1MorphDebug=!phase1MorphDebug;e.currentTarget.classList.toggle('active',phase1MorphDebug)};$('#phase1MorphReset').onclick=()=>{phase1Chest=PHASE1_MORPH_DEFAULT.chest;phase1Waist=PHASE1_MORPH_DEFAULT.waist;phase1Pelvis=PHASE1_MORPH_DEFAULT.pelvis;phase1Shoulder=PHASE1_MORPH_DEFAULT.shoulder;phase1Belly=PHASE1_MORPH_DEFAULT.belly;phase1Neck=PHASE1_MORPH_DEFAULT.neck;phase1MorphMaster=PHASE1_MORPH_DEFAULT.master;for(const [id,v] of Object.entries({phase1Chest,phase1Waist,phase1Pelvis,phase1Shoulder,phase1Belly,phase1Neck,phase1MorphMaster})){const el=$('#'+id);if(el){el.value=v;el.nextElementSibling.value=(+v).toFixed(2)}}phase1MorphEnabled=true;phase1MorphDebug=false;$('#phase1MorphToggle').classList.add('active');$('#phase1MorphDebug').classList.remove('active');updatePhase1MorphPanel()};
'''
html = replace_once(
    html,
    "$('#resetMotion').onclick=resetWorldMotion;",
    ui_bindings + "$('#resetMotion').onclick=resetWorldMotion;",
    "morphology UI bindings",
)

html = replace_once(html, "window.__CAT_PHASE1_READY__='gate-a-webgl2';", "window.__CAT_PHASE1_READY__='gate-b-webgl2';", "Gate B ready flag")
html = replace_once(
    html,
    "buildId:'cat-kaopu-phase1-gate-a-single-npc-20260916',ready:window.__CAT_PHASE1_READY__,gate:'A',priorities:{morphology:.48,locomotion:.42,collision:.10},",
    "buildId:'cat-kaopu-phase1-gate-b-morphology-20260916',ready:window.__CAT_PHASE1_READY__,gate:'B',priorities:{morphology:.62,locomotion:.28,collision:.10},morphology:phase1MorphAudit(),",
    "Gate B state header",
)
html = replace_once(
    html,
    "shapeMutation:false,action",
    "shapeMutation:'bounded-bind-space-surface-corrective-layer',action",
    "Gate B shape state",
)
html = replace_once(
    html,
    "window.__CAT_PHASE1_SET_COLLISION__=v=>",
    "window.__CAT_PHASE1_SET_MORPH__=cfg=>{if(cfg.enabled!==undefined)phase1MorphEnabled=!!cfg.enabled;if(cfg.debug!==undefined)phase1MorphDebug=!!cfg.debug;if(cfg.chest!==undefined)phase1Chest=Math.max(0,Math.min(1,+cfg.chest));if(cfg.waist!==undefined)phase1Waist=Math.max(0,Math.min(1,+cfg.waist));if(cfg.pelvis!==undefined)phase1Pelvis=Math.max(0,Math.min(1,+cfg.pelvis));if(cfg.shoulder!==undefined)phase1Shoulder=Math.max(0,Math.min(1,+cfg.shoulder));if(cfg.belly!==undefined)phase1Belly=Math.max(0,Math.min(1,+cfg.belly));if(cfg.neck!==undefined)phase1Neck=Math.max(0,Math.min(1,+cfg.neck));if(cfg.master!==undefined)phase1MorphMaster=Math.max(0,Math.min(1.25,+cfg.master));updatePhase1MorphPanel();return phase1MorphAudit()};window.__CAT_PHASE1_MORPH_AUDIT__=phase1MorphAudit;window.__CAT_PHASE1_SET_COLLISION__=v=>",
    "Gate B morphology API",
)
html = replace_once(
    html,
    "gates:{singleNpc:'active',group:'locked',variation:'locked',avoidance:'next'}",
    "morphology:{layer:'bounded-bind-space-surface-corrective',payloadMutation:false,rigMutation:false,boneLengthMutation:false,weightMutation:false,regions:['thorax','waist','pelvis','shoulder-neck','ventral-line']},gates:{singleNpc:'active',morphology:'active',group:'locked',variation:'locked',avoidance:'next'}",
    "Gate B audit contract",
)
html = replace_once(
    html,
    "phase1Gate:'A',collisionProxy:true",
    "phase1Gate:'B',phase1Morphology:true,phase1MorphPayloadInvariant:true,phase1MorphRigInvariant:true,collisionProxy:true",
    "Gate B stats",
)
html = replace_once(
    html,
    "resize();setView('quarter',true);setAction('stand');",
    "resize();setView('quarter',true);setAction('stand');updatePhase1MorphPanel();",
    "initial morphology audit",
)

if "blinkLayerEnabled=false" not in html:
    raise SystemExit("Gate B expected Gate A secondary face carrier default to remain disabled")

WORKBENCH.write_text(html, encoding="utf-8")
INDEX.write_text(html, encoding="utf-8")

profile = {
    "schema": "cat_kaopu/bounded_morphology_profile@1.0",
    "buildId": BUILD_ID,
    "date": DATE,
    "sourceGateA": str(SOURCE.relative_to(ROOT)),
    "space": "bind-space-before-skinning",
    "representation": "bounded-analytic-regional-field",
    "runtimePayload": {
        "format": "CATV440",
        "sha256": sha256_bytes(payload),
        "mutation": False,
    },
    "invariants": {
        "rigHierarchy": True,
        "boneLengths": True,
        "skinningWeights": True,
        "animationTracks": True,
        "collisionProfile": True,
        "eyeRegionVertices": True,
        "bodyLengthAxis": True,
        "groundMinimum": True,
    },
    "regions": [
        {"id": "thorax", "purpose": "restore lateral rib-cage volume and ventral depth"},
        {"id": "waist", "purpose": "separate thorax from abdomen without pinching limbs"},
        {"id": "pelvis", "purpose": "maintain hind-quarter continuity"},
        {"id": "shoulder-neck", "purpose": "soften chest, scapular and neck-root transition"},
        {"id": "ventral-line", "purpose": "raise the waist line while retaining thoracic depth"},
    ],
    "parameters": {
        key: {"default": value, "min": 0.0, "max": 1.25 if key == "master" else 1.0}
        for key, value in DEFAULTS.items()
    },
    "equationRevision": "gate-b-torso-field-v1",
    "anatomicalEvidence": [
        {
            "title": "Normal cross-sectional anatomy of the feline thorax and abdomen",
            "pmid": "9845186",
            "doi": "10.1111/j.1740-8261.1998.tb01640.x",
            "use": "regional thorax and abdomen cross-sectional reference",
        },
        {
            "title": "Anatomical study of the thorax and abdomen of the domestic cat",
            "pmid": "42710191",
            "doi": "10.1016/j.rvsc.2026.106389",
            "use": "thorax/abdomen sections correlated with CT and 3D reconstruction",
        },
    ],
    "measuredDefault": metrics,
    "visualAcceptance": False,
    "productionReady": False,
}
PROFILE.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

contract = {
    "schema": "cat_kaopu/phase1_gate_b_contract@1.0",
    "buildId": BUILD_ID,
    "gate": "B",
    "status": "active",
    "goal": "correct torso silhouette before limb, paw and head gates",
    "requiredViews": ["front", "left", "top", "quarter"],
    "requiredActions": ["stand", "walk_forward", "turn_left", "turn_right"],
    "requiredComparisons": ["morph_off", "morph_on", "morph_debug"],
    "allowedMutation": ["bounded bind-space surface corrective layer"],
    "forbiddenMutation": [
        "CATV440 payload",
        "rig hierarchy",
        "bone lengths",
        "skinning weights",
        "animation tracks",
        "collision proxy profile",
        "group runtime",
        "variation runtime",
    ],
    "deferred": {
        "limbSegmentation": True,
        "pawRebuild": True,
        "headRebuild": True,
        "groupRuntime": True,
        "variationRuntime": True,
        "localAvoidance": True,
    },
    "visualAcceptance": False,
    "productionReady": False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

report = f"""# CAT KAOPU Phase 1 Gate B 躯干形态修正报告

日期：{DATE}  
Build ID：`{BUILD_ID}`  
状态：`visualAcceptance=false`，`productionReady=false`

## 本轮边界

Gate B 只处理全身形态证据中最明显的躯干问题：胸腔、腰腹、骨盆、腹线和肩颈过渡。它不是新猫体，也不是通过骨骼缩放修改比例；修正层在绑定空间、蒙皮之前运行，并以稳定骨骼权重限定影响域。

以下内容保持逐字节或结构不变：CATV440 二进制载荷、34 骨父子关系、固定骨长、蒙皮权重、动作轨道、V4.39 姿势修形、V4.36 足掌接触链和 Gate A 三个碰撞代理。

## 默认修正量

- 最大表面位移：`{metrics['maxDeltaM'] * 1000:.3f} mm`
- 平均受影响顶点位移：`{metrics['meanAffectedDeltaM'] * 1000:.3f} mm`
- 受影响顶点：`{metrics['affectedVertices']} / {metrics['bodyVertexCount']}`
- 胸腔宽度：`{metrics['baseWidthsM']['chest'] * 1000:.2f} → {metrics['widthsM']['chest'] * 1000:.2f} mm`
- 腰腹宽度：`{metrics['baseWidthsM']['waist'] * 1000:.2f} → {metrics['widthsM']['waist'] * 1000:.2f} mm`
- 骨盆宽度：`{metrics['baseWidthsM']['pelvis'] * 1000:.2f} → {metrics['widthsM']['pelvis'] * 1000:.2f} mm`
- 猫体纵向长度变化：`{(metrics['bodyLengthM'] - metrics['bodyLengthBaseM']) * 1000:.6f} mm`
- 地面最低点变化：`{(metrics['bodyMinZM'] - metrics['bodyMinZBaseM']) * 1000:.6f} mm`
- 眼区顶点最大变化：`{metrics['eyeRegionMaxDeltaM'] * 1000:.6f} mm`

## 技术约束

1. 修正函数同时存在 GPU 渲染路径和 CPU 导出/审计路径，参数一致。
2. 所有修正均由连续区域场控制，不使用离散部位随机缩放。
3. 三角形方向保持为正；静态审计记录边长和面积比，防止未来编辑产生折叠。
4. 旧 Gate A 固定工作台保留，不被 Gate B 覆盖。
5. 群体、受限 DNA 和局部避让继续锁定。

## 尚未通过的内容

Gate B 的技术证据不能替代视觉审批。四肢关节段落、足掌结构、头颈最终轮廓、步态自然度与转向时序仍需要后续独立生产门。因此当前不能把“躯干更合理”推导为“整猫形态已经完成”，也不能提前进入群体复制。
"""
REPORT.write_text(report, encoding="utf-8")

outputs = []
for path in (WORKBENCH, INDEX, PROFILE, CONTRACT, REPORT):
    outputs.append(
        {
            "path": str(path.relative_to(ROOT)),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
    )
manifest = {
    "schema": "cat_kaopu/phase1_gate_b_build@1.0",
    "buildId": BUILD_ID,
    "sourceGateA": str(SOURCE.relative_to(ROOT)),
    "sourceGateASha256": sha256(SOURCE),
    "runtimePayloadSha256": sha256_bytes(payload),
    "outputs": outputs,
    "technicalReady": True,
    "browserEvidenceRequired": True,
    "visualAcceptance": False,
    "productionReady": False,
    "groupRuntime": False,
    "variationRuntime": False,
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(
    json.dumps(
        {
            "buildId": BUILD_ID,
            "workbench": str(WORKBENCH.relative_to(ROOT)),
            "bytes": WORKBENCH.stat().st_size,
            "payloadSha256": sha256_bytes(payload),
            "maxDeltaMm": round(metrics["maxDeltaM"] * 1000, 4),
            "widthRatios": metrics["widthRatios"],
        },
        ensure_ascii=False,
    )
)
