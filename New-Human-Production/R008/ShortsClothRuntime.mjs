import * as THREE from 'three';
import {LINEN_MATERIAL_FRAGMENT,LINEN_MATERIAL_SOURCE} from './ShortsLinenMaterial.mjs';
import {scSolveBending} from './ShortsBending.mjs';
import {paperTriangle,evaluatePaperTriangle,xpbdScalarStep} from './ShortsPaperSurfaceModel.mjs';

// Independent, finite-force cloth mechanics. No vertex is animated by skinning.
// UV metric, stitched mass and tape rest lengths are owned by the measured draft.
export const SHORTS_PHYSICS=Object.freeze({densityKgM2:.22,fixedDt:1/240,iterations:24,edgeCompliance:1e-8,bendCompliance:40000,damping:3,gravity:9.81,bodyClearanceM:.004,friction:.55,elasticEA:100,mainStrainLimit:.05,elasticStrainLimit:.35});
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(...a);
const vertex=`precision highp float;in vec3 position,normal;in vec2 uv;in vec3 panelTint;uniform mat4 modelMatrix,viewMatrix,projectionMatrix;out vec3 W,N,tint;out vec2 C;out vec4 linenShadow;void main(){vec4 w=modelMatrix*vec4(position,1.);W=w.xyz;N=normalize(mat3(modelMatrix)*normal);C=uv*(100./3.);tint=panelTint;linenShadow=vec4(0.);gl_Position=projectionMatrix*viewMatrix*w;}`;
function linenMaterial(){
 const uniforms={uCam:{value:new THREE.Vector3()},uViewport:{value:new THREE.Vector2()},uMode:{value:2},uMaterial:{value:0},uLight:{value:0},uNeutral:{value:0},uCompare:{value:0},uDiag:{value:0},uTime:{value:0},uCoarse:{value:1},uWeave:{value:1},uSlub:{value:1},uAge:{value:.35},uFarId:{value:1},uSheen:{value:1},uFuzz:{value:1},shadowsEnabled:{value:0},shadow:{value:new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1)},panelReview:{value:0}};uniforms.shadow.value.needsUpdate=true;
 const fragment=LINEN_MATERIAL_FRAGMENT.replace(/^#version 300 es\s*/,'').replace('out vec4 O;','out vec4 O;in vec3 tint;uniform float panelReview;').replace('O=vec4(col,1.);','O=vec4(mix(col,tint,panelReview*.66),1.);');
 return new THREE.RawShaderMaterial({name:'Original procedural R24 linen',glslVersion:THREE.GLSL3,uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide});
}
function nearestOnTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return {point:a,w:[1,0,0]};
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return {point:b,w:[0,1,0]};
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);return {point:a.map((v,k)=>v+t*ab[k]),w:[1-t,t,0]};}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return {point:c,w:[0,0,1]};
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);return {point:a.map((v,k)=>v+t*ac[k]),w:[1-t,0,t]};}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const t=(d4-d3)/((d4-d3)+(d5-d6));return {point:b.map((v,k)=>v+t*(c[k]-v)),w:[0,1-t,t]};}
 const inv=1/(va+vb+vc),v=vb*inv,w=vc*inv;return {point:a.map((x,k)=>x+ab[k]*v+ac[k]*w),w:[1-v-w,v,w]};
}
export class ShortsClothRuntime {
 constructor(draft,body,actor,scene,options={}){
  this.draft=draft;this.body=body;this.actor=actor;this.scene=scene;this.options={...SHORTS_PHYSICS,...options};this.accumulator=0;this.time=0;this.steps=0;this.enabled=true;this.cpu=[];this.history={maxMainStrain:0,maxElasticStrain:0,maxBodyPenetrationM:0,maxSeamGapM:0,nonFinite:0,firstFailure:null};
  const count=draft.positions.length/3,parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  this.membraneModel=options.membraneModel??'legacy-edge-distance';
  if(options.paperMaterial)this.options.paperMaterial=Object.freeze({...options.paperMaterial});
  if(!['legacy-edge-distance','orthotropic-paper'].includes(this.membraneModel))throw Error('Unknown membrane model');
  if(this.membraneModel==='orthotropic-paper'&&!options.paperMaterial)throw Error('Explicit N/m warp, weft and shear inputs required');
  this.activeSeams=options.activeSeamIDs===undefined?draft.seams:draft.seams.filter(s=>options.activeSeamIDs.includes(s.id));if(options.activeSeamIDs&&this.activeSeams.length!==new Set(options.activeSeamIDs).size)throw Error('Unknown/duplicate source seam activation');for(const seam of this.activeSeams)for(const pair of seam.pairs){const a=pair.a??pair[0],b=pair.b??pair[1];parent[find(a)]=find(b);}
  const roots=[...new Set(parent.map((_,i)=>find(i)))],ids=new Map(roots.map((id,i)=>[id,i]));this.quotient=parent.map((_,i)=>ids.get(find(i)));this.members=roots.map(()=>[]);this.quotient.forEach((j,i)=>this.members[j].push(i));
  this.mass=roots.map(()=>0);this.positions=roots.map(()=>[0,0,0]);const uv=draft.uvs||draft.sourceUV,indices=draft.triangles;
  const sourceMass=new Float64Array(count);this.triangles=[];this.edges=[];this.bends=[];const edgeMap=new Map();this.paperAreaM2=0;
  for(let t=0;t<indices.length;t+=3){const original=Array.from(indices.slice(t,t+3)),q=original.map(i=>this.quotient[i]),u=original.map(i=>[uv[i*2],uv[i*2+1]]),area=Math.abs((u[1][0]-u[0][0])*(u[2][1]-u[0][1])-(u[1][1]-u[0][1])*(u[2][0]-u[0][0]))/2;if(!(area>1e-12))throw Error('Invalid measured paper triangle');this.paperAreaM2+=area;original.forEach(i=>sourceMass[i]+=area*this.options.densityKgM2/3);
   const det=(u[1][0]-u[0][0])*(u[2][1]-u[0][1])-(u[2][0]-u[0][0])*(u[1][1]-u[0][1]);
   const pieceId=draft.ranges.find(r=>original[0]>=r.offset&&original[0]<r.offset+r.count)?.pieceId;
   const paperReference=paperTriangle(u,{grainAngleRadians:options.grainAnglesByPiece?.[pieceId]??0});
   if(this.membraneModel==='orthotropic-paper')evaluatePaperTriangle(paperReference,[[0,0,0],[1,0,0],[0,1,0]],options.paperMaterial);
   this.triangles.push({original,q,uv:u,pieceId,paperReference,paperLambdas:[0,0,0],inv:[(u[2][1]-u[0][1])/det,-(u[2][0]-u[0][0])/det,-(u[1][1]-u[0][1])/det,(u[1][0]-u[0][0])/det]});
   for(let k=0;k<3;k++){const a=q[k],b=q[(k+1)%3],other=q[(k+2)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');const rest=Math.hypot(u[k][0]-u[(k+1)%3][0],u[k][1]-u[(k+1)%3][1]);if(a===b)continue;const old=edgeMap.get(key);if(old){old.other.push(other);if(Math.abs(rest-old.rest)>.0001)throw Error('Measured seams disagree about material edge length');}else{const e={a,b,rest,compliance:this.options.edgeCompliance,lambda:0,other:[other]};edgeMap.set(key,e);this.edges.push(e);}}
  }
  const frame=new THREE.Matrix4(),actorPosition=new THREE.Vector3(),actorRotation=new THREE.Quaternion(),actorScale=new THREE.Vector3();actor.matrixWorld.decompose(actorPosition,actorRotation,actorScale);frame.compose(actorPosition,actorRotation,new THREE.Vector3(1,1,1));
  const scratch=new THREE.Vector3();for(let i=0;i<count;i++){const q=this.quotient[i],m=sourceMass[i];this.mass[q]+=m;scratch.fromArray(draft.positions,i*3).applyMatrix4(frame);for(let k=0;k<3;k++)this.positions[q][k]+=scratch.getComponent(k)*m;}
  for(let i=0;i<roots.length;i++){if(!(this.mass[i]>0))throw Error('Cloth has a massless DOF');this.positions[i]=this.positions[i].map(v=>v/this.mass[i]);}this.invMass=this.mass.map(m=>1/m);this.previous=this.positions.map(p=>[...p]);this.velocity=this.positions.map(()=>[0,0,0]);this.initial=this.positions.map(p=>[...p]);
  this.bendParticles=this.positions.map((pos,i)=>({pos,invMass:this.invMass[i]}));
  // Real paper is flat: bending rest angle is zero, independently of the
  // initially dressed shape. No opposite-edge length is taken from posed XYZ.
  for(const e of this.edges)if(e.other.length===2&&e.other[0]!==e.other[1])this.bends.push({indices:[e.other[0],e.other[1],e.a,e.b],restAngle:0,lambda:0});
  this.elastic=(options.elasticEnabled===false?[]:(draft.elasticEdges||[])).map(e=>({a:this.quotient[e.a??e[0]],b:this.quotient[e.b??e[1]],rest:e.restLengthM??e.rest,compliance:e.compliance??e.complianceMPerN??((e.restLengthM??e.rest)/this.options.elasticEA),tensionOnly:true,lambda:0}));if(this.elastic.some(e=>!(e.rest>0)))throw Error('Elastic tape needs physical rest lengths');
  this.waist=[...new Set((draft.waistIndices||[]).map(i=>this.quotient[i]))];this.paperIdentity=JSON.stringify({uv:Array.from(uv),indices:Array.from(indices),sourceMass:Array.from(sourceMass)});this.sourceMass=sourceMass;this.neighbours=roots.map(()=>new Set());for(const t of this.triangles)for(const a of t.q)for(const b of t.q)this.neighbours[a].add(b);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('uv',new THREE.BufferAttribute(Float32Array.from(uv),2));const colors=new Float32Array(count*3),palette=[[.2,.62,.9],[.94,.48,.22],[.12,.38,.72],[.72,.24,.14],[.54,.72,.24],[.43,.78,.94],[1,.67,.34],[.82,.38,.25],[.27,.52,.82]];for(const [part,range] of draft.ranges.entries())for(let i=range.offset;i<range.offset+range.count;i++)colors.set(palette[part%palette.length],i*3);geometry.setAttribute('panelTint',new THREE.BufferAttribute(colors,3));geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(indices),1));this.mesh=new THREE.Mesh(geometry,linenMaterial());this.mesh.name='Measured low-rise linen shorts with elastic casing';this.mesh.frustumCulled=false;scene.add(this.mesh);this.mesh.onBeforeRender=(renderer,scene,camera)=>{camera.getWorldPosition(this.mesh.material.uniforms.uCam.value);renderer.getDrawingBufferSize(this.mesh.material.uniforms.uViewport.value);};this.stitches=(draft.casing.stitchPaths||[]).map(path=>{const n=path.indices.length,geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));const material=new THREE.LineBasicMaterial({color:0x766746});const line=new THREE.LineLoop(geometry,material);line.name='Physical casing '+path.edge+' seam';line.frustumCulled=false;scene.add(line);return {line,indices:path.indices};});this.syncRender();
 }
 solveDistance(e,h){const a=this.positions[e.a],b=this.positions[e.b],d=sub(b,a),l=len(d);if(l<1e-12)return;const alpha=e.compliance/(h*h),w=this.invMass[e.a]+this.invMass[e.b],candidate=e.lambda+(-(l-e.rest)-alpha*e.lambda)/(w+alpha),next=e.tensionOnly?Math.min(0,candidate):candidate,dl=next-e.lambda;e.lambda=next;for(let k=0;k<3;k++){const n=d[k]/l;a[k]-=this.invMass[e.a]*dl*n;b[k]+=this.invMass[e.b]*dl*n;}}
 solveMembrane(t,h){
  for(let k=0;k<3;k++){
   const row=evaluatePaperTriangle(t.paperReference,t.q.map(i=>this.positions[i]),this.options.paperMaterial).rows[k];
   const step=xpbdScalarStep({value:row.value,gradients:row.gradients,dofIndices:t.q,invMass:this.invMass,lambda:t.paperLambdas[k],compliance:row.compliancePerJ,h});
   if(step.status==='HOLD')throw Error('Membrane constraint has no admissible update');
   t.paperLambdas[k]=step.lambda;for(const {id,delta}of step.corrections)for(let axis=0;axis<3;axis++)this.positions[id][axis]+=delta[axis];
  }
 }
 solveMainMaterial(h){if(this.membraneModel==='orthotropic-paper')for(const t of this.triangles)this.solveMembrane(t,h);else for(const e of this.edges)this.solveDistance(e,h);}
 resetMaterialMultipliers(){for(const t of this.triangles)t.paperLambdas.fill(0);}
 materialIdentity(){return JSON.stringify({uv:Array.from(this.draft.sourceUV),triangles:Array.from(this.draft.triangles),sourceMass:Array.from(this.sourceMass),mass:this.mass,invMass:this.invMass,membraneModel:this.membraneModel,paperMaterial:this.options.paperMaterial??null,triangleRest:this.triangles.map(t=>({uv:t.uv,inv:t.inv,grainAngleRadians:t.paperReference.grainAngleRadians})),edges:this.edges.map(e=>[e.a,e.b,e.rest,e.compliance]),elastic:this.elastic.map(e=>[e.a,e.b,e.rest,e.compliance,e.tensionOnly])});}
 async prepareWear({maxPasses=200}={}){
  if(!Number.isInteger(maxPasses)||maxPasses<1||maxPasses>200)throw Error('Static assembly is bounded to 200 passes');
  const identity=this.materialIdentity(),start=performance.now();this.body.refitExact();
  const trace=[],h=this.options.fixedDt;
  // A separate manufacturing stage, without gravity, body movement or pins.
  // Only cut-paper edge lengths and actual collider contact move the DOFs.
  // No material reference is derived from these temporary assembled positions.
  for(let pass=1;pass<=maxPasses;pass++){
   for(const e of [...this.edges,...this.elastic])e.lambda=0;this.resetMaterialMultipliers();
   for(let sweep=0;sweep<2;sweep++){this.solveMainMaterial(h);for(const e of this.elastic)this.solveDistance(e,h);}
   this.contacts();
   if(pass%10===0||pass===maxPasses){const a=this.audit(true);trace.push({pass,mainStrain:a.mainStrain,bodyPenetrationM:a.bodyPenetrationM,elasticStrain:a.elasticStrain,finite:a.finite});this.syncRender();if(!a.finite||a.numericValid)break;await new Promise(resolve=>setTimeout(resolve,0));}
  }
  if(this.materialIdentity()!==identity)throw Error('Static assembly modified material rest identity');
  this.previous=this.positions.map(p=>[...p]);this.velocity=this.positions.map(()=>[0,0,0]);this.syncRender();
  this.assembly={kind:'bounded static manufacturing solve; not motion validation',maxPasses,trace,elapsedMs:performance.now()-start,paperRestUnchanged:true,allDofsFree:this.invMass.every(w=>w>0),numericValid:this.audit(true).numericValid,productionReady:false};return this.assembly;
 }
 contactSample(ids,weights,margin){const p=[0,0,0];ids.forEach((id,j)=>{for(let k=0;k<3;k++)p[k]+=this.positions[id][k]*weights[j];});const contact=this.body.collide(new THREE.Vector3(...p),margin);if(!contact)return 0;const point=contact.point?.toArray?contact.point.toArray():contact.point,normal=contact.normal?.toArray?contact.normal.toArray():contact.normal;if(!point||!normal)return 0;const delta=point.map((v,k)=>v-p[k]),depth=dot(delta,normal);if(!(depth>0))return 0;const combined=new Map();ids.forEach((id,j)=>combined.set(id,(combined.get(id)||0)+weights[j]));let w=0;for(const [id,b]of combined)w+=this.invMass[id]*b*b;for(const [id,b]of combined)for(let k=0;k<3;k++)this.positions[id][k]+=this.invMass[id]*b*depth*normal[k]/w;return depth;}
 contacts(){let max=0;for(let i=0;i<this.positions.length;i++)max=Math.max(max,this.contactSample([i],[1],this.options.bodyClearanceM));for(const t of this.triangles)max=Math.max(max,this.contactSample(t.q,[1/3,1/3,1/3],this.options.bodyClearanceM));return max;}
 selfContacts(){
  const size=.02,buckets=new Map(),key=(x,y,z)=>x+','+y+','+z;for(let i=0;i<this.positions.length;i++){const p=this.positions[i],k=key(...p.map(v=>Math.floor(v/size)));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);}
  let resolved=0;for(const t of this.triangles){const p=t.q.map(i=>this.positions[i]),lo=[0,1,2].map(k=>Math.floor((Math.min(...p.map(v=>v[k]))-.001)/size)),hi=[0,1,2].map(k=>Math.floor((Math.max(...p.map(v=>v[k]))+.001)/size));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)for(const id of buckets.get(key(x,y,z))||[]){if(t.q.some(j=>this.neighbours[id].has(j)))continue;const v=this.positions[id],hit=nearestOnTriangle(v,...p),delta=sub(v,hit.point),d=len(delta);if(d>=.001||d<1e-10)continue;const normal=delta.map(v=>v/d),w=this.invMass[id]+t.q.reduce((s,j,k)=>s+this.invMass[j]*hit.w[k]**2,0),dl=(.001-d)/w;for(let k=0;k<3;k++){v[k]+=this.invMass[id]*dl*normal[k];t.q.forEach((j,a)=>this.positions[j][k]-=this.invMass[j]*hit.w[a]*dl*normal[k]);}resolved++;}}
  return resolved;
 }
 fixedStep(h){
  this.previous=this.positions.map(p=>[...p]);const damp=Math.exp(-this.options.damping*h);for(let i=0;i<this.positions.length;i++){this.velocity[i][1]-=this.options.gravity*h;for(let k=0;k<3;k++){this.velocity[i][k]*=damp;this.positions[i][k]+=this.velocity[i][k]*h;}}
  for(const e of [...this.edges,...this.bends,...this.elastic])e.lambda=0;this.resetMaterialMultipliers();
  for(let pass=0;pass<this.options.iterations;pass++){this.solveMainMaterial(h);for(const e of this.bends)scSolveBending(e,this.bendParticles,h,this.options.bendCompliance);for(const e of this.elastic)this.solveDistance(e,h);this.contacts();if(pass===this.options.iterations-1)this.selfContacts();}
  for(let i=0;i<this.positions.length;i++){const p=this.positions[i],last=this.previous[i],v=this.velocity[i];for(let k=0;k<3;k++)v[k]=(p[k]-last[k])/h;const c=this.body.collide(new THREE.Vector3(...p),this.options.bodyClearanceM+.0001);if(c){const n=c.normal.toArray?c.normal.toArray():c.normal,bodyV=c.velocity?.toArray?c.velocity.toArray():(c.velocity||[0,0,0]),relative=sub(v,bodyV),normalV=dot(relative,n),tangent=relative.map((x,k)=>x-normalV*n[k]);const tangentL=len(tangent),mu=this.options.friction,normalChange=Math.max(0,-normalV)+.3*h;if(tangentL>1e-10){const reduction=Math.min(1,mu*normalChange/tangentL);for(let k=0;k<3;k++)v[k]-=tangent[k]*reduction;}}}
  this.steps++;this.time+=h;const audit=this.audit(true);for(const [to,from]of [['maxMainStrain','mainStrain'],['maxElasticStrain','elasticStrain'],['maxBodyPenetrationM','bodyPenetrationM']])this.history[to]=Math.max(this.history[to],audit[from]);if(!audit.finite){this.history.nonFinite++;this.enabled=false;}if(!audit.numericValid&&!this.history.firstFailure)this.history.firstFailure={step:this.steps,time:this.time,...audit};this.lastAudit=audit;
 }
 advance(dt){if(!Number.isFinite(dt)||dt<0||!Number.isFinite(this.options.fixedDt)||this.options.fixedDt<=0)throw Error('Cloth requires finite elapsed time and positive fixedDt');if(!this.enabled||dt===0)return;if(Math.abs(dt-this.options.fixedDt)>1e-10)throw Error('Advance the character and cloth together at the declared fixed substep');const start=performance.now();this.body.update({time:this.time+dt,exactRefit:true});this.fixedStep(dt);this.syncRender();this.cpu.push(performance.now()-start);if(this.cpu.length>2000)this.cpu.shift();}
 updateStitchedRenderNormals(){
  const geometry=this.mesh.geometry,position=geometry.attributes.position;
  let topology=this.renderNormalTopology;
  if(!topology||topology.quotient!==this.quotient||topology.triangles!==this.triangles){
   const signs=new Int8Array(this.triangles.length),sourceSigns=new Int8Array(this.quotient.length),edges=new Map(),adj=this.triangles.map(()=>[]);let nonManifoldEdges=0,degenerateTriangles=0,orientationConflicts=0,sourceSignConflicts=0,components=0;
   for(const [i,t]of this.triangles.entries()){
    if(new Set(t.q).size!==3)degenerateTriangles++;
    for(let k=0;k<3;k++){const a=t.q[k],b=t.q[(k+1)%3],key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,[]);edges.get(key).push({i,direction:a<b?1:-1});}
   }
   for(const rows of edges.values()){if(rows.length>2)nonManifoldEdges++;if(rows.length===2){const[a,b]=rows;adj[a.i].push({i:b.i,ratio:-a.direction*b.direction});adj[b.i].push({i:a.i,ratio:-a.direction*b.direction});}}
   for(let seed=0;seed<signs.length;seed++)if(!signs[seed]){components++;signs[seed]=1;const stack=[seed];while(stack.length){const i=stack.pop();for(const e of adj[i]){const wanted=signs[i]*e.ratio;if(!signs[e.i]){signs[e.i]=wanted;stack.push(e.i);}else if(signs[e.i]!==wanted)orientationConflicts++;}}}
   this.triangles.forEach((t,i)=>t.original.forEach(v=>{if(sourceSigns[v]&&sourceSigns[v]!==signs[i])sourceSignConflicts++;sourceSigns[v]=signs[i];}));
   topology={quotient:this.quotient,triangles:this.triangles,signs,sourceSigns,sums:new Float64Array(this.positions.length*3),valid:nonManifoldEdges===0&&degenerateTriangles===0&&orientationConflicts===0&&sourceSignConflicts===0,components,nonManifoldEdges,degenerateTriangles,orientationConflicts,sourceSignConflicts};this.renderNormalTopology=topology;
  }
  if(!topology.valid){geometry.computeVertexNormals();this.renderNormalReport={method:'original per-source normals; joined topology unsafe to smooth',valid:false,components:topology.components,nonManifoldEdges:topology.nonManifoldEdges,degenerateTriangles:topology.degenerateTriangles,orientationConflicts:topology.orientationConflicts,sourceSignConflicts:topology.sourceSignConflicts,physicsChanged:false};return;}
  // Smooth only real sewn DOFs. Coincident independent papers remain distinct.
  // Keep 553 source UV vertices and original draw winding: the unchanged
  // DoubleSide shader flips by gl_FrontFacing, hence restore source winding
  // sign when scattering a consistently oriented quotient normal.
  const sums=topology.sums;sums.fill(0);
  for(const [i,t]of this.triangles.entries()){
   const[a,b,c]=t.original,ab=[position.getX(b)-position.getX(a),position.getY(b)-position.getY(a),position.getZ(b)-position.getZ(a)],ac=[position.getX(c)-position.getX(a),position.getY(c)-position.getY(a),position.getZ(c)-position.getZ(a)],sign=topology.signs[i],normal=[(ab[1]*ac[2]-ab[2]*ac[1])*sign,(ab[2]*ac[0]-ab[0]*ac[2])*sign,(ab[0]*ac[1]-ab[1]*ac[0])*sign];
   for(const q of t.q)for(let k=0;k<3;k++)sums[q*3+k]+=normal[k];
  }
  if(!geometry.attributes.normal)geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(this.quotient.length*3),3));const normal=geometry.attributes.normal;let zeroAreaDofs=0;
  for(let q=0;q<this.positions.length;q++){const at=q*3,length=Math.hypot(sums[at],sums[at+1],sums[at+2]);if(length>1e-20)for(let k=0;k<3;k++)sums[at+k]/=length;else zeroAreaDofs++;}
  for(let i=0;i<this.quotient.length;i++){const at=this.quotient[i]*3,sign=topology.sourceSigns[i];normal.setXYZ(i,sign*sums[at],sign*sums[at+1],sign*sums[at+2]);}normal.needsUpdate=true;
  this.renderNormalReport={method:'area-weighted current sewn-DOF normals with consistent quotient orientation and source-winding scatter',valid:zeroAreaDofs===0,components:topology.components,actualJoinedGroups:this.members.filter(g=>g.length>1).length,zeroAreaDofs,sourceUVVertices:this.quotient.length,sourceIndicesUnchanged:true,positionSmoothing:false,physicsChanged:false};
 }
 syncRender(){const attr=this.mesh.geometry.attributes.position;for(let i=0;i<this.quotient.length;i++)attr.setXYZ(i,...this.positions[this.quotient[i]]);attr.needsUpdate=true;this.updateStitchedRenderNormals();for(const stitch of this.stitches||[]){const a=stitch.line.geometry.attributes.position;for(let i=0;i<stitch.indices.length;i++)a.setXYZ(i,...this.positions[this.quotient[stitch.indices[i]]]);a.needsUpdate=true;}}
 audit(full=true){
  let mainStrain=0,worstMaterialTriangle=null;for(const t of this.triangles){const r=evaluatePaperTriangle(t.paperReference,t.q.map(i=>this.positions[i]));if(r.principalStrain>mainStrain){mainStrain=r.principalStrain;worstMaterialTriangle={sourceIndices:t.original,quotientIndices:t.q,pieceId:t.pieceId,minimumStretch:r.sigmaMin,maximumStretch:r.sigmaMax,actualPositions:t.q.map(i=>[...this.positions[i]]),sourceUV:t.uv};}}
  let currentLengthM=0,restLengthM=0,elasticStrain=0;for(const e of this.elastic){const l=len(sub(this.positions[e.a],this.positions[e.b]));currentLengthM+=l;restLengthM+=e.rest;elasticStrain=Math.max(elasticStrain,Math.abs(l/e.rest-1));}
  let bodyPenetrationM=full?0:null;const samples=full?[...this.positions,...this.triangles.map(t=>[0,1,2].map(k=>t.q.reduce((v,i)=>v+this.positions[i][k]/3,0)))]:[];for(const p of samples){const c=this.body.collide(new THREE.Vector3(...p),0);if(c)bodyPenetrationM=Math.max(bodyPenetrationM,c.penetration??c.depth??len(sub(c.point.toArray?c.point.toArray():c.point,p)));}
  const finite=this.positions.every(p=>p.every(Number.isFinite))&&this.velocity.every(p=>p.every(Number.isFinite)),sorted=[...this.cpu].sort((a,b)=>a-b),waistY=this.waist.reduce((v,i)=>v+this.positions[i][1],0)/Math.max(1,this.waist.length),rmsSpeed=Math.sqrt(this.velocity.reduce((v,p)=>v+dot(p,p),0)/this.positions.length);
  return {valid:false,numericValid:finite&&mainStrain<=this.options.mainStrainLimit&&elasticStrain<=this.options.elasticStrainLimit&&full&&bodyPenetrationM<=.001,contactVerificationPending:true,bodyAuditPerformed:full,manufacturingMaterialValid:finite&&mainStrain<=this.options.mainStrainLimit,finite,mainStrain,worstMaterialTriangle,elasticStrain,bodyPenetrationM,seamGapM:0,seams:this.activeSeams.length,actualDofs:this.positions.length,particles:this.quotient.length,triangles:this.triangles.length,time:this.time,step:this.steps,waist:{heightM:waistY,currentLengthM,restLengthM,strain:restLengthM>0?currentLengthM/restLengthM-1:null},massKg:this.mass.reduce((a,b)=>a+b,0),rmsSpeed,physics:{...this.options},cpuP95Ms:sorted[Math.floor(sorted.length*.95)]||0,history:{...this.history},body:(()=>{const b=this.body.snapshot?.();if(!b)return null;const {measurements,...telemetry}=b;return telemetry;})(),appearanceSource:LINEN_MATERIAL_SOURCE,selfContact:'vertex-triangle-spatial-hash; strict verifier required',productionReady:false};
 }
 snapshot(){return {audit:this.audit(),positions:this.positions.map(p=>[...p]),velocity:this.velocity.map(p=>[...p]),sourceIdentity:this.paperIdentity};}
 setPanelReview(v){this.mesh.material.uniforms.panelReview.value=Number(!!v);}
 dispose(){for(const s of this.stitches||[]){this.scene.remove(s.line);s.line.geometry.dispose();s.line.material.dispose();}this.scene.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.uniforms.shadow.value.dispose();this.mesh.material.dispose();this.enabled=false;}
}
