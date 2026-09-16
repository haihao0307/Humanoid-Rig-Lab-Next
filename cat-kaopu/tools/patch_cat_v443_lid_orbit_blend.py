from __future__ import annotations

from pathlib import Path

WORKBENCH = Path(__file__).resolve().parent.parent / "workbench/CAT_KAOPU_CURRENT.html"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


text = WORKBENCH.read_text(encoding="utf-8")
if "float lowerFade=1.-.42" in text:
    print("V4.43 lid/orbit blend already present")
    raise SystemExit(0)

# V4.42 kept almost the entire eyelid strip opaque to hide eye-sphere leakage.
# V4.43 has an explicit orbital transition shell behind it, so the outer half
# can now fade into that shell instead of reading as a rectangular plug.
text = replace_once(
    text,
    "float edgeAlpha=1.-smoothstep(.94,1.,vBand);",
    "float edgeAlpha=1.-smoothstep(.52,.90,vBand);float lowerFade=1.-.42*smoothstep(.62,.98,vClosure)*(1.-step(0.,vLid));",
    "earlier eyelid outer fade",
)
text = replace_once(
    text,
    "outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),uDebug>.5?1.:edgeAlpha);",
    "outColor=vec4(pow(max(col,vec3(0.)),vec3(1./2.2)),uDebug>.5?1.:edgeAlpha*lowerFade);",
    "closed lower-lid fade",
)

# Extend the orbital shell farther toward the sampled head surface so it fills
# the area uncovered by the eyelid fade, while keeping the outermost row fully
# transparent and preserving the frozen silhouette.
text = replace_once(
    text,
    "float alpha=uDebug>.5?1.:clamp(uStrength*(1.-smoothstep(.76,1.,vBand))*vCanthus,0.,.94);",
    "float alpha=uDebug>.5?1.:clamp(uStrength*(.62+.38*uStrength)*(1.-smoothstep(.88,1.,vBand))*vCanthus,0.,.96);",
    "orbital bridge alpha",
)

WORKBENCH.write_text(text, encoding="utf-8")
print("patched V4.43 lid/orbit blend: shorter visible lid strip, softer lower lid and longer orbital bridge")
