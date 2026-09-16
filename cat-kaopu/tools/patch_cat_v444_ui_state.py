from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKBENCH = ROOT / "workbench/CAT_KAOPU_CURRENT.html"


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
if "CAT KAOPU V4.44" in text:
    print("V4.44 UI already present")
    raise SystemExit(0)
if "CAT KAOPU V4.42" not in text or "__CAT_V442_READY__" not in text:
    raise SystemExit("V4.42 source markers missing")

library, start, end = extract_json(text, "LIB", "canvas")
library["behavior"]["version"] = "V4.44"
library["behavior"]["boundary"] = (
    "Deterministic preview only. V4.44 preserves the V4.32 neutral body surface, V4.40 CATV440 "
    "payload, 34-bone rig, V4.39 posture correctives and V4.36 locomotion/contact. It replaces the "
    "default four-strip eyelid presentation with one continuous annular periorbital carrier per eye. "
    "The two runtime patches are head-bone-driven and never write back to CATV440."
)
text = text[:start] + json.dumps(library, ensure_ascii=False, separators=(",", ":")) + text[end:]

text = replace_once(
    text,
    "<title>CAT KAOPU V4.42 · 受限几何眼睑体积第一层</title>",
    "<title>CAT KAOPU V4.44 · 双眼连续眶周载体第一阶段</title>",
    "title",
)
text = replace_once(
    text,
    'alt="V4.42 受限几何眼睑体积第一层静态回退"',
    'alt="V4.44 双眼连续眶周载体第一阶段静态回退"',
    "fallback alt",
)
text = replace_once(text, "<aside><h1>CAT KAOPU V4.42</h1>", "<aside><h1>CAT KAOPU V4.44</h1>", "heading")
text = replace_once(
    text,
    "V4.32 冻结整猫表面 → V4.40 耳眼/短毛 → V4.41 片元眼睑 → V4.42 受限几何眼睑体积",
    "V4.32 冻结整猫表面 → V4.42 四片眼睑 → V4.43 过渡壳实验 → V4.44 双眼连续眶周载体",
    "lineage",
)
text = replace_once(
    text,
    '<span class="tag good">受限几何眼睑</span><span class="tag good">眼缘厚度</span>',
    '<span class="tag good">连续眶周载体</span><span class="tag good">双眼各一片</span><span class="tag good">连续内外眼角</span><span class="tag good">眼缘厚度</span>',
    "tags",
)
text = replace_once(
    text,
    '<button class="active" id="blinkLayer">几何眼睑</button><button id="lidDebug">眼睑检查</button>',
    '<button class="active" id="blinkLayer">连续眶周</button><button id="lidDebug">眶周检查</button>',
    "toolbar",
)
text = replace_once(
    text,
    '<button class="active" id="blinkToggle">几何眼睑</button><button id="lidDebugToggle">眼睑检查</button>',
    '<button class="active" id="blinkToggle">连续眶周</button><button id="lidDebugToggle">眶周检查</button>',
    "aside buttons",
)
text = replace_once(
    text,
    '<label><span>眼缘厚度</span><input id="lidThickness" max="0.00075" min="0.00015" step="0.00005" type="range" value="0.00042"/><output>0.42 mm</output></label>',
    '<label><span>眼缘厚度</span><input id="lidThickness" max="0.00075" min="0.00015" step="0.00005" type="range" value="0.00042"/><output>0.42 mm</output></label><label><span>眶周融合</span><input id="patchStrength" max="1" min="0" step="0.05" type="range" value="0.86"/><output>0.86</output></label><label><span>闭眼褶皱</span><input id="creaseStrength" max="1" min="0" step="0.05" type="range" value="0.52"/><output>0.52</output></label>',
    "sliders",
)
text = replace_once(
    text,
    "耳朵继续使用 V4.40 的两根代码骨和局部权重；眼球仍是 V4.40 轻量球体。V4.42 在二进制猫体之外生成左右眼各一组上、下眼睑壳体，由头骨矩阵带动并以真实厚度参数闭合；原猫体顶点、眼球顶点、34 骨与蒙皮权重均不改。当前仍未包含第三眼睑、泪膜折射和眼眶软组织挤压。",
    "耳朵和眼球继续沿用 V4.40。V4.44 不再默认渲染上、下四片独立眼睑条带，而是为左右眼各生成一张连续环形眶周载体；内边界形成可眨动睑裂，外边界采样冻结眉弓、鼻根和面颊，内外眼角天然属于同一拓扑。原猫体、眼球、34 骨与蒙皮权重均不改。",
    "layer note",
)
text = replace_once(
    text,
    '<div class="kpi"><b>几何眼睑</b><span id="kLid">4 片 / 0.42 mm</span></div><div class="kpi"><b>角膜 / 瞳孔</b>',
    '<div class="kpi"><b>连续眶周</b><span id="kLid">2 片 / 0.42 mm</span></div><div class="kpi"><b>融合 / 褶皱</b><span id="kPatch">0.86 / 0.52</span></div><div class="kpi"><b>角膜 / 瞳孔</b>',
    "KPI",
)
text = replace_once(
    text,
    "本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。新增内容是独立的四片受限程序化眼睑壳体和眼缘厚度；它们只读取头骨矩阵，不写回主体几何。第三眼睑、真实泪膜折射、眼眶软组织挤压、胡须和轮廓毛束仍未完成。",
    "本轮继续冻结 V4.32 中性猫体、V4.40 二进制载荷与 34 骨权重、V4.39 坐卧修形及 V4.36 运动接触。新增内容是左右眼各一张连续眶周载体，载体只读取冻结头脸采样和 head 骨矩阵，不写回主体几何。V4.42/V4.43 保留为历史基线但不作为默认渲染层。第三眼睑、泪膜折射、胡须和轮廓毛束仍未开始。",
    "scope",
)
text = replace_once(
    text,
    "先检查“几何眼睑 / 角膜检查”：正面、三分之四和侧面下，上眼睑应承担主要闭合行程，下眼睑只小幅上提；闭眼不得露出虹膜，也不能形成贴在眼球上的灰色圆片。再调节眼缘厚度和检查色，确认壳体不穿出头脸轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。",
    "先在眼部近景检查开眼、半闭和完全闭眼：内外眼角应保持连续，不能再出现上、下眼睑条带的矩形端头；完全闭眼时上眼睑承担主要行程，下眼睑只提供支撑。再调节眶周融合、闭眼褶皱和检查色，确认外边界始终回到冻结头脸且不改变头部轮廓。最后回归站立、坐姿、趴卧、直行、转向与耳眼追踪。",
    "test note",
)
text = replace_once(
    text,
    "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
    "let autoExpression=true,autoBlink=true,eyeLayerEnabled=true,blinkLayerEnabled=true,lidDebugEnabled=false,corneaLayerEnabled=true,earLayerEnabled=true,furLayerEnabled=true,furDebugEnabled=false,manualGazeYaw=0,manualGazePitch=0,manualEarLeft=0,manualEarRight=0,manualBlink=0,lidThickness=.00042,patchStrength=.86,creaseStrength=.52,corneaResponse=.82,pupilAdapt=.42,furStrength=.72;",
    "state",
)

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.44 UI, scope and continuous-periorbital state")
