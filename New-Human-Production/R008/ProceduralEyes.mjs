import * as THREE from 'three';

// Character-calibrated metre-space components, generated from functions.
// Rim samples are transient references into the regenerated head, never assets.
export function createProceduralEyes({surface,mesh,byName,bindWorld,data}) {
 const head=byName.get('head'),root=new THREE.Group();
 root.name='ProceduralEyeSockets';root.matrixAutoUpdate=false;
 root.matrix.copy(bindWorld.get(head)).invert();head.add(root);
 const eyes=[],halfWidth=.0118,upper=.0033,lower=.0023,radius=.0125,cy=1.656,columns=64,rows=12;
 const parts=new Map(data.charts.map(c=>[c.id,c.part]));
 const candidates=[];
 for(let i=0;i<surface.positions.length/3;i++)if(parts.get(surface.chartIds[i])===2&&surface.positions[i*3+2]>.075&&Math.abs(surface.positions[i*3])<.075&&Math.abs(surface.positions[i*3+1]-cy)<.030)candidates.push(i);
 // Bind to the actual regenerated triangle surface, including its UV and normal.
 // A nearest-vertex depth guess can leave a visible gap at grazing angles.
 const triangles=[];
 for(const g of surface.groups)if(g.materialIndex===2)for(let i=g.start;i<g.start+g.count;i+=3){const ids=Array.from(surface.indices.subarray(i,i+3)),p=ids.map(id=>Array.from(surface.positions.subarray(id*3,id*3+3)));if(p.every(v=>v[2]>.075)&&p.some(v=>Math.abs(v[0])<.075&&Math.abs(v[1]-cy)<.030))triangles.push({ids,p});}
 const bins=new Map(),binSize=.003;
 for(const tri of triangles){const [x0,x1,y0,y1]=[Math.min(...tri.p.map(v=>v[0])),Math.max(...tri.p.map(v=>v[0])),Math.min(...tri.p.map(v=>v[1])),Math.max(...tri.p.map(v=>v[1]))].map(v=>Math.floor(v/binSize));for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tri);}}
 function rim(x,y,withColour=true) {
  let found=null;
  for(const {ids,p:[a,b,c]}of bins.get(Math.floor(x/binSize)+','+Math.floor(y/binSize))||[]){const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,w=1-u-v;if(Math.min(u,v,w)<-1e-6)continue;const z=u*a[2]+v*b[2]+w*c[2];if(!found||z>found.z)found={ids,base:[a,b,c],weights:[u,v,w],z};}
  if(!found)throw Error(`No regenerated head triangle at eye attachment ${x},${y}`);
  const samples=found.ids.map((id,i)=>({id,base:found.base[i],w:found.weights[i]})),normal=new THREE.Vector3(),uv=new THREE.Vector2();
  for(const {id,w}of samples){normal.addScaledVector(new THREE.Vector3().fromArray(surface.normals,id*3),w);uv.addScaledVector(new THREE.Vector2().fromArray(surface.parameters,id*2),w);}
  if(!withColour)return {samples,z:found.z,normal:normal.normalize(),uv};
  const im=mesh.material[2].map.image,channels=im.data.length/(im.width*im.height),ix=THREE.MathUtils.clamp(uv.x,0,1)*(im.width-1),iy=(1-THREE.MathUtils.clamp(uv.y,0,1))*(im.height-1),x0=Math.floor(ix),y0=Math.floor(iy),color=new THREE.Color(0,0,0);
  for(const [dx,dy,weight]of [[0,0,(1-ix+x0)*(1-iy+y0)],[1,0,(ix-x0)*(1-iy+y0)],[0,1,(1-ix+x0)*(iy-y0)],[1,1,(ix-x0)*(iy-y0)]]){const at=(Math.min(y0+dy,im.height-1)*im.width+Math.min(x0+dx,im.width-1))*channels;color.add(new THREE.Color().setRGB(im.data[at]/255,im.data[at+1]/255,im.data[at+2]/255,THREE.SRGBColorSpace).multiplyScalar(weight));}
  return {samples,z:found.z,normal:normal.normalize(),color,uv};
 }
 const rotation=new THREE.Matrix4(),normal=new THREE.Vector3(),euler=new THREE.Euler(0,0,0,'YXZ');
 for(const sign of [1,-1]) {
  const cx=sign*.034,cz=rim(cx,cy).z-radius-.0006,group=new THREE.Group();group.position.set(cx,cy,cz);root.add(group);
  const uniform={gazeMatrix:{value:new THREE.Matrix3()},aperture:{value:new THREE.Vector3(upper,-lower,0)}};
  // Warm off-white diffuse layer under a restrained wet surface highlight.
  const material=new THREE.MeshPhysicalMaterial({color:0xaaa59b,roughness:.38,clearcoat:.30,clearcoatRoughness:.20,specularIntensity:.55,ior:1.36});
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniform);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 eyeP; varying vec3 eyeSocketP; uniform mat3 gazeMatrix;').replace('#include <begin_vertex>','#include <begin_vertex>\neyeP=position;eyeSocketP=gazeMatrix*position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 eyeP; varying vec3 eyeSocketP; uniform vec3 aperture;').replace('#include <color_fragment>',`#include <color_fragment>
    float shape=sqrt(max(0.,1.-pow(eyeSocketP.x/${halfWidth},2.)));
    float seam=aperture.z*shape;
    // Keep a solid globe behind the lids; the physical skin cover occludes it.
    // Clipping the globe to a flat aperture leaves a hole from oblique views.
    vec3 en=normalize(eyeP);float ir=length(en-vec3(0.,0.,1.))*${radius};
    float angle=atan(en.y,en.x),phase=angle*59.+ir*4200.;
    // Pixel-footprint filtering prevents radial fibres sparkling in motion.
    float fibreVisibility=1.-smoothstep(.6,2.5,fwidth(phase));
    float fibres=.5+.20*sin(phase)*fibreVisibility+.12*sin(angle*19.-ir*1800.);
    vec3 iris=mix(vec3(.040,.057,.050),vec3(.13,.18,.145),fibres);
    iris*=mix(.35,1.,1.-smoothstep(.0047,.0058,ir));
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
    diffuseColor.rgb=mix(diffuseColor.rgb,iris,1.-smoothstep(.0056-aa,.0056+aa,ir));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.004),1.-smoothstep(.00225-aa,.00225+aa,ir));`);
  };
  material.customProgramCacheKey=()=>`r008-eyes-socket-v3-${sign}`;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),material);group.add(globe);
  const lids=[];
  for(const top of [true,false]) {
   const rimRows=[],indices=[],colors=[],uvs=[],blends=[];
   const cheek=rim(cx+sign*.006,cy-.014).color;
   for(let i=0;i<=columns;i++) {
    const a=-Math.PI/2+Math.PI*i/columns,x=halfWidth*Math.sin(a),profile=Math.cos(a),outerX=.018*Math.sin(a),outerY=(top?.012:-.010)*profile;
    const skin=rim(cx+outerX,cy+outerY);rimRows.push({x,profile,outerX,outerY,...skin});
    for(let j=0;j<=rows;j++){const t=j/rows,s=t*t*(3-2*t),color=skin.color.clone().lerp(cheek,s*.60).multiplyScalar(1-.045*t),sx=THREE.MathUtils.lerp(outerX,x,s),sy=THREE.MathUtils.lerp(outerY,(top?upper:-lower)*profile,s),sample=rim(cx+sx,cy+sy);if(j===rows)color.lerp(new THREE.Color(.30,.105,.080),.08);colors.push(color.r,color.g,color.b);uvs.push(sample.uv.x,sample.uv.y);blends.push(THREE.MathUtils.smoothstep(t,.12,.75));}
   }
   for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){const a=i*(rows+1)+j,b=a+rows+1;indices.push(...(top?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((columns+1)*(rows+1)*3),3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array((columns+1)*(rows+1)*3),3));geometry.setAttribute('lidColor',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('lidBlend',new THREE.Float32BufferAttribute(blends,1));geometry.setIndex(indices);
   const skinMaterial=mesh.material[2],lidMaterial=new THREE.MeshStandardMaterial({map:skinMaterial.map,normalMap:skinMaterial.normalMap,roughnessMap:skinMaterial.roughnessMap,metalnessMap:skinMaterial.metalnessMap,roughness:1,metalness:1,side:THREE.DoubleSide});
   lidMaterial.userData.lidSurface=true;
   lidMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 lidColor;attribute float lidBlend;varying vec3 vLidColor;varying float vLidBlend;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLidColor=lidColor;vLidBlend=lidBlend;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vLidColor;varying float vLidBlend;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vLidColor,vLidBlend);').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,vLidBlend));').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.68,vLidBlend);\n// lid surface ready').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=1.-vLidBlend;');};lidMaterial.customProgramCacheKey=()=>`r008-lid-surface-v3-${sign}-${Number(top)}`;
   const lid=new THREE.Mesh(geometry,lidMaterial);group.add(lid);lids.push({lid,rimRows,top,surfaceNormals:new Float32Array((columns+1)*(rows+1)*3),coverWeights:new Float32Array((columns+1)*(rows+1))});
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
   for(const {lid,rimRows,top,surfaceNormals,coverWeights} of e.lids) {
    const p=lid.geometry.attributes.position,n=lid.geometry.attributes.normal,uv=lid.geometry.attributes.uv,blend=lid.geometry.attributes.lidBlend;
    for(let i=0;i<rimRows.length;i++) {
     const r=rimRows[i],edgeY=(seam+(top?topHeight:bottomHeight))*r.profile;
     // Outer attachment follows the same expression deformation as the head.
     for(let j=0;j<=rows;j++) {
      const t=j/rows,s=t*t*(3-2*t),x=THREE.MathUtils.lerp(r.outerX,r.x,s),y=THREE.MathUtils.lerp(r.outerY,edgeY,s),sample=rim(e.cx+x,cy+y,false);
      let dx=0,dy=0,dz=0;for(const {id,w,base}of sample.samples){const a=mesh.geometry.attributes.position.array;dx+=(a[id*3]-base[0])*w;dy+=(a[id*3+1]-base[1])*w;dz+=(a[id*3+2]-base[2])*w;}
      const q=(x/halfWidth)**2+(y/(y>=0?.0070:.0048))**2,cover=1-THREE.MathUtils.smoothstep(q,.32,.98),globeZ=Math.sqrt(Math.max(0,radius*radius-x*x-y*y))+.00010;
      const z=THREE.MathUtils.lerp(sample.z-e.cz+.000035,globeZ,cover);
      const id=i*(rows+1)+j;p.setXYZ(id,x+dx*(1-cover),y+dy*(1-cover),z+dz*(1-cover));uv.setXY(id,sample.uv.x,sample.uv.y);blend.setX(id,cover);sample.normal.toArray(surfaceNormals,id*3);coverWeights[id]=cover;
     }
    }
    lid.geometry.computeVertexNormals();
    // Match the existing head's shading only at the attachment boundary.
    for(let id=0;id<p.count;id++){const c=coverWeights[id];if(c>=1)continue;normal.fromArray(surfaceNormals,id*3).lerp(new THREE.Vector3().fromBufferAttribute(n,id),c).normalize();n.setXYZ(id,normal.x,normal.y,normal.z);}
    p.needsUpdate=true;n.needsUpdate=true;uv.needsUpdate=true;blend.needsUpdate=true;
   }
  }
  return {closure:Math.max(...eyes.map(e=>e.closure)),closures:eyes.map(e=>e.closure),lidFollow:eyes.map(e=>e.follow),gaze:gaze.toArray(),mode,components:6,generated:true,headRimSamples:candidates.length};
 }
 // The smaller cut is covered by a wider, surface-bound skin collar in 3D.
 for(const m of [mesh.material[2]]) {
  const compile=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 socketP;').replace('#include <begin_vertex>','#include <begin_vertex>\nsocketP=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 socketP;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
   float ex=(abs(socketP.x)-.034)/${halfWidth};float ey=socketP.y-${cy};float eh=sqrt(max(0.,1.-ex*ex));if(socketP.z>.075&&abs(ex)<1.&&ey<.0070*eh&&ey>-.0048*eh)discard;`);};m.needsUpdate=true;
 }
 const api={root,eyes,report:{},update(dt,c,actions){this.report=update(dt,c,actions);return this.report},setMode(v){if(!['auto','centre','left','right','up','down','blink','closed','leftClosed','rightClosed'].includes(v))throw Error('Unknown gaze');mode=v;if(v==='blink')this.blink();},blink(side='Both'){if(!['Both','Left','Right'].includes(side))throw Error('Unknown blink side');blinkSide=side;blinkTime=0;nextBlink=time+1.8;},set closure(v){manualBlink=THREE.MathUtils.clamp(v,0,1)},dispose(){root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});root.removeFromParent();}};
 api.update(0);return api;
}
