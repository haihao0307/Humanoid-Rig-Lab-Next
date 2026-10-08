// This file is assembled into the existing R02 module scope, not a second app.
// It changes mesh materials and mesh-rooted fibres. No portrait planes exist.
let identityRuntime=null;
const IDENTITY_DEFINITIONS={
 original:{label:'原 R02',description:'原始扫描颜色、法线和材质参数；保留作回退对照。',seed:0,beard:0,brow:0,params:{}},
 porcelain:{label:'01 · 冷白雀斑',description:'无须、铜棕细弧眉；鼻颊雀斑、细孔、偏哑光。独立色素 / 凹凸 / 粗糙度贴图。',seed:218,beard:0,brow:1450,params:{roughness:.60,oil:.12,detail:.56,meso:.75,micro:1.10,pores:.18,fuzz:.34,pigment:0,blood:.23,sss:.84,radius:1.20,relief:.62}},
 umber:{label:'02 · 深褐短须',description:'深褐色素、短硬胡茬、宽浓断眉；局部痘印、眉侧浅疤，T 区偏油。',seed:734,beard:11000,brow:1950,params:{roughness:.42,oil:.43,detail:.77,meso:1.08,micro:1.40,pores:.38,fuzz:.24,pigment:0,blood:.15,sss:.74,radius:.90,relief:.75}},
 weathered:{label:'03 · 风化熟龄',description:'暖褐晒斑、额纹和眼角细纹；灰白混色胡须、疏密眉束、干燥粗糙分区。',seed:159,beard:15000,brow:2250,params:{roughness:.64,oil:.10,detail:.90,meso:1.55,micro:1.20,pores:.29,fuzz:.32,pigment:0,blood:.30,sss:.76,radius:1.15,relief:.88}}
};
function identityRandom(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function identityHairGeometry(geometry,profile){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,ix=geometry.index.array,areas=[],triangles=[];
 let total=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);const x=(a.x+b.x+c.x)/3,y=(a.y+b.y+c.y)/3,z=(a.z+b.z+c.z)/3;if(Math.abs(x)>.078||y<-.035||y>.098||z<.025)continue;let ar=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;if(ar<1e-13)continue;total+=ar;areas.push(total);triangles.push(i);}
 const output={brow:[],beard:[]},rand=identityRandom(profile.seed),q=new THREE.Vector3(),nn=new THREE.Vector3();
 for(let tries=0;tries<380000&&(output.brow.length<profile.brow||output.beard.length<profile.beard);tries++){
  let lo=0,hi=areas.length-1,r=rand()*total;while(lo<hi){let m=(lo+hi)>>1;if(areas[m]<r)lo=m+1;else hi=m;}
  const i=triangles[lo],ia=ix[i],ib=ix[i+1],ic=ix[i+2];let u=rand(),v=rand();if(u+v>1){u=1-u;v=1-v;}
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);q.copy(a).multiplyScalar(1-u-v).addScaledVector(b,u).addScaledVector(c,v);
  const ax=Math.abs(q.x),side=q.x<0?-1:1,t=(ax-.010)/.048;
  const arch=.0795+.0033*Math.sin(Math.PI*t)-.004*t+(profile.seed===218?.0015:0);
  const width=profile.seed===218?.00165:profile.seed===734?.0031:.0027;
  const brow=t>0&&t<1&&Math.abs(q.y-arch)<width*Math.pow(Math.sin(Math.PI*t),.40);
  const notch=profile.seed===734&&q.x>.039&&q.x<.046&&q.y>.074;
  const lower=q.y<.010&&q.y>-.029,sideburn=ax>.026&&ax<.067&&q.y<.048&&q.y>-.022;
  const moustache=ax<.026&&q.y>.023&&q.y<.029&&q.z>.071;
  const lip=ax<.028&&Math.abs(q.y-.0185)<.006;
  const beard=(lower||sideburn||moustache)&&!lip;
  let kind=brow&&!notch?'brow':beard?'beard':null;
  if(!kind||output[kind].length>=profile[kind])continue;
  if(kind==='beard'&&q.y<-.015&&rand()>.65)continue;
  if(kind==='brow'&&profile.seed===159&&Math.sin(ax*970+q.y*1760)>.65&&rand()>.27)continue;
  nn.set(n.getX(ia)*(1-u-v)+n.getX(ib)*u+n.getX(ic)*v,n.getY(ia)*(1-u-v)+n.getY(ib)*u+n.getY(ic)*v,n.getZ(ia)*(1-u-v)+n.getZ(ib)*u+n.getZ(ic)*v).normalize();
  const flow=kind==='brow'?new THREE.Vector3(side*(.7+.2*rand()),.3-.55*t,0):new THREE.Vector3(side*(moustache?.38:.12),-1,.10);
  flow.addScaledVector(nn,-flow.dot(nn)).normalize();
  const length=kind==='brow'?(profile.seed===218?.0018+rand()*.0020:profile.seed===159?.0030+rand()*.0045:.0024+rand()*.0032):(profile.seed===159?.003+rand()*.006:.00045+rand()*.0011);
  let col=profile.seed===218?new THREE.Color(.105,.047,.022):profile.seed===159&&rand()<.55?new THREE.Color(.29,.275,.24):new THREE.Color(.014,.009,.006);
  col.multiplyScalar(.65+rand()*.85);
  output[kind].push({p:q.clone(),n:nn.clone(),flow,length,col,random:rand(),uv:[uv.getX(ia)*(1-u-v)+uv.getX(ib)*u+uv.getX(ic)*v,uv.getY(ia)*(1-u-v)+uv.getY(ib)*u+uv.getY(ic)*v]});
 }
 const group=new THREE.Group();group.name='identity-mesh-rooted-fibres';
 for(const kind of ['brow','beard']){
  const positions=[],normals=[],roots=[],colors=[],tangents=[],uvs=[],ts=[],sides=[],ids=[],randoms=[],widths=[];
  for(const strand of output[kind]){let start=positions.length/3;
   for(let j=0;j<4;j++){let t=j/3;const bend=t*t,tip=strand.p.clone().addScaledVector(strand.n,.000025+strand.length*t*.30).addScaledVector(strand.flow,strand.length*(t*.50+bend*.38));
    const tangent=strand.n.clone().multiplyScalar(.3).addScaledVector(strand.flow,.5+.76*t).normalize();
    for(const side of [-1,1]){positions.push(...tip.toArray());roots.push(...strand.p.toArray());normals.push(...strand.n.toArray());colors.push(...strand.col.toArray());tangents.push(...tangent.toArray());uvs.push(...strand.uv);ts.push(t);sides.push(side);randoms.push(strand.random);widths.push(kind==='brow'?.000023:.000026);}
    if(j<3){let k=start+j*2;ids.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
  }
  const g=new THREE.BufferGeometry();for(const [key,arr,size] of [['position',positions,3],['normal',normals,3],['rootPosition',roots,3],['color',colors,3],['tangentHair',tangents,3],['uv',uvs,2],['strandT',ts,1],['strandSide',sides,1],['strandRandom',randoms,1],['strandWidth',widths,1]])g.setAttribute(key,new THREE.Float32BufferAttribute(arr,size));g.setIndex(ids);
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uDensity:{value:1},uLength:{value:1},uSurface:E.uSurface,uRelief:E.uRelief,uPixelHeight:fuzz.material.uniforms.uPixelHeight,uLightDir:fuzz.material.uniforms.uLightDir,uLightPower:fuzz.material.uniforms.uLightPower},
   vertexShader:`attribute vec3 rootPosition,color,tangentHair;attribute float strandT,strandSide,strandRandom,strandWidth;uniform float uLength,uRelief,uPixelHeight;uniform sampler2D uSurface;varying float vt,vs,coverage,vr;varying vec3 vc,vn,vv,vHair;void main(){vt=strandT;vs=strandSide;vr=strandRandom;vc=color;vec3 pp=rootPosition+(position-rootPosition)*uLength+normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001;vec4 p=modelViewMatrix*vec4(pp,1.);vv=-p.xyz;vn=normalize(normalMatrix*normal);vHair=normalize(mat3(modelViewMatrix)*tangentHair);vec3 across=normalize(cross(vHair,normalize(vv)));float width=strandWidth*(1.-.88*vt);float pixel=max(.0000001,-p.z/(projectionMatrix[1][1]*uPixelHeight*.5));float halfwidth=max(width,pixel*.50);coverage=width/halfwidth;p.xyz+=across*strandSide*halfwidth;gl_Position=projectionMatrix*p;}`,
   fragmentShader:`uniform float uDensity,uLightPower;uniform vec3 uLightDir;varying float vt,vs,coverage,vr;varying vec3 vc,vn,vv,vHair;void main(){if(vr>uDensity)discard;vec3 N=normalize(vn),V=normalize(vv),L=normalize(uLightDir),T=normalize(vHair);float lam=max(dot(N,L),0.);float longitudinal=sqrt(max(1.-pow(dot(T,normalize(L+V)),2.),0.));float sheen=pow(longitudinal,44.);float alpha=coverage*(1.-smoothstep(.1,1.,abs(vs)))*(1.-smoothstep(.85,1.,vt));vec3 col=vc*(.48+lam*uLightPower*.75)+vec3(.24,.20,.15)*sheen*uLightPower*.06;gl_FragColor=vec4(col,alpha);}`});
  const obj=new THREE.Mesh(g,mat);obj.frustumCulled=false;obj.name=kind;group.add(obj);
 }
 group.userData.counts={brow:output.brow.length,beard:output.beard.length};return group;
}
async function installSkinIdentities(original,load){
 const cache=new Map(),originalMaps={...original};let sequence=0,group=null,current='original';
 const hairValues={browDensity:1,beardDensity:1,beardLength:1};
 const updateHair=()=>{if(group)for(const obj of group.children){obj.material.uniforms.uDensity.value=obj.name==='brow'?hairValues.browDensity:hairValues.beardDensity;obj.material.uniforms.uLength.value=obj.name==='brow'?1:hairValues.beardLength;}
  for(const k in hairValues){$(k).value=hairValues[k];$(k+'Out').textContent=hairValues[k].toFixed(2);}dirty=true;};
 function releaseHair(){if(!group)return;fuzz.remove(group);for(const child of group.children){child.geometry.dispose();child.material.dispose();}group=null;}
 async function mapsFor(id){if(id==='original')return originalMaps;if(cache.has(id)){const a=cache.get(id);cache.delete(id);cache.set(id,a);return a;}
  const root='./assets/identities/'+id+'/';const [albedo,normal,roughness,features]=await Promise.all([load(root+'albedo.webp',true),load(root+'normal.webp'),load(root+'roughness.webp'),load(root+'features.webp')]);const result={albedo,normal,roughness,features};cache.set(id,result);return result;
 }
 async function setIdentity(id,{keepValues=false}={}){
  if(!IDENTITY_DEFINITIONS[id])throw new Error('未知表皮配方');const request=++sequence;$('identityStatus').textContent='正在载入 '+IDENTITY_DEFINITIONS[id].label+'…';state.identityLoading=true;
  try{
   const maps=await mapsFor(id);if(request!==sequence)return;
   releaseHair();skin.map=maps.albedo;skin.normalMap=maps.normal;skin.clearcoatNormalMap=maps.normal;
   U.uIdentityEnabled.value=id==='original'?0:1;U.uIdentityRoughnessBase.value=IDENTITY_DEFINITIONS[id].params.roughness??defaults.roughness;U.uIdentityRoughness.value=maps.roughness||originalMaps.spec;U.uIdentityFeatures.value=maps.features||originalMaps.surfaceMap;
   if(!keepValues)Object.assign(values,defaults,IDENTITY_DEFINITIONS[id].params);
   if(id!=='original'){group=identityHairGeometry(mesh.geometry,IDENTITY_DEFINITIONS[id]);fuzz.add(group);}
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
 const api={set:setIdentity,report,restore,hasHair:()=>!!group&&current!=='original',current:()=>current,definitions:IDENTITY_DEFINITIONS};identityRuntime=api;window.__SKIN_LAB__.identity=api;
 for(const b of document.querySelectorAll('[data-identity]'))b.onclick=()=>setIdentity(b.dataset.identity).catch(e=>{toast(e.message);state.errors.push(e.message);});
 for(const k in hairValues)$(k).oninput=()=>{hairValues[k]=Number($(k).value);updateHair();};
 $('identityMaps').onclick=()=>{
  const host=$('mapGallery');host.replaceChildren();if(current==='original'){host.textContent='原版扫描贴图保留在 r01/assets。';}else for(const [id,label]of [['albedo','颜色 / 色素'],['normal','法线 / 凹凸'],['roughness','粗糙度'],['features','色斑 / 毛囊 / 起伏']]){const card=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=label+' · 2048 × 2048';img.src='./assets/identities/'+current+'/'+id+'.webp';img.alt=label;card.append(caption,img);host.append(card);}
  $('mapsDialog').showModal();
 };
 $('mapsClose').onclick=()=>$('mapsDialog').close();
 await setIdentity('porcelain');return api;
}
