"""Bound expensive physical frames without lowering geometry or pixel samples.
The static renderer remains as the fixed look baseline. Physical frames preserve
one material/camera/physics snapshot and are presented only after all batches.
No watchdog disable, gl.finish, lost-context retry, curve omission or resolution
change. Apply only the exact audited input or final output forms.
"""
from pathlib import Path
import hashlib
P=Path(__file__).resolve().parent
p=P/'runtime-budget.js';s=p.read_text()
if 'out.drawRanges=[];' not in s:
    assert hashlib.sha256(s.encode()).hexdigest()=='33e6c635d5a596c93f2574e5761b13287d4b4db1b8bc3a8796609d8806f5d167'
    s=s.replace('let n=0,tri=0;for(let k=0;k<cc;k++){','let n=0,tri=0,rangeStart=0,rangeTriangles=0;out.drawRanges=[];for(let k=0;k<cc;k++){')
    s=s.replace('tri+=(len-1)*2;}','tri+=(len-1)*2;rangeTriangles+=(len-1)*2;if(n-rangeStart>=65536){out.drawRanges.push({start:rangeStart,count:n-rangeStart,triangles:rangeTriangles});rangeStart=n;rangeTriangles=0;}}if(n>rangeStart)out.drawRanges.push({start:rangeStart,count:n-rangeStart,triangles:rangeTriangles});')
    p.write_text(s)
p=P/'app.js';s=p.read_text()
if 'function* physicalFrameBatches' in s:
    print('Bounded renderer already present');raise SystemExit(0)
