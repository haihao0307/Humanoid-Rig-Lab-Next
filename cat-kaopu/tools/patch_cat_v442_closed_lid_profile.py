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


text = BUILDER.read_text(encoding="utf-8")
changed = False

# The R15 evidence removed globe leakage, but the closed lid still read as a
# horizontal shelf.  Narrow the lower transition zone and let the upper lid
# carry more of the visible soft-tissue volume.
text, did = replace_once(
    text,
    "outerUpper:corner+.68*arc,outerLower:corner-.48*arc",
    "outerUpper:corner+.62*arc,outerLower:corner-.31*arc",
    "upper/lower orbital transition proportions",
)
changed |= did

# Do not flatten the moving lid normal into a frontal plate.  Retain the
# eye-following curvature while still damping the strongest spherical read.
text, did = replace_once(
    text,
    "innerN=normalize(mix(innerN,closeNormal,close*(1.-tt)*.58));",
    "innerN=normalize(mix(innerN,closeNormal,close*(1.-tt)*.28));",
    "closed-lid curved normal",
)
changed |= did

# Add a bounded convex profile to the upper lid; keep the lower lid shallow so
# it supports the closure without becoming a second rectangular plate.
text, did = replace_once(
    text,
    "p.x+=close*bandBulge*aRadius.x*(lid>0.?.055:.025);",
    "p.x+=close*bandBulge*aRadius.x*(lid>0.?.115:.018);",
    "upper-dominant convex lid profile",
)
changed |= did

# The old lower-lid brightness made the lower sheet look like a separate white
# shelf.  Keep both sheets close to the face material and use geometry, not a
# brightness split, to communicate upper/lower ordering.
text, did = replace_once(
    text,
    "base*=vLid>0.?.975:1.015;",
    "base*=vLid>0.?.965:.985;",
    "body-matched lid albedo",
)
changed |= did

if changed:
    BUILDER.write_text(text, encoding="utf-8")
    print(
        "patched V4.42 closed profile: narrower lower transition, curved "
        "upper-dominant volume and body-matched lid response"
    )
else:
    print("V4.42 closed-lid profile patch already complete")
