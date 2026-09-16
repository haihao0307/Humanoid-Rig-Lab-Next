from __future__ import annotations

from pathlib import Path

WORKBENCH = Path(__file__).resolve().parent.parent / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


text = WORKBENCH.read_text(encoding="utf-8")
if "__CAT_V443_ORBITAL_GEOMETRY__" in text:
    print("V4.43 orbital controls/API already present")
    raise SystemExit(0)

text = replace_once(
    text,
    "layerSlider('#lidThickness',v=>lidThickness=v,v=>(v*1000).toFixed(2)+' mm');layerSlider('#corneaResponse',v=>corneaResponse=v);",
    "layerSlider('#lidThickness',v=>lidThickness=v,v=>(v*1000).toFixed(2)+' mm');layerSlider('#orbitStrength',v=>orbitStrength=v);layerSlider('#orbitCompression',v=>orbitCompression=v);layerSlider('#corneaResponse',v=>corneaResponse=v);",
    "slider runtime",
)
text = replace_once(
    text,
    "$('#lidDebugToggle').onclick=e=>{lidDebugEnabled=!lidDebugEnabled;e.currentTarget.classList.toggle('active',lidDebugEnabled)};$('#corneaToggle')",
    "$('#lidDebugToggle').onclick=e=>{lidDebugEnabled=!lidDebugEnabled;e.currentTarget.classList.toggle('active',lidDebugEnabled)};$('#orbitToggle').onclick=e=>{orbitLayerEnabled=!orbitLayerEnabled;e.currentTarget.classList.toggle('active',orbitLayerEnabled)};$('#orbitDebugToggle').onclick=e=>{orbitDebugEnabled=!orbitDebugEnabled;e.currentTarget.classList.toggle('active',orbitDebugEnabled)};$('#corneaToggle')",
    "button runtime",
)
text = replace_once(
    text,
    "$('#lidDebug').onclick=$('#lidDebugToggle').onclick;$('#corneaLayer')",
    "$('#lidDebug').onclick=$('#lidDebugToggle').onclick;$('#orbitLayer').onclick=$('#orbitToggle').onclick;$('#orbitDebug').onclick=$('#orbitDebugToggle').onclick;$('#corneaLayer')",
    "toolbar runtime",
)
text = replace_once(
    text,
    "$('#kLid').textContent=(blinkLayerEnabled?'4 片 / ':'关闭 / ')+(lidThickness*1000).toFixed(2)+' mm';$('#kCornea')",
    "$('#kLid').textContent=(blinkLayerEnabled?'4 片 / ':'关闭 / ')+(lidThickness*1000).toFixed(2)+' mm';$('#kOrbit').textContent=(orbitLayerEnabled?'4 片 / ':'关闭 / ')+orbitStrength.toFixed(2)+' / '+orbitCompression.toFixed(2);$('#kCornea')",
    "KPI runtime",
)
text = replace_once(
    text,
    "expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},eyelidGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,vertices:lidMesh.vertices,triangles:lidMesh.triangles,headBoneIndex},camera:",
    "expression:{...expressionState,autoBlink,eyeLayerEnabled,blinkLayerEnabled,lidDebugEnabled,lidThickness,orbitLayerEnabled,orbitDebugEnabled,orbitStrength,orbitCompression,corneaLayerEnabled,earLayerEnabled,furLayerEnabled,corneaResponse,pupilAdapt,furStrength,furDebugEnabled},eyelidGeometry:{enabled:blinkLayerEnabled,debug:lidDebugEnabled,thicknessM:lidThickness,vertices:lidMesh.vertices,triangles:lidMesh.triangles,headBoneIndex},orbitalTissue:{enabled:orbitLayerEnabled,debug:orbitDebugEnabled,strength:orbitStrength,compression:orbitCompression,vertices:orbitMesh.vertices,triangles:orbitMesh.triangles,pieces:orbitMesh.pieces,headBoneIndex},camera:",
    "metrics",
)
text = replace_once(
    text,
    "geometricEyelidTriangles:lidMesh.triangles,deterministicBlink:true",
    "geometricEyelidTriangles:lidMesh.triangles,orbitalSoftTissueTransition:true,orbitalPieces:orbitMesh.pieces,orbitalVertices:orbitMesh.vertices,orbitalTriangles:orbitMesh.triangles,deterministicBlink:true",
    "stats",
)
text = replace_once(
    text,
    "if(cfg.lidDebug!==undefined)lidDebugEnabled=!!cfg.lidDebug;if(cfg.cornea!==undefined)",
    "if(cfg.lidDebug!==undefined)lidDebugEnabled=!!cfg.lidDebug;if(cfg.orbitEnabled!==undefined)orbitLayerEnabled=!!cfg.orbitEnabled;if(cfg.orbitDebug!==undefined)orbitDebugEnabled=!!cfg.orbitDebug;if(cfg.orbitStrength!==undefined)orbitStrength=Math.max(0,Math.min(1,+cfg.orbitStrength));if(cfg.orbitCompression!==undefined)orbitCompression=Math.max(0,Math.min(1,+cfg.orbitCompression));if(cfg.cornea!==undefined)",
    "setter inputs",
)
text = replace_once(
    text,
    "manualBlink,lidThickness,lidDebugEnabled,corneaResponse",
    "manualBlink,lidThickness,lidDebugEnabled,orbitLayerEnabled,orbitDebugEnabled,orbitStrength,orbitCompression,corneaResponse",
    "setter return",
)

# Rename public runtime markers only after V4.42-specific patch anchors are gone.
text = text.replace("__CAT_V442_", "__CAT_V443_")
text = replace_once(
    text,
    "window.__CAT_V443_RENDER_STATE__='bounded-geometric-eyelid-volume'",
    "window.__CAT_V443_RENDER_STATE__='orbital-soft-tissue-transition'",
    "render state",
)
text = replace_once(
    text,
    "window.__CAT_V443_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',payload:'CATV440'};window.__CAT_V443_EYELID_GEOMETRY__=",
    "window.__CAT_V443_BASELINE__={surface:'V4.32',weights:'V4.40',posture:'V4.39',locomotion:'V4.36',eyeExpression:'V4.41',geometricEyelid:'V4.42',payload:'CATV440'};window.__CAT_V443_ORBITAL_GEOMETRY__={pieces:orbitMesh.pieces,vertices:orbitMesh.vertices,triangles:orbitMesh.triangles,fitMode:orbitMesh.fitMode,headBoneIndex,source:'frozen-head-sampled-performance-deform-shell'};window.__CAT_V443_EYELID_GEOMETRY__=",
    "baseline API",
)

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.43 orbital controls, metrics, statistics and public API")
