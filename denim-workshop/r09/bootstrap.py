"""One-time R08 -> R09 source migration; refuses to overwrite canonical sources.
After generation, edit r09/*.js and rebuild with build.py. R08 stays immutable.
"""
from pathlib import Path
import shutil,hashlib
D=Path(__file__).resolve().parent;S=D.parent/'r08'
assert not (D/'app.js').exists(), 'R09 already generated: edit canonical sources and run build.py'
assert hashlib.sha256((S/'index.html').read_bytes()).hexdigest()=='6f9000811b7c3b3a4be2f31e21cea5cb42ccb4632478727d20b7fc49e8862acf'
for f in ['app.js','core.js','natural-yarn.js','sampling.js','cotton-surface.js','fiber-optics.js','structure.js','template.html','test-cotton.cjs']:
    shutil.copy2(S/f,D/f)
p=D;base=S
s=(base/'natural-yarn.js').read_text()
s=s.replace('function generate(C,g,damage,fray=1){','function generate(C,g,damage,fray=1,options={}){')
s=s.replace("function fiber(points,kind,radius,group,role){fibers.push({points,kind,radius,group,role});}","""function emit(c){if(options.onFiber){if(c.role!=='surface'&&c.role!=='clumped'&&c.role!=='stray')c.points=smoothCurve(c.points,2);options.onFiber(c);fibers.push({role:c.role,kind:c.kind,parentId:c.parentId});}else fibers.push(c);}
 function fiber(points,kind,radius,group,role){emit({points,kind,radius,group,role});}""")
