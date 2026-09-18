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
 check(source.includes("revision:'r24-anatomical-nasal-body-and-rolled-alar-rim'")&&source.includes("id:'upperLidSulcus'")&&source.includes("id:'lowerLidTransition'"),'versioned source-conforming face retains the independent orbital transition and lid sulci');
 check(source.includes('compactFaceGuideSpline')&&source.includes('const oralHeight=originalHeight')&&source.includes('crossSections:')&&!source.includes('baseRotationRad')&&!source.includes('nasalSectionSurface'),'one nasal loft is built after an independent oral bed without stacked basal rotations or per-column repair patches');
 check(source.includes('perioral:COMPACT_PERIORAL_STRUCTURE')&&source.includes('return compactMuzzleDepth(x,y)')&&!source.includes('whiteRollUpper')&&!source.includes('upperRoll:'),'perioral geometry has one active parameter source without obsolete cosmetic controls');
 check(source.includes('const chinLo=1.4270,chinHi=1.4495')&&source.includes('compactLipContactShadow')&&source.includes('float oralOpening=max(compactLipOpen,compactJawOpen)'),'lower-face Hermite bed, nonuniform contact shadow and closed-mouth cavity gate are explicit');
 check(source.includes('float outerGate=1.-compactLipInner')&&!source.includes('openingGate='),'neutral-coordinate lip grooves persist during opening and remain outside the wet mucosa');
 const tint=source.slice(source.indexOf('  vec3 compactLipTint'),source.indexOf('  float compactLipMoisture'));
 check(!tint.includes('p.z')&&tint.includes('mix(outer,inner,compactLipInner)'),'outer/inner pigment selection cannot change with facial depth');
 check(renderer.includes("c.lipSurface==='mucosa'?1:0"),'renderer supplies material identity per draw');
 check(source.includes('float oralOpening=max(compactLipOpen,compactJawOpen)')&&source.includes('compactFeature<14.5&&oralOpening<.035')&&!source.includes('compactJawOpen<.16'),'dental layers are gated while the tongue remains part of the closed oral floor');
 check(source.includes('const lipBedSurface=')&&source.includes('smooth+(surface(x,y)-smooth)*attach')&&source.includes('const annulusPoint='),'lip free edge is laterally smoothed within the continuous oral annulus');
 check(source.includes("'upperTeeth'")&&source.includes("'lowerTeeth'")&&source.includes("'upperGum'")&&source.includes("'lowerGum'")&&source.includes("'tongue'"),'teeth, gingiva and tongue are separate programmatic oral domains');
 check(source.includes('function compactJawMotionShader')&&source.includes('jawPerformanceApproximation:true'),'jaw performance shader and explicit approximation report are defined in anatomy');
 check(renderer.includes('compactJawMotion(source,n,canonicalPosition)')&&renderer.includes("upperTeeth=c.name==='upperTeeth'")&&renderer.includes('compactJawOpen'),'renderer applies the local jaw controller and classifies oral structures');
 check(renderer.includes("mouth=c.name==='mouthInterior'")&&renderer.includes('mouth?10:upperTeeth?11:lowerTeeth?12:upperGum?13:lowerGum?14:tongue?15:lash?16:beard?17:brow?18:0')&&renderer.includes('compactLipContactShadow(R)'),'mouth interior has a dedicated feature gate and the lip seam uses controlled shading');
 check(manifest.modules.indexOf('body/FaceAnatomy.js')<manifest.modules.indexOf('body/CompactWorkbench.js'),'generator precedes renderer');
 check((read('source/runtime.template.js').match(/__SOURCE:body\/FaceAnatomy\.js__/g)||[]).length===1,'runtime includes generator once');
 check(!/\b(?:document|window|fetch|Worker|localStorage)\b/.test(source),'generator has no external side effects');
 check(renderer.includes('compactCreateFaceAnatomy(data.meshes,this.rig,this.statureScale)'),'personal surface and rig drive reconstruction');
 check(renderer.includes('.concat(faceTissue.meshes,eyeTissue.meshes)'),'face and eye meshes share display sampling');
 check((renderer.match(/compactFaceSurfaceMask\(R\)/g)||[]).length===2,'colour and depth share aperture masks');
 check(read('body/HumanDNA.js').includes("faceAnatomy:lab.compact?{generator:'body/FaceAnatomy.js'"),'recipe exports face parameters');
 return {checks,applicationExecuted:false,visualAcceptance:false};
}

