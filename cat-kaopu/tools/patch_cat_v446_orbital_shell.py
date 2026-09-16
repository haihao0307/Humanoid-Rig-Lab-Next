from __future__ import annotations

from pathlib import Path

BUILDER = Path(__file__).resolve().parent / "build_cat_v446_wide_eye_region.py"
text = BUILDER.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if new in text:
        print(f"{label}: already present")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one marker, found {count}")
    text = text.replace(old, new, 1)
    print(f"{label}: patched")


replace_once(
    "float eyeR=sqrt(pow(hy/.95,2.)+pow((vz-.03)/1.28,2.)),nearEye=1.-smoothstep(.72,1.62,eyeR),insideShell=step(hy*hy+vz*vz,1.12),shellX=ec.x+er.x*sqrt(max(.0008,1.-min(.999,hy*hy+vz*vz)))*(1.015+uThicknessM/max(er.x,.0001));p.x=mix(p.x,max(p.x,shellX),nearEye*insideShell*.72*field);",
    "float eyeR=sqrt(pow(hy/.92,2.)+pow((vz-.02)/1.22,2.)),nearEye=(1.-smoothstep(.70,1.42,eyeR))*(1.-smoothstep(1.02,1.28,abs(hy))),shy=hy/1.28,shz=(vz-.02)/1.44,shellR2=shy*shy+shz*shz,insideShell=1.-smoothstep(.88,1.18,shellR2),orbitalX=ec.x+er.x*(1.075-.205*min(shellR2,1.25))+uThicknessM*.36,shellBlend=nearEye*insideShell*field*.96;vec3 shellN=normalize(vec3(1.,.33*hy,.25*(vz-.02)));p.x=mix(p.x,max(p.x,orbitalX),shellBlend);n=normalize(mix(n,shellN,shellBlend*.88));",
    "analytic orbital shell and normal",
)
replace_once(
    "float brow=exp(-pow(hy/1.38,2.)-pow((vz-1.62)/.70,2.))*nearEye,cheek=exp(-pow((abs(hy)-1.10)/.86,2.)-pow((vz+1.42)/.82,2.))*nearEye,nose=exp(-pow(p.y/.0135,2.)-pow((p.z-(.5*(uEyeL.z+uEyeR.z)+.006))/.030,2.));",
    "float brow=exp(-pow(hy/1.18,2.)-pow((vz-1.36)/.62,2.))*nearEye,cheek=exp(-pow((abs(hy)-.90)/.70,2.)-pow((vz+1.12)/.70,2.))*nearEye,nose=exp(-pow(p.y/.0125,2.)-pow((p.z-(.5*(uEyeL.z+uEyeR.z)+.008))/.027,2.));",
    "localized brow nose cheek fields",
)
replace_once(
    "float edgeDist=min(abs(vz-upper),abs(vz-lower)),lidBand=(1.-smoothstep(.07,.34,edgeDist))*nearEye,upperField=smoothstep(lower-.002,upper+.002,vz);",
    "float edgeDist=min(abs(vz-upper),abs(vz-lower)),lidBand=(1.-smoothstep(.055,.26,edgeDist))*nearEye,upperField=smoothstep(lower-.002,upper+.002,vz);",
    "narrow lid support",
)
replace_once(
    "float closed=smoothstep(.68,.98,blink),seamBand=(1.-smoothstep(.035,.24,abs(vz-seam)))*nearEye*closed;",
    "float closed=smoothstep(.70,.985,blink),seamBand=(1.-smoothstep(.025,.145,abs(vz-seam)))*nearEye*closed;",
    "localized closed seam",
)
replace_once(
    "bool inAperture=abs(hx)<.59&&vz>lower+.012&&vz<upper-.012&&vNearEye>.08;",
    "bool inAperture=abs(hx)<.62&&vz>lower+.010&&vz<upper-.010&&vNearEye>.10;",
    "aperture bounds",
)
replace_once(
    "rim=(1.-smoothstep(.018,.085,edgeDist))*vNearEye,closed=smoothstep(.72,.98,vBlink),seamBand=(1.-smoothstep(.018,.095,abs(vz-seam)))*vNearEye*closed;",
    "rim=(1.-smoothstep(.014,.060,edgeDist))*vNearEye,closed=smoothstep(.72,.985,vBlink),seamBand=(1.-smoothstep(.012,.070,abs(vz-seam)))*vNearEye*closed;",
    "fragment rim and seam locality",
)
replace_once(
    "base*=1.-.18*rim;base*=1.-.52*seamBand*uCreaseStrength;",
    "base*=1.-.10*rim;base*=1.-.38*seamBand*uCreaseStrength;",
    "subtle rim and single seam response",
)
replace_once(
    "float wet=(1.-smoothstep(.008,.045,edgeDist))*vNearEye*(1.-closed);",
    "float wet=(1.-smoothstep(.006,.032,edgeDist))*vNearEye*(1.-closed);",
    "localized wet rim",
)

BUILDER.write_text(text, encoding="utf-8")
print("patched V4.46 orbital shell: convex socket fill, analytic normals and local seams")