s=s.replace("fibers.push({points:pts,kind,radius:","emit({points:pts,kind,radius:")
s=s.replace('fibers.push(c);\n  }','emit(c);\n  }')
s=s.replace("for(const c of [...tubes,...fibers])if", "for(const c of [...tubes,...(options.onFiber?[]:fibers)])if")
(p/'natural-yarn.js').write_text(s)
s=(base/'core.js').read_text()
s=s.replace('const pts=new Float32Array((length*4+1)*3);for(let j=0;','const pts=p.compact?null:new Float32Array((length*4+1)*3);for(let j=0;!p.compact&&')
s=s.replace('c.points.every(Number.isFinite)','!c.points||c.points.every(Number.isFinite)')
(p/'core.js').write_text(s)
s=(base/'app.js').read_text().replace('R08.0','R09.0').replace('KAOPU_Denim_R08','KAOPU_Denim_R09')
s=s.replace("let state={preset:","let state={quality:'balanced',frameLimit:30,stitchCells:7,threadDiameter:.105,preset:")
s=s.replace("const optics=", "const Budget=KAOPURuntimeBudget,Compact=KAOPUCompactFibers,Stitch=KAOPULockstitch;let cachedNaturalAudit=null,buildSerial=0,geometryBuilds=0,stitchStats=null,renderDeadline=0,lastHud=0;const timer=new Budget.Timer(gl);\nconst optics=")
s=s.replace('${KAOPUCottonSurface.shapeGLSL}','${KAOPUCottonSurface.shapeGLSL}\n${Stitch.glsl}')
s=s.replace('in vec4 aP;in vec4 aRange;','layout(location=0) in vec4 aP;layout(location=1) in vec4 aRange;')
s=s.replace('${fragCommon}${shade}', '${fragCommon}${shade}${Stitch.glsl}')
s=s.replace('void main(){if(uShadowPass==1){O=vec4(1);return;}if(uAudit==1)', 'void main(){if(uSeam==1&&needleDistance(vM)<.64)discard;if(uShadowPass==1){O=vec4(1);return;}if(uAudit==1)',1)
s=s.replace('col*=mix(1.,.92+.08*abs(front),uCotton);','col*=mix(1.,.92+.08*abs(front),uCotton)*seamContact(vM);')
a=s.index('const seamVS=');b=s.index('const hairVS=',a)
s=s[:a]+'''const seamVS=`#version 300 es
${common}
in vec3 aM,aNormal,aTangent;in vec2 aUV;uniform mat4 uVP;out vec3 vW,vN,vT;out vec2 vM,vUV;
void main(){mat3 b=basis(aM.xy);vW=carrier(aM.xy)+b[2]*aM.z;vN=normalize(b*aNormal);vT=normalize(b*aTangent);vM=aM.xy;vUV=aUV;gl_Position=uVP*vec4(vW,1.);}`;
const seamFS=`#version 300 es
${fragCommon}${shade}
in vec3 vW,vN,vT;in vec2 vM,vUV;out vec4 O;
void main(){if(uShadowPass==1){O=vec4(1);return;}vec3 N=normalize(vN),T=normalize(vT);if(!gl_FrontFacing)N=-N;float twist=vUV.y-vUV.x*8.4;float fp=length(vec2(dFdx(twist),dFdy(twist)))*uFilterScale;float detail=1.-smoothstep(.5,2.5,fp);float ply=cos(twist*3.)*detail;N=normalize(N+cross(T,N)*sin(twist*3.)*.16*detail);vec3 c=vec3(.145,.082,.022)*(1.+.13*ply+.05*sin(vUV.x*2.3));O=vec4(tone(layeredLighting(c,N,T,vW,.25,.105)),1.);}`;
''' +s[b:]
s=s.replace('in vec4 aP;in vec4 aMeta;in vec4 aTangent;uniform mat4 uVP;', '${Compact.vertexPrelude}\nuniform mat4 uVP;')
s=s.replace('void main(){mat3 b=basis(aP.xy);vM=aP.xy;','void main(){${Compact.vertexRead}mat3 b=basis(aP.xy);vM=aP.xy;',1)
s=s.replace('vLife=aMeta.y;vAlpha=sigma/filtered*taper;','if(collapsed){w=0.;taper=0.;}vLife=aMeta.y;vAlpha=sigma/filtered*taper;')
# Shared geometry positions in a dedicated depth-only program.
poscode=s[s.index('vec3 yarnSection('):s.index('const fragCommon=')]
poscode=poscode[:poscode.index('void main()')]
depth='''const depthVS=`#version 300 es\n${common}\nlayout(location=0) in vec4 aP;layout(location=1) in vec4 aRange;uniform mat4 uVP;out vec2 vM;\n'''+poscode+'''void main(){int id=int(aRange.z+.5);float t=clamp(aP.x+floor(aRange.x/16.)*16.,aRange.x,aRange.y);if(abs(aP.w)>.5)t=aP.w<0.?aRange.x:aRange.y;float scale=aP.z;int caps=int(aRange.w+.5);if(abs(aP.w)>.5&&(aP.w<0.?((caps&1)==0):((caps&2)==0)))scale=0.;vec3 p=yarnSection(t,aP.y,id,scale);vM=p.xy;gl_Position=uVP*vec4(carrier(p.xy)+basis(p.xy)[2]*p.z,1.);}`;
const depthFS=`#version 300 es\n${fragCommon}${Stitch.glsl}\nin vec2 vM;out vec4 O;void main(){if(uSeam==1&&needleDistance(vM)<.64)discard;O=vec4(1);}`;
'''
s=s.replace('function program(v,f)',depth+'\nfunction program(v,f)')
s=s.replace('let yarnProg,surfProg,seamProg,hairProg,looseProg;','let yarnProg,surfProg,seamProg,hairProg,looseProg,depthProg;')
s=s.replace('yarnProg=program(vs,fs);','yarnProg=program(vs,fs);depthProg=program(depthVS,depthFS);')
s=s.replace("return p._loc[k]??(p._loc[k]=gl.getUniformLocation(p,k));", "return Object.prototype.hasOwnProperty.call(p._loc,k)?p._loc[k]:(p._loc[k]=gl.getUniformLocation(p,k));")
s=s.replace('new Float32Array(data),gl.STATIC_DRAW','(data instanceof Float32Array?data:new Float32Array(data)),gl.STATIC_DRAW')
s=s.replace('new Uint32Array(indices),gl.STATIC_DRAW','(indices instanceof Uint32Array?indices:new Uint32Array(indices)),gl.STATIC_DRAW')
s=s.replace('function destroy(m){if(m){','function destroy(m){if(m){if(m.textures)m.textures.forEach(t=>gl.deleteTexture(t));if(m.fullVAO)gl.deleteVertexArray(m.fullVAO);')
s=s.replace('instances=[],instanceCounts=[0,0]', "instances=[],fullInstances=[],rangeData=[[],[]],boundsCache=[[],[]],activeCounts=[0,0],cullKey='',instanceCounts=[0,0]")
start=s.index('function attachRanges(');end=s.index('function build(){',start)
s=s[:start]+'''function bindRangeVAO(m,buf,full=false){const vao=full?gl.createVertexArray():m.vao;if(full)m.fullVAO=vao;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.vb);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(1,1);}
function attachRanges(m,kind){bindRangeVAO(m,instances[kind]);bindRangeVAO(m,fullInstances[kind],true);}
function createRanges(){for(const b of [...instances,...fullInstances])gl.deleteBuffer(b);instances=[];fullInstances=[];brokenEnds=[];graph.cuts=[];cullKey='';const writer=new Compact.Builder();
 naturalData=Natural.generate(C,graph,state.damage,state.fray,{onFiber:c=>writer.add(c)});fiberCount=writer.curves;hairs=writer.upload(gl);cachedNaturalAudit=Natural.audit(naturalData);naturalData.fibers=[];
 for(let kind=0;kind<2;kind++){const data=[],byId=new Map();for(const [start,end,id] of naturalData.spans[kind]){if(!byId.has(id))byId.set(id,[]);byId.get(id).push([start,end]);for(let base=Math.floor(start/16)*16;base<end;base+=16){const lo=Math.max(start,base),hi=Math.min(end,base+16);data.push(lo,hi,id,(lo===start?1:0)+(hi===end?2:0));}}
  for(let id=0;id<(kind?graph.ny:graph.nx);id++)graph.cuts.push({family:kind?'weft':'warp',index:id,spans:byId.get(id)||[]});
  rangeData[kind]=new Float32Array(data);instanceCounts[kind]=data.length/4;activeCounts[kind]=instanceCounts[kind];
  for(const list of [instances,fullInstances]){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,rangeData[kind],gl.DYNAMIC_DRAW);list.push(b);}
 }
 brokenEnds=naturalData.released.filter(r=>r.type==='tail');
}
function selectVisible(vp){const key=[buildSerial,state.shape,state.structure,...vp,state.qaNoCull].join('|');if(key===cullKey)return;cullKey=key;
 for(let kind=0;kind<2;kind++){const all=rangeData[kind],out=new Float32Array(all.length);let n=0;for(let i=0;i<all.length;i+=4){const r=all.subarray(i,i+4),b=Budget.bounds(r,kind,graph,state);if(state.qaNoCull||Budget.sphereVisible(vp,b.center,b.radius)){out.set(r,n);n+=4;}}activeCounts[kind]=n/4;gl.bindBuffer(gl.ARRAY_BUFFER,instances[kind]);gl.bufferSubData(gl.ARRAY_BUFFER,0,out.subarray(0,n));}
}
''' +s[end:]
s=s.replace('graph=C.compile({weave:', 'buildSerial++;geometryBuilds++;graph=C.compile({compact:true,weave:')
start=s.index('let sa=[],si=[];');end=s.index('const ld=Natural.tubeMesh',start)
s=s[:start]+'''buildSeam();edges=null;
 '''+s[end:]