export function checkFaceCheekRail(api){
 if(!api){
  const context=vm.createContext({clamp:(v,a,b)=>Math.max(a,Math.min(b,v))});
  new vm.Script(['body/EyeAnatomy.js','body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js'].map(readDefault).join('\n')+'\nglobalThis.api={form:compactFaceFormDepth,parameters:COMPACT_FACE_ANATOMY};').runInContext(context);api=context.api;
 }
 let checks=0,maxSlopeMismatch=0,samples=0;const check=(v,m)=>{assertDefault(v,'Cheek rail: '+m);checks++;};
 const p=api.parameters,rail=p.cheekRail,rows=rail?.stations,edges=[rail?.innerM,rail?.shoulderInM,rail?.shoulderOutM,rail?.outerM];
 check(edges.every((v,i)=>Number.isFinite(v)&&v>0&&(i===0||v>edges[i-1])),'transverse support and shoulders are finite, positive and ordered');
 check(Array.isArray(rows)&&rows.length>=4&&rows.every((row,i)=>row.length===2&&row.every(Number.isFinite)&&row[0]>p.bounds[2]&&row[0]<p.bounds[3]&&(i===0||row[0]>rows[i-1][0])),'longitudinal stations fit the sampled facial region without repeated intervals');
 check(rows[0][1]===0&&rows.at(-1)[1]===0,'both longitudinal ends return to their supporting face');
 check(rows.some(row=>row[1]>0)&&rows.some(row=>row[1]<0)&&rows.every(row=>Math.abs(row[1])<.006),'support and recession stay within a bounded millimetre-scale offset');
 const oldForms=p.forms;p.forms=[]; // Isolate this production field from the independently tested orbital forms.
 try{
  const f=api.form,xMid=(rail.shoulderInM+rail.shoulderOutM)/2,yLo=rows[0][0],yHi=rows.at(-1)[0],h=1e-6;
  const tangentJoin=(fn,t)=>{const at=fn(t),left=(3*at-4*fn(t-h)+fn(t-2*h))/(2*h),right=(-3*at+4*fn(t+h)-fn(t+2*h))/(2*h),error=Math.abs(left-right);maxSlopeMismatch=Math.max(maxSlopeMismatch,error);check(Number.isFinite(error)&&error<5e-5,'one-sided first derivatives meet at each longitudinal and transverse join');};
  for(const row of rows){check(Math.abs(f(xMid,row[0])-row[1])<1e-12,'broad shoulder retains the authored longitudinal landmarks');tangentJoin(y=>f(xMid,y),row[0]);}
  for(let k=0;k<rows.length-1;k++){
   const a=rows[k],b=rows[k+1],lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);let previous=f(xMid,a[0]);
   for(let i=0;i<=40;i++){
    const y=a[0]+(b[0]-a[0])*i/40,value=f(xMid,y);samples++;
    check(Number.isFinite(value)&&value>=lo-1e-12&&value<=hi+1e-12,'each rail section remains between its end heights without overshoot');
    check((value-previous)*Math.sign(b[1]-a[1])>=-1e-12,'each section is monotone, without secondary cheek ridges');previous=value;
    for(const x of [0,rail.innerM-.001,rail.outerM+.001])check(f(x,y)===0,'cheek field leaves the centre face and external support untouched');
    for(const x of [rail.innerM+.003,xMid,rail.outerM-.003])check(Math.abs(f(x,y)-f(-x,y))<1e-12,'left and right cheek offsets mirror before identity variation');
   }
  }
  for(const row of rows.slice(1,-1)){
   for(const x of edges)tangentJoin(v=>f(v,row[0]),x);
   for(const x of [-xMid,xMid])for(const y of [yLo-.001,yLo,yHi,yHi+.001])check(f(x,y)===0,'longitudinal compact support has no raised endpoint');
   const values=Array.from({length:31},(_,i)=>f(rail.innerM+(rail.outerM-rail.innerM)*i/30,row[0]));
   check(values.every(value=>value*Math.sign(row[1])>=-1e-12&&Math.abs(value)<=Math.abs(row[1])+1e-12),'transverse taper cannot invert or amplify the longitudinal shape');
  }
 }finally{p.forms=oldForms;}
 return {checks,samples,maximumFirstDerivativeMismatch:maxSlopeMismatch,firstDerivativeContinuous:true,curvatureContinuityClaimed:false,visualAcceptance:false};
}

