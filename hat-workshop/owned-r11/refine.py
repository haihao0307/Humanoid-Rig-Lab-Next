"""Visual and observed layout corrections, never screenshot retouching or error filtering."""
from pathlib import Path
R=Path(__file__).resolve().parent
p=R/'src/field.js';text=p.read_text()
old='Math.sin((v-.74)/.26*PI)*sm((v-.74)/.08);'
new='Math.sin((v-.74)/.26*PI)*sm((v-.74)/.08)*r*r;'
if old in text:
 assert text.count(old)==1
 p.write_text(text.replace(old,new))
else:assert new in text,'Field surface changed; reconcile before refining'
p=R/'src/viewer.js';text=p.read_text()
old="const resize=()=>{const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();drawSoon();};new ResizeObserver(resize).observe(canvas.parentElement);resize();"
new="""// R11_LAYOUT_1: do not write intrinsic canvas dimensions from an observer notification.
 let resizeFrame=0;
 const resizeNow=()=>{resizeFrame=0;const r=canvas.parentElement.getBoundingClientRect(),w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height)),size=renderer.getSize(new T.Vector2());if(size.x!==w||size.y!==h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();drawSoon();}};
 const resize=()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(resizeNow);};
 new ResizeObserver(resize).observe(canvas.parentElement);resizeNow();"""
if old in text:
 assert text.count(old)==1
 p.write_text(text.replace(old,new))
else:assert 'R11_LAYOUT_1' in text,'Resize runtime changed; reconcile first'
p=R/'shell.html';text=p.read_text()
old='#canvas{display:block;width:100%;height:100%;touch-action:none}'
new='#canvas{position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none}'
if old in text:p.write_text(text.replace(old,new))
else:assert new in text
print('Applied radius-faded roof wrinkles and actual canvas layout feedback repair; all errors still fail QA')