pos=s.index('function uniforms(')
s=s[:pos]+'''function buildSeam(){destroy(seams);const d=Stitch.generate(graph,state,Natural);stitchStats=d.stats;seams=mesh(d.vertices,d.indices,seamProg,'aM',3,11);gl.bindVertexArray(seams.vao);gl.bindBuffer(gl.ARRAY_BUFFER,seams.vb);for(const [name,size,offset] of [['aNormal',3,3],['aTangent',3,6],['aUV',2,9]]){const a=gl.getAttribLocation(seamProg,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,44,offset*4);}gl.bindVertexArray(null);}
'''+s[pos:]
s=s.replace("uf(p,'uCotton',state.cotton);", "ui(p,'uSeam',state.seam?1:0);uf(p,'uStitchPitch',graph.p.warpPitch*state.stitchCells);uf(p,'uThreadRadius',state.threadDiameter*.5);uf(p,'uCotton',state.cotton);")
s=s.replace("uf(p,'uTime',state.animate?clock:0)","uf(p,'uTime',state.qaTime??clock)")
s=s.replace('gl.bindVertexArray(m.vao);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,instanceCounts[kind]);','gl.bindVertexArray((flat||shadowDrawing)?m.fullVAO:m.vao);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,(flat||shadowDrawing)?instanceCounts[kind]:activeCounts[kind]);')
s=s.replace("state.backstain,state.preset].join('|')", "state.backstain,state.preset,state.seam,state.stitchCells].join('|')")
s=s.replace('function configureLights(){',"let configuredLight=-1;function configureLights(){if(configuredLight===state.light)return;configuredLight=state.light;")
s=s.replace('state.animate?clock:0].join', "state.quality==='reference'?(state.qaTime??clock):Math.floor((state.qaTime??clock)*15)/15].join")
s=s.replace('drawYarns(yarnProg,lightVP,keyPos);','drawYarns(depthProg,lightVP,keyPos);')
s=s.replace("if(state.animate){if(last)clock+=Math.min((time-last)/1000,.05);last=time;}else last=0;", "if(state.animate){if(last)clock+=Math.min((time-last)/1000,.20);last=time;}else last=0;timer.poll();timer.begin();")
old="let ss=Math.max(1,Math.min(2,Math.sqrt((rect.width<700?1100000:2000000)/(cw*ch))));target(Math.round(cw*ss),Math.round(ch*ss));\n let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch,bodyPixels=ch/span*Math.max(graph.p.width,graph.p.height);"
new="""let {vp,eye,span,distance,projection}=camera(cw/ch),pixelsPerYarn=ch/span*graph.p.warpPitch,bodyPixels=ch/span*Math.max(graph.p.width,graph.p.height);
 let maxSS=state.quality==='reference'?2:2-.75*Sampling.smooth(4,9,pixelsPerYarn),ss=Math.max(1,Math.min(maxSS,Math.sqrt((rect.width<700?1100000:2000000)/(cw*ch))));target(Math.round(cw*ss),Math.round(ch*ss));selectVisible(vp);"""
