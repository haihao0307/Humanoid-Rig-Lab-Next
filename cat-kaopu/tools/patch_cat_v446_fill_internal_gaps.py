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
    "if(bestP)return{p:bestP,n:bestN,valid:1};let bd=1e9,bv=null;for(const v of headVerts){const dy=v.p[1]-y,dz=v.p[2]-z,d=dy*dy+dz*dz;if(d<bd){bd=d;bv=v}}if(bv)return{p:[bv.p[0],y,z],n:bv.n.slice(),valid:0};return{p:[.19,y,z],n:[1,0,0],valid:0}",
    "if(bestP)return{p:bestP,n:bestN,valid:1};const near=[];for(const v of headVerts){const dy=v.p[1]-y,dz=v.p[2]-z,d=dy*dy+dz*dz;let q=near.length;while(q>0&&near[q-1].d>d)q--;near.splice(q,0,{d,v});if(near.length>16)near.pop()}if(near.length){let sw=0,sx=0,nx=0,ny=0,nz=0;for(const q of near){const w=1/Math.pow(q.d+2e-6,1.18);sw+=w;sx+=q.v.p[0]*w;nx+=q.v.n[0]*w;ny+=q.v.n[1]*w;nz+=q.v.n[2]*w}const nl=Math.hypot(nx,ny,nz)||1;return{p:[sx/sw,y,z],n:[nx/nl,ny/nl,nz/nl],valid:0}}return{p:[.19,y,z],n:[1,0,0],valid:0}",
    "weighted interior fallback",
)
replace_once(
    "domain=(1-Math.min(1,Math.max(0,(metric-.82)/.18)))*(raw[id].valid?1:0),edge=.16*Math.max(0,1-metric);",
    "domain=1-Math.min(1,Math.max(0,(metric-.82)/.18)),edge=.16*Math.max(0,1-metric);",
    "analytic domain without internal holes",
)

BUILDER.write_text(text, encoding="utf-8")
print("patched V4.46 carrier: weighted interior reconstruction with analytic outer trim")