assert hashlib.sha256(s.encode()).hexdigest()=='05d5941d36e98754bb71a25247d901282ca925c6bdb5185c36d8bed7a7771bde'
# Deferred structural edits cannot destroy buffers referenced by an in-flight frame.
s=s.replace("let physicsShape=1,physicsConfigKey='';", "let physicsShape=1,physicsConfigKey='';let frameJob=null,framePhysics=null,insideFrame=false,deferredBuild=false,batchBudget=524288,batchSubmittedAt=0,batchTrianglePeak=0,cancelledFrames=0;const physicsView=()=>framePhysics||dynamics;")
s=s.replace('function build(){detail.reset();','function build(){if(frameJob&&!insideFrame){deferredBuild=true;request();return;}detail.reset();')
s=s.replace("ui(p,'uPhysics',dynamics.active&&dynamics.ready", "ui(p,'uPhysics',physicsView().active&&physicsView().ready")
s=s.replace("dynamics.active?0:(state.animate?clock:0)","physicsView().active?0:(state.animate?clock:0)")
# Cache keys use the same uploaded physical revision, not an asynchronously received one.
s=s.replace('dynamics.active?dynamics.revision:0','physicsView().active?physicsView().revision:0')
# Store the old function for static look and synchronous internal audit only.
start=s.index("let lod='';function render(time=0)");end=s.index('\nfunction request(delay=0)',start)
old=s[start:end]
s=s[:start]+old.replace("let lod='';function render(time=0)","let lod='';function renderStatic(time=0)",1)+s[end:]
# Build an equivalent physical-frame generator from the same source body.
gen=old.replace("let lod='';function render(time=0)","function* physicalFrameBatches(time=0)",1)
gen=gen.replace('configurePhysics();dynamics.upload();gpuTimer.start();','configurePhysics();dynamics.upload();framePhysics={active:dynamics.active,ready:dynamics.ready,revision:dynamics.revision,report:dynamics.report};frameJob.physics=framePhysics;frameJob.generation=dynamics.generation;gpuTimer.start();')
gen=gen.replace('if(!useMip)makeShadow();if(wantFiltered)makeMacroShadow();','if(!useMip)yield* makeShadowBatches();if(wantFiltered){makeMacroShadow();yield 65536;}')
gen=gen.replace(' function scene(mip){',' function* scene(mip){')
gen=gen.replace('if(!state.qaAudit)drawStudio(eye,cw/ch);','if(!state.qaAudit){drawStudio(eye,cw/ch);yield 131072;}')
gen=gen.replace('}else drawYarns(yarnProg,vp,eye);','}else yield* yarnBatches(yarnProg,vp,eye);')
gen=gen.replace("if(!mip&&!state.qaAudit&&looseMesh){uniforms(looseProg,vp,eye);gl.bindVertexArray(looseMesh.vao);gl.drawElements(gl.TRIANGLES,looseMesh.count,gl.UNSIGNED_INT,0);drawCount++;}","if(!mip&&!state.qaAudit&&looseMesh)yield* triangleBatches(looseProg,looseMesh,vp,eye);")
gen=gen.replace("if(!mip&&state.seam&&seamVisible){uniforms(seamProg,vp,eye);ui(seamProg,'uEdge',0);gl.bindVertexArray(seams.vao);gl.drawElements(gl.TRIANGLES,seams.count,gl.UNSIGNED_INT,0);drawCount++;}","if(!mip&&state.seam&&seamVisible)yield* triangleBatches(seamProg,seams,vp,eye);")
gen=gen.replace('drawFiberStore(', 'yield* fiberBatches(')
gen=gen.replace('scene(true);','yield* scene(true);').replace('scene(useMip);','yield* scene(useMip);')
gen=gen.replace('physics:{active:dynamics.active,...dynamics.report,','physics:{active:framePhysics.active,...framePhysics.report,')
gen=gen.replace('cpuSubmitMs:performance.now()-start,',"cpuSubmitMs:frameJob.cpuMs+performance.now()-frameJob.resumeStart,cooperativeRender:{batches:frameJob.batches+1,maximumBatchTriangles:Math.max(batchTrianglePeak,frameJob.currentCost),cancelledFrames,onePhysicsSnapshot:true,qualityReduced:false,gpuElapsedIncludesSchedulingWait:true},")
# Avoid new physics samples overwriting the just-rendered diagnostic while polling.
# Generation/revision still progress independently in the worker.
helpers=r'''
const yarnRangeAttribute=gl.getAttribLocation(yarnProg,'aRange');
function* yarnBatches(p,vp,cam){
 for(let kind=0;kind<2;kind++){const m=mainMeshes[geomLevel*2+kind],full=shadowDrawing,count=full?instanceCounts[kind]:viewCounts[kind],buffer=full?instances[kind]:viewBuffers[kind],vao=full?m.vao:m.viewVao;
  for(let first=0;first<count;first+=96){const n=Math.min(96,count-first);uniforms(p,vp,cam);for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,baked[i]||dummyTex);ui(p,['uFrontCol','uFrontN','uBackCol','uBackN'][i],i);}gl.disable(gl.CULL_FACE);ui(p,'uKind',kind);gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const at=yarnRangeAttribute;gl.vertexAttribPointer(at,4,gl.FLOAT,false,0,first*16);gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,n);gl.vertexAttribPointer(at,4,gl.FLOAT,false,0,0);drawCount++;yield m.count*n/3;}
 }
}
function* triangleBatches(p,m,vp,eye){for(let offset=0;offset<m.count;offset+=196608){const count=Math.min(196608,m.count-offset);uniforms(p,vp,eye);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,offset*4);drawCount++;yield count/3;}}
function* fiberBatches(store,vp,eye,span,ch,distance,klass=0){if(!store)return;const ranges=store.drawRanges||[{start:0,count:store.indexCount,triangles:store.visibleTriangles}];for(const range of ranges){uniforms(hairProg,vp,eye);ui(hairProg,'uCurveClass',klass);uf(hairProg,'uMmPerPixel',span/ch);uf(hairProg,'uFocusDistance',distance);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.activeTexture(gl.TEXTURE8);gl.bindTexture(gl.TEXTURE_2D,store.pointTex);ui(hairProg,'uFiberPoints',8);gl.activeTexture(gl.TEXTURE9);gl.bindTexture(gl.TEXTURE_2D,store.metaTex);ui(hairProg,'uFiberMeta',9);gl.bindVertexArray(store.vao);gl.drawElements(gl.TRIANGLE_STRIP,range.count,gl.UNSIGNED_INT,range.start*4);drawCount++;gl.depthMask(true);gl.disable(gl.BLEND);yield range.triangles;}}
'''
# Mirror the unchanged detailed shadow, but allow yields between primitive batches.
a=s.index('function makeShadow(){');b=s.index('\nfunction drawStudio',a)
shadow=s[a:b].replace('function makeShadow(){','function* makeShadowBatches(){',1)
shadow=shadow.replace("gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);", "try{gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);")
shadow=shadow.replace('drawYarns(yarnProg,lightVP,keyPos);','yield* yarnBatches(yarnProg,lightVP,keyPos);')
shadow=shadow.replace("{uniforms(prog,lightVP,keyPos);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);drawCount++;shadowTriangles+=m.count/3;}","{yield* triangleBatches(prog,m,lightVP,keyPos);shadowTriangles+=m.count/3;}")
shadow=shadow.replace('shadowDrawCalls=drawCount-old[3];[geomLevel,longMorph,sideMorph,drawCount]=old;shadowDrawing=false;shadowKey=key;gl.bindFramebuffer(gl.FRAMEBUFFER,null);','shadowDrawCalls=drawCount-old[3];shadowKey=key;}finally{[geomLevel,longMorph,sideMorph,drawCount]=old;shadowDrawing=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);}')
# Cooperative driver. Poll only with timeout zero; production never blocks with finish().
driver=r'''
function render(time=0){
 pending=false;if(document.hidden||!stageVisible||gl.isContextLost())return;
 if(!state.qaAudit&&!gpuAvailable()){request(frameJob?4:8,true);return;}
 if(frameJob&&batchSubmittedAt){const elapsed=performance.now()-batchSubmittedAt;if(elapsed<16)batchBudget=Math.min(2097152,batchBudget*2);else if(elapsed>250)batchBudget=Math.max(131072,batchBudget/2);batchSubmittedAt=0;}
 const rect=canvas.getBoundingClientRect(),viewKeyNow=[rect.width,rect.height,devicePixelRatio||1].join('|');const stateKey=JSON.stringify(state);
 if(frameJob&&(deferredBuild||bakeDirty||stateKey!==frameJob.key||viewKeyNow!==frameJob.viewKey||dynamics.generation!==frameJob.generation)){
  // Discard an unfinished OFFSCREEN frame, never a partially displayed image.
  frameJob.iterator.return();gpuTimer.end();frameJob=null;framePhysics=null;cancelledFrames++;gl.colorMask(true,true,true,true);gl.depthMask(true);shadowDrawing=false;shadowKey='';macroShadowKey='';
 }
 if(deferredBuild){deferredBuild=false;build();}
 if(!frameJob&&(!dynamics.active||state.qaAudit||state.qaSingleBatch||bakeDirty)){renderStatic(time);return;}
 if(!frameJob){frameJob={key:JSON.stringify(state),viewKey:viewKeyNow,followup:false,state:{...state},generation:dynamics.generation,physics:null,batches:0,cpuMs:0,currentCost:0,resumeStart:0};frameJob.iterator=physicalFrameBatches(time);}
 const job=frameJob,live=state;state=job.state;framePhysics=job.physics;insideFrame=true;job.resumeStart=performance.now();let result,cost=0;
 try{do{result=job.iterator.next();if(result.done)break;cost+=Number(result.value)||0;job.currentCost=cost;}while(cost<batchBudget);}
 catch(e){job.iterator.return();frameJob=null;framePhysics=null;gpuTimer.end();throw e;}
 finally{job.cpuMs+=performance.now()-job.resumeStart;state=live;insideFrame=false;}
 if(result.done){frameJob=null;framePhysics=null;if(job.followup)request();return;}
 job.batches++;batchTrianglePeak=Math.max(batchTrianglePeak,cost);job.physics=framePhysics;submitGpu();batchSubmittedAt=performance.now();request(1,true);
}
'''
pos=s.index('\nfunction request(delay=0)')
s=s[:pos]+'\n'+helpers+'\n'+shadow+'\n'+gen+'\n'+driver+s[pos:]
s=s.replace("if(delay>0)setTimeout(()=>requestAnimationFrame(render),delay);else requestAnimationFrame(render);", "if(frameJob)setTimeout(()=>render(performance.now()),Math.max(1,delay));else if(delay>0)setTimeout(()=>requestAnimationFrame(render),delay);else requestAnimationFrame(render);")
s=s.replace('function request(delay=0){','function request(delay=0,internal=false){if(frameJob&&!insideFrame&&!internal)frameJob.followup=true;')
s=s.replace("function auditGPU(){const saved=", "function auditGPU(){if(frameJob)throw Error('Await the current physical frame before synchronous depth audit');const saved=")
s=s.replace("window.__DENIM_WORKBENCH__={ready:false,", "window.__DENIM_WORKBENCH__={ready:false,renderIdle:()=>!frameJob&&gpuAvailable(),renderBatchState:()=>({inFlight:!!frameJob,batches:frameJob?.batches||0,cancelledFrames,batchBudget}),")
p.write_text(s)
print('Exact geometry and restart order retained; bounded physical batches, offscreen cancellation, frozen uploaded physical revision.')
