from __future__ import annotations

import json
from pathlib import Path

MODULE_ROOT = Path(__file__).resolve().parent.parent
WORKBENCH = MODULE_ROOT / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


def extract_json(text: str, name: str, next_name: str) -> tuple[dict, int, int]:
    start_token = f"const {name}="
    end_token = f";\nconst {next_name}="
    start = text.index(start_token) + len(start_token)
    end = text.index(end_token, start)
    return json.loads(text[start:end]), start, end


text = WORKBENCH.read_text(encoding="utf-8")
if "CAT KAOPU V4.43" in text:
    print("V4.43 UI already present")
    raise SystemExit(0)
if "CAT KAOPU V4.42" not in text or "__CAT_V442_READY__" not in text:
    raise SystemExit("V4.42 source markers missing")

library, start, end = extract_json(text, "LIB", "canvas")
library["behavior"]["version"] = "V4.43"
library["behavior"]["boundary"] = (
    "Deterministic preview only. V4.43 preserves the V4.32 neutral body surface, V4.40 CATV440 "
    "payload, 34-bone rig, V4.39 posture correctives, V4.36 locomotion/contact and V4.42 four-piece "
    "geometric eyelids. It adds a head-bone-driven orbital transition shell sampled from the frozen "
    "face surface; the shell is a bounded Performance Deform layer and never writes back to CATV440."
)
text = text[:start] + json.dumps(library, ensure_ascii=False, separators=(",", ":")) + text[end:]

text = replace_once(
    text,
    "<title>CAT KAOPU V4.42 · 受限几何眼睑体积第一层</title>",
    "<title>CAT KAOPU V4.43 · 眼眶软组织过渡层第一阶段</title>",
    "title",
)
text = replace_once(
    text,
    'alt="V4.42 受限几何眼睑体积第一层静态回退"',
    'alt="V4.43 眼眶软组织过渡层第一阶段静态回退"',
    "fallback alt",
)
text = replace_once(text, "<aside><h1>CAT KAOPU V4.42</h1>", "<aside><h1>CAT KAOPU V4.43</h1>", "heading")
text = replace_once(
    text,
    "V4.32 冻结整猫表面 → V4.40 耳眼/短毛 → V4.41 片元眼睑 → V4.42 受限几何眼睑体积",
    "V4.32 冻结整猫表面 → V4.42 几何眼睑 → V4.43 受限眼眶软组织过渡层",
    "lineage",
)
text = replace_once(
    text,
    '<span class="tag good">受限几何眼睑</span><span class="tag good">眼缘厚度</span>',
    '<span class="tag good">受限几何眼睑</span><span class="tag good">眼缘厚度</span><span class="tag good">眼眶过渡壳</span><span class="tag good">闭眼压缩场</span>',
    "tags",
)
text = replace_once(
    text,
    '<button class="active" id="blinkLayer">几何眼睑</button><button id="lidDebug">眼睑检查</button>',
    '<button class="active" id="blinkLayer">几何眼睑</button><button id="lidDebug">眼睑检查</button><button class="active" id="orbitLayer">眼眶过渡</button><button id="orbitDebug">眼眶检查</button>',
    "toolbar",
)
text = replace_once(
    text,
    '<button class="active" id="blinkToggle">几何眼睑</button><button id="lidDebugToggle">眼睑检查</button>',
    '<button class="active" id="blinkToggle">几何眼睑</button><button id="lidDebugToggle">眼睑检查</button><button class="active" id="orbitToggle">眼眶过渡</button><button id="orbitDebugToggle">眼眶检查</button>',
    "aside buttons",
)
text = replace_once(
    text,
    '<label><span>眼缘厚度</span><input id="lidThickness" max="0.00075" min="0.00015" step="0.00005" type="range" value="0.00042"/><output>0.42 mm</output></label>',
    '<label><span>眼缘厚度</span><input id="lidThickness" max="0.00075" min="0.00015" step="0.00005" type="range" value="0.00042"/><output>0.42 mm</output></label><label><span>眼眶过渡</span><input id="orbitStrength" max="1" min="0" step="0.05" type="range" value="0.78"/><output>0.78</output></label><label><span>闭眼压缩</span><input id="orbitCompression" max="1" min="0" step="0.05" type="range" value="0.55"/><output>0.55</output></label>',
    "sliders",
)
text = replace_once(
    text,
    "耳朵继续使用 V4.40 的两根代码骨和局部权重；眼球仍是 V4.40 轻量球体。V4.42 在二进制猫体之外生成左右眼各一组上、下眼睑壳体，由头骨矩阵带动并以真实厚度参数闭合；原猫体顶点、眼球顶点、34 骨与蒙皮权重均不改。当前仍未包含第三眼睑、泪膜折射和眼眶软组织挤压。",
    "耳朵和眼球继续沿用 V4.40；四片几何眼睑继续沿用 V4.42。V4.43 从冻结头脸表面采样左右眼上、下共四片眼眶过渡壳，在闭眼时只对眼睑邻近区域施加受限压缩和回弹，并向眉弓、鼻根与面颊逐渐衰减。它属于 Performance Deform 层，不修改 V4.32 表面、CATV440、34 骨或蒙皮权重。",
    "layer note",
)
text = replace_once(
    text,
    '<div class="kpi"><b>几何眼睑</b><span id="kLid">4 片 / 0.42 mm</span></div><div class="kpi"><b>角膜 / 瞳孔</b>',
    '<div class="kpi"><b>几何眼睑</b><span id="kLid">4 片 / 0.42 mm</span></div><div class="kpi"><b>眼眶过渡</b><span id="kOrbit">4 片 / 0.78</span></div><div class="kpi"><b>角膜 / 瞳孔</b>',
    "KPI",
)
text = replace_once(
    text,
    "本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。新增内容是独立的四片受限程序化眼睑壳体和眼缘厚度；它们只读取头骨矩阵，不写回主体几何。第三眼睑、真实泪膜折射、眼眶软组织挤压、胡须和轮廓毛束仍未完成。",
    "本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形、V4.36 运动接触和 V4.42 四片几何眼睑。新增内容是四片由 head 骨驱动、从冻结头脸采样的眼眶过渡壳。它只承担局部连续曲率和闭眼压缩过渡，不改变整猫轮廓。第三眼睑、真实泪膜折射、胡须和轮廓毛束仍未开始。",
    "scope",
)
text = replace_once(
    text,
    "先检查“几何眼睑 / 角膜检查”：正面、三分之四和侧面下，上眼睑应承担主要闭合行程，下眼睑只小幅上提；闭眼不得露出虹膜，也不能形成贴在眼球上的灰色圆片。再调节眼缘厚度和检查色，确认壳体不穿出头脸轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。",
    "先在眼部近景中分别检查开眼、半闭和完全闭眼；眼眶过渡层关闭时可看到 V4.42 独立盖板基线，开启后外缘应连续接入眉弓、鼻根和面颊。再切换眼眶检查色、过渡强度和闭眼压缩，确认修形只停留在局部眼眶且不改变头部外轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。",
    "test note",
)
text = replace_once(
    text,
    "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
    "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,orbitLayerEnabled=true,orbitDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,orbitStrength=.78,orbitCompression=.55,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
    "state",
)

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.43 UI, scope, controls and runtime state")