export function checkFaceAnatomyParameters(){
 let checks=0;const check=(v,m)=>{assertDefault(v,m);checks++;};
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/(Math.hypot(...a)||1));
 const context=vm.createContext({add,sub,mul,cross,norm,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),COMPACT_INFLUENCES:8});
 new vm.Script(['body/EyeAnatomy.js','body/PerioralSurface.js','body/BrowAnatomy.js','body/BeardAnatomy.js','body/FaceAnatomy.js'].map(readDefault).join('\n')+'\nglobalThis.api={create:compactCreateFaceAnatomy,sample:compactFaceRaySampler,form:compactFaceFormDepth,guide:compactFaceGuideSpline,perioral:compactPerioralDepth,outline:compactLipOutline,relief:compactLipReliefDepth,radial:compactLipRadial,opening:compactLipOpening,cavityJaw:compactCavityJawWeight,lipJaw:compactLipJawWeight,structure:COMPACT_PERIORAL_STRUCTURE,parameters:COMPACT_FACE_ANATOMY};').runInContext(context);
 const api=context.api,rig={jointIds:new Map([['head',7]])},cheekRail=checkFaceCheekRail(api);checks+=cheekRail.checks;
 const plane={name:'skin',canonicalPositions:Float32Array.from([-.09,1.40,.19,.09,1.40,.19,.09,1.59,.19,-.09,1.59,.19]),indices:Uint16Array.from([0,1,2,0,2,3])};
 const before=JSON.stringify(plane),front=api.sample([plane]);
 check(Math.abs(front(0,1.5)-.19)<1e-7,'barycentric source depth');
 check(front(.1,1.5)===null,'outside ray remains missing');
 const smoothPlane={...plane,normals:Int16Array.from([6553,0,6553,0,6553,0,6553,0])},smoothSample=api.sample([smoothPlane]);
 const sampledNormal=smoothSample.normal(0,1.50);
 check(sampledNormal&&Math.abs(Math.hypot(...sampledNormal)-1)<1e-9&&sampledNormal[0]>.24,'source shading normal survives barycentric face-boundary sampling');
 check(smoothSample.normal(.1,1.5)===null,'missing source normal cannot fabricate an attachment');
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
  check(collapsed===0,'noncollapsed three-dimensional triangles '+m.name+' count='+collapsed);
  check(inverted===0,'geometric winding agrees with three-dimensional normals '+m.name+' count='+inverted);
 }
 const cavity=full.meshes.find(m=>m.name==='noseInterior'),n=api.parameters.nostrils;
 const nose=api.parameters.nose;check(n.ry>n.rx*.5&&n.ry<n.rx*.7,'nostril aperture is oval rather than a horizontal slit');
 check(nose.guideX[0]===0&&nose.guideX.every((x,i,all)=>i===0||x>all[i-1])&&nose.guideX.at(-1)<nose.sidewallX&&nose.sidewallX<nose.cheekHalfWidth,'authored nasal landmarks precede independently source-fitted sidewall and cheek attachment stations');
 check(nose.crossSections.every((row,i,all)=>row.length===nose.guideX.length+1&&(i===0||row[0]>all[i-1][0]))&&nose.centreline.every((row,i,all)=>i===0||row[0]>all[i-1][0]),'nasal longitudinal guides are ordered and have matching transverse dimensions');
 const basal=nose.crossSections.find(row=>row[0]===n.y),tip=nose.crossSections.find(row=>row[0]===1.483);
 check(basal[1]>basal[3]&&basal[4]>basal[3]&&tip[2]>tip[1],'columella and ala flank the nostril with distinct projection and paired tip domes remain supported');
 for(const row of nose.crossSections){
  const guide=api.guide(nose.guideX,row.slice(1));
  check(nose.guideX.every((x,i)=>Math.abs(guide(x)-row[i+1])<1e-12),'nasal C2 guide passes through its authored transverse landmarks');
  const samples=Array.from({length:125},(_,i)=>guide(nose.cheekHalfWidth*i/124));
  check(samples.every(v=>Number.isFinite(v)&&v>-.04&&v<1.12),'nasal spline remains bounded between columella, ala and cheek without oscillating spikes');
  for(const x of nose.guideX.slice(1,-1)){
   const h=1e-6,left=(guide(x)-guide(x-h))/h,right=(guide(x+h)-guide(x))/h;
   const d2left=(guide(x)-2*guide(x-h)+guide(x-2*h))/(h*h),d2right=(guide(x+2*h)-2*guide(x+h)+guide(x))/(h*h);
   check(Math.abs(left-right)<.15&&Math.abs(d2left-d2right)<80,'nasal transverse rails meet with continuous tangent and curvature');
  }
 }
 const lips=api.parameters.lips,centre=api.outline(lips.centreX),peak=api.outline(lips.centreX+lips.halfWidth*.18),centralHeight=centre.top-centre.bottom;
 check(lips.halfWidth>.023&&lips.halfWidth<.025&&centralHeight>.014&&centralHeight<.018,'neutral mouth width and central vermilion height remain bounded');
 check(peak.top>centre.top&&centre.bottom>peak.bottom,'Cupid bow and lower-lip belly remain distinct without an inflated uniform ring');
 check(api.relief(0,0,true)<.0021&&api.relief(0,0,false)<.0021,'neutral free-edge projection remains below the former swollen candidate');
 const structure=api.structure,pc=structure.centreX,ph=structure.philtrum,phY=(ph.lowerY+ph.upperY)/2,phX=(ph.lowerX+ph.upperX)/2;
 check(api.perioral(pc,structure.seamY)>api.perioral(pc+.045,structure.seamY)+.0005,'oral support projects as one broad volume above the surrounding cheek baseline');
 check(api.perioral(pc-phX,phY)>api.perioral(pc,phY)&&api.perioral(pc+phX,phY)>api.perioral(pc,phY),'philtral columns flank a relative groove within the projecting upper-lip support');
 const sulcus=api.perioral(pc,structure.labiomental.y);check(sulcus<api.perioral(pc,1.452)&&sulcus<api.perioral(pc,structure.mentalis.y),'labiomental valley separates the lower lip and convex chin without requiring an absolute negative depth');
 check(api.perioral(pc,structure.mentalis.y)>api.perioral(pc+.035,structure.mentalis.y),'mentalis pad distributes centrally above the lateral chin');
 check(full.report.nostrilFrames.length===2&&full.report.nostrilFrames.every(f=>f.rimVertices>=16),'both nasal openings have tessellated rims');
 check(full.meshes.find(m=>m.name==='faceBrow').triangles===2*api.parameters.brow.strandsPerSide*api.parameters.brow.sides*(api.parameters.brow.segments+1)*2,'individual closed tube fibre topology');
 check(api.form(.5,1.5)===0,'secondary forms have bounded support');
 check(full.report.measuredAnatomy===false,'authored geometry is not labelled measured');
 // Keep the whole oral attachment in front of the sampler's .12 depth cutoff.
 const sloped={...plane,canonicalPositions:Float32Array.from(plane.canonicalPositions,(v,i)=>i%3===2?.205+2*(plane.canonicalPositions[i-1]-1.48):v)};
 const slopedFace=api.create([sloped],rig,1);
 // The returning underside is not single-valued in front projection. Verify
 // the actual three-dimensional aperture frame and its shared mesh boundary.
 for(const face of [full,slopedFace]){
  const skin=face.meshes.find(m=>m.name==='faceSkin'),cavity=face.meshes.find(m=>m.name==='noseInterior'),edges=new Map();
  for(let i=0;i<skin.indices.length;i+=3)for(const [a,b]of [[0,1],[1,2],[2,0]]){const x=skin.indices[i+a],y=skin.indices[i+b],key=Math.min(x,y)+'/'+Math.max(x,y);edges.set(key,(edges.get(key)||0)+1);}
  const boundaryIds=new Set([...edges].filter(([,count])=>count===1).flatMap(([key])=>key.split('/').map(Number))),boundary=[...boundaryIds].map(i=>Array.from(skin.canonicalPositions.subarray(i*3,i*3+3)));
  let start=0;for(const frame of face.report.nostrilFrames){
   const f=frame.projectedAxes,det=f[0]*f[3]-f[1]*f[2],radii=frame.physicalRadii;
   check(Math.abs(det-radii[0]*radii[1]*frame.normal[2])<1e-11,'nostril frontal area is the physical basal area foreshortened by its actual normal');
   check(Math.hypot(f[2],f[3])<Math.hypot(radii[0],radii[1]),'downward-facing physical nostril axes do not retain a full unprojected frontal opening');
   const floor=Array.from(cavity.canonicalPositions.subarray(frame.floorVertex*3,frame.floorVertex*3+3)),delta=sub(floor,frame.centre),along=delta.reduce((s,v,i)=>s+v*frame.normal[i],0);
   check(Math.abs(Math.hypot(...delta)-n.depth)<2e-7,'cavity has the configured physical depth');
   check(along<-.999*n.depth&&frame.normal[1]<-.3,'nasal opening turns downward and the cavity enters behind it');
   check(cavity.cavityLight?.length===cavity.vertices*4,'nasal visibility field is complete');
   for(let i=start;i<=frame.floorVertex;i++){
    const axis=Array.from(cavity.cavityLight.subarray(i*4+1,i*4+4));
    check(Math.hypot(...axis.map((v,k)=>v-frame.normal[k]))<1e-7,'nasal wall carries its aperture direction separately from its surface normal');
   }
   check(cavity.cavityLight[frame.floorVertex*4]<.1,'deep nasal floor receives little aperture light');
   const radialRows=(frame.floorVertex-start)/(frame.rimVertices+1)-1,stride=radialRows+1;
   check(Number.isInteger(radialRows)&&radialRows>=2&&radialRows===(n.rings??10),'actual cavity layout matches its configured radial sampling');
   for(let i=0;i<frame.rimVertices;i++){let previous=0;for(let j=0;j<=radialRows;j++){const visibility=cavity.cavityLight[(start+i*stride+j)*4];check(Number.isFinite(visibility)&&visibility>=previous&&visibility<=1,'nasal visibility increases continuously towards the opening');previous=visibility;}check(previous===1,'shared rim has unoccluded facial illumination');}
   const rimIds=[];for(let i=0;i<frame.rimVertices;i++){const id=start+i*stride+radialRows,point=Array.from(cavity.canonicalPositions.subarray(id*3,id*3+3)),match=boundary.findIndex(p=>Math.hypot(...sub(p,point))<2e-7);check(match>=0,'cavity rim shares the clipped facial boundary');rimIds.push([...boundaryIds][match]);}
   for(let i=0;i<rimIds.length;i++){const a=rimIds[i],b=rimIds[(i+1)%rimIds.length];check(edges.get([Math.min(a,b),Math.max(a,b)].join('/'))===1,'every cavity rim segment is an open edge of the facial mesh');}
   start=frame.floorVertex+1;
  }
  const outer=face.meshes.find(m=>m.lipSurface==='vermilion'),rings=api.parameters.lips.rings,rimIds=[];
  for(let i=rings;i<outer.vertices;i+=rings+1){
   const point=Array.from(outer.canonicalPositions.subarray(i*3,i*3+3)),id=outer.faceBoundaryVertexIds[(i-rings)/(rings+1)];
   check(boundaryIds.has(id)&&point.every((v,k)=>v===skin.canonicalPositions[id*3+k]),'lip annulus shares an actual facial boundary vertex');
   rimIds.push(id);
   check(outer.normals[i*2]===skin.normals[id*2]&&outer.normals[i*2+1]===skin.normals[id*2+1],'lip and skin boundary normals are identical');
  }
  for(let i=0;i<rimIds.length;i++)check(edges.get([Math.min(rimIds[i],rimIds[(i+1)%rimIds.length]),Math.max(rimIds[i],rimIds[(i+1)%rimIds.length])].join('/'))===1,'every lip attachment segment matches a facial boundary edge at segment '+i);
  const inner=face.meshes.find(m=>m.lipSurface==='mucosa'),wall=face.meshes.find(m=>m.name==='mouthInterior');
  const wallStride=(wall.vertices-1)/(inner.outerLipBoundaryVertexIds.length+1);
  check(Number.isInteger(wallStride)&&wallStride===wall.returnRows+1,'oral chamber rows match actual generated topology');
  for(let i=0;i<inner.outerLipBoundaryVertexIds.length;i++){
   const outerId=inner.outerLipBoundaryVertexIds[i],innerId=i*(inner.returnRows+1),rear=innerId+inner.returnRows,wallId=i*wallStride;
   check([0,1,2].every(k=>inner.canonicalPositions[innerId*3+k]===outer.canonicalPositions[outerId*3+k]),'every inner return starts on the identical outer free-edge vertex');
   check([0,1].every(k=>inner.normals[innerId*2+k]===outer.normals[outerId*2+k]),'outer and inner lip share their contact tangent');
   check([0,1,2].every(k=>wall.canonicalPositions[wallId*3+k]===inner.canonicalPositions[rear*3+k]),'oral vestibule starts on the identical mucosal rear-edge vertex');
  }
 }
 const lip=full.meshes.find(m=>m.name==='faceLip'),mouth=full.meshes.find(m=>m.name==='mouthInterior'),upperTeeth=full.meshes.find(m=>m.name==='upperTeeth'),lowerTeeth=full.meshes.find(m=>m.name==='lowerTeeth'),upperGum=full.meshes.find(m=>m.name==='upperGum'),lowerGum=full.meshes.find(m=>m.name==='lowerGum'),tongue=full.meshes.find(m=>m.name==='tongue');
 check(lip.lipSurface==='vermilion'&&full.meshes.some(m=>m.name==='faceLip'&&m.lipSurface==='mucosa'&&m.vertices>0),'outer vermilion and inner return have explicit material domains');
 // Exercise face depths on both sides of the former .1862/.1882 pigment gate.
 for(const depth of [.175,.205]){
  const shifted={...plane,canonicalPositions:Float32Array.from(plane.canonicalPositions,(v,i)=>i%3===2?depth:v)};
  const shiftedFace=api.create([shifted],rig,1),domains=shiftedFace.meshes.filter(m=>m.name==='faceLip');
  check(domains.length===2&&domains[0].lipSurface==='vermilion'&&domains[1].lipSurface==='mucosa','material domains survive source depth changes');
  check(domains.every(m=>m.canonicalPositions.every(Number.isFinite)),'depth-shifted lip geometry is finite');
  check(domains[0].vertices===lip.vertices,'source depth does not change lip topology');
  const oralNames=['upperTeeth','lowerTeeth','upperGum','lowerGum'];let commonDelta;
  for(const name of oralNames){
   const a=full.meshes.find(m=>m.name===name),b=shiftedFace.meshes.find(m=>m.name===name);
   const delta=b.canonicalPositions[2]-a.canonicalPositions[2];commonDelta??=delta;
   check(Math.abs(delta-commonDelta)<2e-7,'source-fitting preserves oral assembly relationships');
   check(b.canonicalPositions.every((v,i)=>Math.abs(v-a.canonicalPositions[i]-(i%3===2?delta:0))<2e-7),'oral source-fitting is a rigid depth translation');
  }
  if(depth<.18)check(commonDelta<-.005,'shallow face moves oral structures behind its envelope');
  const floor=shiftedFace.meshes.find(m=>m.name==='mouthInterior'),attachedTongue=shiftedFace.meshes.find(m=>m.name==='tongue');
  check(attachedTongue.mouthBoundaryVertexIds.length>100,'tongue owns an explicit oral floor attachment');
  for(const [tongueId,floorId]of attachedTongue.mouthBoundaryVertexIds)for(let k=0;k<3;k++)
   check(attachedTongue.canonicalPositions[tongueId*3+k]===floor.canonicalPositions[floorId*3+k],'source fitting retains exact tongue and floor boundary positions');
 }
 check([upperTeeth,lowerTeeth,upperGum,lowerGum,tongue].every(Boolean),'all layered oral meshes are generated');
 check(upperTeeth.triangles===lowerTeeth.triangles&&upperTeeth.triangles>1000,'paired dentitions use stable closed crown topology');
 // Crown geometry is closed and tooth-specific, independently of colour or
 // mouth visibility. Preserve the established five mirrored teeth per arch.
 const crownPoints=(mesh,crown)=>{const count=mesh.vertices/10;return Array.from({length:count},(_,i)=>Array.from(mesh.canonicalPositions.subarray((crown*count+i)*3,(crown*count+i)*3+3)));};
 const sectionSpan=(points,axis)=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
 for(const mesh of [upperTeeth,lowerTeeth]){
  const count=mesh.vertices/10,edges=new Map();check(Number.isInteger(count),'dentition preserves ten separately authored crowns');
  for(let i=0;i<mesh.indices.length;i+=3){const ids=Array.from(mesh.indices.subarray(i,i+3));
   check(ids.every(id=>Math.floor(id/count)===Math.floor(ids[0]/count)),'crowns remain separate rigid closed surfaces');
   for(const [a,b] of [[0,1],[1,2],[2,0]]){const key=[Math.min(ids[a],ids[b]),Math.max(ids[a],ids[b])].join('/');edges.set(key,(edges.get(key)||0)+1);}
  }
  check([...edges.values()].every(value=>value===2)&&mesh.vertices-edges.size+mesh.triangles===20,'all ten crowns are closed manifolds without open cervical or cutting edges');
 }
 for(const crown of [0,1,2,3]){
  const points=crownPoints(upperTeeth,crown),ys=points.map(p=>p[1]),top=Math.max(...ys),bottom=Math.min(...ys),height=top-bottom;
  const neck=points.filter(p=>p[1]>top-height*.10),body=points.filter(p=>p[1]<top-height*.3&&p[1]>top-height*.7),edge=points.filter(p=>p[1]<bottom+height*.035);
  check(sectionSpan(neck,0)<sectionSpan(body,0)*.92,'incisor cervical neck narrows into the gingiva');
  check(sectionSpan(edge,0)>sectionSpan(body,0)*.65,'incisor keeps a broad cutting edge rather than a central ellipsoid pole');
  check(sectionSpan(edge,2)<sectionSpan(body,2)*.60,'incisor labiolingual thickness tapers into a blade');
 }
 for(const crown of [4,5]){
  const points=crownPoints(upperTeeth,crown),ys=points.map(p=>p[1]),top=Math.max(...ys),bottom=Math.min(...ys),height=top-bottom;
  const body=points.filter(p=>p[1]<top-height*.3&&p[1]>top-height*.7),tip=points.filter(p=>p[1]<bottom+height*.035);
  check(sectionSpan(tip,0)<sectionSpan(body,0)*.5,'canine converges into one rounded cusp instead of copying the incisor blade');
 }
 const width=m=>{const xs=[];for(let i=0;i<m.canonicalPositions.length;i+=3)xs.push(m.canonicalPositions[i]);return Math.max(...xs)-Math.min(...xs);};
 check(width(upperTeeth)>width(lowerTeeth),'maxillary dental arch remains wider than mandibular arch');
 check(upperGum.triangles===lowerGum.triangles&&upperGum.triangles>500,'continuous gingival arches use matched tube topology');
 check(tongue.vertices>200&&full.report.jawPerformanceApproximation===true&&full.report.oralStructures.measuredDentition===false,'tongue and jaw approximation are explicit authored structures rather than measured dentition');
 check(Math.max(...mouth.canonicalPositions.filter((v,i)=>i%3===2))-Math.min(...mouth.canonicalPositions.filter((v,i)=>i%3===2))>.008,'oral cavity has depth rather than a closure strip');
 // Shared attachment is C2: no raised rim, tangent break or curvature step.
 for(const upper of [true,false])for(const u of [-1,-.95,-.6,-.25,0,.25,.6,.95,1]){
  check(Math.abs(api.relief(u,1,upper))<1e-12,'outer perioral attachment has no raised rim');
  check(Math.abs((api.relief(u,1,upper)-api.relief(u,1-1e-5,upper))/1e-5)<1e-6,'perioral attachment joins the skin tangentially');
  const h=1e-5,curvature=(api.relief(u,1-2*h,upper)-2*api.relief(u,1-h,upper)+api.relief(u,1,upper))/(h*h);
  check(Math.abs(curvature)<1e-4,'perioral relief has zero curvature at the outer attachment');
 }
 // Geometric shape requirements replace the historical 0.6 mm upper-roll cap,
 // which prevented a central tubercle while allowing a repeated thin ribbon.
 const lipSection=(u,upper)=>{
  const samples=Array.from({length:601},(_,i)=>api.relief(u,i/600,upper));
  const peak=Math.max(...samples),index=samples.indexOf(peak);
  return {samples,peak,index,crest:index/600*lips.apron,frontSpan:samples.filter(v=>v>=peak*.95).length/600*lips.apron};
 };
 for(let i=0;i<=40;i++){
  const u=-1+i/20;
  check(Math.abs(api.relief(u,0,true)-api.relief(u,0,false))<1e-12,'upper and lower lips share the same closing-edge projection');
  for(const upper of [true,false]){
   const section=lipSection(u,upper),{samples,index}=section;
   check(samples.every(v=>Number.isFinite(v)&&v>=0),'authored lip sections remain finite and supported above their common bed');
   check(section.crest>0&&section.crest<1,'the single lip crest stays inside the vermilion rather than becoming an attachment ridge');
   check(samples.every((v,j)=>j===0||(j<=index?v>=samples[j-1]-1e-13:v<=samples[j-1]+1e-13)),'each lip section rises once and falls once without secondary rolls or terraces');
  }
 }
 for(const u of [-1,1])for(let i=0;i<=60;i++)check(Math.abs(api.relief(u,i/60,true)-api.relief(u,i/60,false))<1e-12,'upper and lower sections meet through the complete finite commissure');
 const upperCentre=lipSection(0,true),upperWing=lipSection(.60,true),lowerCentre=lipSection(0,false),lowerLobe=lipSection(.25,false),lowerWing=lipSection(.70,false);
 check(upperCentre.peak>lowerCentre.peak&&upperCentre.peak>upperWing.peak,'the central upper tubercle projects ahead of the lower centre and receding upper wings');
 check(upperCentre.crest<upperWing.crest,'upper wings turn into the face on a different section from the central tubercle');
 const upperExtent=centre.top-centre.seam,lowerExtent=centre.seam-centre.bottom;
 check(lowerCentre.frontSpan*lowerExtent>upperCentre.frontSpan*upperExtent*1.4,'the lower lip has a broader frontal plane than the tightly turned upper tubercle');
 check(lowerLobe.peak>lowerCentre.peak&&lowerLobe.peak>lowerWing.peak&&lowerLobe.peak<lowerCentre.peak*1.2,'paired lower-lip lobes remain broad and subordinate rather than two isolated bumps');
 check(api.radial(0)===0&&api.radial(.16)===.16&&api.radial(1)===1,'rolled free edge and red border retain their landmarks');
 check(api.radial(1e-6)/1e-6<.001,'outer free edge approaches the inner return tangentially');
 const lipX=api.parameters.lips.centreX,seamY=api.outline(lipX).seam,lower=[lipX,seamY-.0001,.188],upper=[lipX,seamY+.0001,.188];
 let lastGap=.0002;for(const amount of [.25,.5,1]){
  const gap=upper[1]+api.opening(upper,amount)-lower[1]-api.opening(lower,amount);
  check(gap>lastGap,'independent lips open monotonically');lastGap=gap;
 }
 check(lastGap>.0045&&lastGap<.006,'full lip opening has a visible millimetre-scale gap');
 for(const point of [[lipX,seamY+.021,.188],[lipX,seamY,.12],[lipX+.026,seamY,.188]])check(api.opening(point,1)===0,'opening remains inside perioral support');
 for(const x of [lipX-.020,lipX,lipX+.020]){
  const seam=api.outline(x).seam;
  check(api.cavityJaw([x,seam+.0007,.18])===0,'upper vestibule stays attached to the maxilla while the jaw opens');
  check(api.cavityJaw([x,seam-.0007,.18])===1,'lower vestibule follows the mandibular side');
  check(Math.abs(api.cavityJaw([x,seam,.18])-.5)<1e-10,'commissural jaw weight remains continuous between oral sides');
  let previous=1;for(let i=0;i<=20;i++){const w=api.cavityJaw([x,seam-.0005+i*.00005,.18]);check(w<=previous+1e-10&&w>=0&&w<=1,'cavity jaw weights change monotonically through the commissure');previous=w;}
 }
 for(const side of [-1,1]){
  const cornerX=lipX+side*lips.halfWidth,seam=api.outline(cornerX).seam;
  check(api.lipJaw([cornerX,seam+.0001,.18])===api.lipJaw([cornerX,seam-.0001,.18]),'upper and lower oral sides share the same commissural jaw weight');
  const separation=inset=>{const x=lipX+side*lips.halfWidth*(1-inset),s=api.outline(x).seam;return api.lipJaw([x,s-.0001,.18])-api.lipJaw([x,s+.0001,.18]);};
  const ratio=separation(.004)/separation(.001);
  check(ratio>1.8&&ratio<2.2,'mouth opening approaches the commissure as a rounded arc instead of a quadratic pointed wedge');
 }
 check(api.lipJaw([lipX,seamY+.0001,.18])===0&&api.lipJaw([lipX,seamY-.0001,.18])===1,'central free lips retain their own upper and lower jaw sides');
 for(const x of [-.023,-.012,0,.012,.023])for(const y of [seamY-.018,seamY-.009,seamY-.001,seamY+.001,seamY+.009,seamY+.018]){
  const e=1e-6,derivative=(api.opening([x,y+e,.188],1)-api.opening([x,y-e,.188],1))/(2*e);
  check(1+derivative>.5,'lip opening retains a positive local volume determinant away from the aperture');
 }
 return {checks,cheekRail,syntheticPlane:true,sourcePreserved:true,humanGenerated:false,visualAcceptance:false};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify({sources:checkFaceAnatomySources(),...(process.argv.includes('--parameter-fixtures')?{parameters:checkFaceAnatomyParameters()}:{})},null,2));
