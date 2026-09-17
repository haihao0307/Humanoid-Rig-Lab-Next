from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "cat-kaopu/body-bind-v1/index.html"
R0_CAPTURE = ROOT / "cat-kaopu/tools/capture_cat_body_bind_v1_r0.mjs"
R1_CAPTURE = ROOT / "cat-kaopu/tools/capture_cat_body_bind_v1_r1.mjs"

text = HTML.read_text(encoding="utf-8")

replacements = [
    ("CAT BODY BIND V1 R0 · 连续整猫身体候选", "CAT BODY BIND V1 R1 · 连续整猫身体候选"),
    ("CAT BODY BIND V1 · R0 整猫身体候选", "CAT BODY BIND V1 · R1 整猫身体候选"),
    ("<b>R0</b>：", "<b>R1</b>："),
    ("const bounds={minX:-.64,maxX:.54,minY:-.225,maxY:.225,minZ:-.025,maxZ:.57};const resolution=86;", "const bounds={minX:-.72,maxX:.56,minY:-.20,maxY:.20,minZ:-.025,maxZ:.60};const resolution=80;"),
]
for old, new in replacements:
    if new in text:
        continue
    if text.count(old) != 1:
        raise SystemExit(f"R1 marker missing or duplicated: {old[:64]}")
    text = text.replace(old, new, 1)

new_sdf = r'''function torsoSdf(x,y,z){
  const x0=-.245,x1=.225,xc=clamp(x,x0,x1),t=(xc-x0)/(x1-x0);
  const wp=Math.exp(-Math.pow((xc+.155)/.095,2)),wt=Math.exp(-Math.pow((xc-.105)/.105,2)),wa=Math.exp(-Math.pow((xc+.025)/.070,2));
  let ry=.079+.023*wp+.034*wt-.013*Math.exp(-Math.pow((xc+.025)/.065,2));
  let rz=.098+.022*Math.exp(-Math.pow((xc+.145)/.100,2))+.048*wt-.008*wa;
  ry*=1+(params.pelvis-1)*wp*.72+(params.thorax-1)*wt*.78+(params.abdomen-1)*wa*.68;
  rz*=1+(params.pelvis-1)*wp*.52+(params.thorax-1)*wt*.72+(params.abdomen-1)*wa*.48;
  const cz=.240+.047*(3*t*t-2*t*t*t)+.004*Math.exp(-Math.pow((xc-.12)/.10,2)),dx=x-xc,cap=.085;
  const q=Math.sqrt(Math.pow(dx/cap,2)+Math.pow(y/ry,2)+Math.pow((z-cz)/rz,2))-1;
  return q*Math.min(ry,rz,cap);
}
function bodySdf(x,y,z){let d=torsoSdf(x,y,z);const add=(v,k=.018)=>{d=smin(d,v,k)};
  add(ellipsoid(x,y,z,.170,0,.268,.105,.103,.118),.024);
  add(taperedCapsule(x,y,z,[.175,0,.300],[.295,0,.370],.080,.065),.024);
  add(taperedCapsule(x,y,z,[.185,0,.230],[.345,0,.342],.060,.047),.022);
  add(ellipsoid(x,y,z,.355,0,.402,.108,.093*params.head,.103),.027);
  add(ellipsoid(x,y,z,.418,0,.370,.055*params.muzzle,.055,.045),.018);
  add(ellipsoid(x,y,z,.404,0,.342,.059*params.muzzle,.049,.030),.016);
  add(ellipsoid(x,y,z,.390,0,.413,.065,.077*params.head,.060),.019);
  for(const side of [-1,1]){
    add(ellipsoid(x,y,z,.357,side*.048,.384,.071,.048*params.head,.060),.016);
    const tip=[.318,side*.067,.449+.101*params.ears],base=[.338,side*.057,.449];
    add(taperedCapsule(x,y,z,base,tip,.034,.0035),.014);add(ellipsoid(x,y,z,.337,side*.055,.450,.048,.031,.039),.014);
    const sy=side*.067,lr=params.limbs;
    add(ellipsoid(x,y,z,.148,sy,.280,.067,.036*lr,.074),.016);
    add(taperedCapsule(x,y,z,[.165,sy,.274],[.118,sy,.165],.031*lr,.024*lr),.012);
    add(taperedCapsule(x,y,z,[.118,sy,.165],[.145,sy,.067],.024*lr,.016*lr),.010);
    add(taperedCapsule(x,y,z,[.145,sy,.067],[.170,sy,.031],.016*lr,.012*lr),.008);
    add(ellipsoid(x,y,z,.190,sy,.019,.045*params.paws,.026*params.paws,.016),.009);
    const hy=side*.075;
    add(ellipsoid(x,y,z,-.155,hy,.247,.090,.052*lr,.091),.017);
    add(taperedCapsule(x,y,z,[-.155,hy,.242],[-.038,hy,.155],.041*lr,.030*lr),.014);
    add(taperedCapsule(x,y,z,[-.038,hy,.155],[-.205,hy,.074],.030*lr,.019*lr),.010);
    add(taperedCapsule(x,y,z,[-.205,hy,.074],[-.158,hy,.032],.019*lr,.013*lr),.008);
    add(ellipsoid(x,y,z,-.128,hy,.019,.050*params.paws,.028*params.paws,.016),.009);
  }
  const tail=[[-.260,0,.255],[-.355,.003,.225],[-.455,.010,.185],[-.555,.018,.160],[-.645,.028,.210],[-.695,.040,.295]];
  for(let i=0;i<tail.length-1;i++){const t0=i/(tail.length-1),t1=(i+1)/(tail.length-1),r0=mix(.034,.011,t0),r1=mix(.034,.011,t1);add(taperedCapsule(x,y,z,tail[i],tail[i+1],r0,r1),.012)}
  return d;
}'''
text, count = re.subn(r"function bodySdf\(x,y,z\)\{.*?return d;\}", new_sdf, text, count=1, flags=re.S)
if count != 1:
    if "function torsoSdf" not in text:
        raise SystemExit("R0 bodySdf block not found")

