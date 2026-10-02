import * as THREE from 'three';

// Character-calibrated metre-space components, generated from functions.
// Rim samples are transient references into the regenerated head, never assets.
export function createProceduralEyes({surface,mesh,byName,bindWorld,data}) {
 const head=byName.get('head'),root=new THREE.Group();
 root.name='ProceduralEyeSockets';root.matrixAutoUpdate=false;
 root.matrix.copy(bindWorld.get(head)).invert();head.add(root);
 const eyes=[],halfWidth=.0136,upper=.0038,lower=.0026,radius=.0145,cy=1.656,columns=48,rows=8;
 const parts=new Map(data.charts.map(c=>[c.id,c.part]));
 const candidates=[],vertexMaterial=new Uint8Array(surface.positions.length/3);
 for(const g of surface.groups)for(let i=g.start;i<g.start+g.count;i++)vertexMaterial[surface.indices[i]]=g.materialIndex;
 for(let i=0;i<surface.positions.length/3;i++)if(parts.get(surface.chartIds[i])===2&&surface.positions[i*3+2]>.075&&Math.abs(surface.positions[i*3])<.075&&Math.abs(surface.positions[i*3+1]-cy)<.030)candidates.push(i);
 function rim(x,y) {
  const nearest=[];
  for(const id of candidates){const d=(surface.positions[id*3]-x)**2+(surface.positions[id*3+1]-y)**2;let at=nearest.findIndex(r=>d<r.d);if(at<0)at=nearest.length;nearest.splice(at,0,{id,d});if(nearest.length>4)nearest.pop();}
  if(!nearest.length)throw Error('No regenerated head samples at eye rim');
  const sum=nearest.reduce((s,r)=>s+1/Math.max(r.d,1e-10),0);
  const samples=nearest.map(r=>({...r,base:Array.from(surface.positions.subarray(r.id*3,r.id*3+3)),w:1/Math.max(r.d,1e-10)/sum}));
  const normal=new THREE.Vector3(),color=new THREE.Color(0,0,0);let z=0;
  for(const {id,w} of samples){z+=surface.positions[id*3+2]*w;normal.addScaledVector(new THREE.Vector3().fromArray(surface.normals,id*3),w);
   const image=mesh.material[vertexMaterial[id]].map?.image;
   if(image?.data){const u=surface.parameters[id*2],v=surface.parameters[id*2+1],channels=image.data.length/(image.width*image.height),pixel=(Math.round((1-THREE.MathUtils.clamp(v,0,1))*(image.height-1))*image.width+Math.round(THREE.MathUtils.clamp(u,0,1)*(image.width-1)))*channels;
    color.add(new THREE.Color().setRGB(image.data[pixel]/255,image.data[pixel+1]/255,image.data[pixel+2]/255,THREE.SRGBColorSpace).multiplyScalar(w));
   }else color.add(new THREE.Color(0xb98568).multiplyScalar(w));
  }
  return {samples,z,normal:normal.normalize(),color};
 }
 const rotation=new THREE.Matrix4(),normal=new THREE.Vector3(),euler=new THREE.Euler(0,0,0,'YXZ');
 for(const sign of [1,-1]) {
  const cx=sign*.034,cz=rim(cx,cy).z-radius+.0012,group=new THREE.Group();group.position.set(cx,cy,cz);root.add(group);
  const uniform={gazeMatrix:{value:new THREE.Matrix3()},aperture:{value:new THREE.Vector3(upper,-lower,0)}};
  // Warm off-white diffuse layer under a restrained wet surface highlight.
  const material=new THREE.MeshPhysicalMaterial({color:0xaaa59b,roughness:.38,clearcoat:.30,clearcoatRoughness:.20,specularIntensity:.55,ior:1.36});
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniform);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 eyeP; varying vec3 eyeSocketP; uniform mat3 gazeMatrix;').replace('#include <begin_vertex>','#include <begin_vertex>\neyeP=position;eyeSocketP=gazeMatrix*position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 eyeP; varying vec3 eyeSocketP; uniform vec3 aperture;').replace('#include <color_fragment>',`#include <color_fragment>
    float shape=sqrt(max(0.,1.-pow(eyeSocketP.x/${halfWidth},2.)));
    float seam=aperture.z*shape;
    if(abs(eyeSocketP.x)>${halfWidth}||eyeSocketP.y>seam+aperture.x*shape||eyeSocketP.y<seam+aperture.y*shape||eyeSocketP.z<0.)discard;
    vec3 en=normalize(eyeP);float ir=length(en-vec3(0.,0.,1.))*${radius};
    float angle=atan(en.y,en.x),phase=angle*59.+ir*4200.;
    // Pixel-footprint filtering prevents radial fibres sparkling in motion.
    float fibreVisibility=1.-smoothstep(.6,2.5,fwidth(phase));
    float fibres=.5+.20*sin(phase)*fibreVisibility+.12*sin(angle*19.-ir*1800.);
    vec3 iris=mix(vec3(.040,.057,.050),vec3(.13,.18,.145),fibres);
    iris*=mix(.35,1.,1.-smoothstep(.0051,.0063,ir));
    float aa=max(fwidth(ir),.00005);
    // Socket-space lid shading stays attached while the globe rotates.
    float lidDistance=min(seam+aperture.x*shape-eyeSocketP.y,eyeSocketP.y-seam-aperture.y*shape);
    float lidSoftness=max(.0011,2.*fwidth(lidDistance));
    float lidShade=mix(.64,1.,smoothstep(0.,lidSoftness,lidDistance));
    float cornerShade=mix(.78,1.,smoothstep(.12,.65,shape));
    float innerCorner=smoothstep(.005,.012,-eyeSocketP.x*${sign}.);
    float warmVariation=.012*sin(en.x*13.+en.y*7.);
    vec3 sclera=diffuseColor.rgb*lidShade*cornerShade*(1.+warmVariation);
    sclera=mix(sclera,sclera*vec3(1.09,.93,.91),innerCorner*.45);
    diffuseColor.rgb=sclera;
    diffuseColor.rgb=mix(diffuseColor.rgb,iris,1.-smoothstep(.00615-aa,.00615+aa,ir));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.004),1.-smoothstep(.00225-aa,.00225+aa,ir));`);
  };
  material.customProgramCacheKey=()=>`r008-eyes-natural-v2-${sign}`;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),material);group.add(globe);
  const lids=[];
  for(const top of [true,false]) {
   const rimRows=[],indices=[],colors=[];
   const cheek=rim(cx+sign*.006,cy-.014).color;
   for(let i=0;i<=columns;i++) {
    const a=-Math.PI/2+Math.PI*i/columns,x=halfWidth*Math.sin(a),profile=Math.cos(a),outerX=x*1.06,outerY=(top?.008:-.0065)*profile;
    const skin=rim(cx+outerX,cy+outerY);rimRows.push({x,profile,outerX,outerY,...skin});
    for(let j=0;j<=rows;j++){const t=j/rows,color=skin.color.clone().lerp(cheek,(t*t*(3-2*t))*.92).multiplyScalar(1-.025*t);if(j===rows)color.lerp(new THREE.Color(.30,.105,.080),.16);colors.push(color.r,color.g,color.b);}
   }
   // Keep the exact attachment, but filter depth noise inside the lid patch.
   // This prevents tiny source folds becoming vertical ribs during closure.
   let depths=rimRows.map(r=>r.z);
   for(let pass=0;pass<4;pass++)depths=depths.map((_,i)=>[1,4,6,4,1].reduce((sum,w,k)=>sum+w*depths[THREE.MathUtils.clamp(i+k-2,0,columns)],0)/16);
   rimRows.forEach((r,i)=>r.smoothZ=depths[i]);
   for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){const a=i*(rows+1)+j,b=a+rows+1;indices.push(...(top?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((columns+1)*(rows+1)*3),3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array((columns+1)*(rows+1)*3),3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
   const lid=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.67,side:THREE.DoubleSide}));group.add(lid);lids.push({lid,rimRows,top});
  }
  eyes.push({sign,group,globe,uniform,lids,cz,cx,closure:0,follow:0});
 }
 let time=0,nextBlink=2.8,blinkTime=-1,manualBlink=0,blinkSide='Both',mode='auto';
 const target=new THREE.Vector2(),gaze=new THREE.Vector2(),sideValue=(value,index)=>THREE.MathUtils.clamp(Array.isArray(value)?value[index]||0:value||0,0,1);
 function update(dt,c={speed:0,turnError:0},actions={}) {
  dt=THREE.MathUtils.clamp(Number(dt)||0,0,.1);time+=dt;
  if(mode==='auto'&&time>=nextBlink){blinkTime=0;blinkSide='Both';nextBlink=time+3.1+1.4*(.5+.5*Math.sin(time*1.73));}
  if(blinkTime>=0)blinkTime+=dt;
  const blink=blinkTime>=0&&blinkTime<.28?(blinkTime<.085?THREE.MathUtils.smoothstep(blinkTime,0,.085):1-THREE.MathUtils.smoothstep(blinkTime,.10,.28)):0;
  if(mode==='left')target.set(.32,0);else if(mode==='right')target.set(-.32,0);else if(mode==='up')target.set(0,.23);else if(mode==='down')target.set(0,-.20);
  else if(['centre','blink','closed','leftClosed','rightClosed'].includes(mode))target.set(0,0);
  else if(c.speed>1)target.set(THREE.MathUtils.clamp((c.turnError||0)*.25,-.28,.28),-.015);
  else target.set(.12*Math.sin(Math.floor(time/2.1)*2.4),.055*Math.cos(Math.floor(time/3.3)*1.9));
  gaze.lerp(target,1-Math.exp(-dt*22));
  for(const e of eyes) {
   const index=e.sign===1?0:1,side=e.sign===1?'Left':'Right';
   const squint=sideValue(actions.cheekSquint,index)*.22+sideValue(actions.browDown,index)*.10;
   const closure=mode==='closed'||mode===(e.sign===1?'leftClosed':'rightClosed')?1:Math.max(manualBlink,(blinkSide==='Both'||blinkSide===side)?blink:0,sideValue(actions.eyeBlink,index),Math.min(.35,squint));
   e.closure=closure;
   const wide=Math.min(1,sideValue(actions.eyeWide,index)+sideValue(actions.browOuterUp,index)*.22);
   e.follow+=(gaze.y*.010-e.follow)*(1-Math.exp(-dt*24));
   const topHeight=(upper+wide*.0012)*(1-closure),bottomHeight=-lower*(1-closure),seam=e.follow*(1-closure)-.001*closure;
   e.uniform.aperture.value.set(topHeight,bottomHeight,seam);
   e.globe.quaternion.setFromEuler(euler.set(-Math.atan(gaze.y),Math.atan(gaze.x-e.sign*.028),0,'YXZ'));
   e.uniform.gazeMatrix.value.setFromMatrix4(rotation.makeRotationFromQuaternion(e.globe.quaternion));
   for(const {lid,rimRows,top} of e.lids) {
    const p=lid.geometry.attributes.position,n=lid.geometry.attributes.normal;
    for(let i=0;i<rimRows.length;i++) {
     const r=rimRows[i],edgeY=(seam+(top?topHeight:bottomHeight))*r.profile,edgeZ=Math.sqrt(Math.max(0,radius*radius-r.x*r.x-edgeY*edgeY))+.00015;
     // Outer attachment follows the same expression deformation as the head.
     let dx=0,dy=0,dz=0;
     for(const {id,w,base} of r.samples){const a=mesh.geometry.attributes.position.array;dx+=(a[id*3]-base[0])*w;dy+=(a[id*3+1]-base[1])*w;dz+=(a[id*3+2]-base[2])*w;}
     for(let j=0;j<=rows;j++) {
      const t=j/rows,s=t*t*(3-2*t),x=THREE.MathUtils.lerp(r.outerX+dx,r.x,s),y=THREE.MathUtils.lerp(r.outerY+dy,edgeY,s);
      // Surface hugs the globe wherever it covers the original aperture.
      const depth=THREE.MathUtils.lerp(r.z,r.smoothZ,THREE.MathUtils.smoothstep(t,0,.5));
      const z=THREE.MathUtils.lerp(depth+dz-e.cz,edgeZ,s)+.00035*Math.sin(Math.PI*t);
      const globeZ=Math.sqrt(Math.max(0,radius*radius-x*x-y*y))+.00015;
      p.setXYZ(i*(rows+1)+j,x,y,Math.max(z,globeZ*Math.sin(Math.PI*t/2)**2));
     }
    }
    lid.geometry.computeVertexNormals();
    // Match the existing head's shading only at the attachment boundary.
    for(let i=0;i<rimRows.length;i++){normal.copy(rimRows[i].normal);n.setXYZ(i*(rows+1),normal.x,normal.y,normal.z);}
    p.needsUpdate=true;n.needsUpdate=true;
   }
  }
  return {closure:Math.max(...eyes.map(e=>e.closure)),closures:eyes.map(e=>e.closure),lidFollow:eyes.map(e=>e.follow),gaze:gaze.toArray(),mode,components:6,generated:true,headRimSamples:candidates.length};
 }
 // Expand the cut to the full supported eye movement envelope; the lids cover
 // it at neutral and closure. Globe and cut use the same canonical landmarks.
 for(const m of [mesh.material[2]]) {
  const compile=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 socketP;').replace('#include <begin_vertex>','#include <begin_vertex>\nsocketP=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 socketP;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float ex=(abs(socketP.x)-.034)/${halfWidth};float ey=socketP.y-${cy};float eh=sqrt(max(0.,1.-ex*ex));if(socketP.z>.075&&abs(ex)<1.&&ey<.0075*eh&&ey>-.0055*eh)discard;`);};m.needsUpdate=true;
 }
 const api={root,eyes,report:{},update(dt,c,actions){this.report=update(dt,c,actions);return this.report},setMode(v){if(!['auto','centre','left','right','up','down','blink','closed','leftClosed','rightClosed'].includes(v))throw Error('Unknown gaze');mode=v;if(v==='blink')this.blink();},blink(side='Both'){if(!['Both','Left','Right'].includes(side))throw Error('Unknown blink side');blinkSide=side;blinkTime=0;nextBlink=time+1.8;},set closure(v){manualBlink=THREE.MathUtils.clamp(v,0,1)},dispose(){root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});root.removeFromParent();}};
 api.update(0);return api;
}
