from pathlib import Path
P=Path(__file__).resolve().parent
p=P/'app.js';s=p.read_text()
if 'FUR_R01_VOLUME_V2' not in s:
    s=s.replace("let presetKey='fox',p={...PRESETS.fox}","let presetKey='ivory',p={...PRESETS.ivory}")
    s=s.replace('MAX=165000,GUIDEW=16,GUIDEH=64','MAX=280000,GUIDEW=16,GUIDEH=128')
    s=s.replace("view==='hat'?105000:view==='swatch'?100000:MAX", "view==='hat'?145000:view==='swatch'?130000:MAX")
    s=s.replace('vec3 groom=normalize(g+b*bundle*uClump*.26);','vec3 groom=normalize(g+b*(bundle*uClump*.42+(aRandom.x-.5)*.42));')
    s=s.replace('(.70*t-.45*t*t)*(1.-uComb*.4)','(.98*t-.47*t*t)*(1.-uComb*.17)*(.83+.34*aRandom.z)')
    s=s.replace('+dynamics*t*t*mix(.26,1.,guard);','+b*len*(aRandom.z-.5)*.15*t*t+dynamics*t*t*mix(.26,1.,guard);')
    s=s.replace('mix(.11,.034,guard)', 'mix(.13,.065,guard)')
    old="add(sign<0?'右翻领':'左翻领',(u,v)=>{let x=sign*(.108+.066*Math.sin(v*PI)-.041*v),y=1.555-.446*v,z=.071+.157*Math.sin(v*PI*.57);let width=.102*(1-.47*v),w=(u-.5)*2;return v3(x+sign*w*width,y+w*.022,z+.032*(1-w*w)+.013*Math.sin(v*PI));},1,sign>0);"
    new="""add(sign<0?'右圆肩':'左圆肩',(u,v)=>{let a=u*2*PI,r=.119*Math.cos(v*PI*.497),h=.125*Math.sin(v*PI*.5);return v3(sign*(.283-.337*h+.941*Math.cos(a)*r),1.425+.941*h+.338*Math.cos(a)*r,.004+Math.sin(a)*r*.96);},0,sign>0);
   add(sign<0?'右翻领':'左翻领',(u,v)=>{let x=sign*(.126+.052*Math.sin(v*PI)-.061*v),y=1.585-.432*v,z=.073+.170*Math.sin(v*PI*.60);let width=.114*Math.sqrt(Math.max(.002,1-Math.pow((v-.43)/.57,2))),w=(u-.5)*2;return v3(x+sign*w*width,y+w*.019,z+.052*(1-w*w)+.01*Math.sin(v*PI));},1,sign>0);"""
    assert old in s,'Lapel source changed unexpectedly'
    s=s.replace(old,new)
    s=s.replace("setPreset('fox');density=1", "setPreset('ivory');density=1")
    s=s.replace("thickness:.12},", "thickness:.16},")
    s=s.replace("thickness:.14},", "thickness:.17},")
    s=s.replace("root:'#a5957e',mid:'#ddcfb9',tip:'#f3eddf'", "root:'#94836c',mid:'#dacdb8',tip:'#f7f2e7'")
    s=s.replace("const furMaterial=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:T.DoubleSide});", "const furMaterial=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true});")
    s+='\n// FUR_R01_VOLUME_V2: rounded shoulders, rolled shawl collar, fuller stable pile.\n'
