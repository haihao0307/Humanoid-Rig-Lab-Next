const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function edit(rel,fn){const p=path.join(root,rel),before=fs.readFileSync(p,'utf8'),after=fn(before);if(after===before)throw Error('No change for '+rel);fs.writeFileSync(p,after);}
function one(s,a,b,label=a.slice(0,70)){if(!s.includes(a))throw Error('Missing anchor '+label);if(s.indexOf(a)!==s.lastIndexOf(a))throw Error('Non-unique anchor '+label);return s.replace(a,b);}

edit('eyes/EyeSystem.js',s=>{
 s=one(s,"export const EYE_VERSION='eyes/3.0.0';","export const EYE_VERSION='eyes/5.0.0';",'eye base version');
 s=one(s," {name:'right',x:-.0300,y:.0690,z:.0627,sign:-1,rx:.0205,ry:.0175,half:.0122,radius:.0125},\n {name:'left', x:.0217,y:.0690,z:.0625,sign: 1,rx:.0203,ry:.0173,half:.0120,radius:.0125}"," {name:'right',x:-.0300,y:.0690,z:.0627,sign:-1,rx:.0205,ry:.0175,half:.0112,radius:.0122},\n {name:'left', x:.0217,y:.0690,z:.0625,sign: 1,rx:.0203,ry:.0173,half:.0110,radius:.0122}",'socket scale');
 s=one(s,"irisDepth:.83,opening:1};","irisDepth:.83,opening:.92};",'default opening');
 s=one(s,"['opening',.65,1.25]","['opening',.56,1.15]",'opening restore range');
 return s;
});

edit('eyes/FittedEyes.js',s=>one(s,"eyeRadiusMM:12.5,defaultApertureMM:[23.4,5.9]","eyeRadiusMM:12.2,defaultApertureMM:[22.2,6.7]",'reported eye scale'));