old_anchors = "const anchors={pelvis:[-.145,0,.225],lumbar:[-.035,0,.245],thorax:[.10,0,.275],neck:[.24,0,.325],head:[.35,0,.375],tail0:[-.255,0,.255],tail1:[-.43,.01,.32]};for(const side of [-1,1]){anchors[`shoulder${side}`]=[.175,side*.076,.265];anchors[`elbow${side}`]=[.165,side*.076,.150];anchors[`wrist${side}`]=[.195,side*.076,.068];anchors[`forepaw${side}`]=[.25,side*.076,.025];anchors[`hip${side}`]=[-.15,side*.083,.225];anchors[`stifle${side}`]=[-.045,side*.083,.145];anchors[`hock${side}`]=[-.175,side*.083,.074];anchors[`hindpaw${side}`]=[-.07,side*.083,.024]}"
new_anchors = "const anchors={pelvis:[-.155,0,.247],lumbar:[-.035,0,.255],thorax:[.105,0,.280],neck:[.255,0,.345],head:[.355,0,.402],tail0:[-.260,0,.255],tail1:[-.455,.01,.185]};for(const side of [-1,1]){anchors[`shoulder${side}`]=[.165,side*.067,.274];anchors[`elbow${side}`]=[.118,side*.067,.165];anchors[`wrist${side}`]=[.145,side*.067,.067];anchors[`forepaw${side}`]=[.190,side*.067,.019];anchors[`hip${side}`]=[-.155,side*.075,.242];anchors[`stifle${side}`]=[-.038,side*.075,.155];anchors[`hock${side}`]=[-.205,side*.075,.074];anchors[`hindpaw${side}`]=[-.128,side*.075,.019]}"
if new_anchors not in text:
    if text.count(old_anchors) != 1:
        raise SystemExit("R0 skeleton anchor block not found")
    text = text.replace(old_anchors, new_anchors, 1)

text = text.replace("cat-body-bind-v1-r0-20260917", "cat-body-bind-v1-r1-20260917")
text = text.replace("cat_body_bind_r0_stats@1.0", "cat_kaopu/cat_body_bind_r1_stats@1.0")
HTML.write_text(text, encoding="utf-8")

capture = R0_CAPTURE.read_text(encoding="utf-8")
capture = capture.replace("body-bind-v1-r0", "body-bind-v1-r1")
capture = capture.replace("R0", "R1")
capture = capture.replace("r0", "r1")
capture = capture.replace("cat-body-bind-v1-r0-20260917", "cat-body-bind-v1-r1-20260917")
R1_CAPTURE.write_text(capture, encoding="utf-8")
print("built Cat Body Bind V1 R1: continuous torso profile, corrected hind digitigrade chain, shorter broad neck and revised head/ear proportions")
