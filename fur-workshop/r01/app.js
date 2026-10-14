import * as T from './three.module.js';
const $=s=>document.querySelector(s), PI=Math.PI, clamp=T.MathUtils.clamp;
const started=performance.now(), canvas=$('#scene'), host=$('#viewport');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(34,1,.015,40), subject=new T.Group();scene.add(subject);
const E=globalThis.KAOPU_EB1,store=E.createStore({persist:true,broadcast:true});
const lighting=E.attachThree(T,{renderer,scene,store,center:[0,.92,0],radius:.95,ui:false,shadows:true});
const PRESETS={
 sable:{name:'深棕貂绒',sub:'密底绒 · 顺毛细亮',length:38,under:7,curl:.12,comb:.82,clump:.32,rough:.44,root:'#21140f',mid:'#57392a',tip:'#a47a56',thickness:.13},
 silver:{name:'银灰长毛',sub:'深色绒底 · 银色针尖',length:66,under:12,curl:.18,comb:.74,clump:.35,rough:.55,root:'#252b2c',mid:'#7b8181',tip:'#d0d2ce',thickness:.13},
 ivory:{name:'奶油长绒',sub:'柔和透光 · 蓬松轮廓',length:55,under:13,curl:.24,comb:.68,clump:.3,rough:.68,root:'#a5957e',mid:'#ddcfb9',tip:'#f3eddf',thickness:.12},
 fox:{name:'暖棕长毛',sub:'长针毛 · 自然下垂',length:88,under:17,curl:.28,comb:.78,clump:.43,rough:.52,root:'#423027',mid:'#a78059',tip:'#d6bb8b',thickness:.14},
 shearling:{name:'卷曲羊羔绒',sub:'短卷曲 · 密实底层',length:20,under:12,curl:1.35,comb:.33,clump:.22,rough:.86,root:'#9e8a70',mid:'#d1bea2',tip:'#e7d8bf',thickness:.17},
 suede:{name:'短绒翻毛皮',sub:'微绒毛 · 非长毛皮草',length:1.6,under:.65,curl:.08,comb:.6,clump:.05,rough:.95,root:'#513527',mid:'#9d7250',tip:'#ac835e',thickness:.09}
};
let presetKey='fox',p={...PRESETS.fox},view='coat',layer='all',density=1,wind=.28,simulating=true,brushMode=false,turning=false,ready=false;
const MAX=165000,GUIDEW=16,GUIDEH=64,guideData=new Float32Array(GUIDEW*GUIDEH*4),guides=[];
const guideTex=new T.DataTexture(guideData,GUIDEW,GUIDEH,T.RGBAFormat,T.FloatType);guideTex.minFilter=T.NearestFilter;guideTex.magFilter=T.NearestFilter;guideTex.needsUpdate=true;
const U={uLength:{value:.088},uUnder:{value:.017},uCurl:{value:.28},uComb:{value:.78},uClump:{value:.43},uRough:{value:.52},uThickness:{value:.00014},uRoot:{value:new T.Color()},uMid:{value:new T.Color()},uTip:{value:new T.Color()},uGuide:{value:guideTex},uHeight:{value:900},uFov:{value:Math.tan(17*PI/180)},uKey:{value:new T.Vector3()},uRim:{value:new T.Vector3()},uKC:{value:new T.Color()},uRC:{value:new T.Color()},uEnvUp:{value:new T.Color()},uEnvDown:{value:new T.Color()},uLayer:{value:0},uZoneOnly:{value:0}};
const vertex=`
attribute vec3 aRoot,aNormal,aGroom;attribute vec4 aRandom;attribute vec2 aGuide;attribute float aZone;
uniform float uLength,uUnder,uCurl,uComb,uClump,uThickness,uHeight,uFov,uLayer,uZoneOnly;
uniform sampler2D uGuide;varying float vT,vAcross,vCover,vRnd,vGuard;varying vec3 vN,vTangent,vPosition;
vec3 curve(float t,float len,float guard,vec3 dynamics){
 vec3 n=aNormal,g=aGroom,b=normalize(cross(n,g));
 float bundle=sin(aRoot.y*76.+sin(aRoot.x*43.)+aRoot.z*53.);
 vec3 groom=normalize(g+b*bundle*uClump*.26);
 float wave=(sin(t*(12.+aRandom.z*12.)+aRandom.x*6.283)-sin(aRandom.x*6.283));
 float curl=len*uCurl*mix(.11,.034,guard)*t;
 return aRoot+n*(.0003+len*(.70*t-.45*t*t)*(1.-uComb*.4))
  +groom*len*uComb*(.30*t+.69*t*t)
  +b*curl*wave+n*curl*(cos(t*15.+aRandom.x*6.283)-cos(aRandom.x*6.283))
  +dynamics*t*t*mix(.26,1.,guard);
}
void main(){
 float guard=step(.62,aRandom.w),fly=step(.978,aRandom.w);vGuard=guard;
 float len=mix(uUnder*(.65+.60*aRandom.y),uLength*(.70+.58*aRandom.y),guard)*(1.+fly*.42)*mix(1.,1.13,step(.5,aZone));
 bool hidden=(uLayer>0.5&&uLayer<1.5&&guard>.5)||(uLayer>1.5&&guard<.5)||(uZoneOnly>.5&&aZone<.5);
 float t=position.y;vec3 dyn=texture2D(uGuide,aGuide).xyz*min(1.,len/.06);
 vec3 q=curve(t,len,guard,dyn),nq=curve(t+.012,len,guard,dyn);vec4 mv=modelViewMatrix*vec4(q,1.);
 vec3 tangent=normalize(mat3(modelViewMatrix)*(nq-q));vec3 eye=normalize(-mv.xyz);
 vec3 side=cross(tangent,eye);side=length(side)<.001?vec3(1.,0.,0.):normalize(side);
 float diameter=uThickness*mix(.68,1.,guard)*(.63+.7*aRandom.z)*pow(max(.002,1.-t),.62);
 float px=2.*abs(mv.z)*uFov/uHeight;float expanded=max(diameter,px*.82);
 vCover=clamp(diameter/max(expanded,.000001),0.,1.);vAcross=position.x;vT=t;vRnd=aRandom.x;
 vN=normalize(mat3(modelMatrix)*aNormal);vTangent=normalize(mat3(modelMatrix)*(nq-q));vPosition=(modelMatrix*vec4(q,1.)).xyz;
 mv.xyz+=side*position.x*expanded*.5;
 gl_Position=hidden?vec4(2.,2.,2.,1.):projectionMatrix*mv;
}`;
const fragment=`
uniform vec3 uRoot,uMid,uTip,uKey,uRim,uKC,uRC,uEnvUp,uEnvDown;uniform float uRough;
varying float vT,vAcross,vCover,vRnd,vGuard;varying vec3 vN,vTangent,vPosition;
vec3 illuminate(vec3 L,vec3 energy,vec3 base,vec3 N,vec3 tangent,vec3 V){
 float wrap=clamp((dot(N,L)+.45)/1.45,0.,1.);
 float fiber=sqrt(max(.002,1.-pow(dot(tangent,L),2.)));
 vec3 H=normalize(L+V);float shift=dot(normalize(tangent+N*.08),H);
 float spec=pow(sqrt(max(0.,1.-shift*shift)),mix(95.,14.,uRough));
 float shift2=dot(normalize(tangent-N*.13),H);
 float broad=pow(sqrt(max(0.,1.-shift2*shift2)),mix(24.,7.,uRough));
 float back=pow(max(dot(-L,V),0.),5.)*(.14+.24*vT);
 return energy*(base*(.31*wrap*fiber+back*.1)+(vec3(.65)+base*.35)*spec*.18*wrap+base*broad*.12*wrap);
}
void main(){
 float edge=1.-smoothstep(.50,1.,abs(vAcross));float alpha=edge*vCover*(1.-smoothstep(.78,1.,vT))*.96;
 if(alpha<.003)discard;
 vec3 N=normalize(vN),tangent=normalize(vTangent),V=normalize(cameraPosition-vPosition);
 vec3 base=mix(uRoot,uMid,smoothstep(0.,.56,vT));base=mix(base,uTip,smoothstep(.55,1.,vT)*(.32+.64*vRnd));
 base*=.75+.46*vRnd;
 float occlusion=mix(.36,1.,pow(vT,.5));
 vec3 env=mix(uEnvDown,uEnvUp,clamp(N.y*.5+.5,0.,1.));
 vec3 col=base*env*.62+illuminate(uKey,uKC,base,N,tangent,V)+illuminate(uRim,uRC,base,N,tangent,V);
 gl_FragColor=vec4(col*occlusion,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const furMaterial=new T.ShaderMaterial({uniforms:U,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:T.DoubleSide});
function syncLight(){const l=E.sampleProfile(store.get());U.uKey.value.fromArray(l.keyDirection);U.uRim.value.fromArray(l.rimDirection);U.uKC.value.fromArray(l.keyColor);U.uRC.value.fromArray(l.rimColor);let up=[0,0,0],down=[0,0,0];for(const b of l.environment)for(let k=0;k<3;k++){up[k]+=b.color[k]*(.45+.55*Math.max(0,b.direction[1]));down[k]+=b.color[k]*(.45+.55*Math.max(0,-b.direction[1]));}U.uEnvUp.value.fromArray(up);U.uEnvDown.value.fromArray(down);renderer.shadowMap.needsUpdate=true;}
store.subscribe(syncLight);syncLight();
let rngState=842731;function rand(){rngState|=0;rngState=rngState+0x6D2B79F5|0;let t=Math.imul(rngState^rngState>>>15,1|rngState);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}
const v3=(x,y,z)=>new T.Vector3(x,y,z);
let pieces=[],growth=[],fur=null,bases=[],rootHash='',buildMs=0,firstReadyMs=0;
function profile(y){const keys=[[.26,.405,.195],[.55,.362,.187],[.94,.315,.173],[1.16,.304,.174],[1.35,.31,.175],[1.5,.253,.136],[1.6,.15,.1]];let i=0;while(i<keys.length-2&&y>keys[i+1][0])i++;let a=keys[i],b=keys[i+1],t=clamp((y-a[0])/(b[0]-a[0]),0,1);t=t*t*(3-2*t);return [T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t)];}
function sample(piece,u,v){const q=piece.fn(u,v),du=piece.fn(Math.min(1,u+.0003),v).sub(piece.fn(Math.max(0,u-.0003),v)),dv=piece.fn(u,Math.min(1,v+.0003)).sub(piece.fn(u,Math.max(0,v-.0003)));let n=du.cross(dv).normalize();if(piece.flip)n.negate();if(n.lengthSq()<.1)n.set(0,1,0);return {q,n};}
function makePieces(){
 const parts=[];const add=(name,fn,zone=0,flip=false)=>parts.push({name,fn,zone,flip});
 if(view==='hat'){
  add('帽身',(u,v)=>{let a=u*2*PI,r=.265*(1-.10*v),y=.68+v*.33;return v3(Math.sin(a)*r,y+.011*Math.cos(a*3)*Math.sin(v*PI),Math.cos(a)*r*.86);});
  add('帽顶',(u,v)=>{let a=u*2*PI,r=.239*(1-v*.995);return v3(Math.sin(a)*r,1.01+.07*Math.sin(v*PI*.5),Math.cos(a)*r*.86);},0,false);
 }else if(view==='swatch'){
  add('弯曲毛皮样片',(u,v)=>v3((u-.5)*.80,.40+v*.85,.09*Math.cos((u-.5)*PI*1.5)+.035*Math.sin(v*PI)),0,false);
 }else{
  add('大衣主体',(u,v)=>{let a=.095+u*(2*PI-.19);let top=1.485+.055*Math.pow(Math.max(0,-Math.cos(a)),2)-.285*Math.pow(Math.max(0,Math.cos(a)),14);let y=.255+v*(top-.255),[rx,rz]=profile(y);let fold=(.0035*Math.sin(a*11+y*2.5)+.0023*Math.sin(a*19-y*4))*(1-v*.45);return v3(Math.sin(a)*(rx+fold),y+.007*Math.cos(a*7)*Math.pow(1-v,3),Math.cos(a)*(rz+fold));});
  for(const sign of [-1,1]){
   add(sign<0?'右袖':'左袖',(u,v)=>{let a=u*2*PI,r=.119-.025*v+.005*Math.sin(v*8)*Math.sin(v*PI);let c=v3(sign*(.283+.238*v),1.425-.665*v,.004+.027*v),b=v3(sign*.941,.338,0);return c.addScaledVector(b,Math.cos(a)*r).add(v3(0,0,Math.sin(a)*r*.96));},0,sign<0);
   add(sign<0?'右翻领':'左翻领',(u,v)=>{let x=sign*(.108+.066*Math.sin(v*PI)-.041*v),y=1.555-.446*v,z=.071+.157*Math.sin(v*PI*.57);let width=.102*(1-.47*v),w=(u-.5)*2;return v3(x+sign*w*width,y+w*.022,z+.032*(1-w*w)+.013*Math.sin(v*PI));},1,sign>0);
  }
  add('后领',(u,v)=>{let a=PI/2+u*PI,r=.106+.092*v;return v3(Math.sin(a)*r,1.556-.058*v+.016*Math.sin(v*PI),Math.cos(a)*r*.83);},1,true);
 }
 return parts;
}
function meshPiece(piece,idx){
 const nu=piece.name==='大衣主体'?120:64,nv=piece.name==='大衣主体'?70:34,positions=[],normals=[],uvs=[],indices=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){let u=i/nu,v=j/nv,{q,n}=sample(piece,u,v);positions.push(...q);normals.push(...n);uvs.push(u,v);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(...(piece.flip?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeBoundingSphere();
 const mat=new T.MeshPhysicalMaterial({color:0x765744,roughness:.95,metalness:0,sheen:.7,sheenRoughness:.75,sheenColor:0xd9b583,side:T.DoubleSide});
 const mesh=new T.Mesh(geo,mat);mesh.name=piece.name;mesh.userData.zone=piece.zone;mesh.castShadow=true;mesh.receiveShadow=true;subject.add(mesh);growth.push(mesh);bases.push(mesh);
 const lining=new T.Mesh(geo.clone(),new T.MeshStandardMaterial({color:0x201c19,roughness:.57,side:T.BackSide}));
 const lp=lining.geometry.attributes.position;for(let k=0;k<lp.count;k++){lp.setXYZ(k,lp.getX(k)-normals[k*3]*.004,lp.getY(k)-normals[k*3+1]*.004,lp.getZ(k)-normals[k*3+2]*.004);}subject.add(lining);
 let area=0;piece.tris=[];const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();
 for(let k=0;k<indices.length;k+=3){A.fromArray(positions,3*indices[k]);B.fromArray(positions,3*indices[k+1]);C.fromArray(positions,3*indices[k+2]);area+=B.sub(A).cross(C.sub(A)).length()*.5;piece.tris.push(area);}
 piece.area=area;piece.geo=geo;piece.idx=idx;
 for(let gy=0;gy<8;gy++)for(let gx=0;gx<16;gx++){const {q,n}=sample(piece,(gx+.5)/16,(gy+.5)/8);guides.push({q,n,offset:v3(0,0,0),vel:v3(0,0,0),phase:rand()*6.28,index:(idx*8+gy)*16+gx});}
}
function pickSurface(piece){let r=rand()*piece.area,a=0,b=piece.tris.length-1;while(a<b){let m=(a+b)>>1;if(piece.tris[m]<r)a=m+1;else b=m;}const ids=piece.geo.index.array,ps=piece.geo.attributes.position.array,ns=piece.geo.attributes.normal.array,uv=piece.geo.attributes.uv.array;let t=Math.sqrt(rand()),s=rand(),w=[1-t,t*(1-s),t*s],q=v3(0,0,0),n=v3(0,0,0),u=0,v=0;for(let j=0;j<3;j++){let id=ids[a*3+j];q.x+=ps[id*3]*w[j];q.y+=ps[id*3+1]*w[j];q.z+=ps[id*3+2]*w[j];n.x+=ns[id*3]*w[j];n.y+=ns[id*3+1]*w[j];n.z+=ns[id*3+2]*w[j];u+=uv[id*2]*w[j];v+=uv[id*2+1]*w[j];}return {q,n:n.normalize(),u,v};}
function rebuild(){
 const begin=performance.now();ready=false;rngState=842731;
 subject.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==furMaterial)o.material.dispose();});subject.clear();growth=[];bases=[];guides.length=0;guideData.fill(0);guideTex.needsUpdate=true;
 pieces=makePieces();pieces.forEach(meshPiece);let area=pieces.reduce((s,x)=>s+x.area,0),count=view==='hat'?105000:view==='swatch'?100000:MAX;
 const roots=new Float32Array(count*3),normals=new Float32Array(count*3),grooms=new Float32Array(count*3),randoms=new Float32Array(count*4),dynamics=new Float32Array(count*2),zones=new Float32Array(count);
 for(let i=0;i<count;i++){
  let r=rand()*area,piece=pieces[0];for(const x of pieces){r-=x.area;if(r<=0){piece=x;break;}}
  const {q,n,u,v}=pickSurface(piece);let g=v3(0,-1,0).addScaledVector(n,n.y);
  if(g.length()<.08)g.set(q.x*.2,-.06,.8).addScaledVector(n,-n.dot(v3(q.x*.2,-.06,.8)));
  g.normalize();roots.set(q.toArray(),i*3);normals.set(n.toArray(),i*3);grooms.set(g.toArray(),i*3);
  randoms.set([rand(),rand(),rand(),rand()],i*4);dynamics[i*2]=(Math.min(15,Math.floor(u*16))+.5)/GUIDEW;dynamics[i*2+1]=(piece.idx*8+Math.min(7,Math.floor(v*8))+.5)/GUIDEH;zones[i]=piece.zone;
 }
 const geo=new T.InstancedBufferGeometry(),points=[],idx=[],segments=7;
 for(let j=0;j<=segments;j++)points.push(-1,j/segments,0,1,j/segments,0);
 for(let j=0;j<segments;j++){let k=j*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
 geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(idx);
 for(const [name,data,size]of [['aRoot',roots,3],['aNormal',normals,3],['aGroom',grooms,3],['aRandom',randoms,4],['aGuide',dynamics,2],['aZone',zones,1]])geo.setAttribute(name,new T.InstancedBufferAttribute(data,size));
 geo.instanceCount=Math.round(count*density);geo.userData.capacity=count;fur=new T.Mesh(geo,furMaterial);fur.frustumCulled=false;fur.renderOrder=3;subject.add(fur);
 let hash=2166136261;const rb=new Uint32Array(roots.buffer);for(let i=0;i<rb.length;i+=97)hash=Math.imul(hash^rb[i],16777619);rootHash=(hash>>>0).toString(16);
 if(view==='coat'||view==='collar'){
  const neck=new T.Mesh(new T.CylinderGeometry(.092,.095,.11,48),new T.MeshStandardMaterial({color:0x262524,roughness:.8}));neck.position.y=1.57;subject.add(neck);
  const cap=new T.Mesh(new T.CylinderGeometry(.025,.025,.022,24),new T.MeshStandardMaterial({color:0x817461,metalness:.6,roughness:.32}));cap.position.y=1.636;subject.add(cap);
 }
 applyParameters();buildMs=performance.now()-begin;ready=true;renderer.shadowMap.needsUpdate=true;$('#status').textContent='可交互 · WebGL2';$('#loading').hidden=true;
}
function applyParameters(){
 U.uLength.value=p.length/1000;U.uUnder.value=p.under/1000;U.uCurl.value=p.curl;U.uComb.value=p.comb;U.uClump.value=p.clump;U.uRough.value=p.rough;U.uThickness.value=p.thickness/1000;
 U.uRoot.value.set(p.root);U.uMid.value.set(p.mid);U.uTip.value.set(p.tip);U.uLayer.value=layer==='under'?1:layer==='guard'?2:0;U.uZoneOnly.value=view==='collar'?1:0;
 if(fur){fur.visible=layer!=='base';fur.geometry.instanceCount=Math.floor(fur.geometry.userData.capacity*density);}
 for(const b of bases){let leather=view==='collar'&&!b.userData.zone;b.material.color.set(leather?'#40332c':p.mid).multiplyScalar(leather?1:.75);b.material.roughness=leather?.54:.98;b.material.sheen=leather?.12:1;b.material.sheenColor.set(p.tip);}
 $('#title-material').textContent=p.name;$('#subtitle-material').textContent=p.sub;
 for(const el of document.querySelectorAll('[data-param]')){let k=el.dataset.param;el.value=p[k];let o=$(`[data-output="${k}"]`);if(o)o.textContent=k==='length'||k==='under'?`${p[k].toFixed(p[k]<3?1:0)} mm`:p[k].toFixed(2);}
 for(const el of document.querySelectorAll('[data-preset]'))el.classList.toggle('selected',el.dataset.preset===presetKey);
 $('#density-readout').textContent=Math.round(density*100)+'%';
}
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xbbb8b1,roughness:.98}));floor.rotation.x=-PI/2;floor.position.y=.006;floor.receiveShadow=true;scene.add(floor);
const plinth=new T.Mesh(new T.CylinderGeometry(.65,.67,.085,96),new T.MeshStandardMaterial({color:0x9c9992,roughness:.72}));plinth.position.y=.05;plinth.receiveShadow=true;scene.add(plinth);
let orbit={azimuth:.34,polar:1.36,distance:2.8,target:v3(0,.96,0)},zoomMode='full';
function cameraUpdate(){camera.position.set(Math.sin(orbit.azimuth)*Math.sin(orbit.polar),Math.cos(orbit.polar),Math.cos(orbit.azimuth)*Math.sin(orbit.polar)).multiplyScalar(orbit.distance).add(orbit.target);camera.lookAt(orbit.target);camera.updateMatrixWorld();}
function cameraPreset(which){zoomMode=which;subject.rotation.y=0;orbit.azimuth=which==='back'?PI+.2:which==='side'?1.5:.34;orbit.polar=1.36;orbit.distance=which==='macro'?.56:which==='collar'?1.15:view==='hat'?1.45:view==='swatch'?2:2.8;orbit.target.set(which==='macro'?.15:0,which==='macro'?1.19:which==='collar'?1.37:view==='hat'?.88:view==='swatch'?.87:.96,which==='macro'?.215:which==='collar'?.07:0);cameraUpdate();}
let dpr=1;function resize(){const w=host.clientWidth,h=host.clientHeight;dpr=Math.min(devicePixelRatio||1,1.5);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);U.uHeight.value=h*dpr;camera.aspect=w/h;camera.updateProjectionMatrix();cameraUpdate();}new ResizeObserver(resize).observe(host);
const raycaster=new T.Raycaster(),ndc=new T.Vector2();let pointer=null,brushHit=null,brushDirection=v3(1,0,0),brushGain=0;
function hitAt(x,y){const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);raycaster.setFromCamera(ndc,camera);const hit=raycaster.intersectObjects(growth,false)[0];return hit?subject.worldToLocal(hit.point.clone()):null;}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,id:e.pointerId,pan:e.button===2,brush:brushMode||e.shiftKey};canvas.setPointerCapture(e.pointerId);if(pointer.brush){brushHit=hitAt(e.clientX,e.clientY);brushGain=.5;}});
canvas.addEventListener('pointermove',e=>{if(!pointer)return;let dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(pointer.brush){brushHit=hitAt(e.clientX,e.clientY);let right=v3(1,0,0).applyQuaternion(camera.quaternion),up=v3(0,1,0).applyQuaternion(camera.quaternion);brushDirection.copy(right.multiplyScalar(dx)).addScaledVector(up,-dy);brushDirection.applyAxisAngle(v3(0,1,0),-subject.rotation.y).clampLength(0,18);brushGain=1;}else if(pointer.pan){let right=v3(1,0,0).applyQuaternion(camera.quaternion),up=v3(0,1,0).applyQuaternion(camera.quaternion);orbit.target.addScaledVector(right,-dx*.001*orbit.distance).addScaledVector(up,dy*.001*orbit.distance);}else{orbit.azimuth-=dx*.006;orbit.polar=clamp(orbit.polar-dy*.005,.22,2.8);}pointer.x=e.clientX;pointer.y=e.clientY;cameraUpdate();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{pointer=null;brushGain=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.distance=clamp(orbit.distance*Math.exp(e.deltaY*.001),.24,6);cameraUpdate();},{passive:false});
canvas.addEventListener('dblclick',e=>{let hit=hitAt(e.clientX,e.clientY);if(hit){orbit.target.copy(subject.localToWorld(hit));orbit.distance=.48;cameraUpdate();}});
let simulationTime=0,simSteps=0;function integrate(dt){simulationTime+=dt;for(const g of guides){let wx=Math.sin(simulationTime*1.6+g.q.y*3.3)+.36*Math.sin(simulationTime*3.1+g.phase),wz=Math.sin(simulationTime*1.2+g.q.x*4.2);let fx=wx*wind*.50,fy=0,fz=wz*wind*.18;if(brushHit&&brushGain>0){let ds=g.q.distanceToSquared(brushHit),fall=Math.exp(-ds/.018);fx+=brushDirection.x*fall*brushGain*.27;fy+=brushDirection.y*fall*brushGain*.27;fz+=brushDirection.z*fall*brushGain*.27;}for(const k of ['x','y','z']){let f=k==='x'?fx:k==='y'?fy:fz;g.vel[k]+=(f-33*g.offset[k]-8.5*g.vel[k])*dt;g.offset[k]+=g.vel[k]*dt;}g.offset.clampLength(0,.035);let inside=g.offset.dot(g.n);if(inside<-.004){g.offset.addScaledVector(g.n,-.004-inside);let vn=g.vel.dot(g.n);if(vn<0)g.vel.addScaledVector(g.n,-vn);}guideData[g.index*4]=g.offset.x;guideData[g.index*4+1]=g.offset.y;guideData[g.index*4+2]=g.offset.z;}guideTex.needsUpdate=true;simSteps++;}
function setPreset(key){if(!PRESETS[key])throw Error('Unknown preset');presetKey=key;p={...PRESETS[key]};applyParameters();}
function setView(key){if(!['coat','collar','hat','swatch'].includes(key))throw Error('Unknown view');view=key;for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('selected',b.dataset.view===key);rebuild();cameraPreset('full');}
function setLayer(key){layer=key;for(const b of document.querySelectorAll('[data-layer]'))b.classList.toggle('selected',b.dataset.layer===key);applyParameters();}
for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>setPreset(b.dataset.preset);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setView(b.dataset.view);
for(const b of document.querySelectorAll('[data-layer]'))b.onclick=()=>setLayer(b.dataset.layer);
for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>cameraPreset(b.dataset.camera);
for(const el of document.querySelectorAll('[data-param]'))el.oninput=()=>{p[el.dataset.param]=Number(el.value);applyParameters();};
$('#density').oninput=e=>{density=Number(e.target.value);applyParameters();};$('#wind').oninput=e=>{wind=+e.target.value;$('#wind-readout').textContent=wind.toFixed(2);};
$('#pause').onclick=()=>{simulating=!simulating;$('#pause').textContent=simulating?'暂停毛梢':'恢复毛梢';};
$('#brush').onclick=()=>{brushMode=!brushMode;$('#brush').classList.toggle('selected',brushMode);canvas.style.cursor=brushMode?'crosshair':'grab';$('#hint').textContent=brushMode?'在毛皮上拖动，观察局部毛梢受力与回弹。':'拖动旋转 · 滚轮缩放 · 双击局部 · Shift 拖动拨毛';};
$('#turn').onclick=()=>{turning=!turning;$('#turn').classList.toggle('selected',turning);};
$('#light').onclick=()=>{const old=$('#eb1-panel');if(old){old.remove();return;}E.mountUI(store);$('#eb1-panel').open=true;};
$('#reset').onclick=()=>{setPreset('fox');density=1;$('#density').value=1;wind=.28;$('#wind').value=.28;$('#wind-readout').textContent='.28';store.preset('custom');setLayer('all');setView('coat');};
$('#export').onclick=async()=>{const recipe={schema:'kaopu.fur/1',version:'FUR-ATELIER-R01',preset:presetKey,material:p,view,density,wind,lighting:store.get(),seed:842731};const area=$('#recipe');area.hidden=false;area.value=JSON.stringify(recipe,null,2);area.select();try{await navigator.clipboard.writeText(area.value);}catch(e){};};
let last=performance.now(),accumulator=0,frames=0,statsTime=last,fps=0,elapsed=0,hidden=false;
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;last=performance.now();accumulator=0;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#status').textContent='显卡上下文暂时丢失';});canvas.addEventListener('webglcontextrestored',()=>{guideTex.needsUpdate=true;$('#status').textContent='已恢复 · WebGL2';});
function frame(now){requestAnimationFrame(frame);if(hidden)return;const dt=Math.min((now-last)/1000,.045);last=now;elapsed+=dt;if(simulating){accumulator=Math.min(accumulator+dt,.05);while(accumulator>=1/120){integrate(1/120);accumulator-=1/120;}}if(turning){subject.rotation.y+=dt*.22;renderer.shadowMap.needsUpdate=true;}lighting.ensure();renderer.render(scene,camera);frames++;if(now-statsTime>1200){fps=frames*1000/(now-statsTime);frames=0;statsTime=now;$('#fps').textContent=fps.toFixed(0);$('#fibers').textContent=(fur.geometry.instanceCount/10000).toFixed(1)+' 万';$('#guide-count').textContent=guides.length;}}
rebuild();resize();firstReadyMs=performance.now()-started;requestAnimationFrame(frame);
window.FUR={version:'FUR-ATELIER-R01',setPreset,setView,setLayer,cameraPreset,setParameter(k,v){if(!Object.hasOwn(p,k))throw Error('Unknown parameter');p[k]=v;applyParameters();},setWind(x){wind=clamp(x,0,1.5);},setSimulating(x){simulating=!!x;},impulse(){brushHit=guides[Math.floor(guides.length*.35)].q.clone();brushDirection.set(12,-3,3);brushGain=1;setTimeout(()=>brushGain=0,260);},audit:()=>({version:'FUR-ATELIER-R01',ready,view,preset:presetKey,parameters:{...p},layer,rootHash,instances:fur.geometry.instanceCount,capacity:fur.geometry.userData.capacity,guides:guides.length,guideTipMax:Math.max(...guides.map(g=>g.offset.length())),simSteps,simulating,wind,lighting:lighting.audit(),buildMs,firstReadyMs,observedFPS:fps,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures,triangles:renderer.info.render.triangles,dpr,backend:'WebGL2 raster',physics:'bounded spring guide tips; not per-strand or garment collision',rootsAttached:true,externalCoatMesh:false,videoVerified:false}),renderer,scene,camera};