assert old in s;s=s.replace(old,new)
s=s.replace('gl.bindVertexArray(hairs.vao);gl.drawElements(gl.TRIANGLES,hairs.count,gl.UNSIGNED_INT,0);', "gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,hairs.textures[0]);ui(hairProg,'uFiberPosition',8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,hairs.textures[1]);ui(hairProg,'uFiberMeta',9);gl.bindVertexArray(hairs.vao);gl.drawArrays(gl.TRIANGLE_STRIP,0,hairs.drawVertices);")
s=s.replace("$('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;", "if(performance.now()-lastHud>250){$('status').textContent=`${graph.curves.length} 根纱线 · ${state.thickness.toFixed(2)} mm · ${lod}`;lastHud=performance.now();updateBudgetHUD();}")
s=s.replace('natural:Natural.audit(naturalData)', 'natural:cachedNaturalAudit')
s=s.replace('instanceCounts:[...instanceCounts],', 'instanceCounts:[...instanceCounts],activeInstances:[...activeCounts],')
s=s.replace('mainMeshes[geomLevel*2].count*instanceCounts[0]+mainMeshes[geomLevel*2+1].count*instanceCounts[1]', 'mainMeshes[geomLevel*2].count*activeCounts[0]+mainMeshes[geomLevel*2+1].count*activeCounts[1]')
s=s.replace('};submitGpu();if(state.animate)request();','};window.__DENIM_WORKBENCH__.lastFrame.budget=budget();timer.end();submitGpu();renderDeadline=performance.now()+(state.animate?1000/state.frameLimit:0);if(state.animate)request();')
s=s.replace('function request(){if(!pending&&!document.hidden){pending=true;requestAnimationFrame(render);}}', "function request(){if(!pending&&!document.hidden){pending=true;const delay=state.animate?Math.max(0,renderDeadline-performance.now()):0;if(delay>1)setTimeout(()=>requestAnimationFrame(render),delay);else requestAnimationFrame(render);}}")
s=s.replace('naturalAudit:()=>Natural.audit(naturalData),getNatural:()=>naturalData', 'naturalAudit:()=>cachedNaturalAudit,getNatural:()=>Natural.generate(C,graph,state.damage,state.fray)')
s=s.replace('getOptics:()=>optics,','getOptics:()=>optics,getBudget:budget,recipe,restoreRecipe,')
s=s.replace("$('seam').onchange=e=>{state.seam=e.target.checked;request();};", "$('seam').onchange=e=>{state.seam=e.target.checked;bakeDirty=true;request();};")
s=s.replace("['wash','abrasion','backstain','slub','cotton','staple','preset'].some", "['wash','abrasion','backstain','slub','cotton','staple','preset','seam','stitchCells'].some")
s=s.replace('Object.assign(state,patch);updateText();if(geom)',"Object.assign(state,patch);if('stitchCells' in patch||'threadDiameter' in patch)buildSeam();updateText();if(geom)")
loc=s.index('function profile()')
s=s[:loc]+'''function recipe(){const keys=['preset','weave','cotton','staple','nap','thickness','slub','wash','abrasion','backstain','fuzz','damage','fray','scatter','transmission','structure','seam','stitchCells','threadDiameter'];return {schema:'kaopu.denim_recipe@1.0',generator:'R09.0',units:'mm',seed:23,parameters:Object.fromEntries(keys.map(k=>[k,state[k]])),engineShared:true,physics:'analytic-view-deformation-not-cloth-solver'};}
function restoreRecipe(r){if(r?.schema!=='kaopu.denim_recipe@1.0'||r.generator!=='R09.0')throw Error('Unsupported recipe');const p=r.parameters,limits={weave:[0,3],cotton:[0,1],staple:[0,1],nap:[0,1],thickness:[.45,1.05],slub:[0,1],wash:[0,1],abrasion:[0,1],backstain:[0,1],fuzz:[0,1],damage:[0,4],fray:[.3,2.5],scatter:[0,1],transmission:[0,1],structure:[0,1],stitchCells:[4,10],threadDiameter:[.06,.18]};if(!p||!presets[p.preset]||typeof p.seam!=='boolean')throw Error('Invalid recipe fields');for(const [k,[a,b]] of Object.entries(limits))if(!Number.isFinite(p[k])||p[k]<a||p[k]>b||(['weave','damage','stitchCells'].includes(k)&&!Number.isInteger(p[k])))throw Error('Invalid '+k);Object.assign(state,Object.fromEntries(Object.keys(recipe().parameters).map(k=>[k,p[k]])));build();}
function budget(){const geom=[...mainMeshes,carrierMesh,seams,looseMesh].reduce((n,m)=>n+(m?.bufferBytes||0),0)+instanceCounts.reduce((a,n)=>a+n*32,0),fiber=hairs?.textureBytes||0,maps=baked.length*bakeSize*bakeSize*4*4/3,shadow=shadowSize*shadowSize*4,screenBytes=(screen?.attachmentBytes||0)+(farTexture?screenW*screenH*(hdr?8:4):0);return {geometryBuffers:geom,compactFiberTextures:fiber,derivedMaterialMaps:Math.round(maps),shadowTexture:shadow,renderTargets:screenBytes,trackedGpuBytes:geom+fiber+Math.round(maps)+shadow+screenBytes,transientBakeBytes:bakeJob?bakeJob.target.attachmentBytes+bakeJob.maps.length*bakeSize*bakeSize*4*4/3:0,jsHeapUsed:performance.memory?.usedJSHeapSize??null,jsHeapMeaning:'browser estimate; not exclusive application ownership',fiberStagingPeak:hairs?.peakTypedStagingBytes||0,retainedDenseFiberPoints:0,retainedYarnPoints:0,frameLimit:state.frameLimit,shadowHz:state.quality==='reference'?'per frame':15,quality:state.quality,cpuSubmitMs:window.__DENIM_WORKBENCH__?.lastFrame?.cpuSubmitMs??null,gpuTimerMs:timer.lastMs,gpuTimerSamples:timer.samples,gpuTimerAvailable:!!timer.ext,gpuDisjoint:timer.disjoint,geometryBuilds,recipeBytes:new TextEncoder().encode(JSON.stringify(recipe())).length,stitch:stitchStats,fiberEncoding:{curves:hairs?.curves,points:hairs?.storedPoints,maxTangentVectorError:hairs?.maxTangentError,maxLifeError:hairs?.maxLifeError},notIncluded:'driver/browser backing stores, framebuffer padding, other tabs and temporary JS allocations; no OS percentage claim',motion:'analytic shader deformation; no physical cloth solver'};}
function updateBudgetHUD(){if(!$('budgetReadout'))return;const b=budget(),mb=n=>(n/1048576).toFixed(1);$('budgetReadout').textContent=`已登记 GPU 资源 ${mb(b.trackedGpuBytes)} MiB\\n几何 ${mb(b.geometryBuffers)} · 纤维 ${mb(b.compactFiberTextures)}\\n材质 ${mb(b.derivedMaterialMaps)} · 阴影 ${mb(b.shadowTexture)}\\n渲染目标 ${mb(b.renderTargets)} MiB\\n材质配方 ${b.recipeBytes} B · 摆动上限 ${b.frameLimit} 帧/秒\\nCPU提交 ${b.cpuSubmitMs?.toFixed(2)??'—'} ms · GPU计时 ${b.gpuTimerMs?.toFixed(2)??'不可用'} ms`;}
''' +s[loc:]
pos=s.index('window.__DENIM_WORKBENCH__={')
s=s[:pos]+'''$('quality').onchange=e=>{state.quality=e.target.value;request();};$('frameLimit').onchange=e=>{state.frameLimit=+e.target.value;request();};
for(const key of ['stitchCells','threadDiameter'])$(key).oninput=e=>{state[key]=+e.target.value;$(key+'Val').textContent=key==='stitchCells'?(state[key]*graph.p.warpPitch).toFixed(2)+' mm':state[key].toFixed(3)+' mm';clearTimeout(bakeTimer);bakeTimer=setTimeout(()=>{buildSeam();bakeDirty=true;request();},100);};
$('seamNear').onclick=()=>{state.seam=true;state.zoom=5.2;state.panX=0;state.panY=-graph.p.height/2+13.4;state.yaw=-.14;state.pitch=.22;bakeDirty=true;updateText();request();};$('seamBack').onclick=()=>{state.seam=true;state.zoom=5.2;state.panX=0;state.panY=-graph.p.height/2+13.4;state.yaw=Math.PI;state.pitch=.10;bakeDirty=true;updateText();request();};
$('saveRecipe').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(recipe())],{type:'application/json'}));a.href=url;a.download='KAOPU_Denim_R09_Recipe.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('loadRecipe').onchange=async e=>{try{restoreRecipe(JSON.parse(await e.target.files[0].text()));}catch(err){$('recipeError').textContent=err.message;}e.target.value='';};
''' +s[pos:]
s=s.replace('function updateText(){', "function updateText(){$('quality').value=state.quality;$('frameLimit').value=state.frameLimit;for(const k of ['stitchCells','threadDiameter']){$(k).value=state[k];$(k+'Val').textContent=k==='stitchCells'?(state[k]*.42).toFixed(2)+' mm':state[k].toFixed(3)+' mm';}")
(p/'app.js').write_text(s)
s=(base/'template.html').read_text().replace('R08','R09').replace('FINITE STAPLES','COMPACT RUNTIME').replace('棉纱近景 · 短纤维 · 稳定采样','同源纤维 · 运行预算 · 锁式针脚')
s=s.replace('/*COTTON*/','/*BUDGET*/\n/*COMPACT*/\n/*STITCH*/\n/*COTTON*/')
s=s.replace('<section><h2>观察 / PRESENTATION</h2>', '''<section><h2>缝线 / LOCKSTITCH</h2><label>针距<span id="stitchCellsVal">2.94 mm</span></label><input id="stitchCells" type="range" min="4" max="10" step="1" value="7"><label>缝线直径<span id="threadDiameterVal">0.105 mm</span></label><input id="threadDiameter" type="range" min=".06" max=".18" step=".005" value=".105"><div class="buttons"><button id="seamNear">针脚正面近看</button><button id="seamBack">底线与穿布</button></div><p class="note">面线与底线在布内交锁。针孔是局部覆盖开口，不是纱线断裂或缝纫力学求解。</p></section><section><h2>性能 / RESOURCE BUDGET</h2><select id="quality"><option value="balanced">节能保真：近景减少重复超采样</option><option value="reference">R08 采样规格：高精度对照</option></select><label>连续摆动帧率上限</label><select id="frameLimit"><option value="15">15 帧/秒 · 低功耗</option><option value="30" selected>30 帧/秒 · 默认</option><option value="60">60 帧/秒 · 更高功耗</option></select><pre id="budgetReadout" style="white-space:pre-wrap;font-size:11px;line-height:1.8">正在统计…</pre><p class="note">资源登记不是整个浏览器内存；计时不是任务管理器占用率。多件衣服应共享引擎，仅保存各自配方。</p><button id="saveRecipe">导出极小材质配方</button><label>读取材质配方<input id="loadRecipe" type="file" accept=".json" style="max-width:130px"></label><span id="recipeError"></span></section><section><h2>观察 / PRESENTATION</h2>''')
s=s.replace('明线是针迹几何示范，尚非完整锁式缝合求解。','明线包含连续面线、底线与穿布交锁路径；不包含真实缝纫及布料受力求解。')
(p/'template.html').write_text(s)
s=(p/'app.js').read_text()
s=s.replace('if(m.textures)m.textures.forEach', 'if(m.indexBuffer)gl.deleteBuffer(m.indexBuffer);if(m.textures)m.textures.forEach')
s=s.replace("if(key===cullKey)return;cullKey=key;", "if(key===cullKey)return;cullKey=key;Compact.selectVisible(gl,hairs,graph,state,vp,Budget);")
s=s.replace('Sampling.smooth(4,9,pixelsPerYarn)', 'Sampling.smooth(1.5,3,pixelsPerYarn)')
s=s.replace('gl.drawArrays(gl.TRIANGLE_STRIP,0,hairs.drawVertices);', 'if(hairs.indexBuffer)gl.drawElements(gl.TRIANGLE_STRIP,hairs.indexCount,gl.UNSIGNED_INT,0);else gl.drawArrays(gl.TRIANGLE_STRIP,0,hairs.drawVertices);')
s=s.replace('(state.fuzz>.01?hairs.count/3:0)', '(state.fuzz>.01?hairs.visibleSegments*2:0)')
s=s.replace('const geom=[...mainMeshes,carrierMesh,seams,looseMesh].reduce', 'const geom=(hairs?.indexBytes||0)+[...mainMeshes,carrierMesh,seams,looseMesh].reduce')
s=s.replace('retainedDenseFiberPoints:0,', 'retainedDenseFiberPoints:0,fiberVisibilityMetadataBytes:(hairs?.records?.byteLength||0)+(hairs?.worldBounds?.byteLength||0),visibleFiberCurves:hairs?.visibleCurves,')
(p/'app.js').write_text(s)
p=D/'app.js';s=p.read_text();a=s.index('vec3 yarnSection(float t,');b=s.index('\nvoid main()',a);old=s[a:b]
profile=r'''struct YarnProfile{vec2 m;vec3 B,N;float h,ra,rz,pitch,ph,t;};
YarnProfile yarnProfile(float t,int id){YarnProfile p;float pitch=uKind==0?uSize.w:uSize.z;float ph=float(id)+float(uKind)*79.;float bulge=noise1(t*.10+ph*19.31);float irregular=1.+uSlub*(.20*(hash(ph)*2.-1.)+.24*(bulge-.5)+.045*sin(t*.61+ph));
p.ra=(uKind==0?uSize.z*.49:uSize.w*.235)*clamp(irregular,.84,1.09);p.rz=uParam.y*(uKind==0?1.:.68)*(1.+uSlub*.14*(bulge-.5));float gate=sin(3.14159265*(t-.5));p.h=liftAt(t,id,uKind)-(uKind==1?uParam.y*.18:0.)+.023*uSlub*gate*gate*sin(t*.48+ph*.67);float deriv=(liftAt(t+.008,id,uKind)-liftAt(t-.008,id,uKind))/(.016*pitch);vec3 T=normalize(uKind==0?vec3(0,1,deriv):vec3(1,0,deriv));p.B=uKind==0?vec3(1,0,0):vec3(0,1,0);p.N=normalize(uKind==0?cross(p.B,T):cross(T,p.B));p.m=uKind==0?vec2((float(id)+.5)*uSize.z-uSize.x*.5,t*uSize.w-uSize.y*.5):vec2(t*uSize.z-uSize.x*.5,(float(id)+.5)*uSize.w-uSize.y*.5);float wobble=uSlub*gate*(.036*sin(t*.37+ph*.71)+.021*sin(t*.113+ph*1.9));p.m+=p.B.xy*wobble;p.pitch=pitch;p.ph=ph;p.t=t;return p;}
vec3 yarnSection(YarnProfile p,float theta,float scale){float q=theta/0.785398163397,k=floor(q),f=fract(q);vec2 circle=vec2(cos(theta),sin(theta)),poly=mix(vec2(cos(k*0.785398163397),sin(k*0.785398163397)),vec2(cos((k+1.)*0.785398163397),sin((k+1.)*0.785398163397)),f),cs=mix(circle,poly,uSideMorph);float packing=cottonPacking(theta,p.t*p.pitch,p.ph).x;vec3 delta=(p.B*p.ra*cs.x*scale+p.N*p.rz*cs.y*scale)*packing;return vec3(p.m,p.h)+delta;}
'''
s=s.replace(old,'${yarnProfileGLSL}')
s=s.replace('const vs=`#version','const yarnProfileGLSL=`'+profile+'`;\nconst vs=`#version',1)
s=s.replace('vec3 local=yarnSection(t,theta,id,sectionScale);','YarnProfile profile=yarnProfile(t,id);vec3 local=yarnSection(profile,theta,sectionScale);')
s=s.replace('yarnSection(low,theta,id,aP.z)','yarnSection(yarnProfile(low,id),theta,aP.z)').replace('yarnSection(high,theta,id,aP.z)','yarnSection(yarnProfile(high,id),theta,aP.z)')
s=s.replace('yarnSection(t,theta+.004,id,1.)','yarnSection(profile,theta+.004,1.)').replace('yarnSection(t,theta-.004,id,1.)','yarnSection(profile,theta-.004,1.)')
s=s.replace('yarnSection(t,aP.y,id,scale)','yarnSection(yarnProfile(t,id),aP.y,scale)')
s=s.replace(".some(k=>k in patch)",".some(k=>k in patch&&patch[k]!==state[k])")
s=s.replace("Object.assign(state,presets[b.dataset.preset],{preset:b.dataset.preset});updateText();build();", "const previousSlub=state.slub;Object.assign(state,presets[b.dataset.preset],{preset:b.dataset.preset});updateText();if(previousSlub!==state.slub)build();else{bakeDirty=true;request();}")
s=s.replace('renderDeadline=performance.now()+(state.animate?1000/state.frameLimit:0);', 'renderDeadline=start+(state.animate?1000/state.frameLimit:0);')
s=s.replace('function request(){if(!pending&&!document.hidden){pending=true;const delay=state.animate?Math.max(0,renderDeadline-performance.now()):0;if(delay>1)setTimeout(()=>requestAnimationFrame(render),delay);else requestAnimationFrame(render);}}', 'let scheduledTimer=null,scheduledFrame=null;function request(){if(!pending&&!document.hidden){pending=true;const delay=state.animate?Math.max(0,renderDeadline-performance.now()):0;const next=()=>{scheduledTimer=null;scheduledFrame=requestAnimationFrame(render);};if(delay>1)scheduledTimer=setTimeout(next,delay);else next();}}')
s=s.replace("document.addEventListener('visibilitychange',()=>{if(!document.hidden){pending=false;last=0;request();}});", "document.addEventListener('visibilitychange',()=>{clearTimeout(scheduledTimer);cancelAnimationFrame(scheduledFrame);scheduledTimer=scheduledFrame=null;pending=false;last=0;if(!document.hidden)request();});")
s=s.replace("{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'}","{alpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'default'}")
s=s.replace('const timer=new Budget.Timer(gl);','const timer=new Budget.Timer(gl);const contextAttributes=gl.getContextAttributes();')
s=s.replace("quality:state.quality,cpuSubmitMs:","quality:state.quality,contextAttributes,cpuSubmitMs:")
s=s.replace('threadDiameter:.105','threadDiameter:.14')
s=s.replace('${fragCommon}${shade}\nin vec3 vW,vN,vT;in vec2 vM,vUV;', '${fragCommon}${shade}\nuniform float uThreadRadius;in vec3 vW,vN,vT;in vec2 vM,vUV;')
s=s.replace('layeredLighting(c,N,T,vW,.25,.105)','layeredLighting(c,N,T,vW,.25,2.*uThreadRadius)')
s=s.replace('state.light,state.seam,state.structure,state.quality', 'state.light,state.seam,state.stitchCells,state.threadDiameter,state.structure,state.quality')
p.write_text(s)
p=D/'template.html';s=p.read_text().replace('0.105 mm','0.140 mm').replace('value=".105"','value=".14"');p.write_text(s)
print('R09 sources generated from frozen R08; no old runtime changed')
