from __future__ import annotations

import base64
import hashlib
import json
import re
from pathlib import Path
from typing import Any

MODULE_ROOT = Path(__file__).resolve().parent.parent
BASELINE = MODULE_ROOT / "baselines/v4.40/CAT_KAOPU_V440_EYE_EAR_SHORT_FUR_WORKBENCH_2026-09-15.html"
CURRENT_HTML = MODULE_ROOT / "workbench/CAT_KAOPU_CURRENT.html"
BUILD_DIR = MODULE_ROOT / "build/v4.41"
OUT_HTML = BUILD_DIR / "CAT_KAOPU_V441_EYELID_CORNEA_WORKBENCH_2026-09-15.html"
DOC_REPORT = MODULE_ROOT / "docs/CAT_KAOPU_V441_EXECUTION_REPORT_2026-09-15.md"
DOC_REVIEW = MODULE_ROOT / "docs/CAT_KAOPU_V441_SELF_REVIEW_2026-09-15.md"
QA_TECHNICAL = MODULE_ROOT / "qa/CAT_KAOPU_V441_TECHNICAL_QA_2026-09-15.json"
CURRENT_JSON = MODULE_ROOT / "CURRENT.json"
README = MODULE_ROOT / "README.md"
MANIFEST = MODULE_ROOT / "BUILD_MANIFEST.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


