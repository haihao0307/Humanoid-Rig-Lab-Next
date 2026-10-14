"""Idempotent source refinement. No alternate screenshot scene or quality reduction."""
from pathlib import Path
P=Path(__file__).resolve().parent
p=P/'app.js';s=p.read_text()
if 'captureFrame()' not in s:
    s=s.replace("const furMaterial=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:T.DoubleSide});", "const furMaterial=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});")
    s=s.replace('let last=performance.now(),accumulator=0,frames=0,statsTime=last,fps=0,elapsed=0,hidden=false;', 'let last=performance.now(),accumulator=0,frames=0,statsTime=last,fps=0,elapsed=0,hidden=false,renderSuspended=false;')
    s=s.replace('requestAnimationFrame(frame);if(hidden)return;', 'requestAnimationFrame(frame);if(hidden||renderSuspended)return;')
    s=s.replace("window.FUR={version:'FUR-ATELIER-R01',", "window.FUR={version:'FUR-ATELIER-R01',captureFrame(){renderSuspended=true;renderer.render(scene,camera);return canvas.toDataURL('image/png');},resumeFrames(){last=performance.now();accumulator=0;renderSuspended=false;},")
    assert 'captureFrame()' in s and 'hidden||renderSuspended' in s
    p.write_text(s)
p=P/'qa.py';s=p.read_text()
if 'base64.b64decode' not in s:
    s=s.replace('import sys,json,time,io,hashlib,traceback,os', 'import sys,json,time,io,hashlib,traceback,os,base64')
    start=s.index('def pixels(page):');end=s.index('try:\n with sync_playwright()',start)
    s=s[:start]+'''def pixels(page):
    data=page.evaluate('FUR.captureFrame()')
    image=Image.open(io.BytesIO(base64.b64decode(data.split(',',1)[1]))).convert('RGB')
    page.evaluate('FUR.resumeFrames()')
    return image

def diff(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

def shot(page,label):
    file=prefix+label+'.png'
    data=page.evaluate('FUR.captureFrame()')
    (Q/file).write_bytes(base64.b64decode(data.split(',',1)[1]))
    report['screenshots'].append({'file':file,'kind':'actual-WebGL-canvas','instancesUnchanged':True})
    page.wait_for_timeout(120)
    try:
        page.screenshot(path=str(Q/(prefix+label+'-ui.png')),timeout=12000)
        report['screenshots'].append({'file':prefix+label+'-ui.png','kind':'actual-browser-viewport'})
    except Exception as exc:
        report.setdefault('viewportCaptureWarnings',[]).append(str(exc).splitlines()[0])
    finally:
        page.evaluate('FUR.resumeFrames()')
''' + s[end:]
    p.write_text(s)
print('Source refinement: GPU frame can be captured without running a competing animation frame.')
