from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import re
import shutil
import struct
from pathlib import Path
from typing import Any

import numpy as np

MODULE_ROOT = Path(__file__).resolve().parent.parent
SRC = Path(os.environ.get('CAT_KAOPU_V439_HTML', str(MODULE_ROOT / 'baselines/v4.39/CAT_KAOPU_V439_REGIONAL_NORMAL_WORKBENCH_2026-09-15.html')))
OUT_DIR = Path(os.environ.get('CAT_KAOPU_V440_OUT', str(MODULE_ROOT / 'build/v4.40')))
OUT_HTML = OUT_DIR / 'CAT_KAOPU_V440_EYE_EAR_SHORT_FUR_WORKBENCH_2026-09-15.html'
DATA_DIR = OUT_DIR / 'files/data/cat_v440'
TOOLS_DIR = OUT_DIR / 'files/tools/cat_v440'
QA_DIR = OUT_DIR / 'qa'


def smoothstep(a: float, b: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def extract_json_constant(text: str, name: str, next_name: str) -> tuple[dict[str, Any], tuple[int, int]]:
    start_token = f'const {name}='
    end_token = f';\nconst {next_name}='
    i = text.index(start_token) + len(start_token)
    j = text.index(end_token, i)
    return json.loads(text[i:j]), (i, j)


def replace_json_constant(text: str, name: str, next_name: str, value: dict[str, Any]) -> str:
    old, (i, j) = extract_json_constant(text, name, next_name)
    _ = old
    return text[:i] + json.dumps(value, ensure_ascii=False, separators=(',', ':')) + text[j:]


def parse_payload(text: str) -> tuple[bytearray, str]:
    m = re.search(r"const CAT_B64='([^']+)'", text)
    if not m:
        raise RuntimeError('CAT_B64 not found')
    return bytearray(base64.b64decode(m.group(1))), m.group(1)


def parse_header(data: bytes) -> dict[str, Any]:
    if data[:7] != b'CATV439':
        raise RuntimeError(f'unexpected magic: {data[:7]!r}')
    o = 8
    keys = ['version','vc','ic','bodyCount','boneCount','flags','posOff','normOff','indexOff','partOff','jointOff','weightOff']
    vals = struct.unpack_from('<12I', data, o)
    out = dict(zip(keys, vals))
    o += 48
    out['bmin'] = struct.unpack_from('<3f', data, o)
    o += 12
    out['bmax'] = struct.unpack_from('<3f', data, o)
    return out


def assign_ear_weights(data: bytearray, header: dict[str, Any]) -> dict[str, Any]:
    vc = int(header['vc'])
    body_count = int(header['bodyCount'])
    bmin = np.asarray(header['bmin'], dtype=np.float64)
    bmax = np.asarray(header['bmax'], dtype=np.float64)
    q = np.frombuffer(data, dtype='<u2', count=vc * 3, offset=int(header['posOff'])).reshape(vc, 3)
    pos = bmin + (q.astype(np.float64) / 65535.0) * (bmax - bmin)
    part = np.frombuffer(data, dtype=np.uint8, count=vc, offset=int(header['partOff'])).copy()
    old_joints = np.frombuffer(data, dtype=np.uint8, count=vc * 4, offset=int(header['jointOff'])).reshape(vc, 4).copy()
    old_weights = np.frombuffer(data, dtype=np.uint8, count=vc * 4, offset=int(header['weightOff'])).reshape(vc, 4).copy()
    new_joints = old_joints.copy()
    new_weights = old_weights.copy()

    ear_indices = {'L': [], 'R': []}
    ear_weights_float = {'L': [], 'R': []}
    for side, sign, bone_index in [('L', 1.0, 32), ('R', -1.0, 33)]:
        x = pos[:, 0]
        sy = pos[:, 1] * sign
        z = pos[:, 2]
        # Ear identity mask: high lateral pinna only. Smooth base falloff prevents a hard hinge.
        mask = (
            smoothstep(0.012, 0.028, sy)
            * smoothstep(0.205, 0.245, z)
            * (1.0 - smoothstep(0.235, 0.252, x))
            * smoothstep(0.170, 0.195, x)
            * (part == 0)
            * (np.arange(vc) < body_count)
        )
        candidates = np.where(mask > 0.035)[0]
        for vi in candidates:
            ew = int(round(float(mask[vi]) * 232.0))
            if ew < 8:
                continue
            remaining = 255 - ew
            pairs = [(int(old_weights[vi, k]), int(old_joints[vi, k])) for k in range(4) if old_weights[vi, k] > 0]
            pairs.sort(reverse=True)
            pairs = pairs[:3]
            s = sum(w for w, _ in pairs) or 1
            scaled = [int(round(remaining * w / s)) for w, _ in pairs]
            if scaled:
                scaled[-1] += remaining - sum(scaled)
            js = [bone_index] + [j for _, j in pairs] + [0, 0, 0]
            ws = [ew] + scaled + [0, 0, 0]
            new_joints[vi] = np.asarray(js[:4], dtype=np.uint8)
            new_weights[vi] = np.asarray(ws[:4], dtype=np.uint8)
            ear_indices[side].append(int(vi))
            ear_weights_float[side].append(float(mask[vi]))

    if not np.all(new_weights.sum(axis=1) == 255):
        bad = np.where(new_weights.sum(axis=1) != 255)[0]
        raise RuntimeError(f'weight sum failure at {bad[:10]}')
    if new_joints.max() > 33:
        raise RuntimeError('joint index overflow')

    data[int(header['jointOff']): int(header['jointOff']) + vc * 4] = new_joints.tobytes()
    data[int(header['weightOff']): int(header['weightOff']) + vc * 4] = new_weights.tobytes()
    data[:7] = b'CATV440'
    struct.pack_into('<I', data, 8, 8)   # payload version
    struct.pack_into('<I', data, 24, 34) # bone count

    stats = {
        'schema': 'cat_kaopu/ear_weight_audit@1.0',
        'version': 'V4.40',
        'sourcePayload': 'CATV439',
        'outputPayload': 'CATV440',
        'vertexCount': vc,
        'bodyVertexCount': body_count,
        'boneCountBefore': 32,
        'boneCountAfter': 34,
        'earBones': {
            'ear_L': 32,
            'ear_R': 33,
        },
        'earVertices': {},
        'weightSumExact255': True,
        'maxJointIndex': int(new_joints.max()),
    }
    for side in ('L','R'):
        ids = np.asarray(ear_indices[side], dtype=np.int64)
        stats['earVertices'][side] = {
            'count': int(ids.size),
            'minPosition': pos[ids].min(axis=0).tolist() if ids.size else None,
            'maxPosition': pos[ids].max(axis=0).tolist() if ids.size else None,
            'meanMask': float(np.mean(ear_weights_float[side])) if ids.size else 0.0,
            'maxMask': float(np.max(ear_weights_float[side])) if ids.size else 0.0,
            'minEarWeightByte': int(new_weights[ids, 0].min()) if ids.size else 0,
            'maxEarWeightByte': int(new_weights[ids, 0].max()) if ids.size else 0,
            'indices': ear_indices[side],
        }
    return stats


def build() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    DATA_DIR.mkdir(parents=True)
    TOOLS_DIR.mkdir(parents=True)
    QA_DIR.mkdir(parents=True)

    text = SRC.read_text(encoding='utf-8')
    payload, old_b64 = parse_payload(text)
    header = parse_header(payload)
    ear_stats = assign_ear_weights(payload, header)
    new_b64 = base64.b64encode(payload).decode('ascii')
    text = text.replace(f"const CAT_B64='{old_b64}'", f"const CAT_B64='{new_b64}'", 1)

    rig, _ = extract_json_constant(text, 'RIG', 'LIB')
    rig['bones'].extend([
        {'name':'ear_L','parent':6,'p':[0.205,0.027,0.216],'role':'expression'},
        {'name':'ear_R','parent':6,'p':[0.205,-0.027,0.216],'role':'expression'},
    ])
    rig['nameToIndex']['ear_L'] = 32
    rig['nameToIndex']['ear_R'] = 33
    text = replace_json_constant(text, 'RIG', 'LIB', rig)

    lib, _ = extract_json_constant(text, 'LIB', 'canvas')
    actions = lib['actions']
    insert_at = next((i for i, a in enumerate(actions) if a['id'] == 'auto_life'), len(actions))
    actions.insert(insert_at, {
        'id':'focus', 'label':'耳眼追踪测试', 'duration':4.8, 'loop':True,
        'status':'expression_layer_candidate'
    })
    lib['behavior']['version'] = 'V4.40'
    lib['behavior']['boundary'] = (
        'Deterministic preview only. V4.40 preserves V4.39 locomotion and posture correction, '
        'adds two expression ear bones, shader-only gaze/iris, and a first anisotropic short-fur direction field.'
    )
    text = replace_json_constant(text, 'LIB', 'canvas', lib)

    text = text.replace('<title>CAT KAOPU V4.39 · 区域姿势修形与法线连续性</title>',
                        '<title>CAT KAOPU V4.40 · 独立耳眼控制与短毛方向场</title>')
    text = text.replace('alt="V4.38 坐卧姿势残差与前序回归审查静态回退"',
                        'alt="V4.40 独立耳眼控制与短毛方向场静态回退"')

    # Toolbar: add appearance toggles before zoom controls.
    old_toolbar = '<button id="correctiveDebug">修正区</button><button id="zoomOut" title="缩小">−</button>'
    new_toolbar = ('<button id="correctiveDebug">修正区</button>'
                   '<button class="active" id="eyeLayer">眼球层</button>'
                   '<button class="active" id="earLayer">耳骨层</button>'
                   '<button class="active" id="furLayer">短毛方向</button>'
                   '<button id="furDebug">毛流检查</button>'
                   '<button id="zoomOut" title="缩小">−</button>')
    text = text.replace(old_toolbar, new_toolbar, 1)

    aside = '''<aside><h1>CAT KAOPU V4.40</h1><div class="sub">V4.32 冻结整猫表面 → V4.34 权重基线 → V4.39 坐卧修形 → V4.40 独立耳眼控制与短毛方向场</div><span class="tag good">代码化整猫</span><span class="tag good">GPU 蒙皮</span><span class="tag good">34 骨</span><span class="tag good">独立左右耳</span><span class="tag good">程序化视线</span><span class="tag good">程序化虹膜</span><span class="tag good">短毛方向场</span><span class="tag good">V4.38/V4.39 回归</span><span class="tag warnTag">生产候选</span>
<section><h2>动作与测试姿势</h2><div class="actions" id="actionButtons"></div><div class="row" style="margin-top:8px"><button id="pause">暂停</button><button id="restart">从头播放</button><button id="resetMotion">回到原点</button></div><label><span>速度</span><input id="speed" max="2" min="0.25" step="0.05" type="range" value="1"/><output>1.00×</output></label></section>
<section><h2>耳眼与短毛第一层</h2><div class="row"><button class="active" id="autoExpression">自动耳眼</button><button class="active" id="eyeToggle">眼球着色</button><button class="active" id="earToggle">耳骨蒙皮</button><button class="active" id="furToggle">短毛方向</button><button id="furDebugToggle">毛流检查</button></div><label><span>视线左右</span><input id="gazeYaw" max="24" min="-24" step="1" type="range" value="0"/><output>0°</output></label><label><span>视线上下</span><input id="gazePitch" max="14" min="-14" step="1" type="range" value="0"/><output>0°</output></label><label><span>左耳转向</span><input id="earLeft" max="18" min="-18" step="1" type="range" value="0"/><output>0°</output></label><label><span>右耳转向</span><input id="earRight" max="18" min="-18" step="1" type="range" value="0"/><output>0°</output></label><label><span>短毛强度</span><input id="furStrength" max="1" min="0" step="0.05" type="range" value="0.72"/><output>0.72</output></label><div class="note">耳朵使用新增的两根代码骨和局部权重；眼球仍是原有轻量球体，但虹膜、竖瞳和视线方向由着色器实时生成；短毛层只改变方向性明暗与微尺度粗糙度，不增加几何毛束，也不能遮盖关节变形错误。</div></section>
<section><h2>运动状态</h2><div class="kpi"><b>动作</b><span id="kAction">—</span></div><div class="kpi"><b>时间</b><span id="kTime">0.00 s</span></div><div class="kpi"><b>支撑爪</b><span id="kContacts">—</span></div><div class="kpi"><b>掌垫中心滑移</b><span id="kSlip">0.00 mm</span></div><div class="kpi"><b>掌垫最大倾角</b><span id="kTilt">0.00°</span></div><div class="kpi"><b>根路径 / 转角</b><span id="kRoot">0.000 m / 0.0°</span></div><div class="kpi"><b>姿势阶段</b><span id="kPosture">—</span></div><div class="kpi"><b>肩胛滑移</b><span id="kScapula">0.0 / 0.0 mm</span></div><div class="kpi"><b>耳眼模式</b><span id="kExpression">自动</span></div><div class="kpi"><b>视线</b><span id="kGaze">0.0° / 0.0°</span></div><div class="kpi"><b>左右耳</b><span id="kEars">0.0° / 0.0°</span></div><div class="kpi"><b>短毛方向</b><span id="kFur">启用 0.72</span></div><div class="kpi"><b>姿势修正</b><span id="kCorrective">关闭</span></div><div class="kpi"><b>法线修正</b><span id="kNormal">启用</span></div><div class="kpi"><b>姿势链</b><span>animationRig → contact/IK → finalPose → appearance</span></div></section>
<section><h2>当前资产</h2><div class="kpi"><b>骨骼</b><span>34（含左右耳）</span></div><div class="kpi"><b>顶点 / 三角形</b><span>3,948 / 7,884</span></div><div class="kpi"><b>每顶点影响</b><span>≤ 4</span></div><div class="kpi"><b>中性表面</b><span>V4.32 冻结</span></div></section>
<section><h2>本轮边界</h2><div class="note">本轮不改变 V4.32 中性猫体、不改变 V4.39 坐卧位置残差与目标法线、不改变掌垫接触、直行和转向。新增内容只包括两根耳部表现骨、眼球朝向/虹膜着色以及第一层程序化短毛方向场。眼睑、眨眼、真实毛束、花纹和毛发物理仍未开始。</div></section>
<section><h2>镜头</h2><label><span>观察距离</span><input id="cameraZoom" max="3.2" min="0.65" step="0.01" type="range" value="1"/><output id="cameraZoomValue">1.00×</output></label><div class="note">默认镜头保持整猫固定取景。耳眼细节可使用“耳眼追踪测试”后放大头部检查；短毛方向场应在全身、头颈、躯干、四肢和尾巴上连续，但不会改变轮廓。</div></section>
<section><h2>测试顺序</h2><div class="note">先检查“耳眼追踪测试”和“左右观察”，确认两只耳朵能够独立转向、虹膜与竖瞳不会游离到眼球外；再检查站立、坐姿、趴卧、直行和转向，确认 V4.38/V4.39 的修形与运动没有回归。最后分别关闭短毛方向层和毛流检查，对比是否只是表层明暗变化。</div></section></aside>'''
    text = re.sub(r'<aside>.*?</aside>', aside, text, count=1, flags=re.S)

    # Parser identity.
    text = text.replace("if(magic!=='CATV439')throw new Error('CATV439 载荷不匹配')",
                        "if(magic!=='CATV440')throw new Error('CATV440 载荷不匹配')", 1)
    text = text.replace("throw new Error('CATV439 区域修形/法线载荷不完整')",
                        "throw new Error('CATV440 耳眼/短毛载荷不完整')", 1)

    # Ensure focus action returns neutral body; expression layer drives eyes/ears.
    old = "function basePose(action,t){const p=emptyPose();let q,lift,side,fore,sign;if(action==='stand')return p;"
    new = "function basePose(action,t){const p=emptyPose();let q,lift,side,fore,sign;if(action==='stand'||action==='focus')return p;"
    text = text.replace(old, new, 1)

    # Annotate auto-life state so expressive layer can follow its current behavior.
    old = "const item=seq[ix],local=t-acc,current=basePose(item.state,local),tr=LIB.behavior.transitionSeconds;"
    new = "const item=seq[ix],local=t-acc,current=basePose(item.state,local),tr=LIB.behavior.transitionSeconds;current.meta=current.meta||{};current.meta.behaviorState=item.state;"
    text = text.replace(old, new, 1)
    old = "const out=mixPose(pp,current,local/tr);out.meta=current.meta||{};return out}return current}"
    new = "const out=mixPose(pp,current,local/tr);out.meta=current.meta||{};out.meta.behaviorState=item.state;return out}return current}"
    text = text.replace(old, new, 1)

    # Add expression state and helper after evalPose.
    marker = "function evalPose(name,t){return name==='auto_life'?autoPose(t):basePose(name,t)}\n\n"
    expression_js = r'''function evalPose(name,t){return name==='auto_life'?autoPose(t):basePose(name,t)}

let autoExpression=true,eyeLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,furStrength=.72;
let expressionState={gazeYaw:0,gazePitch:0,earLeft:0,earRight:0,earPitchL:0,earPitchR:0,mode:'auto'};
function expressionFor(name,t,pose){const source=name==='auto_life'&&pose.meta&&pose.meta.behaviorState?pose.meta.behaviorState:name;let gy=0,gp=0,eL=0,eR=0,pL=0,pR=0;const q=(x,d)=>2*Math.PI*x/d;if(source==='focus'){const a=q(t,4.8);gy=20*Math.sin(a);gp=3.5*Math.sin(a*.5+.35);eL=gy*.46+2.2*Math.sin(a*1.7);eR=gy*.46-2.0*Math.sin(a*1.45);pL=pR=-5}else if(source==='look'){const a=q(t,4.2);gy=16*Math.sin(a);gp=-2.5+2.3*Math.sin(a*.5+.2);eL=gy*.42+2.0;eR=gy*.42-2.0;pL=pR=-3}else if(source==='alert'){const a=q(t,3.2);gy=4*Math.sin(a*.5);gp=3+1.5*Math.sin(a);eL=5+2*Math.sin(a);eR=-5-2*Math.sin(a*.82);pL=pR=-4.5}else if(source==='sniff'){const a=q(t,3.4);gy=2.5*Math.sin(a*.5);gp=-10+1.5*Math.sin(a);eL=gy*.3+2;eR=gy*.3-2;pL=pR=-2}else if(source==='groom'){const a=q(t,3.8);gy=11;gp=-8+1.2*Math.sin(a*3);eL=8;eR=3;pL=-3;pR=-1}else if(source==='idle'){const a=q(t,3.6);gy=2.2*Math.sin(a*.45);gp=1.1*Math.sin(a*.35);eL=1.8*Math.sin(a*.7);eR=-1.6*Math.sin(a*.63+.8);pL=pR=-1.5}else if(source==='tail'){const a=q(t,3.2);gy=3*Math.sin(a*.4);eL=1.5*Math.sin(a*.7);eR=-1.5*Math.sin(a*.58);pL=pR=-1}else if(source.startsWith('turn_')){const sign=source==='turn_left'?1:-1;gy=8*sign;eL=5*sign;eR=3*sign;pL=pR=-2}else if(source==='walk'||source==='walk_forward'){const a=q(t,1.12);gy=1.5*Math.sin(a*.5);eL=1.2*Math.sin(a);eR=-1.2*Math.sin(a+.8);pL=pR=-1.2}
if(!autoExpression){gy=manualGazeYaw;gp=manualGazePitch;eL=manualEarLeft;eR=manualEarRight;pL=pR=0}
if(!eyeLayerEnabled){gy=0;gp=0}if(!earLayerEnabled){eL=eR=pL=pR=0}
return{gazeYaw:gy,gazePitch:gp,earLeft:eL,earRight:eR,earPitchL:pL,earPitchR:pR,mode:autoExpression?'auto':'manual',source}}
function applyExpressionPose(p,name,t){const e=expressionFor(name,t,p);expressionState=e;setA(p,'ear_L',e.earPitchL*DEG,0,e.earLeft*DEG);setA(p,'ear_R',e.earPitchR*DEG,0,e.earRight*DEG);p.meta=p.meta||{};p.meta.expression={...e};return p}

'''
    if marker not in text:
        raise RuntimeError('evalPose marker missing')
    text = text.replace(marker, expression_js, 1)

    # Apply expression to desired pose before transition blending.
    old = "function sampleDesired(localT){const t=sampledTime(action,localT),desired=evalPose(action,t);desired.r[0]+=motionOrigin[0];"
    new = "function sampleDesired(localT){const t=sampledTime(action,localT),desired=applyExpressionPose(evalPose(action,t),action,t);desired.r[0]+=motionOrigin[0];"
    text = text.replace(old, new, 1)

    # Shader replacement: 34 bones, procedural eye and fur direction field.
    shader_start = text.index('const vs=`#version 300 es')
    shader_end = text.index('const lineVS=`#version 300 es', shader_start)
    shader_block = r'''const vs=`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;layout(location=2)in float aPart;layout(location=3)in uvec4 aJoints;layout(location=4)in vec4 aWeights;layout(location=5)in vec3 aSitDelta;layout(location=6)in vec3 aLieDelta;layout(location=7)in vec3 aSitPoseNormal;layout(location=8)in vec3 aLiePoseNormal;uniform mat4 uPV;uniform mat4 uBones[34];uniform vec2 uPostureCorrection;uniform float uCorrectiveEnabled;uniform float uNormalCorrectiveEnabled;out vec3 vN;flat out float vPart;out vec3 vWeightColor;out float vCorr;out vec3 vEyeDir;out vec3 vFurT;out vec3 vBindP;vec3 bc(uint b){float f=float(b);return .5+.5*cos(vec3(0.,2.094,4.188)+f*2.399);}void main(){mat4 sm=aWeights.x*uBones[aJoints.x]+aWeights.y*uBones[aJoints.y]+aWeights.z*uBones[aJoints.z]+aWeights.w*uBones[aJoints.w];mat3 nm=aWeights.x*mat3(uBones[aJoints.x])+aWeights.y*mat3(uBones[aJoints.y])+aWeights.z*mat3(uBones[aJoints.z])+aWeights.w*mat3(uBones[aJoints.w]);vec4 p=sm*vec4(aPos,1.);vec3 corr=aSitDelta*uPostureCorrection.x+aLieDelta*uPostureCorrection.y;if(uCorrectiveEnabled>.5&&aPart<.5)p.xyz+=corr;gl_Position=uPV*p;vec3 baseN=normalize(nm*aNormal);float w=clamp(uPostureCorrection.x+uPostureCorrection.y,0.,1.);vec3 targetN=normalize(baseN*(1.-w)+aSitPoseNormal*uPostureCorrection.x+aLiePoseNormal*uPostureCorrection.y);vN=normalize(mix(baseN,targetN,uNormalCorrectiveEnabled));vPart=aPart;vCorr=aPart<.5?length(corr):0.;vWeightColor=aWeights.x*bc(aJoints.x)+aWeights.y*bc(aJoints.y)+aWeights.z*bc(aJoints.z)+aWeights.w*bc(aJoints.w);vec3 eyeC=aPos.y>=0.?vec3(.230651,.015828,.206688):vec3(.230651,-.015657,.206688);vEyeDir=aPart>.5?normalize(aPos-eyeC):vec3(1.,0.,0.);vec3 axis=vec3(1.,0.,.04);if(aPos.x<-.15&&aPos.z>.14)axis=normalize(vec3(-.58,0.,.82));if(aPos.z<.13&&abs(aPos.y)>.016)axis=vec3(0.,0.,-1.);if(aPos.x>.17&&aPos.z>.17)axis=normalize(vec3(1.,0.,.12));vec3 bt=axis-aNormal*dot(axis,aNormal);if(length(bt)<.001)bt=vec3(0.,1.,0.);vFurT=normalize(nm*normalize(bt));vBindP=aPos;}`;
const fs=`#version 300 es
precision highp float;in vec3 vN;flat in float vPart;in vec3 vWeightColor;in float vCorr;in vec3 vEyeDir;in vec3 vFurT;in vec3 vBindP;uniform float uWeightMode;uniform float uCorrectiveDebug;uniform vec2 uGaze;uniform float uEyeEnabled;uniform float uFurEnabled;uniform float uFurStrength;uniform float uFurDebug;out vec4 outColor;vec3 heat(float x){x=clamp(x,0.,1.);return mix(mix(vec3(.03,.18,.40),vec3(.06,.85,.72),smoothstep(0.,.5,x)),vec3(1.,.28,.08),smoothstep(.5,1.,x));}float hash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));if(vPart>.5&&uEyeEnabled>.5){float cy=cos(uGaze.x),sy=sin(uGaze.x),cp=cos(uGaze.y),sp=sin(uGaze.y);vec3 g=normalize(vec3(cp*cy,cp*sy,sp));vec3 r=normalize(cross(vec3(0.,0.,1.),g));if(length(r)<.01)r=vec3(0.,1.,0.);vec3 u=normalize(cross(g,r));vec3 e=normalize(vEyeDir);float ex=dot(e,r),ey=dot(e,u),ef=dot(e,g);float iris=1.-smoothstep(.34,.43,sqrt(ex*ex+ey*ey));iris*=smoothstep(.25,.55,ef);float pupil=(1.-smoothstep(.038,.066,abs(ex)))*(1.-smoothstep(.17,.24,abs(ey)))*smoothstep(.35,.72,ef);vec3 irisCol=mix(vec3(.12,.055,.015),vec3(.68,.48,.13),.75+.25*clamp(ey*2.+.5,0.,1.));vec3 eyeCol=mix(vec3(.025,.018,.012),irisCol,iris);eyeCol=mix(eyeCol,vec3(.003),pupil);float spec=pow(max(dot(n,normalize(vec3(.52,-.35,.78))),0.),54.);eyeCol+=vec3(.72,.78,.82)*spec*.65;outColor=vec4(pow(max(eyeCol,vec3(0.)),vec3(1./2.2)),1.);return;}float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;vec3 base=uWeightMode>.5?vWeightColor:vec3(.69,.655,.59);if(uCorrectiveDebug>.5)base=heat(vCorr/.008);if(uFurDebug>.5&&vPart<.5){vec3 t=normalize(vFurT);base=.5+.5*t;d=.82;}else if(uFurEnabled>.5&&vPart<.5&&uWeightMode<.5&&uCorrectiveDebug<.5){vec3 t=normalize(vFurT);vec3 lt=normalize(l1-n*dot(l1,n)+vec3(.0001));float aniso=pow(abs(dot(t,lt)),5.);float micro=hash31(floor(vBindP*720.));base*=1.+(micro-.5)*.055*uFurStrength;base+=vec3(.11,.095,.075)*aniso*.18*uFurStrength;d*=1.+(aniso-.35)*.08*uFurStrength;}vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;
'''
    text = text[:shader_start] + shader_block + text[shader_end:]

    # Add uniforms to U object.
    old = "debug:gl.getUniformLocation(pr,'uCorrectiveDebug')},LU="
    new = ("debug:gl.getUniformLocation(pr,'uCorrectiveDebug'),gaze:gl.getUniformLocation(pr,'uGaze'),"
           "eye:gl.getUniformLocation(pr,'uEyeEnabled'),fur:gl.getUniformLocation(pr,'uFurEnabled'),"
           "furStrength:gl.getUniformLocation(pr,'uFurStrength'),furDebug:gl.getUniformLocation(pr,'uFurDebug')},LU=")
    text = text.replace(old, new, 1)

    # Add expression state to rendering variables.
    old = "correctiveDebug=false,paused=false,speed=1,action='stand'"
    new = "correctiveDebug=false,paused=false,speed=1,action='stand'"
    # No replacement necessary; expression globals already declared earlier.

    # Populate action buttons explicitly (V4.39 relied on an external build step, so make this self-contained).
    insert_before = "function nowAction(){return paused?pauseStamp:(performance.now()/1000-actionStart)*speed}"
    action_ui = r'''const actionPanel=$('#actionButtons');actionPanel.innerHTML=LIB.actions.map(a=>'<button data-action="'+a.id+'">'+a.label+'</button>').join('');actionPanel.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)setAction(b.dataset.action)});
function nowAction(){return paused?pauseStamp:(performance.now()/1000-actionStart)*speed}'''
    text = text.replace(insert_before, action_ui, 1)

    # Set expression uniforms in frame before drawing.
    old = "gl.uniform1f(U.debug,correctiveDebug?1:0);gl.drawElements"
    new = ("gl.uniform1f(U.debug,correctiveDebug?1:0);"
           "gl.uniform2f(U.gaze,expressionState.gazeYaw*DEG,expressionState.gazePitch*DEG);"
           "gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.fur,furLayerEnabled?1:0);"
           "gl.uniform1f(U.furStrength,furStrength);gl.uniform1f(U.furDebug,furDebugEnabled?1:0);gl.drawElements")
    if old not in text:
        raise RuntimeError('frame uniform marker missing')
    text = text.replace(old, new, 1)

    # Add KPI updates to frame.
    old = "$('#kRegion').textContent=correctiveDebug?'开启':'关闭';statusBox.innerHTML="
    new = ("$('#kRegion')&&($('#kRegion').textContent=correctiveDebug?'开启':'关闭');"
           "$('#kExpression').textContent=expressionState.mode==='auto'?'自动 '+expressionState.source:'手动';"
           "$('#kGaze').textContent=expressionState.gazeYaw.toFixed(1)+'° / '+expressionState.gazePitch.toFixed(1)+'°';"
           "$('#kEars').textContent=expressionState.earLeft.toFixed(1)+'° / '+expressionState.earRight.toFixed(1)+'°';"
           "$('#kFur').textContent=furLayerEnabled?'启用 '+furStrength.toFixed(2):'关闭';statusBox.innerHTML=")
    text = text.replace(old, new, 1)

    # Extend metrics expression.
    old = "corrective:{enabled:poseCorrectives,normalEnabled:normalCorrectives,debug:correctiveDebug,weights:cw,representation:'regional_position_residual_plus_pose_target_normal'},camera:"
    new = ("corrective:{enabled:poseCorrectives,normalEnabled:normalCorrectives,debug:correctiveDebug,weights:cw,representation:'regional_position_residual_plus_pose_target_normal'},"
           "expression:{...expressionState,eyeLayerEnabled,earLayerEnabled,furLayerEnabled,furStrength,furDebugEnabled},camera:")
    text = text.replace(old, new, 1)

    # Wire new controls before existing reset handlers.
    control_marker = "$('#resetMotion').onclick=resetWorldMotion;"
    control_js = r'''$('#autoExpression').onclick=e=>{autoExpression=!autoExpression;e.currentTarget.classList.toggle('active',autoExpression);e.currentTarget.textContent=autoExpression?'自动耳眼':'手动耳眼'};
function manualSlider(id,setter,format=v=>v+'°'){const el=$(id);el.oninput=e=>{autoExpression=false;$('#autoExpression').classList.remove('active');$('#autoExpression').textContent='手动耳眼';const v=+e.target.value;setter(v);e.target.nextElementSibling.value=format(v)}}
manualSlider('#gazeYaw',v=>manualGazeYaw=v);manualSlider('#gazePitch',v=>manualGazePitch=v);manualSlider('#earLeft',v=>manualEarLeft=v);manualSlider('#earRight',v=>manualEarRight=v);manualSlider('#furStrength',v=>furStrength=v,v=>v.toFixed(2));
$('#eyeToggle').onclick=e=>{eyeLayerEnabled=!eyeLayerEnabled;e.currentTarget.classList.toggle('active',eyeLayerEnabled)};$('#earToggle').onclick=e=>{earLayerEnabled=!earLayerEnabled;e.currentTarget.classList.toggle('active',earLayerEnabled)};$('#furToggle').onclick=e=>{furLayerEnabled=!furLayerEnabled;e.currentTarget.classList.toggle('active',furLayerEnabled)};$('#furDebugToggle').onclick=e=>{furDebugEnabled=!furDebugEnabled;e.currentTarget.classList.toggle('active',furDebugEnabled)};$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#earLayer').onclick=$('#earToggle').onclick;$('#furLayer').onclick=$('#furToggle').onclick;$('#furDebug').onclick=$('#furDebugToggle').onclick;
$('#resetMotion').onclick=resetWorldMotion;'''
    text = text.replace(control_marker, control_js, 1)

    # Versioned public APIs and stats.
    text = text.replace("window.__CAT_V439_READY__='webgl2'", "window.__CAT_V440_READY__='webgl2'", 1)
    text = text.replace("window.__CAT_V439_RENDER_STATE__='regional-normal-refinement'", "window.__CAT_V440_RENDER_STATE__='eye-ear-short-fur'", 1)
    text = text.replace('window.__CAT_V439_CAMERA__=', 'window.__CAT_V440_CAMERA__=', 1)
    text = text.replace('window.__CAT_V439_GET_CAMERA__=', 'window.__CAT_V440_GET_CAMERA__=', 1)
    text = text.replace('window.__CAT_V439_GET_METRICS__=', 'window.__CAT_V440_GET_METRICS__=', 1)
    text = text.replace('window.__CAT_V439_RESET_MOTION__=', 'window.__CAT_V440_RESET_MOTION__=', 1)
    text = text.replace('window.__CAT_V439_SET_CORRECTIVES__=', 'window.__CAT_V440_SET_CORRECTIVES__=', 1)
    text = text.replace('window.__CAT_V439_SAMPLE_SURFACE__=', 'window.__CAT_V440_SAMPLE_SURFACE__=', 1)
    text = text.replace('window.__CAT_V439_SAMPLE_BONES__=', 'window.__CAT_V440_SAMPLE_BONES__=', 1)
    text = text.replace('window.__CAT_V439_SAMPLE_JOINTS__=', 'window.__CAT_V440_SAMPLE_JOINTS__=', 1)
    text = text.replace('window.__CAT_V439_SET_SAMPLE__=', 'window.__CAT_V440_SET_SAMPLE__=', 1)
    text = text.replace('window.__CAT_V439_SAMPLE_DEFORM__=', 'window.__CAT_V440_SAMPLE_DEFORM__=', 1)
    text = text.replace('window.__CAT_V439_EXPORT_POSITIONS__=', 'window.__CAT_V440_EXPORT_POSITIONS__=', 1)
    text = text.replace('window.__CAT_V439_STATS__=', 'window.__CAT_V440_STATS__=', 1)
    text = text.replace("bones:m.boneCount", "bones:boneCount", 1)
    text = text.replace("regionalRefinement:true,poseTargetNormals:true", "regionalRefinement:true,poseTargetNormals:true,earBones:true,proceduralEye:true,shortFurDirectionField:true", 1)
    text = text.replace("requestAnimationFrame(frame);\n}catch(err)", r'''window.__CAT_V440_SET_EXPRESSION__=cfg=>{if(cfg.auto!==undefined)autoExpression=!!cfg.auto;if(cfg.gazeYaw!==undefined)manualGazeYaw=+cfg.gazeYaw;if(cfg.gazePitch!==undefined)manualGazePitch=+cfg.gazePitch;if(cfg.earLeft!==undefined)manualEarLeft=+cfg.earLeft;if(cfg.earRight!==undefined)manualEarRight=+cfg.earRight;if(cfg.furStrength!==undefined)furStrength=+cfg.furStrength;if(cfg.eyeEnabled!==undefined)eyeLayerEnabled=!!cfg.eyeEnabled;if(cfg.earEnabled!==undefined)earLayerEnabled=!!cfg.earEnabled;if(cfg.furEnabled!==undefined)furLayerEnabled=!!cfg.furEnabled;if(cfg.furDebug!==undefined)furDebugEnabled=!!cfg.furDebug;return{autoExpression,manualGazeYaw,manualGazePitch,manualEarLeft,manualEarRight,furStrength,eyeLayerEnabled,earLayerEnabled,furLayerEnabled,furDebugEnabled}};
window.__CAT_V440_SET_CAMERA_TARGET__=(x,y,z,zoom=1)=>{target[0]=x;target[1]=y;target[2]=z;fitDist=fittedDistance(az,el);zoomScale=Math.max(.2,Math.min(3.2,zoom));dist=fitDist*zoomScale;return{target:target.slice(),dist}};
window.__CAT_V440_EAR_AUDIT__={leftCount:%d,rightCount:%d,leftIndices:%s,rightIndices:%s};
requestAnimationFrame(frame);
}catch(err)''' % (
        ear_stats['earVertices']['L']['count'], ear_stats['earVertices']['R']['count'],
        json.dumps(ear_stats['earVertices']['L']['indices']), json.dumps(ear_stats['earVertices']['R']['indices'])
    ), 1)
    text = text.replace("window.__CAT_V439_READY__='static-fallback'", "window.__CAT_V440_READY__='static-fallback'", 1)
    text = text.replace("window.__CAT_V439_ERROR__", "window.__CAT_V440_ERROR__", 1)

    # Update remaining visible/version strings.
    text = text.replace('V4.39 结果', 'V4.39 基线')
    text = text.replace('V4.39', 'V4.40')
    # Restore references that should still name the previous baseline in boundary text.
    text = text.replace('不改变 V4.40 坐卧位置残差', '不改变 V4.39 坐卧位置残差')
    text = text.replace('V4.40 回归', 'V4.39 回归')

    OUT_HTML.write_text(text, encoding='utf-8')
    (DATA_DIR / 'cat_v440.bin').write_bytes(payload)
    (DATA_DIR / 'CAT_KAOPU_V440_EAR_WEIGHT_AUDIT_2026-09-15.json').write_text(
        json.dumps(ear_stats, ensure_ascii=False, indent=2), encoding='utf-8')
    shutil.copy2(Path(__file__), TOOLS_DIR / 'build_cat_v440_eye_ear_short_fur.py')

    summary = {
        'schema': 'cat_kaopu/v440_build_summary@1.0',
        'version': 'V4.40',
        'source': str(SRC),
        'output': str(OUT_HTML),
        'payloadBytes': len(payload),
        'payloadSha256': hashlib.sha256(payload).hexdigest(),
        'vertices': header['vc'],
        'triangles': header['ic'] // 3,
        'boneCount': 34,
        'newBones': ['ear_L','ear_R'],
        'earWeightAudit': ear_stats,
        'runtimeDependencies': {'externalModel': False, 'externalTexture': False, 'externalAnimation': False},
        'scope': ['independent ear bones','procedural eye gaze/iris/pupil','first anisotropic short-fur direction field'],
        'frozen': ['V4.32 neutral surface','V4.34 base weights except bounded ear-region reassignment','V4.39 posture residuals/normals','V4.36 locomotion/contact'],
    }
    (QA_DIR / 'CAT_KAOPU_V440_BUILD_SUMMARY_2026-09-15.json').write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2)[:5000])


if __name__ == '__main__':
    build()
