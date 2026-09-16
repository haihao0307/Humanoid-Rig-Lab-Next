from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v442_geometric_eyelid.py"

OLD = (
    "float openInner=lid>0.?(.42*q):(-.20*q);"
    "float seam=-.08*q;"
    "float lidClose=lid>0.?close:pow(close,1.28);"
    "float inner=mix(openInner,seam,lidClose);"
    "float outer=(lid>0.?.96:-.92)*q;"
    "float tt=smoothstep(0.,1.,t);"
    "float ey=mix(inner,outer,tt);"
    "float ef=sqrt(max(.0001,1.-ex*ex-ey*ey));"
    "float rMean=max(.0001,(aRadius.x+aRadius.y+aRadius.z)/3.);"
    "float frontScale=1.+uThicknessM/rMean;"
    "float surfaceScale=mix(frontScale,1.006,tt);"
    "float shell=aParam.w<.5?surfaceScale:(aParam.w<1.5?frontScale:1.003);"
    "vec3 dir=normalize(vec3(ef,ex,ey));"
    "vec3 p=aCenter+aRadius*dir*shell;"
)

NEW = (
    "float side=sign(aCenter.y),medial=ex*side;"
    "float openInner=lid>0.?((.39-.025*medial)*q):((-.16-.015*medial)*q);"
    "float seamCenter=(-.018+.030*medial)*q;"
    "float seam=seamCenter+(lid>0.?-.012:.012)*q;"
    "float lidClose=lid>0.?smoothstep(0.,1.,close):pow(close,1.18);"
    "float inner=mix(openInner,seam,lidClose);"
    "float outer=(lid>0.?.82:-.72)*q;"
    "float tt=smoothstep(0.,1.,t);"
    "float ey=mix(inner,outer,tt);"
    "float sphereEf=sqrt(max(.0001,1.-ex*ex-ey*ey));"
    "float flatten=.10*close*(1.-.62*tt)*q*q;"
    "float ef=max(.08,sphereEf-flatten);"
    "float rMean=max(.0001,(aRadius.x+aRadius.y+aRadius.z)/3.);"
    "float frontScale=1.+uThicknessM/rMean;"
    "float surfaceScale=mix(frontScale,.985,tt);"
    "float shell=aParam.w<.5?surfaceScale:(aParam.w<1.5?frontScale:.982);"
    "vec3 dir=vec3(ef,ex,ey);"
    "vec3 p=aCenter+aRadius*dir*shell;"
    "p.x+=close*(lid>0.?uThicknessM*.35:-uThicknessM*.15)*(1.-tt);"
)

text = BUILDER.read_text(encoding="utf-8")
if NEW in text:
    print("V4.42 orbital-fit eyelid patch already present")
elif text.count(OLD) != 1:
    raise SystemExit(f"expected exactly one V4.42 eyelid shader marker, found {text.count(OLD)}")
else:
    BUILDER.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")
    print("patched V4.42 eyelids: tucked outer orbit, asymmetric closure seam and reduced spherical bulge")
