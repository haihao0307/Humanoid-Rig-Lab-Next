from pathlib import Path
p=Path(__file__).resolve().parent;old=p.parent/'r14'
s=(old/'dynamics.js').read_text()
s=s.replace("new KAOPUDenimBend.Sheet(m.options,m.contract)","new KAOPUDenimFastBend.Sheet(m.options,m.contract)")
s=s.replace("+KAOPUDenimBend.workerModule+'\\nconst Top=", "+KAOPUDenimBend.workerModule+'\\n'+KAOPUDenimFastBend.workerModule+'\\nconst Top=")
assert 'KAOPUDenimFastBend.workerModule' in s
# Do not recompute/upload a known-zero legacy field while using the fold grid.
s=s.replace('for(let j=0;j<19;j++)for(let i=0;i<25;i++){const id=j*25+i;field', "if(!m.labGrid)for(let j=0;j<19;j++)for(let i=0;i<25;i++){const id=j*25+i;field")
a=s.index('vec3 r14Cubic(');b=s.index('\nvoid dynamicFrame',a)
s=s[:a]+'''// R15: reuse the same four Hermite texels for position and its derivative.
// Both values retain the R14 polynomial; no resampling lattice or LOD change.
void r15CubicPair(int ix,int iy,float t,int ny,float h,out vec3 position,out vec3 slope){
 vec3 a=texelFetch(uR13,ivec2(ix,iy),0).xyz,b=texelFetch(uR13,ivec2(ix+1,iy),0).xyz,ta=texelFetch(uR13,ivec2(ix,iy+ny),0).xyz*h,tb=texelFetch(uR13,ivec2(ix+1,iy+ny),0).xyz*h;
 float t2=t*t,t3=t2*t;position=(2.*t3-3.*t2+1.)*a+(t3-2.*t2+t)*ta+(-2.*t3+3.*t2)*b+(t3-t2)*tb;
 slope=((6.*t2-6.*t)*a+(3.*t2-4.*t+1.)*ta+(-6.*t2+6.*t)*b+(3.*t2-2.*t)*tb)/h;
}
void r14Frame(vec2 m,out vec3 base,out mat3 frame){ivec2 ts=textureSize(uR13,0);ivec2 sz=ivec2(ts.x,(ts.y-1)/3);vec2 q=clamp(m/uPhysicsSize+.5,vec2(0),vec2(1))*vec2(sz-1),f;ivec2 lo=min(ivec2(floor(q)),sz-2);f=q-vec2(lo);vec3 a,b,ax,bx;float h=uPhysicsSize.x/float(sz.x-1);r15CubicPair(lo.x,lo.y,f.x,sz.y,h,a,ax);r15CubicPair(lo.x,lo.y+1,f.x,sz.y,h,b,bx);vec3 dx=vec3(1,0,0)+mix(ax,bx,f.y),dy=vec3(0,1,0)+(b-a)/(uPhysicsSize.y/float(sz.y-1));base=vec3(m,0)+mix(a,b,f.y);frame=mat3(dx,dy,normalize(cross(dx,dy)));}
''' +s[b:]
# Separate wall/physics speed metrics; keep every integrator step and original cap.
s=s.replace("report:{...sim.report(),solverMs:totalMs,", "report:{...sim.report(),sampledAtWorkerMs:performance.now(),solverMs:totalMs,")
(p/'dynamics.js').write_text(s)
s=(old/'app.js').read_text().replace('R14.0','R15.0')
s=s.replace("!['R12.0','R12.1','R13.0','R15.0']", "!['R12.0','R12.1','R13.0','R14.0','R15.0']")
s=s.replace("const optics=KAOPUFiberOptics.integrate();", "const frameMetrics=KAOPUDenimFrameMetrics.create();const optics=KAOPUFiberOptics.integrate();")
oldfunc="function uf(p,k,x){gl.uniform1f(U(p,k),x);}function ui(p,k,x){gl.uniform1i(U(p,k),x);}function v3(p,k,x){gl.uniform3fv(U(p,k),x);}function mat(p,k,x){gl.uniformMatrix4fv(U(p,k),false,x);}"
newfunc="""function changedUniform(p,k,x){const cache=p._valueCache||(p._valueCache=Object.create(null));if(typeof x==='number'){if(cache[k]===x)return false;cache[k]=x;return true;}const old=cache[k];if(old&&old.length===x.length){let same=true;for(let i=0;i<x.length;i++)if(old[i]!==x[i]){same=false;break;}if(same)return false;for(let i=0;i<x.length;i++)old[i]=x[i];}else cache[k]=Array.from(x);return true;}
function uf(p,k,x){const u=U(p,k);if(u!==null&&changedUniform(p,k,x))gl.uniform1f(u,x);}function ui(p,k,x){const u=U(p,k);if(u!==null&&changedUniform(p,k,x))gl.uniform1i(u,x);}function v3(p,k,x){const u=U(p,k);if(u!==null&&changedUniform(p,k,x))gl.uniform3fv(u,x);}function v4(p,k,x){const u=U(p,k);if(u!==null&&changedUniform(p,k,x))gl.uniform4fv(u,x);}function mat(p,k,x){const u=U(p,k);if(u!==null&&changedUniform(p,k,x))gl.uniformMatrix4fv(u,false,x);}"""
assert oldfunc in s;s=s.replace(oldfunc,newfunc)
s=s.replace("gl.uniform4fv(U(p,'uSize'),[graph.p.width,graph.p.height,graph.p.warpPitch,graph.p.weftPitch]);", "v4(p,'uSize',[graph.p.width,graph.p.height,graph.p.warpPitch,graph.p.weftPitch]);")
s=s.replace("gl.uniform4fv(U(p,'uParam'),[graph.lift,graph.rz,state.thickness*.5,0]);", "v4(p,'uParam',[graph.lift,graph.rz,state.thickness*.5,0]);")
# Ensure the display poll records only the completed image, not partial batches.
s=s.replace("gl.deleteSync(gpuFence);gpuFence=null;if(status===gl.WAIT_FAILED)throw Error('GPU completion fence failed');return true;", "gl.deleteSync(gpuFence);gpuFence=null;if(status===gl.WAIT_FAILED)throw Error('GPU completion fence failed');frameMetrics.complete();return true;")
s=s.replace('if(elapsed<16)batchBudget=Math.min(2097152,batchBudget*2);else if(elapsed>250)batchBudget=Math.max(131072,batchBudget/2);', 'if(elapsed<8)batchBudget=Math.min(33554432,batchBudget*2);else if(elapsed>20)batchBudget=Math.max(131072,batchBudget/2);')
# rAF itself paces a 60Hz display. Sleeping first often misses that refresh.
s=s.replace('if(state.animate)request(Math.max(0,1000/state.motionFps-(lastDrawTime-start)));', 'frameMetrics.submit(frame,window.__DENIM_WORKBENCH__.lastFrame.physics.steps||0,window.__DENIM_WORKBENCH__.lastFrame.physics.simulationSeconds??((window.__DENIM_WORKBENCH__.lastFrame.physics.steps||0)/240),window.__DENIM_WORKBENCH__.lastFrame.cpuSubmitMs);if(state.animate)request(state.motionFps>=60?0:Math.max(0,1000/state.motionFps-(lastDrawTime-start)));')
# End-of-generator requests must schedule the next whole frame on rAF, not
# via the partial-frame timer while frameJob is still live.
s=s.replace('if(frameJob)setTimeout(()=>render(performance.now()),Math.max(1,delay));', 'if(frameJob&&internal)setTimeout(()=>render(performance.now()),Math.max(1,delay));')
# Add actual metrics to diagnostics. Report calculation already occurs <=4Hz.
s=s.replace('return {geometryBufferBytes:geom,', 'return {frameTiming:frameMetrics.report(),geometryBufferBytes:geom,')
s=s.replace("$('budgetStats').textContent=`已计 GPU", "const f=p.frameTiming;$('budgetStats').textContent=`完成绘制 ${f.fps.toFixed(1)} FPS · 目标 ≥60（非保证）\\n新物理状态 ${f.newPhysicsFps.toFixed(1)} FPS · 仿真速度 ${f.simulationSpeed.toFixed(2)}×\\n帧间隔P95 ${f.frameP95Ms?.toFixed(2)??'—'} ms\\n求解 ${dynamics.report?.solverBackend||'JS'} · 240 Hz\\n已计 GPU")
s=s.replace('version:\'R15.0\',renderer:', "frameMetrics:()=>frameMetrics.report(30),frameMetricRows:()=>frameMetrics.all(),resetFrameMetrics:()=>frameMetrics.reset(),version:'R15.0',renderer:")
s=s.replace("return {geometryBufferBytes", "return {geometryBufferBytes")
# Dedicated optional benchmark changes only the permitted edge target, not
# physical time, mass, topology, self-contact or resolution.
insert="""
let perfRun=null;
function stopPerformanceTest(){if(!perfRun)return;clearInterval(perfRun.timer);const saved=perfRun.saved;perfRun=null;mechanicsControls({fold:saved.fold,gripEnabled:saved.gripEnabled});state.animate=saved.animate;syncMotion();$('r15-benchmark').textContent='运行30秒真实运动检查';}
function startPerformanceTest(){if(perfRun){stopPerformanceTest();return;}if(state.experiment!=='fold')enterExperiment('fold',false);const saved={fold:state.fold,gripEnabled:state.gripEnabled,animate:state.animate};frameMetrics.reset();state.animate=true;mechanicsControls({gripEnabled:true,fold:1});syncMotion();let began=performance.now(),phase=-1;perfRun={saved,timer:setInterval(()=>{const elapsed=(performance.now()-began)/1000,next=Math.floor(elapsed/2.7)%2; if(elapsed>=30){const r=frameMetrics.report(30);stopPerformanceTest();$('r15-result').textContent=`已完成：绘制 ${r.fps.toFixed(1)} FPS，新状态 ${r.newPhysicsFps.toFixed(1)} FPS，仿真 ${r.simulationSpeed.toFixed(2)}×，P95 ${r.frameP95Ms?.toFixed(1)} ms。仅为本设备本窗口；GPU完成观察不等于显示器测量。`;return;}if(next!==phase){phase=next;mechanicsControls({fold:next?0:1});}$('r15-benchmark').textContent=`停止检查 · ${Math.floor(elapsed)}/30秒`;},150)};}
$('r15-benchmark').onclick=startPerformanceTest;
"""
s=s.replace('setInterval(updateExperimentPanel,700);',insert+'\nsetInterval(updateExperimentPanel,700);')
s=s.replace("window.__DENIM_WORKBENCH__={ready:false,", "window.__DENIM_WORKBENCH__={ready:false,startPerformanceTest,stopPerformanceTest,")
(p/'app.js').write_text(s)
s=(old/'template.html').read_text().replace('R14.0','R15.0')
s=s.replace('/*BENDING*/','/*BENDING*/\n/*FASTBEND*/\n/*FRAMEMETRICS*/')
s=s.replace('<div id="budgetStats"', '<button id="r15-benchmark" type="button">运行30秒真实运动检查</button><div id="r15-result" style="font-size:11px;white-space:normal"></div><div id="budgetStats"')
# Locate exact budget selector if tag differs
if 'id="r15-benchmark"' not in s:
 s=s.replace('id="budgetStats"','id="budgetStats"')
 pos=s.index('id="budgetStats"');tag=s.rfind('<',0,pos);s=s[:tag]+'<button id="r15-benchmark" type="button">运行30秒真实运动检查</button><div id="r15-result" style="font-size:11px;white-space:normal"></div>'+s[tag:]
