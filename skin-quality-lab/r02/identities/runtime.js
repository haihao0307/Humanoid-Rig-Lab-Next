// This file is assembled into the existing R02 module scope, not a second app.
// It changes mesh materials and mesh-rooted fibres. No portrait planes exist.
let identityRuntime=null;
const IDENTITY_DEFINITIONS={
 original:{label:'原 R02',description:'原始扫描颜色、法线和材质参数；保留作回退对照。',seed:0,beard:0,brow:0,params:{}},
 porcelain:{label:'01 · 冷白雀斑',description:'无须、铜棕细弧眉；鼻颊雀斑、细孔、偏哑光。独立色素 / 凹凸 / 粗糙度贴图。',seed:218,beard:0,brow:1450,params:{roughness:.60,oil:.12,detail:.56,meso:.75,micro:1.10,pores:.18,fuzz:.34,pigment:0,blood:.23,sss:.84,radius:1.20,relief:.62}},
 umber:{label:'02 · 深褐短须',description:'深褐色素、短硬胡茬、宽浓断眉；局部痘印、眉侧浅疤，T 区偏油。',seed:734,beard:11000,brow:1950,params:{roughness:.56,oil:.14,detail:.77,meso:1.08,micro:1.40,pores:.38,fuzz:.24,pigment:0,blood:.15,sss:.74,radius:.90,relief:.75}},
 weathered:{label:'03 · 风化熟龄',description:'暖褐晒斑、额纹和眼角细纹；灰白混色胡须、疏密眉束、干燥粗糙分区。',seed:159,beard:15000,brow:2250,params:{roughness:.64,oil:.07,detail:.90,meso:1.25,micro:1.20,pores:.29,fuzz:.32,pigment:0,blood:.19,sss:.76,radius:1.15,relief:.88}}
};
function identityRandom(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
// Rebound to the CURRENT subdivided scan triangles; no GNM indices or teacher
// groom assets are reused. The material math is adapted from Kaopu FiberMaterial.
function identityHairGeometry(geometry,profile,maps){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,ix=geometry.index.array,areas=[],triangles=[];
 const sample=tex=>{const canvas=document.createElement('canvas');canvas.width=tex.image.width;canvas.height=tex.image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(tex.image,0,0);const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data,w=canvas.width,h=canvas.height;return (u,v)=>{let x=Math.max(0,Math.min(w-1,u*w-.5)),y=Math.max(0,Math.min(h-1,(1-v)*h-.5)),a=Math.floor(x),b=Math.floor(y),c=Math.min(a+1,w-1),d=Math.min(b+1,h-1);x-=a;y-=b;return ((bytes[(b*w+a)*4+2]*(1-x)+bytes[(b*w+c)*4+2]*x)*(1-y)+(bytes[(d*w+a)*4+2]*(1-x)+bytes[(d*w+c)*4+2]*x)*y)/255-.5;};};
 const sampleSurface=sample(E.uSurface.value),sampleFeatures=sample(maps.features),displaced=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const h=(sampleSurface(uv.getX(i),uv.getY(i))+sampleFeatures(uv.getX(i),uv.getY(i)))*.001;displaced[i*3]=n.getX(i)*h;displaced[i*3+1]=n.getY(i)*h;displaced[i*3+2]=n.getZ(i)*h;}
 let total=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);const x=(a.x+b.x+c.x)/3,y=(a.y+b.y+c.y)/3,z=(a.z+b.z+c.z)/3;if(Math.abs(x)>.078||y<-.035||y>.098||z<.025)continue;let ar=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(ar<1e-13)continue;total+=ar;areas.push(total);triangles.push(i);}
 const output={brow:[],beard:[]},rand=identityRandom(profile.seed),q=new THREE.Vector3(),nn=new THREE.Vector3();
 const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 for(let tries=0;tries<520000&&(output.brow.length<profile.brow||output.beard.length<profile.beard);tries++){
  let lo=0,hi=areas.length-1,r=rand()*total;while(lo<hi){let m=(lo+hi)>>1;if(areas[m]<r)lo=m+1;else hi=m;}
  const i=triangles[lo],ia=ix[i],ib=ix[i+1],ic=ix[i+2];let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);q.copy(a).multiplyScalar(1-u-v).addScaledVector(b,u).addScaledVector(c,v);
  const ax=Math.abs(q.x),side=q.x<0?-1:1,t=(ax-.010)/.048;
  const arch=.0795+.0033*Math.sin(Math.PI*t)-.004*t+(profile.seed===218?.0015:0);
  const width=profile.seed===218?.00165:profile.seed===734?.0031:.0027;
  const brow=t>0&&t<1&&Math.abs(q.y-arch)<width*Math.pow(Math.sin(Math.PI*t),.40);
  const notch=profile.seed===734&&q.x>.039&&q.x<.046&&q.y>.074;
  const moustache=ax<.027&&q.y>.0225&&q.y<.030&&q.z>.071;
  const upper=.019+.034*smooth(.023,.071,ax)+.002*Math.sin(q.x*170);
  const cheek=smooth(.023,.031,ax)*(1-smooth(.063,.071,ax))*(1-smooth(upper-.003,upper+.002,q.y));
  const chin=(1-smooth(.006,.013,q.y))*(1-smooth(.063,.072,ax));
  const bottom=smooth(-.031,-.022,q.y),lip=ax<.029&&Math.abs(q.y-.0185)<.0065;
  const probability=Math.max(cheek,chin,moustache?.88:0)*bottom;
  const beard=!lip&&rand()<probability;
  const kind=brow&&!notch?'brow':beard?'beard':null;if(!kind||output[kind].length>=profile[kind])continue;
  if(kind==='brow'&&profile.seed===159&&Math.sin(ax*970+q.y*1760)>.65&&rand()>.27)continue;
  nn.set(n.getX(ia)*(1-u-v)+n.getX(ib)*u+n.getX(ic)*v,n.getY(ia)*(1-u-v)+n.getY(ib)*u+n.getY(ic)*v,n.getZ(ia)*(1-u-v)+n.getZ(ib)*u+n.getZ(ic)*v).normalize();
  if(nn.z<.04)continue;
  const field=Math.sin(q.x*97+q.y*133)+.4*Math.sin(q.x*229-q.y*71);
  const flow=kind==='brow'?new THREE.Vector3(side*(.72+.18*rand()),.45-.83*t,0):new THREE.Vector3(side*(moustache?.92:.13+.15*smooth(-.015,.035,q.y))+.11*field,-1,.06);
  flow.x+=(rand()-.5)*.18;flow.y+=(rand()-.5)*.12;flow.addScaledVector(nn,-flow.dot(nn)).normalize();
  let length=kind==='brow'?(profile.seed===218?.0017+rand()*.0020:profile.seed===159?.0025+rand()*.0038:.0021+rand()*.0030):(profile.seed===159?.0026+rand()*.0048:.00055+rand()*.00115);
  if(kind==='beard'&&moustache)length*=.73;
  const silver=profile.seed===159&&rand()<(kind==='brow'?.60:.78);
  let col=profile.seed===218?new THREE.Color(.12,.052,.024):silver?new THREE.Color(.53,.55,.57):new THREE.Color(.014,.010,.008);col.multiplyScalar(.83+rand()*.30);
  const relief=new THREE.Vector3(displaced[ia*3]*(1-u-v)+displaced[ib*3]*u+displaced[ic*3]*v,displaced[ia*3+1]*(1-u-v)+displaced[ib*3+1]*u+displaced[ic*3+1]*v,displaced[ia*3+2]*(1-u-v)+displaced[ib*3+2]*u+displaced[ic*3+2]*v);
  output[kind].push({p:q.clone(),n:nn.clone(),flow,length,col,relief,random:rand(),radius:(kind==='brow'?.000021:.000027)*(0.77+rand()*.48),curl:rand(),silver,triangle:i/3,bary:[1-u-v,u,v]});
 }
 const group=new THREE.Group();group.name='identity-scan-bound-kaopu-fibres';
 for(const kind of ['brow','beard']){
  const positions=[],normals=[],roots=[],colors=[],tangents=[],ts=[],sides=[],ids=[],randoms=[],radii=[],relief=[];const segments=kind==='beard'&&profile.seed===159?10:7;
  for(const strand of output[kind]){const start=positions.length/3,across=new THREE.Vector3().crossVectors(strand.n,strand.flow).normalize(),points=[];
   for(let j=0;j<=segments;j++){const t=j/segments;const lift=strand.radius*1.2+strand.length*(.16*t+.12*t*t);const bend=Math.sin(t*Math.PI*(1.25+strand.curl*.75))*strand.length*.11*t;
    points.push(strand.p.clone().addScaledVector(strand.n,lift).addScaledVector(strand.flow,strand.length*(.75*t+.10*t*t)).addScaledVector(across,bend*(strand.curl-.5)*2));}
   for(let j=0;j<=segments;j++){const t=j/segments,tangent=points[Math.min(j+1,segments)].clone().sub(points[Math.max(0,j-1)]).normalize(),radius=strand.radius*Math.pow(Math.max(.015,1-t),.70);
    for(const side of [-1,1]){positions.push(...points[j].toArray());roots.push(...points[0].toArray());normals.push(...strand.n.toArray());colors.push(...strand.col.toArray());tangents.push(...tangent.toArray());ts.push(t);sides.push(side);randoms.push(strand.random);radii.push(radius);relief.push(...strand.relief.toArray());}
    if(j<segments){let k=start+j*2;ids.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
  }
  const g=new THREE.BufferGeometry();for(const [key,arr,size] of [['position',positions,3],['scalpNormal',normals,3],['rootPosition',roots,3],['strandColor',colors,3],['tangent',tangents,3],['along',ts,1],['strandSide',sides,1],['strandRandom',randoms,1],['strandRadius',radii,1],['boundRelief',relief,3]])g.setAttribute(key,new THREE.Float32BufferAttribute(arr,size));g.setIndex(ids);
  const obj=new THREE.Mesh(g);obj.name=kind;const handle=attachFiberMaterial(obj,{renderer,color:'#ffffff',roughness:profile.seed===159?.52:.42,specular:.12,shadows:false,coverageAA:true,coverageResolve:'blend'});obj.material.uniforms.uRelief=E.uRelief;obj.userData.fiberHandle=handle;obj.renderOrder=2;group.add(obj);
 }
 group.userData.counts={brow:output.brow.length,beard:output.beard.length};group.userData.binding={basis:'current subdivided R02 scan triangles',surface:'barycentric interpolation of displaced triangle vertices',rootOffsetMeters:[.000025,.000050],originalFuzzPreserved:14000,segments:[7,10],sourceMaterial:'kaopu-hair-workbench/qa/gnm-groom-editor/src/FiberMaterial.js@23f1f408f961749c49e9747d45072c761825b158',fiberShadows:'disabled; retain original VSM skin shadows'};return group;
}

async function installSkinIdentities(original,load){
 const cache=new Map(),originalMaps={...original};let sequence=0,group=null,current='original';
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
   releaseHair();skin.map=maps.albedo;skin.color.setRGB(1,1,1);skin.normalMap=maps.normal;skin.clearcoatNormalMap=maps.normal;
   U.uIdentityEnabled.value=id==='original'?0:1;U.uIdentityRoughnessBase.value=IDENTITY_DEFINITIONS[id].params.roughness??defaults.roughness;U.uIdentityRoughness.value=maps.roughness||originalMaps.spec;U.uIdentityFeatures.value=maps.features||originalMaps.surfaceMap;
   if(!keepValues)Object.assign(values,defaults,IDENTITY_DEFINITIONS[id].params);
   if(id!=='original'){group=identityHairGeometry(mesh.geometry,IDENTITY_DEFINITIONS[id],maps);fuzz.add(group);}
   current=id;state.identity=id;state.identityMaps=id==='original'?'original-4k-scan':['albedo','normal','roughness','features'].map(k=>({kind:k,width:maps[k].image.width,height:maps[k].image.height}));state.identityHair=group?.userData.counts||{brow:0,beard:0};
   document.querySelectorAll('[data-identity]').forEach(b=>{b.classList.toggle('active',b.dataset.identity===id);b.setAttribute('aria-pressed',String(b.dataset.identity===id));});
   $('identityDescription').textContent=IDENTITY_DEFINITIONS[id].description;$('identityStatus').textContent=id==='original'?'已恢复原始 R02':'2K 独立身份图 + 原 R02 4K 扫描微结构';
   document.querySelector('.caption-title').textContent=IDENTITY_DEFINITIONS[id].label;
   for(const k in hairValues)$(k).disabled=id==='original'||(id==='porcelain'&&k.startsWith('beard'));
   for(const key of [...cache.keys()])if(cache.size>2&&key!==id){const item=cache.get(key);for(const tex of Object.values(item))tex.dispose();cache.delete(key);}
   updateHair();skin.needsUpdate=true;apply();dirty=true;if(state.ready)render();
  }finally{if(request===sequence)state.identityLoading=false;}
 }
 const report=()=>({schema:'kaopu/skin-identity@1',id:current,hair:{...hairValues},geometryBasis:'R02.1 original scan; topology unchanged',maps:state.identityMaps});
 async function restore(o){if(!o)return setIdentity('original');if(o.schema!=='kaopu/skin-identity@1')throw Error('表皮配方版本不兼容');await setIdentity(o.id);for(const k in hairValues)if(Number.isFinite(o.hair?.[k]))hairValues[k]=Math.max(0,Math.min(k==='beardLength'?2:1,o.hair[k]));updateHair();}
 const api={set:setIdentity,report,restore,hasHair:()=>!!group&&current!=='original',current:()=>current,diagnostics:()=>({binding:group?.userData.binding,materials:group?.children.map(o=>fiberMaterialDiagnostics(o.material))}),definitions:IDENTITY_DEFINITIONS};identityRuntime=api;window.__SKIN_LAB__.identity=api;
 for(const b of document.querySelectorAll('[data-identity]'))b.onclick=()=>setIdentity(b.dataset.identity).catch(e=>{toast(e.message);state.errors.push(e.message);});
 for(const k in hairValues)$(k).oninput=()=>{hairValues[k]=Number($(k).value);updateHair();};
 $('identityMaps').onclick=()=>{
  const host=$('mapGallery');host.replaceChildren();if(current==='original'){host.textContent='原版扫描贴图保留在 r01/assets。';}else for(const [id,label]of [['albedo','颜色 / 色素'],['normal','法线 / 凹凸'],['roughness','粗糙度'],['features','色斑 / 毛囊 / 起伏']]){const card=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=label+' · 2048 × 2048';img.src='./assets/identities/'+current+'/'+id+'.webp';img.alt=label;card.append(caption,img);host.append(card);}
  $('mapsDialog').showModal();
 };
 $('mapsClose').onclick=()=>$('mapsDialog').close();
 await setIdentity('porcelain');return api;
}