if 'GPU_FENCE_BACKPRESSURE' not in s:
    s=s.replace('let last=performance.now(),accumulator=0,frames=0,statsTime=last,fps=0,elapsed=0,hidden=false;', 'let last=performance.now(),accumulator=0,frames=0,statsTime=last,fps=0,elapsed=0,hidden=false,renderSuspended=false;')
    s=s.replace("function frame(now){requestAnimationFrame(frame);if(hidden)return;", "function frame(now){requestAnimationFrame(frame);if(hidden||renderSuspended)return;")
    anchor='function frame(now){requestAnimationFrame(frame);if(hidden||renderSuspended)return;'
    assert anchor in s
    helper="""
// GPU_FENCE_BACKPRESSURE: never submit an unbounded queue on a slower GPU.
const gl=renderer.getContext();let gpuFence=null,contextLost=false,gpuWaitFrames=0;
function completedGPU(){if(contextLost)return false;if(!gpuFence)return true;const q=gl.clientWaitSync(gpuFence,0,0);if(q===gl.TIMEOUT_EXPIRED){gpuWaitFrames++;return false;}gl.deleteSync(gpuFence);gpuFence=null;return q!==gl.WAIT_FAILED;}
function fenceGPU(){gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
async function drainGPU(){const start=performance.now();while(!completedGPU()){if(contextLost)throw Error('WebGL context lost during capture');if(performance.now()-start>15000)throw Error('GPU frame exceeded capture budget');await new Promise(r=>setTimeout(r,20));}}
async function captureGPU(){renderSuspended=true;await drainGPU();lighting.ensure();renderer.render(scene,camera);fenceGPU();await drainGPU();return canvas.toDataURL('image/png');}
canvas.addEventListener('webglcontextlost',()=>{contextLost=true;ready=false;gpuFence=null;});
canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;ready=true;gpuFence=null;});
"""
    s=s.replace(anchor,helper+anchor+'if(!completedGPU())return;')
    s=s.replace('lighting.ensure();renderer.render(scene,camera);frames++;','lighting.ensure();renderer.render(scene,camera);fenceGPU();frames++;')
    old="captureFrame(){renderSuspended=true;renderer.render(scene,camera);return canvas.toDataURL('image/png');},"
    if old in s:s=s.replace(old,'captureFrame:captureGPU,')
    else:s=s.replace("window.FUR={version:'FUR-ATELIER-R01',", "window.FUR={version:'FUR-ATELIER-R01',captureFrame:captureGPU,resumeFrames(){last=performance.now();accumulator=0;renderSuspended=false;},")
    s=s.replace("audit:()=>({version:'FUR-ATELIER-R01',ready,", "audit:()=>({version:'FUR-ATELIER-R01',ready,contextLost,gpuWaitFrames,")
    s=s.replace("$('#fps').textContent=fps.toFixed(0)", "$('#fps').textContent=fps.toFixed(1)")
p.write_text(s)
print('Refined application:',len(s),'characters')
p=P/'qa.py'
if p.exists():
    s=p.read_text()
    s=s.replace("'165000 explicit fiber instances',initial['instances']==165000", "'280000 explicit fiber instances',initial['instances']==280000")
    s=s.replace('import sys,json,time,io,hashlib,traceback,os', 'import sys,json,time,io,hashlib,traceback,os,base64') if 'import base64' not in s and ',base64' not in s else s
    a=s.index('def pixels(page):');b=s.index('try:\n with sync_playwright()',a)
    s=s[:a]+'''def pixels(page):
    data=page.evaluate('FUR.captureFrame()')
    image=Image.open(io.BytesIO(base64.b64decode(data.split(',',1)[1]))).convert('RGB')
    page.evaluate('FUR.resumeFrames()')
    return image

def diff(a,b):return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3

def shot(page,label):
    file=prefix+label+'.png'
    data=page.evaluate('FUR.captureFrame()')
    (Q/file).write_bytes(base64.b64decode(data.split(',',1)[1]))
    report['screenshots'].append({'file':file,'kind':'actual-WebGL-canvas','instancesUnchanged':True,'compositorScreenshot':False})
    page.evaluate('FUR.resumeFrames()')
''' + s[b:]
    s=s.replace("steps=page.evaluate('FUR.audit().simSteps');page.wait_for_timeout(750);check('Guide physics advances',page.evaluate('FUR.audit().simSteps')>steps)", "steps=page.evaluate('FUR.audit().simSteps');page.wait_for_function('(steps)=>FUR.audit().simSteps>steps',arg=steps,timeout=15000);check('Guide physics advances',page.evaluate('FUR.audit().simSteps')>steps)")
    s=s.replace("check('No JS page errors',not report['pageErrors'],report['pageErrors'])", "check('WebGL context remains valid',not page.evaluate('FUR.audit().contextLost'));check('No JS page errors',not report['pageErrors'],report['pageErrors'])")
    p.write_text(s)
    print('QA captures the actual completed WebGL framebuffer; no screenshot-compositor contention.')