(p/'template.html').write_text(s)
s=(old/'build.py').read_text().replace("('BENDING','bend-cloth.js'),", "('BENDING','bend-cloth.js'),('FASTBEND','bend-fast.js'),('FRAMEMETRICS','frame-metrics.js'),").replace('R14.0','R15.0').replace("'denim-workshop/r14/index.html'","'denim-workshop/r15/index.html'").replace("'400e0d217c1b73015f2e052a0947556bb285c333'","'9d5437755d69c8a86557b10cbfcf12dbb84812ed'")
(p/'build.py').write_text(s)
print('Patched accelerated kernel, shared shader loads, uniform cache, scheduling, measured completion metrics')

# Additional final memory/reporting and benchmark control refinements.
p=Path(__file__).resolve().parent
s=(p/'app.js').read_text()
s=s.replace("physicsWorkerBytes:dynamics.report?.ownedTypedArrayBytes??dynamics.report?.workerArrayBytes??null", "physicsWorkerBytes:dynamics.report?(dynamics.report.wasmLinearMemoryBytes||0)+(dynamics.report.ownedTypedArrayBytes??dynamics.report.workerArrayBytes??0):null,physicsMemoryAccounting:'WASM linear memory plus owned JS views; overlapping WASM views conservatively double counted'")
s=s.replace("const saved=perfRun.saved;perfRun=null;mechanicsControls({fold:saved.fold,gripEnabled:saved.gripEnabled});", "const saved=perfRun.saved;perfRun=null;if(state.experiment==='fold')mechanicsControls({fold:saved.fold,gripEnabled:saved.gripEnabled});")
s=s.replace("function enterExperiment(mode,play=true){if(![", "function enterExperiment(mode,play=true){if(perfRun)stopPerformanceTest();if(![")
(p/'app.js').write_text(s)

