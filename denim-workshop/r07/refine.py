"""Unify seeded yarn cross-sections and embedded staple roots. Run after upgrade.py only."""
from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'app.js').read_text()
old='float hash(float x){return fract(sin(x*127.1+13.7)*43758.5453);}'
new='float hash(float x){uint n=(uint(int(x))^0x9e3779b9u)*0x85ebca6bu;n^=n>>13;n*=0xc2b2ae35u;return float(n^(n>>16))/4294967296.;}'
assert s.count(old)==2;s=s.replace(old,new)
s=s.replace('out float vId;','flat out float vId;').replace('in float vId;','flat in float vId;')
s=s.replace('vInfo.y,variation','floor(vInfo.y+.5),variation').replace('vInfo.x,vInfo.y,1.','floor(vInfo.x+.5),floor(vInfo.y+.5),1.')
(p/'app.js').write_text(s)
n=(p/'natural-yarn.js').read_text()
helper=r'''
// This is the CPU twin of yarnSection in app.js: same hash, correlated radii and packing.
// Float raster precision can still differ; this is not a global inter-fiber collision proof.
function sectionPoint(C,g,kind,id,t,theta,radial=1){const pitch=kind?g.p.warpPitch:g.p.weftPitch,ph=id+kind*79;
 const noise=x=>{const a=Math.floor(x),f=x-a;return mix(H(a),H(a+1),sm(f));};
 const bulge=noise(t*.10+ph*19.31),irregular=1+g.p.slub*(.20*(H(ph)*2-1)+.24*(bulge-.5)+.045*Math.sin(t*.61+ph));
 const ra=(kind?g.p.weftPitch*.235:g.p.warpPitch*.49)*clamp(irregular,.84,1.09),rz=g.rz*(kind?.68:1)*(1+g.p.slub*.14*(bulge-.5));
 const deriv=(C.sample(g.d,kind,id,t+.008)-C.sample(g.d,kind,id,t-.008))*g.lift/(.016*pitch);
 const T=norm(kind?[1,0,deriv]:[0,1,deriv]),B=kind?[0,1,0]:[1,0,0],V=norm(kind?cross(T,B):cross(B,T));
 const packing=1+.060*Math.cos(theta*3+t*pitch*1.3+ph)+.025*Math.cos(theta*7-t*pitch*.8+ph*.33);
 return add(organicPoint(C,g,kind,id,t),add(mul(B,ra*radial*packing*Math.cos(theta)),mul(V,rz*radial*packing*Math.sin(theta))));
}
'''
assert n.count('function smoothCurve(')==1;n=n.replace('function smoothCurve(',helper+'function smoothCurve(')
n=n.replace('strand<2;strand++','strand<3;strand++')
a='''    let deriv=(C.sample(g.d,kind,id,t+.01)-C.sample(g.d,kind,id,t-.01))*g.lift/(.02*pitch);'''
b='''    q=add(q,add(mul(B,ra*migrate*Math.cos(theta)),mul(V,rz*migrate*Math.sin(theta))));pts.push(q);'''
i=n.index(a);j=n.index(b,i)+len(b)
n=n[:i]+'''    let migrate=.90+.16*Math.sin(Math.PI*u)+.020*Math.sin(t*.9+phase);
    q=sectionPoint(C,g,kind,id,t,theta,migrate);pts.push(q);'''+n[j:]
a='''   q[kind?1:0]+=Math.cos(spin)*ra*(.84+.16*Math.sin(Math.PI*u));
   q[2]+=Math.sin(spin)*rz+face*(loopy?(.035+.09*H(j+411))*Math.sin(Math.PI*u):(.08+.10*H(j+411))*u);'''
b='''   q=sectionPoint(C,g,kind,id,tt,spin,.92+.08*Math.sin(Math.PI*u));
   q[2]+=face*(loopy?(.020+.065*H(j+411))*Math.sin(Math.PI*u):(.04+.10*H(j+411))*u);'''
assert a in n;n=n.replace(a,b)
n=n.replace('audit,H,smoothCurve','audit,H,smoothCurve,sectionPoint')
(p/'natural-yarn.js').write_text(n)
print('Shader and CPU staple surfaces now share the same deterministic section model.')
t=(p/'template.html').read_text();t=t.replace('</style>','#tools{max-width:calc(100% - 335px);flex-wrap:wrap;justify-content:flex-end}@media(max-width:750px){#tools{max-width:none;justify-content:flex-start}}</style>');(p/'template.html').write_text(t)
