from __future__ import annotations

from pathlib import Path

WORKBENCH = Path(__file__).resolve().parent.parent / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


text = WORKBENCH.read_text(encoding="utf-8")
if "__CAT_V444_PERIORBITAL_GEOMETRY__" in text:
    print("V4.44 controls/API already present")
    raise SystemExit(0)

text = replace_once(
    text,
    "layerSlider('#lidThickness',v=>lidThickness=v,v=>(v*1000).toFixed(2)+' mm');layerSlider('#corneaResponse',v=>corneaResponse=v);",
    "layerSlider('#lidThickness',v=>lidThickness=v,v=>(v*1000).toFixed(2)+' mm');layerSlider('#patchStrength',v=>patchStrength=v);layerSlider('#creaseStrength',v=>creaseStrength=v);layerSlider('#corneaResponse',v=>corneaResponse=v);",
    "slider runtime",
)
text = replace_once(
    text,
    "$('#kLid').textContent=(blinkLayerEnabled?'4 片 / ':'关闭 / ')+(lidThickness*1000).toFixed(2)+' mm';$('#kCornea')",
    "$('#kLid').textContent=(blinkLayerEnabled?'2 片 / ':'关闭 / ')+(lidThickness*1000).toFixed(2)+' mm';$('#kPatch').textContent=patchStrength.toFixed(2)+' / '+creaseStrength.toFixed(2);$('#kCornea')",
    "KPI runtime",
)
text = replace_once(
    text,
    "expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},eyelidGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,vertices:lidMesh.vertices,triangles:lidMesh.triangles,headBoneIndex},camera:",
    "expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,patchStrength,creaseStrength,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},periorbitalGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,patchStrength,creaseStrength,vertices:periMesh.vertices,triangles:periMesh.triangles,pieces:periMesh.pieces,headBoneIndex},camera:",
    "metrics",
)
text = replace_once(
    text,
    "proceduralEyelid:false,geometricEyelidVolume:true,geometricEyelidPieces:4,geometricEyelidVertices:lidMesh.vertices,geometricEyelidTriangles:lidMesh.triangles,deterministicBlink:true",
    "proceduralEyelid:false,geometricEyelidVolume:false,continuousPeriorbitalPatch:true,continuousPeriorbitalPieces:periMesh.pieces,continuousPeriorbitalVertices:periMesh.vertices,continuousPeriorbitalTriangles:periMesh.triangles,legacyV442EyelidAvailable:true,deterministicBlink:true",
    "stats",
)
text = replace_once(
    text,
    "if(cfg.lidThickness!==undefined)lidThickness=Math.max(.00015,Math.min(.00075,+cfg.lidThickness));if(cfg.lidDebug!==undefined)lidDebugEnabled=!!cfg.lidDebug;if(cfg.cornea!==undefined)",
    "if(cfg.lidThickness!==undefined)lidThickness=Math.max(.00015,Math.min(.00075,+cfg.lidThickness));if(cfg.lidDebug!==undefined)lidDebugEnabled=!!cfg.lidDebug;if(cfg.patchStrength!==undefined)patchStrength=Math.max(0,Math.min(1,+cfg.patchStrength));if(cfg.creaseStrength!==undefined)creaseStrength=Math.max(0,Math.min(1,+cfg.creaseStrength));if(cfg.cornea!==undefined)",
    "setter inputs",
)
text = replace_once(
    text,
    "manualBlink,lidThickness,lidDebugEnabled,corneaResponse",
    "manualBlink,lidThickness,lidDebugEnabled,patchStrength,creaseStrength,corneaResponse",
    "setter return",
)

text = text.replace("__CAT_V442_", "__CAT_V444_")
text = replace_once(
    text,
    "window.__CAT_V444_RENDER_STATE__='bounded-geometric-eyelid-volume'",
    "window.__CAT_V444_RENDER_STATE__='continuous-periorbital-aperture-carrier'",
    "render state",
)
text = replace_once(
    text,
    "window.__CAT_V444_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',payload:'CATV440'};window.__CAT_V444_EYELID_GEOMETRY__=",
    "window.__CAT_V444_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',legacyGeometricEyelid:'V4.42',orbitalExperiment:'V4.43',payload:'CATV440'};window.__CAT_V444_PERIORBITAL_GEOMETRY__={pieces:periMesh.pieces,vertices:periMesh.vertices,triangles:periMesh.triangles,fitMode:periMesh.fitMode,headBoneIndex,source:'continuous-annular-frozen-head-sampled-carrier'};window.__CAT_V444_EYELID_GEOMETRY__=",
    "baseline API",
)

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.44 controls, metrics, statistics and public API")