# Preserve a completed/manual benchmark report and export actual local conditions.
s=(p/'app.js').read_text()
s=s.replace('let perfRun=null;','let perfRun=null,lastPerfReport=null;')
s=s.replace("const saved=perfRun.saved;perfRun=null;", "const saved=perfRun.saved;lastPerfReport={statistics:frameMetrics.report(30),frames:frameMetrics.all(),stoppedAt:new Date().toISOString(),completedFullDuration:performance.now()-perfRun.began>=30000};perfRun=null;")
s=s.replace("perfRun={saved,timer:setInterval", "perfRun={saved,began,generation:dynamics.generation,timer:setInterval")
s=s.replace("const elapsed=(performance.now()-began)/1000,next=", "if(state.experiment!=='fold'||dynamics.generation!==perfRun.generation){stopPerformanceTest();$('r15-result').textContent='试样已改变，本次检查中止；旧帧不混入新试样。';return;}const elapsed=(performance.now()-began)/1000,next=")
s=s.replace("$('r15-benchmark').onclick=startPerformanceTest;", """$('r15-benchmark').onclick=startPerformanceTest;
$('r15-save').onclick=()=>{const ex=gl.getExtension('WEBGL_debug_renderer_info');const report={version:'R15.0',schema:'kaopu.denim-performance@1',benchmark:lastPerfReport||{statistics:frameMetrics.report(30),frames:frameMetrics.all(),completedFullDuration:false},conditions:{userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],canvas:[canvas.width,canvas.height],devicePixelRatio,renderer:ex?gl.getParameter(ex.UNMASKED_RENDERER_WEBGL):'unavailable',state:{...state},physicalState:dynamics.report},limits:['GPU fence observed by JS, not display/compositor capture','A 60 FPS target is not a universal hardware guarantee','Frame and distinct physical-state rate are separate','No upload: this report is saved only at user request']};const a=document.createElement('a');const u=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.href=u;a.download='denim-r15-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};""")
(p/'app.js').write_text(s)
s=(p/'template.html').read_text();s=s.replace('<div id="r15-result"', '<button id="r15-save" type="button">导出本机帧时间报告</button><div id="r15-result"');(p/'template.html').write_text(s)
