from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v442_geometric_eyelid.py"


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        print(f"{label}: already present")
        return text, False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    print(f"{label}: patched")
    return text.replace(old, new, 1), True


def replace_exact_count(
    text: str,
    old: str,
    new: str,
    expected: int,
    label: str,
) -> tuple[str, bool]:
    if old not in text and new in text:
        print(f"{label}: already present")
        return text, False
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} markers, found {count}")
    print(f"{label}: patched {count} markers")
    return text.replace(old, new), True


text = BUILDER.read_text(encoding="utf-8")
changed = False

# V4.41's accepted open-eye silhouette exposed only the central half of the
# eye sphere.  V4.42 originally used almost the whole sphere (hx ±1), which
# doubled the fissure width and made the lids read as detached bars.  Keep the
# outer shell spanning the orbit, but collapse the *inner* lid edge at bounded
# anatomical canthi (hx ±0.52).
old_curves = (
    "float hx=clamp(ex/.995,-1.,1.),q=sqrt(max(0.,1.-hx*hx)),"
    "side=sign(aCenter.y),lateral=hx*side,"
    "medial=smooth01((-lateral-.2)/.8),"
    "arc=pow(max(q,.0001),mix(.78,1.12,medial)),"
    "corner=-.025+.070*lateral+.012*(1.-q),"
    "upperOpen=corner+(.36-.02*lateral)*arc,"
    "lowerOpen=corner-(.17+.01*lateral)*arc,"
    "seamLine=corner-(.055-.015*lateral)*arc"
)
new_curves = (
    "float hx=clamp(ex/.995,-1.,1.),q=sqrt(max(0.,1.-hx*hx)),"
    "apx=hx/.52,apq=sqrt(max(0.,1.-apx*apx)),"
    "side=sign(aCenter.y),lateral=hx*side,"
    "medial=smooth01((-lateral-.2)/.8),"
    "arc=pow(apq,mix(.82,1.08,medial)),"
    "corner=-.025+.070*lateral+.012*(1.-q),"
    "upperOpen=corner+(.34-.02*lateral)*arc,"
    "lowerOpen=corner-(.28+.01*lateral)*arc,"
    "seamLine=corner-(.035-.010*lateral)*arc"
)
text, did = replace_once(
    text,
    old_curves,
    new_curves,
    "bounded palpebral aperture",
)
changed |= did

# Keep almost the complete transition sheet in front of the eye sphere.  The
# previous 0.72 fade released the lower band too early, revealing a black
# crescent between the lower lid and the frozen face surface.
text, did = replace_once(
    text,
    "sphereSafety=(1.-smoothstep(.72,.98,tt))*sphereInside",
    "sphereSafety=(1.-smoothstep(.90,.995,tt))*sphereInside",
    "eye-sphere safety reach",
)
changed |= did

# Both closed lids must remain outside the eye sphere.  The old negative lower
# offset pushed the lower lid behind the globe, so the dark eye surface leaked
# through even when blink=1.  Preserve upper-over-lower depth order while
# keeping both positive.
text, did = replace_exact_count(
    text,
    "p.x+=close*(lid>0.?uThicknessM*.46:-uThicknessM*.16)",
    "p.x+=close*(lid>0.?uThicknessM*.34:uThicknessM*.18)",
    2,
    "closed-lid depth order",
)
changed |= did

# The outer band is already ray-fitted to the frozen head surface.  Fade only
# across the final six percent so it fills the socket instead of becoming
# transparent over an otherwise open hole.
text, did = replace_once(
    text,
    "float edgeAlpha=1.-smoothstep(.60,1.,vBand);",
    "float edgeAlpha=1.-smoothstep(.94,1.,vBand);",
    "outer orbital opacity",
)
changed |= did

if changed:
    BUILDER.write_text(text, encoding="utf-8")
    print(
        "patched V4.42 eyelids: bounded fissure width, sealed lower lid, "
        "longer eye-sphere safety and opaque orbital bridge"
    )
else:
    print("V4.42 aperture integration patch already complete")