edit('research/ResearchEyes.js',s=>{
 s=one(s,`function rail(u,upper){
 u=clamp(u,-1,1);const t=(u+1)*.5;
 // Endpoint-constrained least squares of the 33 measured CC0 contour points.
 const c=upper?[.38441346288415335,-.013457920226416842,.4445801720372662,.056531015805420755]:[-.26980682201867545,-.07559112460541781,-.25913444501352073,-.003966655456640926];
 const k=upper?1:2,baseline=lerp(REFERENCE_RAILS[0][k],REFERENCE_RAILS[32][k],t);
 return baseline+(1-u*u)*(c[0]+u*(c[1]+u*(c[2]+u*c[3])));
}` ,`function rail(u,upper){
 u=clamp(u,-1,1);const t=(u+1)*.5;
 // Endpoint-constrained least squares of the 33 measured CC0 contour points.
 const c=upper?[.38441346288415335,-.013457920226416842,.4445801720372662,.056531015805420755]:[-.26980682201867545,-.07559112460541781,-.25913444501352073,-.003966655456640926];
 const k=upper?1:2,baseline=lerp(REFERENCE_RAILS[0][k],REFERENCE_RAILS[32][k],t);
 const raw=baseline+(1-u*u)*(c[0]+u*(c[1]+u*(c[2]+u*c[3])));
 // The template points become steep very close to the canthi. A measured lid
 // still converges progressively: the medial side closes earlier than the lateral.
 const taper=smooth((1-Math.abs(u))/(u<0?.24:.18));
 return baseline+(raw-baseline)*taper;
}`,'canthal rail taper');
 s=one(s,"this.state.reconstruction='ET03 contact-constrained shell'","this.state.reconstruction='ET05 anatomical palpebral envelope'",'reconstruction label');
 s=one(s,"observed.z-envelope.z-.00045","observed.z-envelope.z-.00058",'deeper globe fit');
 s=one(s,` margin(c,a,blink){
  const nx=Math.cos(a),upper=Math.sin(a)>=0,u=nx*c.sign,w=Math.sqrt(Math.max(0,1-nx*nx));
  const top=rail(u,true)*c.half,bottom=rail(u,false)*c.half,center=lerp(bottom,top,.22);
  const pitch=c.gazePitch||0,yaw=c.gazeYaw||0;
  const gaze=-pitch*(upper?.0056:.0023)*w,squint=this.config.squint||0;
  const open=this.config.opening||1;
  let topOpen=top*open-pitch*.0056*w-.0020*squint*w;
  let bottomOpen=bottom*open-pitch*.0023*w+.0020*squint*w;
  if(topOpen<bottomOpen+.00006*w){const mid=(topOpen+bottomOpen)*.5;topOpen=mid+.00003*w;bottomOpen=mid-.00003*w;}
  const rest=upper?topOpen:bottomOpen,narrow=0;
  const closedY=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
  const y=lerp(c.y-.0005+rest,closedY,blink);
  const x=c.x+c.half*nx+yaw*.0006*w*(1-blink);
  const front=this.eyeFront(c,x,y);let z=front===null?c.z+.003:front+.00009;
  if(blink>0&&c.referenceSurface){
   const key=Math.round(nx*1e9);let closedZ=c.closedCurve.get(key);
   if(closedZ===undefined){closedZ=c.referenceSurface(c.x+c.half*nx,closedY).z;c.closedCurve.set(key,closedZ);}
   z=Math.max(z,lerp(z,closedZ,blink));
  }
  return new THREE.Vector3(x,y,z);
 }`,` margin(c,a,blink){
  const nx=Math.cos(a),upper=Math.sin(a)>=0,u=nx*c.sign,w=Math.sqrt(Math.max(0,1-nx*nx));
  const top=rail(u,true)*c.half,bottom=rail(u,false)*c.half;
  const pitch=c.gazePitch||0,yaw=c.gazeYaw||0,squint=this.config.squint||0;
  const open=this.config.opening??.92;
  let topOpen=top*open-pitch*.0052*w-.00175*squint*w;
  let bottomOpen=bottom*open-pitch*.0021*w+.00175*squint*w;
  if(topOpen<bottomOpen+.00008*w){const mid=(topOpen+bottomOpen)*.5;topOpen=mid+.00004*w;bottomOpen=mid-.00004*w;}
  const rest=upper?topOpen:bottomOpen;
  const closedY=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
  const y=lerp(c.y-.0005+rest,closedY,blink);
  const x=c.x+c.half*nx+yaw*.00052*w*(1-blink);
  const front=this.eyeFront(c,x,y),corner=smooth((1-Math.abs(u))/(u<0?.24:.18));
  // Anterior free margin: upper lid is deliberately thicker than lower lid.
  // The posterior conjunctival surface remains 0.045 mm off the globe.
  const openClearance=lerp(.00015,upper?.00040:.00027,corner);
  const clearance=lerp(openClearance,.00029,blink);
  let z=front===null?c.z+.003:front+clearance;
  if(blink>0&&c.referenceSurface){
   const key=Math.round(nx*1e9);let closedZ=c.closedCurve.get(key);
   if(closedZ===undefined){closedZ=c.referenceSurface(c.x+c.half*nx,closedY).z;c.closedCurve.set(key,closedZ);}
   z=Math.max(z,lerp(z,closedZ,blink));
  }
  return new THREE.Vector3(x,y,z);
 }`,'anatomical margin');
 s=one(s,`  const im=new THREE.MeshStandardMaterial({color:0x96574f,roughness:.46,side:THREE.FrontSide});
  const inside=new THREE.Mesh(ig,im);inside.name='inner-lid-contact-'+c.name;inside.frustumCulled=false;m.add(inside);
  return {mesh:m,entries,A,R,inside,ni};`,`  const im=new THREE.MeshStandardMaterial({color:0x87504b,roughness:.50,side:THREE.FrontSide});
  const inside=new THREE.Mesh(ig,im);inside.name='inner-lid-contact-'+c.name;inside.frustumCulled=false;m.add(inside);
  // Free palpebral margin bridges the outer skin to the posterior contact shell.
  // It is a real strip, not a shader-only dark line; upper and lower thickness differ.
  const es=8,ep=new Float32Array((A+1)*(es+1)*3),ei=[];
  for(let a=0;a<A;a++)for(let q=0;q<es;q++){const k=a*(es+1)+q;ei.push(k,k+es+1,k+1,k+1,k+es+1,k+es+2);}
  const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.BufferAttribute(ep,3));eg.setIndex(ei);
  const em=new THREE.MeshPhysicalMaterial({color:0x9a625a,roughness:.46,metalness:0,clearcoat:.22,clearcoatRoughness:.20,ior:1.36,envMapIntensity:.32,side:THREE.DoubleSide});
  const edge=new THREE.Mesh(eg,em);edge.name='palpebral-free-margin-'+c.name;edge.frustumCulled=false;edge.castShadow=true;edge.receiveShadow=true;m.add(edge);
  return {mesh:m,entries,A,R,inside,ni,edge,es};`,'free margin mesh');
 s=one(s,"IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?outerZ-.0003:z+.000035);","IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?outerZ-.0003:z+.000045);",'posterior gap');
 s=one(s,`  IP.needsUpdate=true;lid.inside.geometry.computeVertexNormals();
  const rp=e.rim.mesh.geometry.attributes.position;
  for(let a=0;a<=e.rim.A;a++){const theta=a/e.rim.A*TAU,p=this.margin(c,theta,blink),lower=Math.max(0,-Math.sin(theta));for(let s=0;s<=e.rim.S;s++){const b=s/e.rim.S*TAU,r=.000014+.000065*lower;rp.setXYZ(a*(e.rim.S+1)+s,p.x+Math.cos(theta)*Math.cos(b)*r,p.y+Math.sin(theta)*Math.cos(b)*r,p.z+Math.sin(b)*r+.000028);}}
  rp.needsUpdate=true;e.rim.mesh.geometry.computeVertexNormals();`,`  IP.needsUpdate=true;lid.inside.geometry.computeVertexNormals();
  const EP=lid.edge.geometry.attributes.position;
  for(let a=0;a<=lid.A;a++){
   const theta=a/lid.A*TAU,outer=margins[a],nx=Math.cos(theta),ny=Math.sin(theta),upper=ny>=0;
   const eyeZ=this.eyeFront(c,outer.x,outer.y),innerZ=eyeZ===null?outer.z-.00025:eyeZ+.000045;
   const corner=smooth((1-Math.abs(nx))/(nx*c.sign<0?.24:.18));
   const bulgeRadius=(upper?.00018:.00014)*(.34+.66*corner)*(1-.25*blink);
   for(let q=0;q<=lid.es;q++){
    const t=q/lid.es,bulge=Math.sin(Math.PI*t),k=a*(lid.es+1)+q;
    EP.setXYZ(k,outer.x+nx*bulge*bulgeRadius,outer.y+ny*bulge*bulgeRadius,lerp(innerZ,outer.z+.000006,t)+bulge*(upper?.000060:.000045));
   }
  }
  EP.needsUpdate=true;lid.edge.geometry.computeVertexNormals();
  // Tear film sits on the posterior edge; it no longer impersonates lid thickness.
  const rp=e.rim.mesh.geometry.attributes.position;
  for(let a=0;a<=e.rim.A;a++){
   const theta=a/e.rim.A*TAU,outer=margins[Math.round(a/e.rim.A*lid.A)],nx=Math.cos(theta),ny=Math.sin(theta),lower=Math.max(0,-ny),medial=Math.max(0,-nx*c.sign);
   const eyeZ=this.eyeFront(c,outer.x,outer.y),baseZ=(eyeZ===null?outer.z-.00020:eyeZ+.000055),r=.000018+.000035*lower+.000012*medial,inset=.000025;
   for(let q=0;q<=e.rim.S;q++){const b=q/e.rim.S*TAU;rp.setXYZ(a*(e.rim.S+1)+q,outer.x-nx*inset+nx*Math.cos(b)*r,outer.y-ny*inset+ny*Math.cos(b)*r,baseZ+Math.sin(b)*r);}
  }
  rp.needsUpdate=true;e.rim.mesh.geometry.computeVertexNormals();`,'edge and tear-film update');
 s=one(s,`  e.contactReport={minOuterClearanceMM:Number.isFinite(minClear)?minClear*1000:null,penetratingTestVertices:penetration,innerShell:true,outerBoundaryFixed:true,contactTestOuterRowsBelow:.55,eyeballHiddenForClosure:false,capturedClosureMaxDeviationMM:blink>.999?closureError*1000:null,outerBoundaryDeviationMM:boundaryError*1000};`,`  const topMid=margins[Math.round(lid.A*.25)],bottomMid=margins[Math.round(lid.A*.75)];
  const gapAtU=u=>{const nx=u*c.sign,a=Math.acos(clamp(nx,-1,1));return (this.margin(c,a,blink).y-this.margin(c,TAU-a,blink).y)*1000;};
  const topEye=this.eyeFront(c,topMid.x,topMid.y),bottomEye=this.eyeFront(c,bottomMid.x,bottomMid.y);
  e.contactReport={minOuterClearanceMM:Number.isFinite(minClear)?minClear*1000:null,penetratingTestVertices:penetration,innerShell:true,freeMarginMesh:true,outerBoundaryFixed:true,contactTestOuterRowsBelow:.55,eyeballHiddenForClosure:false,capturedClosureMaxDeviationMM:blink>.999?closureError*1000:null,outerBoundaryDeviationMM:boundaryError*1000,horizontalApertureMM:Math.abs(margins[0].x-margins[Math.round(lid.A*.5)].x)*1000,verticalApertureMM:(topMid.y-bottomMid.y)*1000,upperMarginThicknessMM:topEye===null?null:(topMid.z-topEye)*1000,lowerMarginThicknessMM:bottomEye===null?null:(bottomMid.z-bottomEye)*1000,posteriorTearGapMM:.045,medialGapAt90MM:gapAtU(-.90),lateralGapAt90MM:gapAtU(.90)};`,'anatomy report');
 s=one(s,"reconstruction:'ET03 contact shell / CC0 measured margin rails'","reconstruction:'ET05 thick palpebral margins / tapered canthi / contact shell'",'info label');
 s += "\n// ET05 anatomical upper/lower free-margin reconstruction\n";
 return s;
});

