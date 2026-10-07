"""Corrections derived from actual browser macro frames, not replacement images."""
from pathlib import Path
import sys
src=Path(sys.argv[1]) if len(sys.argv)>1 else Path('out/source')
a=(src/'app.js').read_text();h=(src/'index.html').read_text()
def patch(old,new):
    global a
    assert a.count(old)==1,(old,a.count(old))
    a=a.replace(old,new,1)
patch('n:48, spc:8','n:36, spc:8')
patch("sourceId:f.sourceId+'-repeat4'","sourceId:f.sourceId+'-repeat'+(C.n/12)")
patch('const fiberCount=24,step=4,','const fiberCount=32,step=1,')
patch('local=curveLocal(c,s,theta);','local=curveLocal(c,s,theta,-.003);')
# Fine strands share every longitudinal sample with the bulk envelope; coarse
# chords previously cut through the envelope and appeared as broken dash marks.
patch('b.castShadow=b.receiveShadow=fi.castShadow=fi.receiveShadow=true;','b.castShadow=b.receiveShadow=true;fi.castShadow=false;fi.receiveShadow=true;')
patch("f.name='fuzz';f.castShadow=f.receiveShadow=true;","f.name='fuzz';f.castShadow=false;f.receiveShadow=true;")
# Path tracing uses actual triangles independently of raster shadow flags.
patch('pt.filteredGlossyFactor=.7','pt.filterGlossyFactor=.7')
patch("C.quality=+b.dataset.quality;document.querySelectorAll", "C.quality=+b.dataset.quality;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*C.quality);document.querySelectorAll")
# Replace camera-plane fuzz ribbons with tangent-oriented tapered triangle tubes.
begin=a.index(' seed=765821;const fuzzN=3200');end=a.index('\n return {bulk:',begin)
a=a[:begin]+''' seed=765821;const fuzzN=3200,FSTEP=9,FU=4,fb=new Builder(fuzzN*FSTEP*FU,fuzzN*(FSTEP-1)*3*6);
 for(let k=0;k<fuzzN;k++){
  const c=curves[Math.floor(rnd()*curves.length)],s=4+rnd()*(npts-9),theta=rnd()*TAU,loop=rnd()<.72,span=.11+rnd()*.45,len=.05+rnd()*.18,dir=rnd()<.5?1:-1,bend=(rnd()-.5)*.06,centers=[];
  for(let j=0;j<FSTEP;j++){const t=j/(FSTEP-1),ss=clamp(s+dir*t*span/(c.family==='warp'?C.cellY:C.cellX)*C.spc,0,npts-1),th=theta+.10*t,d=(loop?Math.sin(t*PI):t*t)*len,local=curveLocal(c,ss,th,.004+d);local[c.family==='warp'?0:1]+=Math.sin(t*PI)*bend;centers.push(surface(...local));}
  let prev=-1;
  for(let j=0;j<FSTEP;j++){const t=j/(FSTEP-1),p=centers[j],p0=centers[Math.max(0,j-1)],p1=centers[Math.min(FSTEP-1,j+1)],tangent=norm(p1.map((v,i)=>v-p0[i])),ref=Math.abs(tangent[2])<.9?[0,0,1]:[0,1,0],n=norm(cross(tangent,ref)),b=norm(cross(tangent,n)),r=.0026*(loop?(.8+.2*Math.sin(t*PI)):(1-.92*t)),start=fb.v;
   for(let q=0;q<FU;q++){const angle=q/3*TAU;fb.vertex(p.map((v,i)=>v+r*(Math.cos(angle)*n[i]+Math.sin(angle)*b[i])),tint(c,s,.94),q/3,t);}
   if(prev>=0)fb.join(start,prev,FU);prev=start;
  }
 }
''' +a[end:]
patch('fuzz:fb.geometry(),surface','fuzz:flipWinding(fb.geometry()),surface')
# CSS transformed drawers added to document.scrollWidth on narrow viewports.
css='@media(max-width:760px){aside{display:none;transform:none;position:fixed}body.panel-open aside{display:block;transform:none}.header-right{gap:6px}#status{display:none}header small{letter-spacing:1.3px}.hint{font-size:9px}}'
h=h.replace('</style>',css+'</style>')
(src/'app.js').write_text(a);(src/'index.html').write_text(h)
print('Continuous fine-fiber chords; 36+36 yarns; mobile drawer has no offscreen layout width.')
