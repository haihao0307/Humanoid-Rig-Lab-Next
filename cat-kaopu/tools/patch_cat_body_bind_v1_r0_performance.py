from __future__ import annotations

import re
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / "body-bind-v1/index.html"
text = TARGET.read_text(encoding="utf-8")

text, count = re.subn(
    r"const body=new MarchingCubes\(resolution,coatMaterial,false,false,520000\);",
    "const body=new MarchingCubes(resolution,coatMaterial,false,false,280000);",
    text,
    count=1,
)
if count != 1 and "280000" not in text:
    raise SystemExit("MarchingCubes capacity marker missing")

pattern = re.compile(
    r"function worldFromLocal\(v\)\{.*?function applyCoatColors\(\)\{.*?\}\n\nlet buildStart=0;",
    re.S,
)
replacement = r'''function smoothstep(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
function applyCoatColors(){
  const pos=body.geometry.getAttribute('position'),capacity=pos.count,drawCount=body.geometry.drawRange.count;
  const used=Number.isFinite(drawCount)&&drawCount>0?Math.min(capacity,drawCount):capacity;
  const arr=new Float32Array(capacity*3);arr.fill(.4);
  const sx=(bounds.maxX-bounds.minX)*.5,sy=(bounds.maxY-bounds.minY)*.5,sz=(bounds.maxZ-bounds.minZ)*.5;
  const cx=(bounds.maxX+bounds.minX)*.5,cy=(bounds.maxY+bounds.minY)*.5,cz=(bounds.maxZ+bounds.minZ)*.5;
  for(let i=0;i<used;i++){
    const x=cx+pos.getX(i)*sx,y=cy+pos.getY(i)*sy,z=cz+pos.getZ(i)*sz;
    let r=.39,g=.405,b=.42,t;
    t=(1-smoothstep(.17,.29,z))*.28;r+=(.68-r)*t;g+=(.67-g)*t;b+=(.64-b)*t;
    t=smoothstep(.245,.38,z)*(1-smoothstep(.09,.16,Math.abs(y)))*.28;r+=(.115-r)*t;g+=(.125-g)*t;b+=(.135-b)*t;
    const bodyBand=(1-smoothstep(.24,.34,Math.abs(x-.015)))*smoothstep(.18,.33,z);
    t=smoothstep(.30,.86,Math.sin((x+.16)*62+Math.sin(y*31)*.7))*bodyBand*.58;r+=(.115-r)*t;g+=(.125-g)*t;b+=(.135-b)*t;
    t=smoothstep(.20,.90,Math.sin((x+.22)*55+Math.abs(y)*22))*smoothstep(.04,.13,Math.abs(y))*smoothstep(.18,.34,z)*.34;r+=(.115-r)*t;g+=(.125-g)*t;b+=(.135-b)*t;
    if(x>.285){t=smoothstep(.15,.9,Math.sin((y+.07)*72+(z-.32)*28))*.25;r+=(.115-r)*t;g+=(.125-g)*t;b+=(.135-b)*t}
    if(x<-.26){t=smoothstep(.15,.85,Math.sin((-x+z)*92))*.52;r+=(.115-r)*t;g+=(.125-g)*t;b+=(.135-b)*t}
    const whiteMuzzle=smoothstep(.35,.44,x)*(1-smoothstep(.34,.39,z));
    const whiteChest=smoothstep(.12,.22,x)*(1-smoothstep(.05,.095,Math.abs(y)))*(1-smoothstep(.19,.27,z));
    const paws=1-smoothstep(.035,.065,z);t=Math.max(whiteMuzzle*.75,whiteChest*.62,paws*.32);r+=(.68-r)*t;g+=(.67-g)*t;b+=(.64-b)*t;
    t=(1-smoothstep(.14,.24,Math.abs(x+.13)))*smoothstep(.055,.13,Math.abs(y))*.10;r+=(.47-r)*t;g+=(.43-g)*t;b+=(.39-b)*t;
    arr[i*3]=r;arr[i*3+1]=g;arr[i*3+2]=b;
  }
  body.geometry.setAttribute('color',new THREE.BufferAttribute(arr,3));body.geometry.attributes.color.needsUpdate=true;
  return used;
}

let buildStart=0;'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    if "const used=Number.isFinite(drawCount)" in text:
        print("optimized color path already present")
    else:
        raise SystemExit("color-path patch marker missing")

old = "const ms=performance.now()-buildStart;const tri=Math.floor(body.geometry.drawRange.count/3);"
new = "const used=applyCoatColors();body.geometry.computeBoundingSphere();body.geometry.computeBoundingBox();setProgress(.96,'更新四视图与指标…');await new Promise(r=>requestAnimationFrame(r));const ms=performance.now()-buildStart;const tri=Math.floor(used/3);"
# The old HTML calls applyCoatColors and bounding updates immediately before this marker.
old_block = "setProgress(.82,'生成程序化灰虎斑材质…');await new Promise(r=>requestAnimationFrame(r));applyCoatColors();body.geometry.computeBoundingSphere();body.geometry.computeBoundingBox();setProgress(.96,'更新四视图与指标…');await new Promise(r=>requestAnimationFrame(r));const ms=performance.now()-buildStart;const tri=Math.floor(body.geometry.drawRange.count/3);"
new_block = "setProgress(.82,'生成程序化灰虎斑材质…');await new Promise(r=>requestAnimationFrame(r));const used=applyCoatColors();body.geometry.computeBoundingSphere();body.geometry.computeBoundingBox();setProgress(.96,'更新四视图与指标…');await new Promise(r=>requestAnimationFrame(r));const ms=performance.now()-buildStart;const tri=Math.floor(used/3);"
if old_block in text:
    text = text.replace(old_block, new_block, 1)
elif new_block not in text:
    raise SystemExit("build-metric patch marker missing")

text = text.replace("vertices:body.geometry.drawRange.count", "vertices:used", 1)
TARGET.write_text(text, encoding="utf-8")
print("optimized R0: actual draw-range coloring, no per-vertex object allocation, reduced buffer capacity")
