"""R05-only fibre finish from macro review. Expanded source is authoritative."""
from pathlib import Path
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
for old,new in [
 ('normalMap:fibre,normalScale:new T.Vector2(.10,.10)','map:plies?fibre.userData.albedo:null,normalMap:plies?fibre:null,normalScale:new T.Vector2(.65,.65)'),
 ("for(const w of data.walls){const m=surfaceMat('cut'),obj=new T.Mesh(w.geometry,m);", "for(const w of data.walls){const m=surfaceMat('cut'),obj=new T.Mesh(w.geometry,m);m.color.multiplyScalar(w.layer===0?1.06:.86);")]:
 if new in s:continue
 assert s.count(old)==1,old;s=s.replace(old,new)
p.write_text(s)
print('Continuous thread core + fibre-scale normals/albedo; two actual layer edge tones. No frozen files touched.')
