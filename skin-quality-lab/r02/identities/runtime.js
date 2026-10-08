// This file is assembled into the existing R02 module scope, not a second app.
// It changes mesh materials and mesh-rooted fibres. No portrait planes exist.
let identityRuntime=null;
const IDENTITY_DEFINITIONS={
 original:{label:'原 R02',description:'原始扫描颜色、法线和材质参数；保留作回退对照。',seed:0,beard:0,brow:0,params:{}},
 porcelain:{label:'01 · 冷白雀斑',description:'无须、铜棕细弧眉；鼻颊雀斑、细孔、偏哑光。独立色素 / 凹凸 / 粗糙度贴图。',seed:218,beard:0,brow:1450,params:{roughness:.60,oil:.12,detail:.56,meso:.75,micro:1.10,pores:.18,fuzz:.34,pigment:0,blood:.23,sss:.84,radius:1.20,relief:.62}},
 umber:{label:'02 · 深褐短须',description:'深褐色素、短硬胡茬、宽浓断眉；局部痘印、眉侧浅疤，T 区偏油。',seed:734,beard:11000,brow:1950,params:{roughness:.56,oil:.14,detail:.77,meso:1.08,micro:1.40,pores:.38,fuzz:.24,pigment:0,blood:.15,sss:.74,radius:.90,relief:.75}},
 weathered:{label:'03 · 风化熟龄',description:'暖褐晒斑、额纹和眼角细纹；眼袋与颊凹、口角和下颌软组织松弛；灰白眉须与分区皱纹。',seed:159,beard:12500,brow:1500,params:{roughness:.64,oil:.07,detail:.90,meso:1.25,micro:1.20,pores:.29,fuzz:.32,pigment:0,blood:.19,sss:.76,radius:1.15,relief:.88}}
};
function identityRandom(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
// Rebound to the CURRENT subdivided scan triangles; no GNM indices or teacher
// groom assets are reused. The material math is adapted from Kaopu FiberMaterial.
function identityHairGeometry(geometry,profile,maps){
 const p=geometry.attributes.position,pNeutral=geometry.attributes.skinNeutralPosition||p,n=geometry.attributes.normal,uv=geometry.attributes.uv,ix=geometry.index.array,areas=[],triangles=[];
 const sample=(tex,channel=2,center=.5)=>{const canvas=document.createElement('canvas');canvas.width=tex.image.width;canvas.height=tex.image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(tex.image,0,0);const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data,w=canvas.width,h=canvas.height;return (u,v)=>{let x=Math.max(0,Math.min(w-1,u*w-.5)),y=Math.max(0,Math.min(h-1,(1-v)*h-.5)),a=Math.floor(x),b=Math.floor(y),c=Math.min(a+1,w-1),d=Math.min(b+1,h-1);x-=a;y-=b;return ((bytes[(b*w+a)*4+channel]*(1-x)+bytes[(b*w+c)*4+channel]*x)*(1-y)+(bytes[(d*w+a)*4+channel]*(1-x)+bytes[(d*w+c)*4+channel]*x)*y)/255-center;};};
 const sampleSurface=sample(E.uSurface.value),sampleFeatures=sample(maps.features),sampleBrow=sample(maps.features,0,0),sampleBrowClear=sample(maps.features,1,0),displaced=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const clear=sampleBrowClear(uv.getX(i),uv.getY(i));const h=(sampleSurface(uv.getX(i),uv.getY(i))*(1-clear)+sampleSurface(uv.getX(i),uv.getY(i)+.06)*clear+sampleFeatures(uv.getX(i),uv.getY(i)))*.001;displaced[i*3]=n.getX(i)*h;displaced[i*3+1]=n.getY(i)*h;displaced[i*3+2]=n.getZ(i)*h;}
 let total=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);const x=(pNeutral.getX(ix[i])+pNeutral.getX(ix[i+1])+pNeutral.getX(ix[i+2]))/3,y=(pNeutral.getY(ix[i])+pNeutral.getY(ix[i+1])+pNeutral.getY(ix[i+2]))/3,z=(pNeutral.getZ(ix[i])+pNeutral.getZ(ix[i+1])+pNeutral.getZ(ix[i+2]))/3;if(Math.abs(x)>.078||y<-.035||y>.098||z<.025)continue;let ar=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(ar<1e-13)continue;total+=ar;areas.push(total);triangles.push(i);}
 const output={brow:[],beard:[]},rand=identityRandom(profile.seed),q=new THREE.Vector3(),rootPoint=new THREE.Vector3(),nn=new THREE.Vector3();
 const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 for(let tries=0;tries<520000&&(output.brow.length<profile.brow||output.beard.length<profile.beard);tries++){
  let lo=0,hi=areas.length-1,r=rand()*total;while(lo<hi){let m=(lo+hi)>>1;if(areas[m]<r)lo=m+1;else hi=m;}
  const i=triangles[lo],ia=ix[i],ib=ix[i+1],ic=ix[i+2];let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);rootPoint.copy(a).multiplyScalar(1-u-v).addScaledVector(b,u).addScaledVector(c,v);q.set(pNeutral.getX(ia)*(1-u-v)+pNeutral.getX(ib)*u+pNeutral.getX(ic)*v,pNeutral.getY(ia)*(1-u-v)+pNeutral.getY(ib)*u+pNeutral.getY(ic)*v,pNeutral.getZ(ia)*(1-u-v)+pNeutral.getZ(ib)*u+pNeutral.getZ(ic)*v);
  const rootU=uv.getX(ia)*(1-u-v)+uv.getX(ib)*u+uv.getX(ic)*v,rootV=uv.getY(ia)*(1-u-v)+uv.getY(ib)*u+uv.getY(ic)*v;
  const guide=scanBrowGuide(rootU,rootV),browWeight=sampleBrow(rootU,rootV),ax=Math.abs(q.x),side=guide.side,t=guide.t;
  const brow=browWeight>.025&&rand()<Math.pow(browWeight,profile.seed===218?1.7:1.05);
  const notch=profile.seed===734&&q.x>.031&&q.x<.035&&q.y>.075&&q.y<.085;
  const moustache=ax<.027&&q.y>.0225&&q.y<.030&&q.z>.071;
  const upper=.019+.034*smooth(.023,.071,ax)+.002*Math.sin(q.x*170);
  const cheek=smooth(.023,.031,ax)*(1-smooth(.063,.071,ax))*(1-smooth(upper-.005,upper+.0035,q.y));
  const chin=(1-smooth(.006,.013,q.y))*(1-smooth(.063,.072,ax));
  const bottom=smooth(-.031,-.022,q.y),lip=ax<.029&&Math.abs(q.y-.0185)<.0065;
  const probability=Math.max(cheek,chin,moustache?.88:0)*bottom;
  const beard=!lip&&rand()<probability;
  const kind=brow&&!notch?'brow':beard?'beard':null;if(!kind||output[kind].length>=profile[kind])continue;if(kind==='beard'&&q.y<.023&&q.z<.048)continue;
  if(kind==='brow'&&profile.seed===159&&Math.sin(ax*970+q.y*1760)>.65&&rand()>.27)continue;
  nn.set(n.getX(ia)*(1-u-v)+n.getX(ib)*u+n.getX(ic)*v,n.getY(ia)*(1-u-v)+n.getY(ib)*u+n.getY(ic)*v,n.getZ(ia)*(1-u-v)+n.getZ(ib)*u+n.getZ(ic)*v).normalize();
  if(nn.z<.04)continue;
  const field=Math.sin(q.x*97+q.y*133)+.4*Math.sin(q.x*229-q.y*71);
  const flow=kind==='brow'?new THREE.Vector3():new THREE.Vector3(side*(moustache?.92:.13+.15*smooth(-.015,.035,q.y))+.19*field,-1,.06);
  if(kind==='brow'){const du1=uv.getX(ib)-uv.getX(ia),dv1=uv.getY(ib)-uv.getY(ia),du2=uv.getX(ic)-uv.getX(ia),dv2=uv.getY(ic)-uv.getY(ia),det=du1*dv2-du2*dv1;const e1=b.clone().sub(a),e2=c.clone().sub(a);if(Math.abs(det)>1e-12){const dpdu=e1.clone().multiplyScalar(dv2).addScaledVector(e2,-dv1).multiplyScalar(1/det),dpdv=e2.clone().multiplyScalar(du1).addScaledVector(e1,-du2).multiplyScalar(1/det);flow.copy(dpdu).multiplyScalar(guide.du).addScaledVector(dpdv,guide.dv).normalize();flow.y+=.22*(1-t);}else flow.set(side,.15,0);}
  flow.x+=(rand()-.5)*.48;flow.y+=(rand()-.5)*.12;if(kind==='brow'||flow.dot(nn)<0)flow.addScaledVector(nn,-flow.dot(nn));flow.normalize();
  let length=kind==='brow'?(profile.seed===218?.0017+rand()*.0020:profile.seed===159?.0012+rand()*.0022:.0021+rand()*.0030):(profile.seed===159?.0011+Math.pow(rand(),.75)*.0044:.00055+rand()*.00115);
  if(kind==='beard'&&moustache)length*=.73;
  const silver=profile.seed===159&&rand()<(kind==='brow'?.45:.67);
  let col=profile.seed===218?new THREE.Color(.12,.052,.024):silver?new THREE.Color(.18,.19,.20):new THREE.Color(.014,.010,.008);col.multiplyScalar(.64+rand()*.70);
  const relief=new THREE.Vector3(displaced[ia*3]*(1-u-v)+displaced[ib*3]*u+displaced[ic*3]*v,displaced[ia*3+1]*(1-u-v)+displaced[ib*3+1]*u+displaced[ic*3+1]*v,displaced[ia*3+2]*(1-u-v)+displaced[ib*3+2]*u+displaced[ic*3+2]*v);
  output[kind].push({neutral:q.clone(),browUV:[rootU,rootV],p:rootPoint.clone(),n:nn.clone(),flow,length,col,relief,random:rand(),radius:(kind==='brow'?.000021:.000027)*(0.52+Math.pow(rand(),1.5)*.85),curl:rand(),silver,triangle:i/3,bary:[1-u-v,u,v]});
 }
 const group=new THREE.Group();group.name='identity-scan-bound-kaopu-fibres';
 for(const kind of ['brow','beard']){
  const positions=[],normals=[],roots=[],colors=[],tangents=[],ts=[],sides=[],ids=[],randoms=[],radii=[],relief=[];const segments=kind==='beard'&&profile.seed===159?10:7;
  for(const strand of output[kind]){const start=positions.length/3,across=new THREE.Vector3().crossVectors(strand.n,strand.flow).normalize(),points=[];
   for(let j=0;j<=segments;j++){const t=j/segments;const lift=strand.radius*1.2+strand.length*(.30*t+.15*t*t);const bend=Math.sin(t*Math.PI*(1.25+strand.curl*.75))*strand.length*.22*t;
    points.push(strand.p.clone().addScaledVector(strand.n,lift).addScaledVector(strand.flow,strand.length*(.75*t+.10*t*t)).addScaledVector(across,bend*(strand.curl-.5)*2));}
   for(let j=0;j<=segments;j++){const t=j/segments,tangent=points[Math.min(j+1,segments)].clone().sub(points[Math.max(0,j-1)]).normalize(),radius=strand.radius*Math.pow(Math.max(0,1-t),1.10);
    for(const side of [-1,1]){positions.push(...points[j].toArray());roots.push(...points[0].toArray());normals.push(...strand.n.toArray());colors.push(...strand.col.toArray());tangents.push(...tangent.toArray());ts.push(t);sides.push(side);randoms.push(strand.random);radii.push(radius);relief.push(...strand.relief.toArray());}
    if(j<segments){let k=start+j*2;ids.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
  }
  const g=new THREE.BufferGeometry();for(const [key,arr,size] of [['position',positions,3],['scalpNormal',normals,3],['rootPosition',roots,3],['strandColor',colors,3],['tangent',tangents,3],['along',ts,1],['strandSide',sides,1],['strandRandom',randoms,1],['strandRadius',radii,1],['boundRelief',relief,3]])g.setAttribute(key,new THREE.Float32BufferAttribute(arr,size));g.setIndex(ids);
  const obj=new THREE.Mesh(g);obj.name=kind;const handle=attachFiberMaterial(obj,{renderer,color:'#ffffff',roughness:profile.seed===159?.52:.42,specular:.12,shadows:false,coverageAA:true,coverageResolve:'blend'});obj.material.uniforms.uRelief=E.uRelief;obj.receiveShadow=false;obj.castShadow=false;obj.material.uniforms.fiberShadows.value=1;obj.userData.fiberHandle=handle;obj.renderOrder=2;group.add(obj);
 }
 group.userData.counts={brow:output.brow.length,beard:output.beard.length};group.userData.binding={browBasis:'asymmetric source-scan UV region and guides',browNeutralBounds:[['x','y','z'].map(k=>Math.min(...output.brow.map(o=>o.neutral[k]))),['x','y','z'].map(k=>Math.max(...output.brow.map(o=>o.neutral[k])))],basis:'current subdivided R02 scan triangles',surface:'barycentric interpolation of displaced triangle vertices',rootOffsetMeters:[Math.min(...Object.values(output).flat().map(s=>s.radius*1.2)),Math.max(...Object.values(output).flat().map(s=>s.radius*1.2))],originalFuzzPreserved:14000,segments:[7,10],sourceMaterial:'kaopu-hair-workbench/qa/gnm-groom-editor/src/FiberMaterial.js@23f1f408f961749c49e9747d45072c761825b158',fiberShadows:'receives existing skin VSM; strand shadow casting disabled'};return group;
}

async function installSkinIdentities(original,load){
 const ageMorph=createScanAgeMorph(mesh.geometry);const cache=new Map(),originalMaps={...original};let sequence=0,group=null,current='original',ageAmount=1;
 // VSM traverses receiveShadow meshes even with castShadow=false.
 // The custom shader reads native skin shadow maps via its own fibre uniform;
 // both scene-graph shadow flags remain false so no fibre depth writer is used.
 const hairValues={browDensity:1,beardDensity:1,beardLength:1};
 const updateHair=()=>{if(group)for(const obj of group.children){obj.material.uniforms.uDensity.value=obj.name==='brow'?hairValues.browDensity:hairValues.beardDensity;obj.material.uniforms.uLength.value=obj.name==='brow'?1:hairValues.beardLength;}
  for(const k in hairValues){$(k).value=hairValues[k];$(k+'Out').textContent=hairValues[k].toFixed(2);}dirty=true;};
 function releaseHair(){if(!group)return;fuzz.remove(group);for(const child of group.children){child.geometry.dispose();child.userData.fiberHandle?.dispose();}group=null;}
 async function mapsFor(id){if(id==='original')return originalMaps;if(cache.has(id)){const a=cache.get(id);cache.delete(id);cache.set(id,a);return a;}
  const root='./assets/identities/'+id+'/';const [albedo,normal,roughness,features]=await Promise.all([load(root+'albedo.webp',true),load(root+'normal.webp'),load(root+'roughness.webp'),load(root+'features.webp')]);const result={albedo,normal,roughness,features};cache.set(id,result);return result;
 }
 async function setIdentity(id,{keepValues=false}={}){
  if(!IDENTITY_DEFINITIONS[id])throw new Error('未知表皮配方');const request=++sequence;$('identityStatus').textContent='正在载入 '+IDENTITY_DEFINITIONS[id].label+'…';state.identityLoading=true;
  try{
   const maps=await mapsFor(id);if(request!==sequence)return;
   releaseHair();const previousFuzz=fuzz;scene.remove(previousFuzz);previousFuzz.geometry.dispose();previousFuzz.material.dispose();ageMorph.apply(id==='weathered'?ageAmount:0);makeFuzz(mesh.geometry);state.ageMorph=ageMorph.diagnostics();skin.map=maps.albedo;skin.color.setRGB(1,1,1);skin.normalMap=maps.normal;skin.clearcoatNormalMap=maps.normal;
   U.uIdentityEnabled.value=id==='original'?0:1;U.uIdentityRoughnessBase.value=IDENTITY_DEFINITIONS[id].params.roughness??defaults.roughness;U.uIdentityRoughness.value=maps.roughness||originalMaps.spec;U.uIdentityFeatures.value=maps.features||originalMaps.surfaceMap;
   if(!keepValues)Object.assign(values,defaults,IDENTITY_DEFINITIONS[id].params);
   if(id!=='original'){group=identityHairGeometry(mesh.geometry,IDENTITY_DEFINITIONS[id],maps);fuzz.add(group);}
   current=id;state.identity=id;state.identityMaps=id==='original'?'original-4k-scan':['albedo','normal','roughness','features'].map(k=>({kind:k,width:maps[k].image.width,height:maps[k].image.height}));state.identityHair=group?.userData.counts||{brow:0,beard:0};
   document.querySelectorAll('[data-identity]').forEach(b=>{b.classList.toggle('active',b.dataset.identity===id);b.setAttribute('aria-pressed',String(b.dataset.identity===id));});
   $('identityDescription').textContent=IDENTITY_DEFINITIONS[id].description;$('identityStatus').textContent=id==='original'?'已恢复原始 R02':'2K 独立表皮 + 原 4K 微结构 / 熟龄形态可回退';
   document.querySelector('.caption-title').textContent=IDENTITY_DEFINITIONS[id].label;
   for(const k in hairValues)$(k).disabled=id==='original'||(id==='porcelain'&&k.startsWith('beard'));
   for(const key of [...cache.keys()])if(cache.size>2&&key!==id){const item=cache.get(key);for(const tex of Object.values(item))tex.dispose();cache.delete(key);}
   $('ageShapeToggle').disabled=id!=='weathered';$('ageShapeToggle').textContent=id!=='weathered'?'熟龄形态对照（选择 03）':ageAmount>0?'熟龄形态：开 · 点击对照原形':'熟龄形态：关 · 点击恢复';updateHair();skin.needsUpdate=true;apply();dirty=true;if(state.ready)render();
  }finally{if(request===sequence)state.identityLoading=false;}
 }
 const report=()=>({ageStrength:ageAmount,schema:'kaopu/skin-identity@1',id:current,hair:{...hairValues},geometryBasis:'R02.1 scan; weathered reversible shape ageing; topology/UV unchanged',maps:state.identityMaps});
 async function restore(o){if(!o)return setIdentity('original');if(o.schema!=='kaopu/skin-identity@1')throw Error('表皮配方版本不兼容');ageAmount=Number.isFinite(o.ageStrength)?Math.max(0,Math.min(1,o.ageStrength)):1;await setIdentity(o.id);for(const k in hairValues)if(Number.isFinite(o.hair?.[k]))hairValues[k]=Math.max(0,Math.min(k==='beardLength'?2:1,o.hair[k]));updateHair();}
 const api={set:setIdentity,report,restore,hasHair:()=>!!group&&current!=='original',current:()=>current,setAgeStrength:async value=>{ageAmount=Math.max(0,Math.min(1,value));return setIdentity(current,{keepValues:true});},diagnostics:()=>({ageMorph:ageMorph.diagnostics(),binding:group?.userData.binding,shadowWriterIsolated:!!group&&group.children.every(o=>!o.receiveShadow&&!o.castShadow),cameraLayerMask:camera.layers.mask,shadowCameraLayerMask:key.shadow.camera.layers.mask,materials:group?.children.map(o=>fiberMaterialDiagnostics(o.material))}),definitions:IDENTITY_DEFINITIONS};identityRuntime=api;window.__SKIN_LAB__.identity=api;
 for(const b of document.querySelectorAll('[data-identity]'))b.onclick=()=>setIdentity(b.dataset.identity).catch(e=>{toast(e.message);state.errors.push(e.message);});
 for(const k in hairValues)$(k).oninput=()=>{hairValues[k]=Number($(k).value);updateHair();};
 $('identityMaps').onclick=()=>{
  const host=$('mapGallery');host.replaceChildren();if(current==='original'){host.textContent='原版扫描贴图保留在 r01/assets。';}else for(const [id,label]of [['albedo','颜色 / 色素'],['normal','法线 / 凹凸'],['roughness','粗糙度'],['features','眉根 / 扫描眉清理 / 起伏']]){const card=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=label+' · 2048 × 2048';img.src='./assets/identities/'+current+'/'+id+'.webp';img.alt=label;card.append(caption,img);host.append(card);}
  $('mapsDialog').showModal();
 };
 $('mapsClose').onclick=()=>$('mapsDialog').close();$('ageShapeToggle').onclick=()=>api.setAgeStrength(ageAmount>0?0:1);
 await setIdentity('porcelain');return api;
}

