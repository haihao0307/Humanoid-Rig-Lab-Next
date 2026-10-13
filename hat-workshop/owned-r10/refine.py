"""Reviewed R10.1 visual corrections; exact-source guard, idempotent, no old assets."""
from pathlib import Path
import hashlib
R=Path(__file__).resolve().parent
checks={'src/shape.js':'7dee60ed52ae3ac7f5072e7c5d439c6adde3081e5bc9c142c45dd1e2d386f673','src/viewer.js':'9a5591aab05a84665f57465132fbfbdc931ee25183db6fde9aff442a5f2b7213'}
texts={p:(R/p).read_text() for p in checks}
if all('R101_VISUAL_2' in s for s in texts.values()):
 print('Visual correction already applied');raise SystemExit(0)
for p,s in texts.items():assert hashlib.sha256(s.encode()).hexdigest()==checks[p],p+' changed; reconcile first'
def rep(p,a,b):
 assert texts[p].count(a)==1,(p,a[:100],texts[p].count(a))
 texts[p]=texts[p].replace(a,b)
g='src/shape.js';v='src/viewer.js'
rep(g,"const cuff=c.shape==='soft',bandHeight=c.band,bandBase=cuff?-.006:-.005;", "const cuff=c.shape==='soft',bandHeight=c.shape==='visor'?ht:c.band,bandBase=cuff?-.006:-.005;")
rep(g,"let y=-.002-(c.drop||0)*s.brim*v;", "let y=.0007-(c.drop||0)*s.brim*v;")
rep(g,"return[(ax-.0005+d)*sn,y,(bz-.0005+d)*cs];", "return[(ax-thick*.8+d)*sn,y,(bz-thick*.8+d)*cs];")
rep(g,"const low=.025,span=c.band/ht;", """const low=.006,span=c.band;
  const bandV=(u,v)=>{const goal=low+span*v;let lo=0,hi=.6;for(let k=0;k<12;k++){const mid=(lo+hi)/2;if(crown(u,mid)[1]<goal)lo=mid;else hi=mid;}return(lo+hi)/2;};""")
rep(g,"const belt=(u,v)=>{const p=crown(u,low+span*v),n=normal(crown,u,low+span*v);", "const belt=(u,v)=>{const t=bandV(u,v),p=crown(u,t),n=normal(crown,u,t);")
rep(g,"t=low+span*(.12+.76*v),p=crown(ang/TAU,t)", "t=bandV(ang/TAU,.12+.76*v),p=crown(ang/TAU,t)")
rep(v,"function syncUI(){", "function syncUI(){const category=H.categories.find(c=>c.id===form.id);$('p-brim').disabled=!category.brim;$('p-fullness').disabled=category.shape==='visor';")
rep(v,"const rt=new T.WebGLRenderTarget(220,146),tc=new T.PerspectiveCamera", "const tc=new T.PerspectiveCamera")
rep(v,"const was=renderer.getRenderTarget();renderer.setRenderTarget(rt);renderer.render(ts,tc);const bytes=new Uint8Array(220*146*4);renderer.readRenderTargetPixels(rt,0,0,220,146,bytes);renderer.setRenderTarget(was);", """const was=renderer.getRenderTarget(),vp=renderer.getViewport(new T.Vector4()),sc=renderer.getScissor(new T.Vector4()),st=renderer.getScissorTest(),ratio=renderer.getPixelRatio(),bytes=new Uint8Array(220*146*4);
   // Use the same display framebuffer and output transform as the main view.
   // Restore it synchronously before yielding, so no thumbnail flashes on screen.
   try{renderer.setRenderTarget(null);renderer.setViewport(0,0,220/ratio,146/ratio);renderer.setScissor(0,0,220/ratio,146/ratio);renderer.setScissorTest(true);renderer.render(ts,tc);const gl=renderer.getContext();gl.readPixels(0,0,220,146,gl.RGBA,gl.UNSIGNED_BYTE,bytes);}
   finally{renderer.setRenderTarget(was);renderer.setViewport(vp);renderer.setScissor(sc);renderer.setScissorTest(st);draw();}""")
rep(v," rt.dispose();\n}", " // No additional render target survives thumbnail generation.\n}")
for p,s in texts.items():(R/p).write_text('// R101_VISUAL_2\n'+s)
print('Applied physical crown/brim overlap, measured ribbon height, visor height and display-matched thumbnails')
