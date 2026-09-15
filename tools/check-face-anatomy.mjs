import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const readDefault=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const assertDefault=(v,m)=>{if(!v)throw Error(m);};

export function checkFaceAnatomySources({read=readDefault,assert=assertDefault}={}){
 let checks=0;const check=(v,m)=>{assert(v,'Face anatomy: '+m);checks++;};
 const source=read('body/FaceAnatomy.js'),renderer=read('body/CompactWorkbench.js'),manifest=JSON.parse(read('source/assembly.json'));
 new vm.Script(source);
 check(manifest.modules.filter(p=>p==='body/FaceAnatomy.js').length===1,'generator assembled once');
 check(source.includes("revision:'r8-orbital-continuity'")&&source.includes("id:'upperLidSulcus'")&&source.includes("id:'lowerLidTransition'"),'versioned orbital transition separates broad socket depth from local lid sulci');
 check(manifest.modules.indexOf('body/FaceAnatomy.js')<manifest.modules.indexOf('body/CompactWorkbench.js'),'generator precedes renderer');
 check((read('source/runtime.template.js').match(/__SOURCE:body\/FaceAnatomy\.js__/g)||[]).length===1,'runtime includes generator once');
 check(!/\b(?:document|window|fetch|Worker|localStorage)\b/.test(source),'generator has no external side effects');
 check(renderer.includes('compactCreateFaceAnatomy(data.meshes,this.rig,this.statureScale)'),'personal surface and rig drive reconstruction');
 check(renderer.includes('.concat(faceTissue.meshes,eyeTissue.meshes)'),'face and eye meshes share display sampling');
 check((renderer.match(/compactFaceSurfaceMask\(R\)/g)||[]).length===2,'colour and depth share aperture masks');
 check(read('body/HumanDNA.js').includes("faceAnatomy:lab.compact?{generator:'body/FaceAnatomy.js'"),'recipe exports face parameters');
 return {checks,applicationExecuted:false,visualAcceptance:false};
}