edit('talkinghead/IntegratedEyes.js',s=>{
 s=one(s,"export const EYE_VERSION='eyes/4.0.0';","export const EYE_VERSION='eyes/5.0.0';",'integration version');
 s=one(s,"const opening=clamp(c.opening*(1+f.wide[i]*.12),.65,1.25);","const opening=clamp(c.opening*(1+f.wide[i]*.10),.56,1.15);",'behavior opening range');
 return s;
});

edit('app.js',s=>{
 s=one(s,"VERSION='emily-transfer/4.0.0'","VERSION='emily-transfer/5.0.0'",'app version');
 s=one(s,"document.title='TalkingHead × 原人头 · ET04'","document.title='眼睑解剖重构 × TalkingHead · ET05'",'document title');
 s=one(s,"textContent='ET04 · TALKINGHEAD'","textContent='ET05 · EYELID ANATOMY'",'version badge');
 return s;
});

edit('index.html',s=>{
 s=s.replace('<title>眼球与眼睑 · ET03</title>','<title>眼睑解剖重构 · ET05</title>');
 s=s.replace('ET04 · TALKINGHEAD','ET05 · EYELID ANATOMY');
 s=s.replace('TalkingHead 行为 <small>ET04 / 1.7.0</small>','TalkingHead 行为 <small>ET05 / 1.7.0</small>');
 s=s.replace('眼睑接触约束继续由 ET03 执行。','眼睑接触、上睑厚度与眼角收束由 ET05 解剖层执行。');
 return s;
});

for(const rel of ['talkinghead/qa.cjs','talkinghead/public.cjs'])edit(rel,s=>s.replaceAll('/tmp/et04','/tmp/et05').replaceAll("version:'ET04'","version:'ET05'").replaceAll('emily-transfer/4.0.0','emily-transfer/5.0.0').replaceAll('eyes/4.0.0','eyes/5.0.0').replaceAll('ET04_BROWSER_PASS','ET05_BROWSER_PASS').replaceAll('ET04_PUBLIC_PASS','ET05_PUBLIC_PASS').replaceAll('__et04BootErrors','__et05BootErrors'));

console.log('ET05_ANATOMY_PATCH_APPLIED');
