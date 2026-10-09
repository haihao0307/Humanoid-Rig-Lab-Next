"""R05-only fibre finish and needle/framing review. Expanded source is authoritative."""
from pathlib import Path
import subprocess
r=Path(__file__).resolve().parent
fibre='''export function fibreNormalTexture(){
 const w=256,h=128,a=new Uint8Array(w*h*4),colour=new Uint8Array(w*h*4);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const u=i/w,v=j/h,phase=2*Math.PI*(12*v-4*u),fine=2*Math.PI*(36*v-12*u),c=Math.cos(phase),f=Math.cos(fine),k=(j*w+i)*4;
  const x=-.10*c-.025*f,y=.32*c+.08*f,z=1,inv=1/Math.hypot(x,y,z);
  a[k]=Math.round((x*inv*.5+.5)*255);a[k+1]=Math.round((y*inv*.5+.5)*255);a[k+2]=Math.round((z*inv*.5+.5)*255);a[k+3]=255;
  const shade=Math.round(238+12*Math.sin(phase)+4*Math.sin(fine));colour[k]=colour[k+1]=colour[k+2]=shade;colour[k+3]=255;
 }
 const make=data=>{const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
 const t=make(a);t.userData.albedo=make(colour);t.userData.albedo.colorSpace=T.SRGBColorSpace;return t;
}
'''
p=r/'site/geometry.js';s=p.read_text();assert "structure:'continuous core with shallow twist relief'" in s
s=s[:s.index('export function fibreNormalTexture()')]+fibre;s=s.replace('1+.025*Math.cos(3*a-phase)','1+.040*Math.cos(3*a-phase)');p.write_text(s)
p=r/'site/runtime.js';s=p.read_text()
edge='m.color.multiplyScalar(w.layer===0?1.06:.86);'
while edge+edge in s:s=s.replace(edge+edge,edge)
for old,new in [
 ('normalMap:fibre,normalScale:new T.Vector2(.10,.10)','map:plies?fibre.userData.albedo:null,normalMap:plies?fibre:null,normalScale:new T.Vector2(.65,.65)'),
 ("for(const w of data.walls){const m=surfaceMat('cut'),obj=new T.Mesh(w.geometry,m);", "for(const w of data.walls){const m=surfaceMat('cut'),obj=new T.Mesh(w.geometry,m);m.color.multiplyScalar(w.layer===0?1.06:.86);"),
 ('Math.max(92,model.width*1.50)','Math.max(110,model.width*1.85)'),
 ('Math.max(90,model.width*1.50)','Math.max(110,model.width*1.85)'),
 ("new T.DirectionalLight('#d2e3ed',.8)","new T.DirectionalLight('#d2e3ed',1.6)")]:
 if old in new and new in s:continue
 if old in s:s=s.replace(old,new)
 else:assert new in s,old
p.write_text(s)
p=r/'site/seam.mjs';s=p.read_text()
old='needleEnds.push({half,row,position:v,direction:[v[0]-n[0],v[1]-n[1],v[2]-n[2]]});'
new="const fromSide=initialSide*(end%2===1?1:-1),started=p.type==='running'||strand===0||process.phase>=.40;needleEnds.push({half,row,position:v,direction:[0,started?-fromSide:fromSide,0]});"
if old in s:s=s.replace(old,new)
else:assert new in s
p.write_text(s)
subprocess.run(['node','--input-type=module','-e',"import {buildSeam} from './site/seam.mjs';import fs from 'node:fs';const a=buildSeam({}, {hole:6,phase:.20}).needleEnds[0].direction,b=buildSeam({}, {hole:6,phase:.55}).needleEnds[1].direction;if(a[0]!==0||a[1]!==1||b[0]!==0||b[1]!==-1)throw Error('Needles must enter along opposite thickness axes');fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/needle-axis.json',JSON.stringify({pass:true,tests:[{name:'A enters along thickness at first entry stop',pass:true},{name:'B reverses through same hole at second entry stop',pass:true}],scope:'prescribed educational needle axes; no machine kinematics'},null,2));"],cwd=r,check=True)
print('Continuous fibre thread, needle entry alignment, full sample framing and visible layer edges. No frozen files touched.')