export function checkFaceAnatomyParameters(){
 let checks=0;const check=(v,m)=>{assertDefault(v,m);checks++;};
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1));
 const context=vm.createContext({add,sub,mul,cross,norm,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),COMPACT_INFLUENCES:8});
 new vm.Script(readDefault('body/EyeAnatomy.js')+'\n'+readDefault('body/FaceAnatomy.js')+'\nglobalThis.api={create:compactCreateFaceAnatomy,sample:compactFaceRaySampler,form:compactFaceFormDepth,outline:compactLipOutline,relief:compactLipReliefDepth,radial:compactLipRadial,opening:compactLipOpening,parameters:COMPACT_FACE_ANATOMY};').runInContext(context);
 const api=context.api,rig={jointIds:new Map([['head',7]])};
 const plane={name:'skin',canonicalPositions:Float32Array.from([-.09,1.43,.19,.09,1.43,.19,.09,1.59,.19,-.09,1.59,.19]),indices:Uint16Array.from([0,1,2,0,2,3])};
 const before=JSON.stringify(plane),front=api.sample([plane]);
 check(Math.abs(front(0,1.5)-.19)<1e-7,'barycentric source depth');
 check(front(.1,1.5)===null,'outside ray remains missing');
 const farther={...plane,canonicalPositions:Float32Array.from(plane.canonicalPositions,(v,i)=>v-(i%3===2?.01:0))};
 check(Math.abs(api.sample([plane,farther])(0,1.5)-.19)<1e-7,'nearest visible depth is independent of mesh ordering');
 const full=api.create([plane],rig,1),scaled=api.create([plane],rig,.94);
 check(JSON.stringify(plane)===before,'input arrays preserved');
 check(full.report.triangles===full.meshes.reduce((s,m)=>s+m.indices.length/3,0),'triangle accounting');
 for(let k=0;k<full.meshes.length;k++){
  const m=full.meshes[k],s=scaled.meshes[k];
  check(m.vertices<=65535&&m.indices.every(i=>i<m.vertices),'Uint16 topology bounds');
  check([...m.positions,...m.normals].every(Number.isFinite),'finite surface and normals');
  check(m.positions.every((v,i)=>Math.abs(s.positions[i]-v*.94)<2e-7),'stature applied exactly once');
  check(m.canonicalPositions.every((v,i)=>v===s.canonicalPositions[i]),'canonical surface independent of stature');
  for(let i=0;i<m.vertices;i++)check(m.binding.ids[i*8]===7&&m.binding.weights.subarray(i*8,i*8+8).reduce((a,b)=>a+b,0)===65535,'normalized head attachment');
  const decode=i=>{let x=m.normals[i*2]/32767,y=m.normals[i*2+1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return norm([x,y,z]);};
  let inverted=0,collapsed=0;for(let i=0;i<m.indices.length;i+=3){const ids=Array.from(m.indices.subarray(i,i+3)),p=ids.map(j=>Array.from(m.canonicalPositions.subarray(j*3,j*3+3))),normal=cross(sub(p[1],p[0]),sub(p[2],p[0])),average=ids.reduce((v,j)=>add(v,decode(j)),[0,0,0]);
   if(Math.hypot(...normal)<1e-13)collapsed++;else if(normal.reduce((s,v,j)=>s+v*average[j],0)<=0)inverted++;}
  check(collapsed===0,'noncollapsed three-dimensional triangles '+m.name);
  check(inverted===0,'geometric winding agrees with three-dimensional normals '+m.name);
 }
 const cavity=full.meshes.find(m=>m.name==='noseInterior'),n=api.parameters.nostrils;
 check(full.report.nostrilFrames.length===2&&full.report.nostrilFrames.every(f=>f.rimVertices>=16),'both nasal openings have tessellated rims');
 check(full.meshes.find(m=>m.name==='faceBrow').triangles===2*api.parameters.brow.strandsPerSide*api.parameters.brow.segments*2,'individual fibre topology');
 check(api.form(.5,1.5)===0,'secondary forms have bounded support');
 check(full.report.measuredAnatomy===false,'authored geometry is not labelled measured');
 const sloped={...plane,canonicalPositions:Float32Array.from(plane.canonicalPositions,(v,i)=>i%3===2?.19+2*(plane.canonicalPositions[i-1]-1.48):v)};
 const slopedFace=api.create([sloped],rig,1);
 // The returning underside is not single-valued in front projection. Verify
 // the actual three-dimensional aperture frame and its shared mesh boundary.
 for(const face of [full,slopedFace]){
  const skin=face.meshes.find(m=>m.name==='faceSkin'),cavity=face.meshes.find(m=>m.name==='noseInterior'),edges=new Map();
  for(let i=0;i<skin.indices.length;i+=3)for(const [a,b]of [[0,1],[1,2],[2,0]]){const x=skin.indices[i+a],y=skin.indices[i+b],key=Math.min(x,y)+'/'+Math.max(x,y);edges.set(key,(edges.get(key)||0)+1);}
  const boundaryIds=new Set([...edges].filter(([,count])=>count===1).flatMap(([key])=>key.split('/').map(Number))),boundary=[...boundaryIds].map(i=>Array.from(skin.canonicalPositions.subarray(i*3,i*3+3)));
  let start=0;for(const frame of face.report.nostrilFrames){
   const floor=Array.from(cavity.canonicalPositions.subarray(frame.floorVertex*3,frame.floorVertex*3+3)),delta=sub(floor,frame.centre),along=delta.reduce((s,v,i)=>s+v*frame.normal[i],0);
   check(Math.abs(Math.hypot(...delta)-n.depth)<2e-7,'cavity has the configured physical depth');
   check(along<-.999*n.depth&&frame.normal[1]<-.3,'nasal opening turns downward and the cavity enters behind it');
   const rimIds=[];for(let i=0;i<frame.rimVertices;i++){const point=Array.from(cavity.canonicalPositions.subarray((start+i*11+10)*3,(start+i*11+10)*3+3)),match=boundary.findIndex(p=>Math.hypot(...sub(p,point))<2e-7);check(match>=0,'cavity rim shares the clipped facial boundary');rimIds.push([...boundaryIds][match]);}
   for(let i=0;i<rimIds.length;i++){const a=rimIds[i],b=rimIds[(i+1)%rimIds.length];check(edges.get([Math.min(a,b),Math.max(a,b)].join('/'))===1,'every cavity rim segment is an open edge of the facial mesh');}
   start=frame.floorVertex+1;
  }
 }
 const lip=full.meshes.find(m=>m.name==='faceLip'),mouth=full.meshes.find(m=>m.name==='mouthInterior');
 check(lip.vertices>2*(api.parameters.lips.columns+1)*(api.parameters.lips.rings+1),'lips include returning inner surfaces');
 check(Math.max(...mouth.canonicalPositions.filter((v,i)=>i%3===2))-Math.min(...mouth.canonicalPositions.filter((v,i)=>i%3===2))>.008,'oral cavity has depth rather than a closure strip');
 // The old fractional sine roll sharpened with increasing subdivision. The
 // replacement must meet the skin in position and tangent at every lip section.
 for(const upper of [true,false])for(const u of [-.95,-.6,-.25,0,.25,.6,.95]){
  check(Math.abs(api.relief(u,1,upper))<1e-12,'outer perioral attachment has no raised rim');
  check(Math.abs((api.relief(u,1,upper)-api.relief(u,1-1e-5,upper))/1e-5)<1e-6,'perioral attachment joins the skin tangentially');
 }
 // A shallow inward roll is required; a deep slot between swollen strips is not.
 // Keep the vermilion colour border inside the supporting skin surface.
 for(const u of [-.65,-.3,0,.3,.65]){
  const free=api.relief(u,0,true),edgeT=1/api.parameters.lips.apron;
  for(let i=1;i<=20;i++){
   const t=edgeT*i/20;
   check(api.relief(u,t,true)<=free+.0006,'upper lip inward roll has bounded depth');
   check(api.relief(u,t,false)<=free+.0018,'lower belly does not surround a deep recessed closure');
  }
  for(const upper of [true,false])check(api.relief(u,edgeT,upper)>.0001,'lip volume continues beyond the vermilion colour boundary');
 }
 check(api.radial(0)===0&&api.radial(.16)===.16&&api.radial(1)===1,'rolled free edge and red border retain their landmarks');
 check(api.radial(1e-6)/1e-6<.001,'outer free edge approaches the inner return tangentially');
 const lipX=api.parameters.lips.centreX,seamY=api.outline(lipX).seam,lower=[lipX,seamY-.0001,.188],upper=[lipX,seamY+.0001,.188];
 let lastGap=.0002;for(const amount of [.25,.5,1]){
  const gap=upper[1]+api.opening(upper,amount)-lower[1]-api.opening(lower,amount);
  check(gap>lastGap,'independent lips open monotonically');lastGap=gap;
 }
 check(lastGap>.0045&&lastGap<.006,'full lip opening has a visible millimetre-scale gap');
 for(const point of [[lipX,seamY+.021,.188],[lipX,seamY,.12],[lipX+.026,seamY,.188]])check(api.opening(point,1)===0,'opening remains inside perioral support');
 for(const x of [-.023,-.012,0,.012,.023])for(const y of [seamY-.018,seamY-.009,seamY-.001,seamY+.001,seamY+.009,seamY+.018]){
  const e=1e-6,derivative=(api.opening([x,y+e,.188],1)-api.opening([x,y-e,.188],1))/(2*e);
  check(1+derivative>.5,'lip opening retains a positive local volume determinant away from the aperture');
 }
 return {checks,syntheticPlane:true,sourcePreserved:true,humanGenerated:false,visualAcceptance:false};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify({sources:checkFaceAnatomySources(),...(process.argv.includes('--parameter-fixtures')?{parameters:checkFaceAnatomyParameters()}:{})},null,2));
