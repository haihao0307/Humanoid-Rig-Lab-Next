"""Hash-locked R09.1 -> R10 migration. Subsequent edits use canonical sources.
Only r10 is writable. Old versions and the dynamics solver remain immutable.
"""
from pathlib import Path
import shutil,hashlib
P=Path(__file__).resolve().parent;S=P.parent/'r09'
assert not (P/'app.js').exists(),'Edit canonical sources instead of rerunning migration'
assert hashlib.sha256((S/'index.html').read_bytes()).hexdigest()=='0da75742f463ad9b6c287d0e4c8836b0871c46ab9ea6d6541c66f7eb2afda8b9'
for f in ['sampling.js','fiber-optics.js','structure.js','core.js','cotton-surface.js','natural-yarn.js','runtime-budget.js','stitches.js','dynamics.js','app.js','template.html','build.py','test-budget.cjs','test-layers.cjs','test-stability.cjs','test-cotton.cjs','test-dynamics.cjs']:
 shutil.copy2(S/f,P/f)
def edit(f,fn):
 p=P/f;p.write_text(fn(p.read_text()))
# Serializable initializers are used for a short-lived geometry-generation worker.
for f,obj,name in [('core.js','KAOPUDenimCore','initializeCore'),('cotton-surface.js','KAOPUCottonSurface','initializeCotton'),('natural-yarn.js','KAOPUNaturalYarn','initializeNatural')]:
 def wrap(s,obj=obj,name=name):
  s=s.replace('(function(root)',f'(function {name}(root)',1)
  pos=s.index("if(typeof module!=='undefined')")
  return s[:pos]+f"root.{obj}.workerModule='('+{name}.toString()+')(globalThis);';"+s[pos:]
 edit(f,wrap)
def natural(s):
 s=s.replace('function generate(C,g,damage,fray=1){','function generate(C,g,damage,fray=1,options={}){')
 s=s.replace('for(const [key,list] of releasedGroups){','if(options.boundary!==false)for(const [key,list] of releasedGroups){')
 s=s.replace('for(let kind=0;kind<2;kind++)for(let side=0;side<2;side++){','if(options.boundary!==false)for(let kind=0;kind<2;kind++)for(let side=0;side<2;side++){')
 s=s.replace('for(let j=0;j<18000;j++){','if(options.micro!==false)for(let j=0;j<18000;j++){')
 s=s.replace('for(let kind=0;kind<2;kind++)for(const span of p.spans[kind]){','if(options.micro!==false)for(let kind=0;kind<2;kind++)for(const span of p.spans[kind]){')
 return s
edit('natural-yarn.js',natural)
def budget(s):
 s=s.replace('const p=packFibers(curves),limit=',"const p=Array.isArray(curves)?packFibers(curves):curves,curveCount=p.bounds.length/8,limit=")
 # Store takes either source curves or transferred packed arrays.
 start=s.index('function makeFiberStore');end=s.index('// An enclosing world',start)
 s=s[:start]+s[start:end].replace('curves.length','curveCount')+s[end:]
 return s
edit('runtime-budget.js',budget)
def stitches(s):
 s=s.replace('stitches=[],holes=[]','stitches=[],holes=[],guides=[]')
 s=s.replace('tubePath(ptsTop,1,id);tubePath(ptsBottom,-1,id);','guides.push({points:ptsTop,kind:0,radius:config.radius,parentId:id,role:"stitch"},{points:ptsBottom,kind:0,radius:config.radius,parentId:id,role:"stitch"});tubePath(ptsTop,1,id);tubePath(ptsBottom,-1,id);')
 return s.replace('return {bounds:[x0,y0,x1,y1,z],','return {guides,bounds:[x0,y0,x1,y1,z],')
edit('stitches.js',stitches)
def sampling(s):
 # Continuous same-frame linear-radiance mixture; far alpha holds local footprint weight.
 old='if(farBlend>0.)c=mix(c,texture(farIm,p).rgb,farBlend);'
 new='if(farBlend>0.){vec4 f=texture(farIm,p);c=mix(c,f.rgb,max(farBlend,f.a));}'
 assert old in s;return s.replace(old,new)
edit('sampling.js',sampling)

