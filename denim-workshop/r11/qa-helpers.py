"""R11 helper regression; --content is development only, never public evidence."""
from pathlib import Path
import argparse,base64,hashlib,io,json,math,os
from datetime import datetime,timezone
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent;OUT=P/'evidence';OUT.mkdir(exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--public');a.add_argument('--content',action='store_true');args=a.parse_args()
R={'passed':False,'startedAt':datetime.now(timezone.utc).isoformat(),'sourceHead':os.getenv('GITHUB_SHA'),'mode':'public' if args.public else 'authored' if args.content else 'file','states':[],'network':[],'realDevice':False,'legalClearance':False}
def capture(p):
 b=base64.b64decode(p.evaluate("document.querySelector('#view').toDataURL().split(',')[1]"));return b,np.asarray(Image.open(io.BytesIO(b)).convert('RGB'))
def openpage(browser,version='r11',mobile=False):
 p=browser.new_page(viewport={'width':390,'height':844} if mobile else {'width':1000,'height':780},device_scale_factor=1);p.set_default_timeout(180000)
 n={'pageErrors':[],'consoleErrors':[],'httpErrors':[],'requests':[],'version':version,'mobileViewport':mobile};R['network'].append(n)
 p.on('pageerror',lambda e:n['pageErrors'].append(str(e)));p.on('console',lambda m:n['consoleErrors'].append({'url':m.location.get('url',''),'text':m.text}) if m.type=='error' else None);p.on('response',lambda r:n['httpErrors'].append({'url':r.url,'status':r.status}) if r.status>=400 else None);p.on('request',lambda r:n['requests'].append(r.url))
 if args.public and version=='r11':p.goto(args.public,wait_until='domcontentloaded',timeout=120000)
 elif args.content:p.set_content((P.parent/version/'index.html').read_text(),wait_until='domcontentloaded')
 else:p.goto((P.parent/version/'index.html').as_uri(),wait_until='domcontentloaded')
 p.wait_for_function('window.__DENIM_WORKBENCH__?.lastFrame||window.__DENIM_WORKBENCH__?.contextLost');return p

def state(p,name,patch=None,action=None,save=False):
 if patch is not None or action:
  old=p.evaluate('__DENIM_WORKBENCH__.lastFrame.frame')
  if action:action()
  else:p.evaluate('(s)=>__DENIM_WORKBENCH__.setState(s)',patch)
  p.wait_for_function('(n)=>__DENIM_WORKBENCH__.lastFrame.frame>n||__DENIM_WORKBENCH__.contextLost',arg=old)
 b,im=capture(p);q=p.evaluate('({version:__DENIM_WORKBENCH__.version,frame:__DENIM_WORKBENCH__.lastFrame,lost:!!__DENIM_WORKBENCH__.contextLost,gl:__DENIM_WORKBENCH__ .getGLError()})');q.update(name=name,pixelStd=float(im.std()),sha256=hashlib.sha256(b).hexdigest());R['states'].append(q)
 bad=q['lost'] or q['gl']!=0 or im.std()<2
 if bad or save:(OUT/(R['mode']+'-'+name+'.png')).write_bytes(b)
 assert not bad,(name,q)
 print(name,q['frame']['frame'],flush=True);return im,q

def near(p,label):
 state(p,label+'-request',{'zoom':5.2,'panX':3,'panY':-4,'seam':False});p.wait_for_function('(()=>{const d=__DENIM_WORKBENCH__.lastFrame.distanceLOD;return d.detail.resident&&!d.detail.pending&&d.microGain>=.999;})()');return state(p,label+'-settled',{},save=True)

def sample_gpu(p):
 return p.evaluate('''()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2');if(!g)throw Error('helper WebGL2');
 const probes=Array.from({length:32},(_,i)=>[i%2?-i*19.125:i*.3125,(i-17)*.6875]);
 function sh(type,src){const x=g.createShader(type);g.shaderSource(x,src);g.compileShader(x);if(!g.getShaderParameter(x,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(x));return x;}
 const pr=g.createProgram();const vs=sh(g.VERTEX_SHADER,'#version 300 es\\nprecision highp float;precision highp int;'+KAOPUDenimNoise.glsl+'\\nuniform vec2 probes[32];out float val;void main(){val=denimNoise2(probes[gl_VertexID]);gl_Position=vec4(0,0,0,1);}');
 const fs=sh(g.FRAGMENT_SHADER,'#version 300 es\\nprecision highp float;out vec4 O;void main(){O=vec4(1);}');g.attachShader(pr,vs);g.attachShader(pr,fs);g.transformFeedbackVaryings(pr,['val'],g.INTERLEAVED_ATTRIBS);g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))throw Error(g.getProgramInfoLog(pr));g.useProgram(pr);
 g.uniform2fv(g.getUniformLocation(pr,'probes'),probes.flat());const vao=g.createVertexArray();g.bindVertexArray(vao);const bf=g.createBuffer();g.bindBuffer(g.TRANSFORM_FEEDBACK_BUFFER,bf);g.bufferData(g.TRANSFORM_FEEDBACK_BUFFER,128,g.STATIC_READ);const tf=g.createTransformFeedback();g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,tf);g.bindBufferBase(g.TRANSFORM_FEEDBACK_BUFFER,0,bf);g.enable(g.RASTERIZER_DISCARD);g.beginTransformFeedback(g.POINTS);g.drawArrays(g.POINTS,0,32);g.endTransformFeedback();g.disable(g.RASTERIZER_DISCARD);const out=new Float32Array(32);g.getBufferSubData(g.TRANSFORM_FEEDBACK_BUFFER,0,out);const cpu=probes.map(q=>KAOPUDenimNoise.sample(...q));const err=Math.max(...cpu.map((x,i)=>Math.abs(x-out[i])));const error=g.getError();g.deleteTransformFeedback(tf);g.deleteBuffer(bf);g.deleteVertexArray(vao);g.deleteProgram(pr);g.deleteShader(vs);g.deleteShader(fs);g.getExtension('WEBGL_lose_context')?.loseContext();return {samples:32,maxAbsError:err,error};}''')

def motion(p,label,zoom):
 state(p,label+'-base',{'shape':0,'zoom':zoom,'yaw':0,'pitch':0,'panX':0,'panY':0,'seam':False});q=p.evaluate('__DENIM_WORKBENCH__.lastFrame');h=p.evaluate("document.querySelector('#view').height");mpp=2*q['distanceMm']*math.tan(math.pi/10)/h;patches=[[],[],[]]
 for i in range(4):
  im,_=state(p,label+'-'+str(i),{'panX':i*.25*mpp},save=i==0)
  for k,world in enumerate([[-25,20,0],[0,22,0],[28,20,0]]):
   xy=p.evaluate('(p)=>__DENIM_WORKBENCH__.projectPoint(p)',world);cx,cy=xy[0],im.shape[0]-xy[1];yy,xx=np.meshgrid(cy+np.arange(-6,7),cx+np.arange(-25,26),indexing='ij');patches[k].append(map_coordinates(im.astype(float).mean(2),[yy,xx],order=3,mode='nearest'))
 return float(np.mean([np.sqrt(np.mean(np.var(np.stack(v),axis=0))) for v in patches]))

with sync_playwright() as pw:
 kw={'headless':False,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
 if os.getenv('CHROMIUM_PATH'):kw['executable_path']=os.environ['CHROMIUM_PATH']
 browser=pw.chromium.launch(**kw);R['browserVersion']=browser.version
 try:
  oldNear=None;oldMotion={}
  if not args.public:
   p=openpage(browser,'r10');oldNear,_=near(p,'baseline-near')
   for key,z in [('middle',1.),('far',.45)]:oldMotion[key]=motion(p,'baseline-'+key,z)
   p.close()
  p=openpage(browser);_,q=state(p,'default',save=True);assert q['version']=='R11.0'
  R['helperGPU']=sample_gpu(p);assert R['helperGPU']['error']==0 and R['helperGPU']['maxAbsError']<3e-6
  im,q=near(p,'candidate-near');R['nearResources']=q['frame']['performance']
  if oldNear is not None:
   d=np.abs(im.astype(float)-oldNear);R['appearance']={'mae':float(d.mean()),'meanRGBShift':(im.mean((0,1))-oldNear.mean((0,1))).tolist(),'contrastRatio':float(im.std()/oldNear.std()),'pixelIdentical':bool(np.array_equal(im,oldNear))}
   assert R['appearance']['mae']<10 and max(abs(v) for v in R['appearance']['meanRGBShift'])<6 and .9<R['appearance']['contrastRatio']<1.1,R['appearance']
  candidateNear=im.copy();R['motion']={}
  for key,z in [('middle',1.),('far',.45)]:
   v=motion(p,'candidate-'+key,z);R['motion'][key]={'candidate':v}
   if key in oldMotion:
    limit=max(oldMotion[key]*1.25,oldMotion[key]+.15);R['motion'][key].update(baseline=oldMotion[key],limit=limit);assert v<=limit,R['motion']
  p.wait_for_function('__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.releases>=1&&!__DENIM_WORKBENCH__.lastFrame.distanceLOD.detail.resident');_,q=state(p,'far-released',{});R['farResources']=q['frame']['performance']
  state(p,'restore-shape',{'shape':1,'yaw':-.23,'pitch':.34});again,_=near(p,'reloaded-near');R['reloadMaxPixelDifference']=int(np.abs(again.astype(int)-candidateNear).max());assert R['reloadMaxPixelDifference']==0
  state(p,'sewing',action=lambda:p.locator('#stitchReview').click(),save=True)
  state(p,'damage',{'damage':4,'zoom':.85,'panX':0,'panY':0},save=True);assert p.evaluate('__DENIM_WORKBENCH__.lastFrame.natural.bridges')>0
  state(p,'intact',{'damage':0,'zoom':1.0,'seam':True});state(p,'wind-on',action=lambda:p.locator('#wind').click());before=p.evaluate('__DENIM_WORKBENCH__.physicsReport()?.steps||0')
  state(p,'wind-far-efficient',{'zoom':.45,'quality':'efficient'},save=True);p.wait_for_function('(n)=>(__DENIM_WORKBENCH__.physicsReport()?.steps||0)>n',arg=before);after=p.evaluate('__DENIM_WORKBENCH__.physicsReport().steps');R['physicsContinues']={'before':before,'after':after};assert after>before
  state(p,'wind-stop',action=lambda:p.locator('#wind').click());state(p,'physics-reset',action=lambda:p.locator('#physicsReset').click());state(p,'quality-restored',{'quality':'fidelity'})
  recipe=p.evaluate('__DENIM_WORKBENCH__.recipe()');assert recipe['noiseKernel']=='kaopu.coordinate_noise@1' and recipe['generator']=='R11.0'
  state(p,'recipe-roundtrip',action=lambda:p.evaluate('(r)=>__DENIM_WORKBENCH__.loadRecipe(r)',recipe));R['oldRecipeRejected']=p.evaluate('''()=>{const r=__DENIM_WORKBENCH__.recipe();r.generator='R10.0';try{__DENIM_WORKBENCH__.loadRecipe(r);return false;}catch(e){return true;}}''');assert R['oldRecipeRejected']
  with p.expect_download() as dl:p.locator('#save').click()
  f=OUT/(R['mode']+'-recipe.json');dl.value.save_as(str(f));assert json.loads(f.read_text())['noiseKernel']==recipe['noiseKernel']
  p.close();p=openpage(browser,mobile=True);state(p,'mobile-default',save=True);state(p,'mobile-middle',{'zoom':1.15},save=True);p.close()
  icon='https://htmlpreview.github.io/favicon.ico'
  for n in R['network']:
   assert not n['pageErrors'],n
   assert not [x for x in n['httpErrors'] if not(x['url']==icon and x['status']==404)],n
   assert not [x for x in n['consoleErrors'] if not(x['url']==icon and '404' in x['text'])],n
   if not args.public:assert not [x for x in n['requests'] if x.startswith('http')],n
  R['method']='Fixed 1000x780 DPR1; 4 quarter-pixel camera pans, 3 cubic-reprojected 13x51 brightness patches; UI wind checked separately. Mobile is 390x844 viewport only.'
  R['passed']=True
 finally:
  R['finishedAt']=datetime.now(timezone.utc).isoformat();(OUT/(R['mode']+'-qa.json')).write_text(json.dumps(R,ensure_ascii=False,indent=2));browser.close()