def regex_replace_once(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex marker, found {count}")
    return out


def extract_json_constant(text: str, name: str, next_name: str) -> tuple[dict[str, Any], tuple[int, int]]:
    start_token = f"const {name}="
    end_token = f";\nconst {next_name}="
    i = text.index(start_token) + len(start_token)
    j = text.index(end_token, i)
    return json.loads(text[i:j]), (i, j)


def replace_json_constant(text: str, name: str, next_name: str, value: dict[str, Any]) -> str:
    _, (i, j) = extract_json_constant(text, name, next_name)
    return text[:i] + json.dumps(value, ensure_ascii=False, separators=(",", ":")) + text[j:]


def embedded_payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise RuntimeError("CAT_B64 not found")
    return base64.b64decode(match.group(1))


def build_html(source_text: str) -> str:
    if "CAT KAOPU V4.40" not in source_text or "__CAT_V440_READY__" not in source_text:
        raise RuntimeError("V4.40 source markers missing")

    text = source_text

    lib, _ = extract_json_constant(text, "LIB", "canvas")
    if not any(action.get("id") == "blink_check" for action in lib.get("actions", [])):
        actions = lib["actions"]
        insert_at = next((i for i, action in enumerate(actions) if action.get("id") == "auto_life"), len(actions))
        actions.insert(
            insert_at,
            {
                "id": "blink_check",
                "label": "眼睑 / 角膜检查",
                "duration": 3.2,
                "loop": True,
                "status": "procedural_eyelid_cornea_candidate",
            },
        )
    lib["behavior"]["version"] = "V4.41"
    lib["behavior"]["boundary"] = (
        "Deterministic preview only. V4.41 preserves the V4.32 neutral surface, V4.40 payload, "
        "V4.39 posture correctives and V4.36 locomotion/contact. It adds a shader-only eyelid aperture, "
        "deterministic blink, corneal wet response and pupil adaptation without modifying geometry or weights."
    )
    text = replace_json_constant(text, "LIB", "canvas", lib)

    text = replace_once(
        text,
        "<title>CAT KAOPU V4.40 · 独立耳眼控制与短毛方向场</title>",
        "<title>CAT KAOPU V4.41 · 眼睑眨眼与角膜响应第一层</title>",
        "document title",
    )
    text = replace_once(
        text,
        'alt="V4.40 独立耳眼控制与短毛方向场静态回退"',
        'alt="V4.41 眼睑眨眼与角膜响应第一层静态回退"',
        "fallback alt",
    )
    text = replace_once(text, "<aside><h1>CAT KAOPU V4.40</h1>", "<aside><h1>CAT KAOPU V4.41</h1>", "aside title")
    text = replace_once(
        text,
        "V4.32 冻结整猫表面 → V4.34 权重基线 → V4.39 坐卧修形 → V4.40 独立耳眼控制与短毛方向场",
        "V4.32 冻结整猫表面 → V4.39 坐卧修形 → V4.40 耳眼/短毛 → V4.41 眼睑眨眼与角膜响应",
        "aside lineage",
    )
    text = replace_once(
        text,
        '<span class="tag good">程序化虹膜</span><span class="tag good">短毛方向场</span>',
        '<span class="tag good">程序化虹膜</span><span class="tag good">程序化眼睑</span><span class="tag good">角膜湿润响应</span><span class="tag good">瞳孔适应</span><span class="tag good">短毛方向场</span>',
        "feature tags",
    )

    text = replace_once(
        text,
        '<button class="active" id="eyeLayer">眼球层</button><button class="active" id="earLayer">耳骨层</button>',
        '<button class="active" id="eyeLayer">眼球层</button><button class="active" id="blinkLayer">眼睑层</button><button class="active" id="corneaLayer">角膜层</button><button class="active" id="earLayer">耳骨层</button>',
        "toolbar eye controls",
    )

    text = replace_once(text, "<section><h2>耳眼与短毛第一层</h2>", "<section><h2>眼睑、角膜、耳眼与短毛</h2>", "section heading")
    text = replace_once(
        text,
        '<button class="active" id="autoExpression">自动耳眼</button><button class="active" id="eyeToggle">眼球着色</button><button class="active" id="earToggle">耳骨蒙皮</button>',
        '<button class="active" id="autoExpression">自动耳眼</button><button class="active" id="autoBlink">自动眨眼</button><button class="active" id="eyeToggle">眼球着色</button><button class="active" id="blinkToggle">眼睑遮罩</button><button class="active" id="corneaToggle">角膜响应</button><button class="active" id="earToggle">耳骨蒙皮</button>',
        "aside eye buttons",
    )

    pitch_label_pattern = (
        r'(<label><span>视线上下</span><input id="gazePitch" max="14" min="-14" step="1" '
        r'type="range" value="0"/><output>0°</output></label>)'
    )
    pitch_label_extra = (
        r'\1<label><span>手动闭眼</span><input id="blinkAmount" max="1" min="0" step="0.02" type="range" value="0"/><output>0.00</output></label>'
        r'<label><span>角膜湿润</span><input id="corneaResponse" max="1" min="0" step="0.02" type="range" value="0.82"/><output>0.82</output></label>'
        r'<label><span>暗处瞳孔</span><input id="pupilAdapt" max="1" min="0" step="0.02" type="range" value="0.42"/><output>0.42</output></label>'
    )
    text = regex_replace_once(text, pitch_label_pattern, pitch_label_extra, "eye sliders")

    text = replace_once(
        text,
        "眼球仍是原有轻量球体，但虹膜、竖瞳和视线方向由着色器实时生成；短毛层只改变方向性明暗与微尺度粗糙度，不增加几何毛束，也不能遮盖关节变形错误。",
        "眼球仍使用 V4.40 轻量球体；V4.41 只在眼球片元层建立上下眼睑开合、确定性眨眼、角膜湿润高光与瞳孔适应。它不是几何眼皮、泪膜折射或第三眼睑，不能替代后续真实眼眶与眼睑体积。短毛层仍只改变方向性明暗。",
        "eye boundary note",
    )

    text = replace_once(
        text,
        '<div class="kpi"><b>视线</b><span id="kGaze">0.0° / 0.0°</span></div><div class="kpi"><b>左右耳</b>',
        '<div class="kpi"><b>视线</b><span id="kGaze">0.0° / 0.0°</span></div><div class="kpi"><b>眨眼</b><span id="kBlink">自动 0.00</span></div><div class="kpi"><b>角膜 / 瞳孔</b><span id="kCornea">启用 0.82 / 0.42</span></div><div class="kpi"><b>左右耳</b>',
        "eye KPIs",
    )

    text = replace_once(
        text,
        "本轮不改变 V4.32 中性猫体、不改变 V4.39 坐卧位置残差与目标法线、不改变掌垫接触、直行和转向。新增内容只包括两根耳部表现骨、眼球朝向/虹膜着色以及第一层程序化短毛方向场。眼睑、眨眼、真实毛束、花纹和毛发物理仍未开始。",
        "本轮不改变 V4.32 中性猫体、不改变 V4.40 二进制载荷与 34 骨权重、不改变 V4.39 坐卧修形，也不改变掌垫接触、直行和转向。新增内容只位于眼球片元表现层：程序化眼睑开合、眨眼、角膜响应和瞳孔适应。真实几何眼睑、第三眼睑、泪膜折射、胡须和几何毛束仍未完成。",
        "scope boundary",
    )
    text = replace_once(
        text,
        "先检查“耳眼追踪测试”和“左右观察”，确认两只耳朵能够独立转向、虹膜与竖瞳不会游离到眼球外；再检查站立、坐姿、趴卧、直行和转向，确认 V4.38/V4.39 的修形与运动没有回归。最后分别关闭短毛方向层和毛流检查，对比是否只是表层明暗变化。",
        "先检查“眼睑 / 角膜检查”：自动眨眼应完整闭合并恢复，手动闭眼 0→1 不得移动眼球几何；再检查不同瞳孔适应和角膜湿润值，确认高光与瞳孔宽度变化受限。随后检查耳眼追踪、站立、坐姿、趴卧、直行和转向，确认 V4.39 修形与 V4.36 运动没有回归。",
        "test sequence",
    )

    text = replace_once(
        text,
        "function basePose(action,t){const p=emptyPose();let q,lift,side,fore,sign;if(action==='stand'||action==='focus')return p;",
        "function basePose(action,t){const p=emptyPose();let q,lift,side,fore,sign;if(action==='stand'||action==='focus'||action==='blink_check')return p;",
        "neutral blink action",
    )

    text = replace_once(
        text,
        "let autoExpression=true,eyeLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,furStrength=.72;",
        "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
        "expression state variables",
    )
    text = replace_once(
        text,
        "let expressionState={gazeYaw:0,gazePitch:0,earLeft:0,earRight:0,earPitchL:0,earPitchR:0,mode:'auto'};",
        "let expressionState={gazeYaw:0,gazePitch:0,earLeft:0,earRight:0,earPitchL:0,earPitchR:0,blink:0,cornea:.82,pupilAdapt:.42,mode:'auto',blinkMode:'auto'};",
        "expression state object",
    )

    old_apply = (
        "function applyExpressionPose(p,name,t){const e=expressionFor(name,t,p);expressionState=e;"
        "setA(p,'ear_L',e.earPitchL*DEG,0,e.earLeft*DEG);setA(p,'ear_R',e.earPitchR*DEG,0,e.earRight*DEG);"
        "p.meta=p.meta||{};p.meta.expression={...e};return p}"
    )
    new_apply = r'''function blinkPulse(t,center,width){const d=Math.abs(t-center);if(d>=width)return 0;const x=1-d/width;return x*x*(3-2*x)}
function blinkFor(source,t){if(!blinkLayerEnabled)return 0;if(!autoBlink)return Math.max(0,Math.min(1,manualBlink));if(source==='blink_check'){const c=((t%3.2)+3.2)%3.2;return Math.max(blinkPulse(c,.86,.19),blinkPulse(c,1.24,.15))}const period=source==='alert'?5.8:4.6;const phase=(source.length%7)*.19;const c=(((t+phase)%period)+period)%period;let b=blinkPulse(c,.22,.16);if(source==='groom'||source==='sniff')b=Math.max(b,blinkPulse(c,2.28,.12)*.72);return b}
function applyExpressionPose(p,name,t){const e=expressionFor(name,t,p);e.blink=blinkFor(e.source,t);e.cornea=corneaLayerEnabled?corneaResponse:0;e.pupilAdapt=pupilAdapt;e.blinkMode=autoBlink?'auto':'manual';expressionState=e;setA(p,'ear_L',e.earPitchL*DEG,0,e.earLeft*DEG);setA(p,'ear_R',e.earPitchR*DEG,0,e.earRight*DEG);p.meta=p.meta||{};p.meta.expression={...e};return p}'''
    text = replace_once(text, old_apply, new_apply, "blink evaluation")

    fs_start = text.index("const fs=`#version 300 es")
    fs_end = text.index("const lineVS=`#version 300 es", fs_start)
    new_fs = r'''const fs=`#version 300 es
precision highp float;in vec3 vN;flat in float vPart;in vec3 vWeightColor;in float vCorr;in vec3 vEyeDir;in vec3 vFurT;in vec3 vBindP;uniform float uWeightMode;uniform float uCorrectiveDebug;uniform vec2 uGaze;uniform float uEyeEnabled;uniform float uLidEnabled;uniform float uBlink;uniform float uCornea;uniform float uPupilAdapt;uniform float uFurEnabled;uniform float uFurStrength;uniform float uFurDebug;out vec4 outColor;vec3 heat(float x){x=clamp(x,0.,1.);return mix(mix(vec3(.03,.18,.40),vec3(.06,.85,.72),smoothstep(0.,.5,x)),vec3(1.,.28,.08),smoothstep(.5,1.,x));}float hash31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}void main(){vec3 n=normalize(vN),l1=normalize(vec3(.45,-.55,.82)),l2=normalize(vec3(-.62,.35,.35));if(vPart>.5&&uEyeEnabled>.5){float cy=cos(uGaze.x),sy=sin(uGaze.x),cp=cos(uGaze.y),sp=sin(uGaze.y);vec3 g=normalize(vec3(cp*cy,cp*sy,sp));vec3 r=normalize(cross(vec3(0.,0.,1.),g));if(length(r)<.01)r=vec3(0.,1.,0.);vec3 u=normalize(cross(g,r));vec3 e=normalize(vEyeDir);float ex=dot(e,r),ey=dot(e,u),ef=dot(e,g);float iris=1.-smoothstep(.34,.43,sqrt(ex*ex+ey*ey));iris*=smoothstep(.25,.55,ef);float pupilHalf=mix(.018,.082,clamp(uPupilAdapt,0.,1.));float pupil=(1.-smoothstep(pupilHalf,pupilHalf+.025,abs(ex)))*(1.-smoothstep(.17,.25,abs(ey)))*smoothstep(.35,.72,ef);vec3 irisCol=mix(vec3(.12,.055,.015),vec3(.68,.48,.13),.75+.25*clamp(ey*2.+.5,0.,1.));vec3 eyeCol=mix(vec3(.025,.018,.012),irisCol,iris);eyeCol=mix(eyeCol,vec3(.003),pupil);float baseSpec=pow(max(dot(n,normalize(vec3(.52,-.35,.78))),0.),54.);eyeCol+=vec3(.72,.78,.82)*baseSpec*.65;vec3 h=normalize(l1+g);float wetSpec=pow(max(dot(n,h),0.),mix(42.,108.,clamp(uCornea,0.,1.)));float fres=pow(1.-max(ef,0.),3.);eyeCol+=vec3(.82,.90,.94)*wetSpec*.46*uCornea+vec3(.08,.12,.14)*fres*.34*uCornea;float blink=clamp(uBlink,0.,1.);float lateral=sqrt(max(0.,1.-(ex*ex)/(.48*.48)));float halfOpen=mix(.30,.010,smoothstep(0.,1.,blink))*lateral;float aperture=uLidEnabled>.5?smoothstep(-halfOpen-.022,-halfOpen+.010,ey)*(1.-smoothstep(halfOpen-.010,halfOpen+.022,ey)):1.;aperture*=1.-smoothstep(.96,.995,blink);float edge=uLidEnabled>.5?(1.-smoothstep(.006,.030,abs(abs(ey)-halfOpen))):0.;float lidLight=.44+.55*max(dot(n,l1),0.)+.10*max(dot(n,l2),0.);vec3 lidCol=vec3(.69,.655,.59)*lidLight;float seam=(1.-smoothstep(.010,.030,abs(ey)))*smoothstep(.10,.40,lateral)*smoothstep(.45,.98,blink);lidCol*=1.-.22*seam;lidCol-=vec3(.045,.036,.03)*edge;vec3 eyeOut=mix(lidCol,eyeCol,aperture);outColor=vec4(pow(max(eyeOut,vec3(0.)),vec3(1./2.2)),1.);return;}float d=max(dot(n,l1),0.)*.70+max(dot(n,l2),0.)*.24+.19;vec3 base=uWeightMode>.5?vWeightColor:vec3(.69,.655,.59);if(uCorrectiveDebug>.5)base=heat(vCorr/.008);if(uFurDebug>.5&&vPart<.5){vec3 t=normalize(vFurT);base=.5+.5*t;d=.82;}else if(uFurEnabled>.5&&vPart<.5&&uWeightMode<.5&&uCorrectiveDebug<.5){vec3 t=normalize(vFurT);vec3 lt=normalize(l1-n*dot(l1,n)+vec3(.0001));float aniso=pow(abs(dot(t,lt)),5.);float micro=hash31(floor(vBindP*720.));base*=1.+(micro-.5)*.055*uFurStrength;base+=vec3(.11,.095,.075)*aniso*.18*uFurStrength;d*=1.+(aniso-.35)*.08*uFurStrength;}vec3 col=base*d+vec3(.025,.04,.045)*pow(1.-max(dot(n,normalize(vec3(.2,-.4,.9))),0.),2.);outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),1.);}`;
'''
    text = text[:fs_start] + new_fs + text[fs_end:]

    text = replace_once(
        text,
        "eye:gl.getUniformLocation(pr,'uEyeEnabled'),fur:gl.getUniformLocation(pr,'uFurEnabled')",
        "eye:gl.getUniformLocation(pr,'uEyeEnabled'),lid:gl.getUniformLocation(pr,'uLidEnabled'),blink:gl.getUniformLocation(pr,'uBlink'),cornea:gl.getUniformLocation(pr,'uCornea'),pupil:gl.getUniformLocation(pr,'uPupilAdapt'),fur:gl.getUniformLocation(pr,'uFurEnabled')",
        "eye uniforms",
    )
    text = replace_once(
        text,
        "gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.fur,furLayerEnabled?1:0);",
        "gl.uniform1f(U.eye,eyeLayerEnabled?1:0);gl.uniform1f(U.lid,blinkLayerEnabled?1:0);gl.uniform1f(U.blink,expressionState.blink);gl.uniform1f(U.cornea,corneaLayerEnabled?corneaResponse:0);gl.uniform1f(U.pupil,pupilAdapt);gl.uniform1f(U.fur,furLayerEnabled?1:0);",
        "frame eye uniforms",
    )

    text = replace_once(
        text,
        "manualSlider('#gazeYaw',v=>manualGazeYaw=v);manualSlider('#gazePitch',v=>manualGazePitch=v);manualSlider('#earLeft',v=>manualEarLeft=v);manualSlider('#earRight',v=>manualEarRight=v);manualSlider('#furStrength',v=>furStrength=v,v=>v.toFixed(2));",
        "manualSlider('#gazeYaw',v=>manualGazeYaw=v);manualSlider('#gazePitch',v=>manualGazePitch=v);manualSlider('#earLeft',v=>manualEarLeft=v);manualSlider('#earRight',v=>manualEarRight=v);function layerSlider(id,setter,format=v=>v.toFixed(2)){const el=$(id);el.oninput=e=>{const v=+e.target.value;setter(v);e.target.nextElementSibling.value=format(v)}}layerSlider('#blinkAmount',v=>{manualBlink=v;autoBlink=false;$('#autoBlink').classList.remove('active');$('#autoBlink').textContent='手动眨眼'});layerSlider('#corneaResponse',v=>corneaResponse=v);layerSlider('#pupilAdapt',v=>pupilAdapt=v);layerSlider('#furStrength',v=>furStrength=v);",
        "slider handlers",
    )
    text = replace_once(
        text,
        "$('#eyeToggle').onclick=e=>{eyeLayerEnabled=!eyeLayerEnabled;e.currentTarget.classList.toggle('active',eyeLayerEnabled)};$('#earToggle').onclick=e=>{earLayerEnabled=!earLayerEnabled;e.currentTarget.classList.toggle('active',earLayerEnabled)};",
        "$('#autoBlink').onclick=e=>{autoBlink=!autoBlink;e.currentTarget.classList.toggle('active',autoBlink);e.currentTarget.textContent=autoBlink?'自动眨眼':'手动眨眼'};$('#eyeToggle').onclick=e=>{eyeLayerEnabled=!eyeLayerEnabled;e.currentTarget.classList.toggle('active',eyeLayerEnabled)};$('#blinkToggle').onclick=e=>{blinkLayerEnabled=!blinkLayerEnabled;e.currentTarget.classList.toggle('active',blinkLayerEnabled)};$('#corneaToggle').onclick=e=>{corneaLayerEnabled=!corneaLayerEnabled;e.currentTarget.classList.toggle('active',corneaLayerEnabled)};$('#earToggle').onclick=e=>{earLayerEnabled=!earLayerEnabled;e.currentTarget.classList.toggle('active',earLayerEnabled)};",
        "eye button handlers",
    )
    text = replace_once(
        text,
        "$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#earLayer').onclick=$('#earToggle').onclick;",
        "$('#eyeLayer').onclick=$('#eyeToggle').onclick;$('#blinkLayer').onclick=$('#blinkToggle').onclick;$('#corneaLayer').onclick=$('#corneaToggle').onclick;$('#earLayer').onclick=$('#earToggle').onclick;",
        "toolbar button handlers",
    )

    text = replace_once(
        text,
        "$('#kGaze').textContent=expressionState.gazeYaw.toFixed(1)+'° / '+expressionState.gazePitch.toFixed(1)+'°';$('#kEars').textContent=expressionState.earLeft.toFixed(1)+'° / '+expressionState.earRight.toFixed(1)+'°';",
        "$('#kGaze').textContent=expressionState.gazeYaw.toFixed(1)+'° / '+expressionState.gazePitch.toFixed(1)+'°';$('#kBlink').textContent=(expressionState.blinkMode==='auto'?'自动 ':'手动 ')+expressionState.blink.toFixed(2);$('#kCornea').textContent=(corneaLayerEnabled?'启用 ':'关闭 ')+corneaResponse.toFixed(2)+' / '+pupilAdapt.toFixed(2);$('#kEars').textContent=expressionState.earLeft.toFixed(1)+'° / '+expressionState.earRight.toFixed(1)+'°';",
        "eye KPI runtime",
    )
    text = replace_once(
        text,
        "expression:{...expressionState,eyeLayerEnabled,earLayerEnabled,furLayerEnabled,furStrength,furDebugEnabled},camera:",
        "expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},camera:",
        "metrics expression",
    )

    api_pattern = r"window\.__CAT_V440_SET_EXPRESSION__=cfg=>\{.*?\};\nwindow\.__CAT_V440_SET_CAMERA_TARGET__="
    api_replacement = r'''window.__CAT_V440_SET_EXPRESSION__=cfg=>{if(cfg.auto!==undefined)autoExpression=!!cfg.auto;if(cfg.autoBlink!==undefined)autoBlink=!!cfg.autoBlink;if(cfg.gazeYaw!==undefined)manualGazeYaw=+cfg.gazeYaw;if(cfg.gazePitch!==undefined)manualGazePitch=+cfg.gazePitch;if(cfg.earLeft!==undefined)manualEarLeft=+cfg.earLeft;if(cfg.earRight!==undefined)manualEarRight=+cfg.earRight;if(cfg.blink!==undefined){manualBlink=Math.max(0,Math.min(1,+cfg.blink));if(cfg.autoBlink===undefined)autoBlink=false}if(cfg.cornea!==undefined)corneaResponse=Math.max(0,Math.min(1,+cfg.cornea));if(cfg.pupilAdapt!==undefined)pupilAdapt=Math.max(0,Math.min(1,+cfg.pupilAdapt));if(cfg.furStrength!==undefined)furStrength=+cfg.furStrength;if(cfg.eyeEnabled!==undefined)eyeLayerEnabled=!!cfg.eyeEnabled;if(cfg.blinkEnabled!==undefined)blinkLayerEnabled=!!cfg.blinkEnabled;if(cfg.corneaEnabled!==undefined)corneaLayerEnabled=!!cfg.corneaEnabled;if(cfg.earEnabled!==undefined)earLayerEnabled=!!cfg.earEnabled;if(cfg.furEnabled!==undefined)furLayerEnabled=!!cfg.furEnabled;if(cfg.furDebug!==undefined)furDebugEnabled=!!cfg.furDebug;return{autoExpression,autoBlink,manualGazeYaw,manualGazePitch,manualEarLeft,manualEarRight,manualBlink,corneaResponse,pupilAdapt,furStrength,eyeLayerEnabled,blinkLayerEnabled,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,furDebugEnabled}};
window.__CAT_V440_SET_CAMERA_TARGET__='''
    text = regex_replace_once(text, api_pattern, api_replacement, "expression public API", flags=re.S)

    text = replace_once(
        text,
        "regionalRefinement:true,poseTargetNormals:true,earBones:true,proceduralEye:true,shortFurDirectionField:true",
        "regionalRefinement:true,poseTargetNormals:true,earBones:true,proceduralEye:true,proceduralEyelid:true,deterministicBlink:true,cornealResponse:true,pupilAdaptation:true,shortFurDirectionField:true",
        "feature stats",
    )

    text = text.replace("__CAT_V440_", "__CAT_V441_")
    text = replace_once(
        text,
        "window.__CAT_V441_RENDER_STATE__='eye-ear-short-fur'",
        "window.__CAT_V441_RENDER_STATE__='eyelid-cornea-response'",
        "render state",
    )
    text = replace_once(
        text,
        "window.__CAT_V441_SET_CAMERA_TARGET__=(x,y,z,zoom=1)=>",
        "window.__CAT_V441_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',payload:'CATV440'};window.__CAT_V441_SET_CAMERA_TARGET__=(x,y,z,zoom=1)=>",
        "baseline API",
    )
    return text


def write_current_metadata(output_text: str, source_payload_sha: str) -> None:
    current = json.loads(CURRENT_JSON.read_text(encoding="utf-8"))
    current["date"] = "2026-09-15"
    current["currentVersion"] = "V4.41"
    current["currentEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["repoOverlayEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["sourceHandoff"] = current.get("handoff", "CAT_KAOPU_CURRENT_FULL_HANDOFF_V440_2026-09-15")
    current["currentLayer"] = "procedural eyelid aperture + deterministic blink + corneal wet response + pupil adaptation"
    current["frozenBaselines"]["expressionPayload"] = "V4.40 CATV440 payload and 34-bone rig unchanged"
    current["runtimeDependencies"] = {"externalModel": False, "externalTexture": False, "externalAnimation": False}
    current["acceptance"] = {
        "surfaceUserAccepted": True,
        "visualAcceptance": False,
        "productionReady": False,
        "userReviewRequired": True,
    }
    current["technicalInvariants"] = {
        "embeddedPayloadSha256": sha256_bytes(embedded_payload(output_text)),
        "sourcePayloadSha256": source_payload_sha,
        "payloadUnchangedFromV440": sha256_bytes(embedded_payload(output_text)) == source_payload_sha,
        "boneCount": 34,
        "neutralSurfaceChanged": False,
        "skinWeightsChanged": False,
    }
    current["nextProductionGate"] = [
        "visual review of eyelid aperture from front, three-quarter and side views",
        "replace shader-only lid with bounded geometric lid volume only after the frozen silhouette remains intact",
        "bounded ear-root corrective for larger ear poses",
        "repair V4.39 sit/lie paw and chest-abdomen support before silhouette fur",
        "short-fur silhouette only after joint folds remain visible and validated",
    ]
    current["github"]["existingBranch"] = "codex/cat-kaopu-v440-mainline-20260915"
    current["github"]["recommendedNewBranch"] = "codex/cat-kaopu-v440-mainline-20260915"
    CURRENT_JSON.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    README.write_text(
        """# Cat Kaopu module — V4.41 working baseline

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.41 builder: `tools/build_cat_v441_eyelid_cornea.py`

V4.40 frozen source: `baselines/v4.40/CAT_KAOPU_V440_EYE_EAR_SHORT_FUR_WORKBENCH_2026-09-15.html`

Run module verification:

```bash
python tools/verify_cat_kaopu_module.py
```

V4.41 adds a shader-only eyelid aperture, deterministic blink, corneal wet response and pupil adaptation. It does not alter the V4.32 neutral surface, the V4.40 binary payload, the 34-bone rig or skin weights. The procedural lid is an intermediate visual layer, not a finished geometric eyelid.

Do not modify the frozen V4.32 neutral surface to repair animation, ear-root, eye, eyelid or fur issues. `visualAcceptance=false` and `productionReady=false` remain in force until user review.
""",
        encoding="utf-8",
    )


def write_reports(source_text: str, output_text: str) -> None:
    source_payload = embedded_payload(source_text)
    output_payload = embedded_payload(output_text)
    source_rig, _ = extract_json_constant(source_text, "RIG", "LIB")
    output_rig, _ = extract_json_constant(output_text, "RIG", "LIB")
    checks = {
        "schema": "cat_kaopu/v441_technical_qa@1.0",
        "version": "V4.41",
        "sourceBaseline": str(BASELINE.relative_to(MODULE_ROOT)),
        "outputWorkbench": str(CURRENT_HTML.relative_to(MODULE_ROOT)),
        "sourceHtmlSha256": sha256_bytes(source_text.encode("utf-8")),
        "outputHtmlSha256": sha256_bytes(output_text.encode("utf-8")),
        "sourcePayloadSha256": sha256_bytes(source_payload),
        "outputPayloadSha256": sha256_bytes(output_payload),
        "payloadByteIdentical": source_payload == output_payload,
        "rigJsonIdentical": source_rig == output_rig,
        "boneCount": len(output_rig.get("bones", [])),
        "requiredMarkers": {
            "readyApi": "__CAT_V441_READY__" in output_text,
            "lidUniform": "uniform float uLidEnabled" in output_text,
            "blinkUniform": "uniform float uBlink" in output_text,
            "corneaUniform": "uniform float uCornea" in output_text,
            "pupilUniform": "uniform float uPupilAdapt" in output_text,
            "blinkAction": '"id":"blink_check"' in output_text,
            "blinkControl": 'id="blinkAmount"' in output_text,
            "corneaControl": 'id="corneaResponse"' in output_text,
        },
        "runtimeDependencies": {"externalModel": False, "externalTexture": False, "externalAnimation": False},
        "visualAcceptance": False,
        "productionReady": False,
    }
    if not checks["payloadByteIdentical"]:
        raise RuntimeError("V4.41 changed the V4.40 binary payload")
    if not checks["rigJsonIdentical"]:
        raise RuntimeError("V4.41 changed the V4.40 rig")
    if checks["boneCount"] != 34:
        raise RuntimeError(f"expected 34 bones, found {checks['boneCount']}")
    if not all(checks["requiredMarkers"].values()):
        raise RuntimeError(f"missing V4.41 marker: {checks['requiredMarkers']}")
    QA_TECHNICAL.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    DOC_REPORT.write_text(
        f"""# CAT KAOPU V4.41 执行报告

## 本轮目标

在不改变 V4.32 中性整猫表面、不改变 V4.40 `CATV440` 二进制载荷与 34 骨蒙皮、不覆盖 V4.39 坐卧修形和 V4.36 运动/接触回归的前提下，建立眼睑、眨眼、角膜和瞳孔的第一层可控表现。

## 实际实现

- 新增 `blink_check` 固定检查动作，身体保持中性，便于只观察眼部。
- 在眼球片元层增加上下眼睑开合遮罩，支持自动眨眼和 0–1 手动闭眼。
- 增加角膜湿润高光与边缘 Fresnel 响应，可单独关闭。
- 增加竖瞳宽度的暗处适应参数，不修改眼球几何。
- 增加工具栏、侧栏控制、KPI、公开 QA API 和版本化运行标记。
- 保留 V4.40 眼球、耳骨、短毛方向场和全部运动链。

## 冻结层验证

- V4.40 源载荷 SHA-256：`{sha256_bytes(source_payload)}`
- V4.41 输出载荷 SHA-256：`{sha256_bytes(output_payload)}`
- 二进制载荷逐字节一致：`true`
- `RIG` JSON 完全一致：`true`
- 骨骼数量：`34`

## 明确限制

V4.41 的“眼睑”是眼球片元层遮罩，不是独立几何眼睑；它没有真实眼睑厚度、眼睑边缘体积、眼眶压迫、第三眼睑或泪膜折射。角膜层是受限高光模型，不代表已完成真实折射。该层只适合验证开合节奏、控制接口和视觉方向，不能作为最终近距离眼部资产。

当前状态继续保持：`visualAcceptance=false`、`productionReady=false`。
""",
        encoding="utf-8",
    )

    DOC_REVIEW.write_text(
        """# CAT KAOPU V4.41 自检记录

## 已通过的结构检查

1. V4.40 嵌入载荷与 V4.41 嵌入载荷逐字节一致。
2. `RIG` JSON、34 根骨骼、耳骨索引和蒙皮权重未改变。
3. V4.32 中性表面、V4.39 坐卧修形与 V4.36 运动逻辑未被本构建器写入。
4. 自动眨眼、手动闭眼、角膜响应和瞳孔适应均有独立控制与公开 QA 接口。
5. 页面仍不读取外部模型、贴图或动画。

## 尚需浏览器视觉检查

1. 正面、三分之四和侧面视角下，闭眼遮罩是否与现有眼球位置协调。
2. 闭合边缘是否出现过硬直线、穿出眼球或左右眼不一致。
3. 角膜高光是否在强度 0–1 内保持受限，不应覆盖虹膜和竖瞳。
4. 眨眼动作是否破坏耳眼追踪、站立、坐姿、趴卧、直行与转向。

## 不能混淆的结论

“能够眨眼”不等于眼睑系统完成；当前没有几何眼皮和第三眼睑。“角膜响应存在”不等于真实角膜折射完成；当前仍是片元层近似。后续若建立几何眼睑，必须继续证明 V4.32 整猫轮廓和 V4.40 载荷没有被用来掩盖动作问题。
""",
        encoding="utf-8",
    )


def rebuild_manifest() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    manifest["schema"] = "cat_kaopu/module_build_manifest@1.1"
    manifest["version"] = "V4.41"
    manifest["buildId"] = "cat-kaopu-v441-eyelid-cornea-20260915"
    manifest["currentEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    manifest["runtimePayload"] = "runtime/cat_v440.bin"
    manifest["frozenBaselines"]["expressionPayload"] = "V4.40 CATV440 payload and 34-bone rig unchanged"
    manifest["visualAcceptance"] = False
    manifest["productionReady"] = False
    manifest["scope"] = [
        "procedural eyelid aperture",
        "deterministic blink",
        "corneal wet response",
        "pupil adaptation",
    ]
    files: list[dict[str, Any]] = []
    excluded_top = {"handoff"}
    for path in sorted(MODULE_ROOT.rglob("*")):
        if not path.is_file() or path == MANIFEST:
            continue
        rel = path.relative_to(MODULE_ROOT)
        if rel.parts and rel.parts[0] in excluded_top:
            continue
        if "__pycache__" in rel.parts or path.suffix in {".pyc", ".pyo"}:
            continue
        files.append({"path": rel.as_posix(), "bytes": path.stat().st_size, "sha256": sha256_file(path)})
    manifest["files"] = files
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    source_path = BASELINE if BASELINE.exists() else CURRENT_HTML
    source_text = source_path.read_text(encoding="utf-8")
    source_payload_sha = sha256_bytes(embedded_payload(source_text))
    output_text = build_html(source_text)

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    OUT_HTML.write_text(output_text, encoding="utf-8")
    CURRENT_HTML.write_text(output_text, encoding="utf-8")
    write_current_metadata(output_text, source_payload_sha)
    write_reports(source_text, output_text)
    rebuild_manifest()

    print(
        json.dumps(
            {
                "version": "V4.41",
                "source": str(source_path),
                "output": str(CURRENT_HTML),
                "htmlSha256": sha256_file(CURRENT_HTML),
                "payloadSha256": source_payload_sha,
                "payloadUnchanged": True,
                "visualAcceptance": False,
                "productionReady": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
