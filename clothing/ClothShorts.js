// Render the current solved original cloth vertices. No posed garment targets,
// body projection, or garment skinning is performed by either vertex shader.
const SHORTS_VERTEX=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;
layout(location=1)in vec3 normal;
layout(location=2)in vec2 uv;
uniform mat4 viewProjection,lightVP;
out vec3 W,N;out vec2 C;out vec4 linenShadow;
void main(){W=position;N=normal;C=uv*(100./3.);linenShadow=lightVP*vec4(W,1.);gl_Position=viewProjection*vec4(W,1.);}`;
// Restore the formed-shorts assembly route without changing the original
// paper. The sequential gated experiment remains opt-in at the solver layer.
// Closed stitches share positions permanently; fit acceptance stays separate.
const SHORTS_WEARING_OPTIONS=Object.freeze({iterations:32,maxMaterialIterations:32,materialConvergenceStrain:.02,stitchDofs:true,stitchJoinToleranceM:.0001,needleSchedule:'overlap',maxSeamTensionN:null,bendCompliance:40000,waistSupportPath:'edge-rotation',waistSupportSlackM:.004,sewingSchedule:'overlap',handlingPolicy:'needle-and-time',triangleBodyContact:true,maxSelfCandidates:30000});
const SHORTS_INITIAL_ASSEMBLY_STEPS=420;
const SHORTS_ASSEMBLY_STEP_LIMIT=1600;
function shortsJoinRenderNormals(vertices,groups){
 for(const group of groups){const sum=[0,0,0];for(const i of group.members)for(let k=0;k<3;k++)sum[k]+=vertices[i*8+3+k];
  if(Math.hypot(...sum)<1e-12)continue;
  for(const i of group.members)for(let k=0;k<3;k++)vertices[i*8+3+k]=sum[k];
 }
}
class ClothShorts {
 constructor(surface,meshes){
  this.surface=surface;this.gl=surface.gl;this.buffers=[];this.disposed=false;
  this.body=new ShortsBody(surface,meshes);this.measurements=this.body.measure();
  this.pattern=createShortsPattern(this.measurements);
  this.simulation=new ShortsCloth(this.pattern,this.body,SHORTS_WEARING_OPTIONS);
  this.renderTriangles=this.simulation.triangles.slice();
  for(const range of this.simulation.pieceRanges)if(this.pattern.pieces.find(p=>p.id===range.id).placement.rightSide==='opposite_uv_normal')for(let t=range.triangleOffset*3;t<(range.triangleOffset+range.triangleCount)*3;t+=3){const a=this.renderTriangles[t+1];this.renderTriangles[t+1]=this.renderTriangles[t+2];this.renderTriangles[t+2]=a;}
  this.count=this.simulation.triangles.length;this.vertices=new Float32Array(this.simulation.particles.length*8);
  this.geometryBytes=this.vertices.byteLength+this.simulation.triangles.byteLength;
  this.report={generator:'cut-and-sewn-shorts@1',triangles:this.count/3,panels:this.pattern.pieces.length,geometryBytes:this.geometryBytes,textureScale:3,clothDynamics:true,legSkinning:false};
  this.assemblyReady=false;this.displayReady=false;this.assemblyState='unstarted';this.dirty=true;this.lastUpdateMilliseconds=0;this.assemblyWallTimeMs=0;this.placed=false;
  const gl=this.gl;
  try{
   this.main=program(gl,SHORTS_VERTEX,LINEN_MATERIAL_FRAGMENT);this.depth=program(gl,SHORTS_VERTEX,'#version 300 es\nprecision highp float;void main(){}');
   this.materialUniforms=Object.fromEntries(['uCam','uMode','uMaterial','uLight','uNeutral','uCompare','uDiag','uViewport','uTime','uCoarse','uWeave','uSlub','uAge','uFarId','uSheen','uFuzz'].map(k=>[k,gl.getUniformLocation(this.main.p,k)]));
   this.vao=gl.createVertexArray();if(!this.vao)throw Error('无法创建短裤绘制数组');gl.bindVertexArray(this.vao);
   const upload=(target,array,usage)=>{const b=gl.createBuffer();if(!b)throw Error('无法创建短裤布料缓冲');this.buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,array,usage);return b;};
   this.vertexBuffer=upload(gl.ARRAY_BUFFER,this.vertices,gl.DYNAMIC_DRAW);
   upload(gl.ELEMENT_ARRAY_BUFFER,this.renderTriangles,gl.STATIC_DRAW);
   for(const [location,size,offset]of [[0,3,0],[1,3,3],[2,2,6]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset*4);}
   gl.bindVertexArray(null);
  }catch(error){this.dispose();throw error;}
 }
 assemble(maxSteps=SHORTS_INITIAL_ASSEMBLY_STEPS,onProgress=()=>{}){
  if(!this.assemblyTask){
   this.assemblyTask=this.assembleOnce(maxSteps,onProgress);
   const task=this.assemblyTask;
   task.then(()=>{if(this.assemblyTask===task)this.assemblyTask=null;},()=>{if(this.assemblyTask===task)this.assemblyTask=null;});
  }
  return this.assemblyTask;
 }
 async assembleOnce(maxSteps,onProgress){
  if(!Number.isInteger(maxSteps)||maxSteps<0||maxSteps>SHORTS_ASSEMBLY_STEP_LIMIT)throw Error('Invalid bounded sewing steps');
  if(this.disposed)throw Error('Sewing was disposed');
  if(this.assemblyReady)return this.assemblyReport;
  if(!this.placed){
   // This one rigid placement belongs to dressing setup. It keeps the flat
   // original pieces at the actor's actual world location and orientation.
   const h=this.surface.boundHuman,source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));
   this.body.update();
   for(const piece of this.pattern.pieces){const p=piece.placement;p.origin=add(current.p,rotate(q,sub(p.origin,source.p)));p.basisU=rotate(q,p.basisU);p.basisV=rotate(q,p.basisV);}
   this.simulation=new ShortsCloth(this.pattern,this.body,SHORTS_WEARING_OPTIONS);this.placed=true;
  }
  const begin=performance.now();this.assemblyState='sewing';
  const remaining=maxSteps;
  for(let start=0;start<remaining;start++){
   if(this.disposed)throw Error('Sewing was disposed');
   this.simulation.step(1);this.dirty=true;onProgress((start+1)/Math.max(1,remaining));
   // Yield after every fixed step; one step can itself be expensive. Complete
   // reports perform a fresh full contact scan only at these bounded checks.
   if(this.simulation.stepIndex%30===0){const report=this.simulation.report();if(this.acceptsAssembly(report)||report.material?.valid===false)break;}
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(this.disposed)throw Error('Sewing was disposed');
  this.assemblyWallTimeMs+=performance.now()-begin;this.displayReady=true;
  const report=this.simulation.report();this.assemblyReady=this.acceptsAssembly(report);
  this.assemblyState=this.assemblyReady?'ready':this.failedAssembly(report)?'failed':'incomplete';
  this.assemblyReport={...report,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs};return this.assemblyReport;
 }
 acceptsAssembly(report){return report.sewn===true&&(report.sewingStage?.enabled===false||report.sewingStage?.complete===true)&&report.engineeringCriteriaMet===true;}
 failedAssembly(report){return report.material?.valid===false||!Number.isFinite(report.peakPrincipalStrain??0)||(report.peakPrincipalStrain??0)>.05||report.selfContact?.sweptHistory?.budgetExceeded===true||(report.selfContact?.sweptHistory?.uncertainCount??0)>0;}
 update(dt){
  if(this.disposed||!this.assemblyReady||!(dt>0))return;
  const begin=performance.now();this.body.update();this.simulation.advance(dt);this.dirty=true;this.lastUpdateMilliseconds=performance.now()-begin;
 }
 diagnostics(){return {...this.report,pattern:{version:this.pattern.version,options:{...this.pattern.options},draft:JSON.parse(JSON.stringify(this.pattern.draft)),sourceChecks:JSON.parse(JSON.stringify(this.pattern.checks))},displayReady:this.displayReady,assemblyReady:this.assemblyReady,assemblyState:this.assemblyState,assembly:this.assemblyReport,body:this.body.report(),simulation:this.simulation.report(),lastUpdateMilliseconds:this.lastUpdateMilliseconds};}
 upload(){
  if(!this.dirty)return;
  const positions=this.simulation.positions,indices=this.renderTriangles,uv=this.simulation.materialCoordinates,v=this.vertices;
  for(let i=0;i<positions.length/3;i++){v.set(positions.subarray(i*3,i*3+3),i*8);v.fill(0,i*8+3,i*8+6);v.set(uv.subarray(i*2,i*2+2),i*8+6);}
  for(let t=0;t<indices.length;t+=3){const a=indices[t]*8,b=indices[t+1]*8,c=indices[t+2]*8,ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],vx=v[c]-v[a],vy=v[c+1]-v[a+1],vz=v[c+2]-v[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const j of [a,b,c]){v[j+3]+=nx;v[j+4]+=ny;v[j+5]+=nz;}}
  // Only actual completed physical stitches share shading normals. Keep each
  // source panel's UV and every solved position; do not bridge open edges.
  if(this.simulation.dofs)shortsJoinRenderNormals(v,this.simulation.dofs.report().groups);
  for(let i=0;i<v.length;i+=8){const length=Math.hypot(v[i+3],v[i+4],v[i+5]);if(length>1e-12)for(let k=3;k<6;k++)v[i+k]/=length;}
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.vertexBuffer);this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,v);this.dirty=false;
 }
 draw(depth){
  if(this.disposed||!this.surface.visible)return;this.upload();
  const gl=this.gl,r=this.surface.renderer,p=depth?this.depth:this.main;gl.useProgram(p.p);gl.uniformMatrix4fv(p.u.viewProjection,false,depth?r.lightVP:r.vp);
  if(!depth){const u=this.materialUniforms;gl.uniform3fv(u.uCam,r.eye);gl.uniform2f(u.uViewport,gl.drawingBufferWidth,gl.drawingBufferHeight);for(const [key,value]of Object.entries({uMode:2,uMaterial:0,uLight:0,uNeutral:0,uCompare:0,uDiag:0}))gl.uniform1i(u[key],value);for(const [key,value]of Object.entries({uCoarse:1,uWeave:1,uSlub:1,uAge:.35,uFarId:1,uSheen:1,uFuzz:1,uTime:0}))gl.uniform1f(u[key],value);gl.uniformMatrix4fv(p.u.lightVP,false,r.lightVP);gl.uniform1i(p.u.shadow,1);gl.uniform1f(p.u.shadowsEnabled,r.quality==='shadow'&&r.shadowAvailable?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,r.shadow);}
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.frontFace(gl.CCW);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);if(depth)r.shadowDrawCalls++;else r.drawCalls++;gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);
 }
 dispose(){if(this.disposed)return;this.disposed=true;const gl=this.gl;for(const b of this.buffers)gl.deleteBuffer(b);if(this.vao)gl.deleteVertexArray(this.vao);if(this.main)gl.deleteProgram(this.main.p);if(this.depth)gl.deleteProgram(this.depth.p);this.buffers=[];}
}
