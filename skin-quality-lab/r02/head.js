import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id),VERSION='skin-quality-lab/r02.0';
const defaults={roughness:.48,oil:.24,detail:.75,pores:.24,poreSize:.32,fuzz:.32,pigment:.16,blood:.25,sss:.78,radius:1.3,azimuth:-46,exposure:.96,meso:.7,micro:.8,relief:.7,translucency:.65};
const values={...defaults};
const presets={natural:{...defaults},dry:{...defaults,roughness:.66,oil:.04,detail:.94,pores:.48,sss:.48},oily:{...defaults,roughness:.32,oil:.78,detail:.72,pores:.32,sss:.72},warm:{...defaults,pigment:.62,blood:.42,roughness:.46,oil:.3,sss:.72}};
const state={ready:false,version:VERSION,errors:[],layer:'beauty',light:'studio',camera:'portrait',baseline:false,frames:0,quality:'high',fps:0};
window.__SKIN_LAB__={state,values,defaults};
const viewport=$('viewport');let albedoRT,entryRT,entryCamera,entryMaterial,entryDirty=true;
let renderer,scene,camera,controls,mesh,skin,fuzz,fullRT,diffRT,blurA,blurB,blurMaterial,composeMaterial,quad,postScene,postCamera,key,fill,rim,pmremTarget,dirty=true,shader,compareHeld=false,last=performance.now(),frameCount=0,lastStat=last;
const U={uPass:{value:0},uDetail:{value:values.detail},uPores:{value:values.pores},uPoreFrequency:{value:450/values.poreSize},uPigment:{value:values.pigment},uBlood:{value:values.blood},uScatter:{value:values.sss},uOil:{value:values.oil},uHeight:{value:null},uSpec:{value:null},uBaseline:{value:0},uLayer:{value:0}};
const E={uMeso:{value:.7},uMicro:{value:.8},uRelief:{value:.7},uTranslucency:{value:.65},uMesoMap:{value:null},uMicroMap:{value:null},uSurface:{value:null},uKeyDepth:{value:null},uKeyVP:{value:new THREE.Matrix4()},uKeyDirection:{value:new THREE.Vector3()},uKeyEnergy:{value:new THREE.Color()},uKeyRange:{value:1.99}};
Object.assign(U,E);
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',2200)}
function fail(e){const message=e?.message||String(e);state.errors.push(message);$('loading').style.display='flex';$('loadingText').textContent='场景未完成载入：'+message;$('status').textContent='载入失败';console.error(e)}
window.addEventListener('error',e=>state.errors.push(e.message));window.addEventListener('unhandledrejection',e=>state.errors.push(String(e.reason)));
function subdivide(g){const oldP=g.attributes.position,oldN=g.attributes.normal,oldUV=g.attributes.uv,idx=g.index.array;const p=Array.from(oldP.array),n=Array.from(oldN.array),uv=Array.from(oldUV.array),out=[],edges=new Map();
 function mid(a,b){const k=a<b?a+':'+b:b+':'+a;if(edges.has(k))return edges.get(k);const i=p.length/3;let x=(p[a*3]+p[b*3])/2,y=(p[a*3+1]+p[b*3+1])/2,z=(p[a*3+2]+p[b*3+2])/2;const da=(x-p[a*3])*n[a*3]+(y-p[a*3+1])*n[a*3+1]+(z-p[a*3+2])*n[a*3+2];const db=(x-p[b*3])*n[b*3]+(y-p[b*3+1])*n[b*3+1]+(z-p[b*3+2])*n[b*3+2];x-=.32*(da*n[a*3]+db*n[b*3]);y-=.32*(da*n[a*3+1]+db*n[b*3+1]);z-=.32*(da*n[a*3+2]+db*n[b*3+2]);p.push(x,y,z);let nx=n[a*3]+n[b*3],ny=n[a*3+1]+n[b*3+1],nz=n[a*3+2]+n[b*3+2],l=Math.hypot(nx,ny,nz)||1;n.push(nx/l,ny/l,nz/l);uv.push((uv[a*2]+uv[b*2])/2,(uv[a*2+1]+uv[b*2+1])/2);edges.set(k,i);return i}
 for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca)}const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(p,3));q.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));q.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));q.setIndex(out);return q}