def app(s):
 s=s.replace('R09.1','R10.0').replace("'R09.0','R10.0'","'R09.0','R09.1','R10.0'")
 s=s.replace('const gpuTimer=Budget.timer(gl);','const DistanceLOD=KAOPUDistanceLOD,detail=DistanceLOD.demand(gl,Budget,()=>{viewKey="";request();});let microGain=0,currentFar=0,renderingMip=false,looseLines=null,seamLines=null,detailReleaseTimer=0;const gpuTimer=Budget.timer(gl);')
 # Coarse material integration: no geometric-cell-sized normals after minification.
 s=s.replace('uniform float uFilterScale,uNearWeight;','uniform float uFilterScale,uNearWeight,uMicroGain;uniform int uCurveClass;')
 s=s.replace('if(a<.00005)discard;','if(vRole>.5)a*=uMicroGain;if(a<.00005)discard;')
 s=s.replace('vec3 V=normalize(uCam-vW),L=normalize(uKeyPos-vW);float cyl=', 'if(uCurveClass==1)c=mix(yarnColor(vM,vFamily,vId,1.),vec3(.29,.276,.247),vFamily>.5?.50:.23);if(uCurveClass==2)c=vec3(.145,.082,.022);vec3 V=normalize(uCam-vW),L=normalize(uKeyPos-vW);float cyl=')
 s=s.replace('vAlpha*min(1.,uFuzz*1.6)','vAlpha*(uCurveClass>0?1.:min(1.,uFuzz*1.6))')
 s=s.replace('uniform float uBack;in vec3 vW;', 'uniform float uBack;in vec3 vW;')
 a=s.index('vec3 nTex=textureGrad(uNormalMap');b=s.index('O=vec4(tone(lighting(c,N,normalize(vT),vW,uFuzz)),tex.a);',a)
 s=s[:a]+'''// Alpha-weighted normal moment: a vanishing vector must not be renormalized into a highlight.
vec4 moment=textureGrad(uNormalMap,vUV,dx,dy);
vec3 nTex=(moment.rgb-vec3(.5))*2./max(moment.a,.001);
float coherence=clamp(length(nTex),0.,1.);
vec3 N0=normalize(vN)*uBack;vec3 B=normalize(cross(vT,N0));mat3 b=mat3(B,normalize(vT),N0);
vec3 m=b*nTex;vec3 N=normalize(normalize(vN)+.40*coherence*(m-normalize(vN)*dot(m,normalize(vN))));
vec3 c=tex.rgb/max(tex.a,.001);
''' +s[b:]
 # Mask rendering shares carrier geometry and depth; no new full-size texture allocation.
 at=s.index('function program(v,f)')
 s=s[:at]+'''const maskFS=`#version 300 es
precision highp float;uniform vec4 uSize;uniform vec3 uCam;uniform sampler2D uMap;uniform float uFilterScale,uNearWeight;in vec3 vN,vW;in vec2 vM,vUV;out vec4 O;
void main(){if(dot(vN,uCam-vW)<=0.)discard;vec2 dx=dFdx(vM)*uFilterScale,dy=dFdy(vM)*uFilterScale;
float fx=length(vec2(dx.x,dy.x))/uSize.z,fy=length(vec2(dx.y,dy.y))/uSize.w;float p=1./max(max(fx,fy),.0001);
if(textureGrad(uMap,vUV,dx/uSize.xy,dy/uSize.xy).a<.001)discard;
O=vec4(0,0,0,max(1.-uNearWeight,1.-smoothstep(2.8,7.,p)));}`;
const macroShadowFS=`#version 300 es
precision highp float;uniform sampler2D uMap;in vec2 vUV;out vec4 O;
void main(){if(textureLod(uMap,vUV,2.).a<.05)discard;O=vec4(1);}`;
''' +s[at:]
 s=s.replace('let filterScale=1,','const maskProg=program(surfVS,maskFS),macroShadowProg=program(surfVS,macroShadowFS);let filterScale=1,')
 # Demand-resident main-view fibers are generated separately, all boundary curves persist.
 s=s.replace('naturalData=Natural.generate(C,graph,state.damage,state.fray);','naturalData=Natural.generate(C,graph,state.damage,state.fray,{micro:false});')
 s=s.replace('hairs.update(visible);seamVisible=', 'hairs.update(visible);detail.store?.update(visible);looseLines?.update(visible);seamLines?.update(visible);seamVisible=')
 s=s.replace('function build(){mainMeshes.forEach(destroy);','function build(){detail.reset();destroy(looseLines);destroy(seamLines);mainMeshes.forEach(destroy);')
 s=s.replace('[[2,8],[4,16],[2,4]]','[[2,8]]')
 s=s.replace('cachedAudit=Natural.audit(naturalData);','seamLines=Budget.makeFiberStore(gl,sewn.guides);looseLines=Budget.makeFiberStore(gl,naturalData.tubes.map(c=>({...c,parentId:c.id,role:"released"})));cachedAudit=Natural.audit(naturalData);')
 s=s.replace("uf(p,'uNearWeight',nearWeight);","uf(p,'uNearWeight',nearWeight);uf(p,'uMicroGain',microGain);ui(p,'uCurveClass',0);")
 # Four MSAA attribute captures, in linear material space. Resources are temporary and reported.
 s=s.replace('Sampling.target(gl,bakeSize,bakeSize,false,null,0)','Sampling.target(gl,bakeSize,bakeSize,false,null,4)')
 s=s.replace('gl.clearColor(.5,.5,back>0?1:0,1)','gl.clearColor(.5,.5,.5,0)')
 # Preserve exact detailed shadow near; coarse dynamic shadow keeps holes and folds without yarn-sized shadow raster instability.
 s=s.replace("gl.bindTexture(gl.TEXTURE_2D,shadowDrawing?dummyTex:(shadowTex||dummyTex))","gl.bindTexture(gl.TEXTURE_2D,shadowDrawing?dummyTex:((renderingMip?macroShadowTex:shadowTex)||dummyTex))")
 s=s.replace("uf(p,'uShadowTexel',1/Math.max(1,shadowSize));","uf(p,'uShadowTexel',1/Math.max(1,renderingMip?macroShadowSize:shadowSize));")
 pos=s.index('function makeShadow(){')
 s=s[:pos]+'''let macroShadowTex=null,macroShadowFbo=null,macroShadowKey='',macroShadowSize=512;
function makeMacroShadow(){
 if(!macroShadowFbo){macroShadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,macroShadowTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,macroShadowSize,macroShadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);macroShadowFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,macroShadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,macroShadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Coarse shadow incomplete');}
 const key=[geometrySerial,state.shape,state.structure,state.light,state.qaClock,state.animate?clock:0,dynamics.active?dynamics.revision:0].join('|');if(key===macroShadowKey)return;
 shadowDrawing=true;gl.bindFramebuffer(gl.FRAMEBUFFER,macroShadowFbo);gl.viewport(0,0,macroShadowSize,macroShadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);
 for(let side=0;side<2;side++){uniforms(macroShadowProg,lightVP,keyPos);uf(macroShadowProg,'uBack',side? -1:1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,baked[side*2]);ui(macroShadowProg,'uMap',0);gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);}
 shadowDrawing=false;macroShadowKey=key;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
function detailMeshes(pixels){if(pixels>4&&!mainMeshes[2])for(let kind=0;kind<2;kind++){const m=tube(16,4,16);attachRanges(m,kind);mainMeshes[2+kind]=m;}
 if(pixels<2.7&&!detail.store&&mainMeshes[2]){destroy(mainMeshes[2]);destroy(mainMeshes[3]);mainMeshes.length=2;}}
function drawFiberStore(store,vp,eye,span,ch,distance,klass=0){if(!store)return;uniforms(hairProg,vp,eye);ui(hairProg,'uCurveClass',klass);uf(hairProg,'uMmPerPixel',span/ch);uf(hairProg,'uFocusDistance',distance);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,store.pointTex);ui(hairProg,'uFiberPoints',8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,store.metaTex);ui(hairProg,'uFiberMeta',9);gl.bindVertexArray(store.vao);gl.drawElements(gl.TRIANGLE_STRIP,store.indexCount,gl.UNSIGNED_INT,0);gl.depthMask(true);gl.disable(gl.BLEND);drawCount++;}
''' +s[pos:]
 # Solver remains untouched. View/shadow work is selected after screen-space demand is computed.
 s=s.replace('dynamics.upload();gpuTimer.start();if(!state.qaAudit)makeShadow();','dynamics.upload();gpuTimer.start();')
 s=s.replace('let far=Sampling.farWeight(pixelsPerYarn,bodyPixels,state.qaForceYarns||state.qaAudit),useMip=far===1;', '''const demand=DistanceLOD.plan(pixelsPerYarn);let far=state.qaForceYarns||state.qaAudit?0:demand.filtered,useMip=far===1,wantFiltered=!state.qaForceYarns&&!state.qaAudit&&demand.localPass;
 currentFar=far;microGain=detail.update(pixelsPerYarn,graph.p,state.damage,state.fray);detailMeshes(pixelsPerYarn);
 if(detail.stats.error)throw Error('近景资源生成失败：'+detail.stats.error);
 if(pixelsPerYarn<2.7&&!detailReleaseTimer&&(detail.store||detail.stats.pending)){detailReleaseTimer=setTimeout(()=>{detailReleaseTimer=0;request();},950);}
 if(!state.qaAudit){configureLights();if(!useMip)makeShadow();if(wantFiltered)makeMacroShadow();}
''')
 s=s.replace("lod=useMip?'远景 · 同源像素积分':far>0?'远近连续过渡':geomLevel===1?'实体纱线 · 近景':'实体纱线 · 稳定采样';", "lod=useMip?'中远景 · 同源预过滤 / 物理保持':wantFiltered?'连续像素足迹过渡':detail.stats.pending?'近景细节按需生成中':'近景 · 实体纱线与棉纤维';")
 s=s.replace('function scene(mip){gl.bindFramebuffer', 'function scene(mip){renderingMip=mip;gl.bindFramebuffer')
 s=s.replace('if(!state.qaAudit&&looseMesh){','if(!mip&&!state.qaAudit&&looseMesh){')
 s=s.replace('if(state.seam&&seamVisible){uniforms(seamProg', 'if(!mip&&state.seam&&seamVisible){uniforms(seamProg')
 # Shared macro/boundary curves use screen-integrated widths, not disappearing tube fragments.
 a=s.index('  if(state.fuzz>.01){uniforms(hairProg');b=s.index('\n }\n if(far>0&&far<1)',a)
 s=s[:a]+'''  if(mip){drawFiberStore(looseLines,vp,eye,span,ch,distance,1);if(state.seam&&seamVisible)drawFiberStore(seamLines,vp,eye,span,ch,distance,2);}
  if(state.fuzz>.01){drawFiberStore(hairs,vp,eye,span,ch,distance);if(!mip&&microGain>0)drawFiberStore(detail.store,vp,eye,span,ch,distance);}
''' +s[b:]
 s=s.replace('if(far>0&&far<1){scene(true);saveFarFrame();}', '''if(wantFiltered&&!useMip){scene(true);
  // The already allocated far image alpha stores a local, derivative-based mix weight.
  gl.colorMask(false,false,false,true);gl.clearColor(0,0,0,far);gl.clear(gl.COLOR_BUFFER_BIT);gl.depthMask(false);gl.disable(gl.BLEND);
  for(let side=0;side<2;side++){uniforms(maskProg,vp,eye);uf(maskProg,'uBack',side? -1:1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,baked[side*2]);ui(maskProg,'uMap',0);gl.bindVertexArray(carrierMesh.vao);gl.drawElements(gl.TRIANGLES,carrierMesh.count,gl.UNSIGNED_INT,0);}
  gl.colorMask(true,true,true,true);gl.depthMask(true);saveFarFrame();}''')
 s=s.replace("uf(blit,'farBlend',farTexture?far:0);","uf(blit,'farBlend',farTexture?Math.max(.000001,far):0);")
 s=s.replace('geometryBufferBytes:[...mainMeshes,carrierMesh,seams,looseMesh,hairs]', 'distanceLOD:{...demand,microGain,detail:detail.report(),dynamicShadow:true,localFootprintMask:wantFiltered&&!useMip},geometryBufferBytes:[...mainMeshes,carrierMesh,seams,looseMesh,hairs,looseLines,seamLines,detail.store]')
 s=s.replace('+hairs.textureBytes,closeSurface:', '+hairs.textureBytes+(detail.store?.textureBytes||0)+(looseLines?.textureBytes||0)+(seamLines?.textureBytes||0),closeSurface:')
 s=s.replace('visibleFiberCurves:hairs.visibleCurves,','visibleFiberCurves:hairs.visibleCurves+(microGain>0?(detail.store?.visibleCurves||0):0),')
 s=s.replace("+(state.fuzz>.01?hairs.visibleTriangles:0),transitionDoublePass:far>0&&far<1", "+(state.fuzz>.01?hairs.visibleTriangles+(!useMip&&microGain>0?(detail.store?.visibleTriangles||0):0):0),transitionDoublePass:wantFiltered&&!useMip")
 s=s.replace('gpuTimer.end();submitGpu();lastDrawTime=', 'gpuTimer.end();submitGpu();if(detail.fading)request();lastDrawTime=')
 s=s.replace('const geom=[...mainMeshes,carrierMesh,seams,looseMesh,hairs]', 'const geom=[...mainMeshes,carrierMesh,seams,looseMesh,hairs,looseLines,seamLines,detail.store]')
 s=s.replace('point=hairs?.textureBytes||0,', 'point=(hairs?.textureBytes||0)+(detail.store?.textureBytes||0)+(looseLines?.textureBytes||0)+(seamLines?.textureBytes||0),')
 s=s.replace('shadow=shadowSize*shadowSize*4;', 'shadow=(shadowSize*shadowSize+(macroShadowTex?macroShadowSize*macroShadowSize:0))*4;')
 s=s.replace('retainedFiberCpuBytes:hairs?.cpuBytes||0,','detailResidency:detail.report(),retainedFiberCpuBytes:(hairs?.cpuBytes||0)+(detail.store?.cpuBytes||0)+(looseLines?.cpuBytes||0)+(seamLines?.cpuBytes||0),')
 s=s.replace("轻量配方 ${p.recipeBytes} B", "近景按需 ${p.detailResidency.resident?'已驻留':p.detailResidency.pending?'生成中':'未驻留'} · 生成 ${p.detailResidency.requests} / 释放 ${p.detailResidency.releases} 次\\n轻量配方 ${p.recipeBytes} B")
 # Direct comparison buttons, not a canned video; keep physical clock and anchor state.
 pos=s.index("$('front').onclick=")
 s=s[:pos]+"$('midReview').onclick=()=>{state.zoom=.85;state.panX=0;state.panY=0;request();};$('lodBack').onclick=()=>{state.zoom=2.0;state.panX=0;state.panY=0;request();};\n"+s[pos:]
 # Report actual main draws rather than inherited full tube triangles in coarse mode.
 s=s.replace("(!state.qaAudit&&looseMesh?looseMesh.count/3:0)+(state.seam&&seamVisible?seams.count/3:0)","(!state.qaAudit&&looseMesh?(useMip?looseLines.visibleTriangles:looseMesh.count/3):0)+(state.seam&&seamVisible?(useMip?seamLines.visibleTriangles:seams.count/3):0)")
 return s
edit('app.js',app)
def template(s):
 s=s.replace('R09.1','R10.0').replace('/*APP*/','/*LOD*/\n/*APP*/')
 s=s.replace('<button id="detail">','<button id="midReview">中景过渡</button><button id="lodBack">拉近对照</button><button id="detail">')
 # Preserve node ids and controls, add compact explanation near budget.
 s=s.replace('不是浏览器总内存', '不是浏览器总内存')
 return s
edit('template.html',template)
def builder(s):
 s=s.replace("('APP','app.js')","('LOD','distance-lod.js'),('APP','app.js')").replace('R09.1','R10.0').replace('r09/index.html','r10/index.html').replace('57e8c6c2ce61a1226da302ba3bb239fc5274ae61','de49103b14bc4884b3f9ba1e5a2a3a8b5fa66eae')
 s=s.replace('R08 equivalent sampling, Float32 points, no visible-point decimation','R08 near sampling preserved; local-footprint filtered middle/far; Float32 micro layer generated on demand')
 return s
edit('build.py',builder)
print('R10 canonical source derived; old runtime and dynamics solver unchanged')
