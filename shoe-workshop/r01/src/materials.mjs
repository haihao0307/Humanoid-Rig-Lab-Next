// Original procedural presentation materials using the public Three.js API.
import * as T from 'three';
export const MATERIALS={smooth:{name:'细纹皮革',roughness:.43,clearcoat:.15,clearcoatRoughness:.32,note:'细粒纹理与柔和涂饰反射'},grain:{name:'粒面皮革',roughness:.52,clearcoat:.1,note:'非规则粒纹与较宽高光'},suede:{name:'绒面革',roughness:.94,sheen:.75,sheenRoughness:.8,note:'粗糙反射与掠射绒光近似，非真实毛纤维'},weave:{name:'织物鞋面',roughness:.85,sheen:.5,sheenRoughness:.8,note:'程序化交错经纬纹理'},patent:{name:'亮面漆皮',roughness:.22,clearcoat:.95,clearcoatRoughness:.13,note:'独立清漆反射层'}};
export const COLOURS=[['深栗棕','#683920'],['酒红','#4d2025'],['炭黑','#191b1e'],['烟草棕','#996344'],['奶油白','#c4bca9'],['深海蓝','#253d4b'],['苔绿','#465245']];
const cache=new Map();
function texture(kind){
 if(cache.has(kind))return cache.get(kind);
 const n=512,data=new Uint8Array(n*n*4),cells=kind==='grain'?17:29;
 const fract=x=>x-Math.floor(x),rand=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453),smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const noise=rand(x,y);let h=noise;
  if(kind==='smooth'||kind==='grain'||kind==='patent'){
   const gx=x/n*cells,gy=y/n*cells,ix=Math.floor(gx),iy=Math.floor(gy);let d1=99,d2=99;
   for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=ix+i,cy=iy+j,rx=(cx+cells)%cells,ry=(cy+cells)%cells,px=cx+.18+.64*rand(rx,ry),py=cy+.18+.64*rand(ry+57,rx+23),d=Math.hypot(gx-px,gy-py);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
   h=.25+.6*smooth((d2-d1)/.16)+.045*(noise-.5);
  }else if(kind==='weave'){
   const ix=Math.floor(x/12),iy=Math.floor(y/12),warp=Math.pow(Math.sin((x%12+.5)/12*Math.PI),.6),weft=Math.pow(Math.sin((y%12+.5)/12*Math.PI),.6);h=.18+.66*((ix+iy)%2?warp:weft)+.055*(noise-.5);
  }else if(kind==='suede')h=.48+.25*(noise-.5)+.16*Math.sin(x*.67+y*2.7);
  for(let c=0;c<3;c++)data[(y*n+x)*4+c]=Math.round(T.MathUtils.clamp(h,0,1)*255);data[(y*n+x)*4+3]=255;
 }
 const t=new T.DataTexture(data,n,n);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(40,40);t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=8;t.needsUpdate=true;cache.set(kind,t);return t;
}
export function palette(kind='smooth',colour='#683920'){const {name,note,...p}=MATERIALS[kind],bump=texture(kind),standard=(color,roughness=.8)=>new T.MeshStandardMaterial({color,roughness});return{skin:new T.MeshPhysicalMaterial({...p,color:colour,bumpMap:bump,bumpScale:kind==='grain'?.00020:kind==='suede'?.00005:kind==='patent'?.000012:.000045,sheenColor:new T.Color(colour).lerp(new T.Color('#c9b49b'),.4),ior:1.48}),edge:standard(new T.Color(colour).multiplyScalar(.58),.65),lining:standard('#a67d51',.76),sole:standard('#252322',.85),cupsole:standard('#b8b2a4',.76),leatherSole:standard('#654730',.65),thread:standard(new T.Color(colour).lerp(new T.Color('#d9c8a4'),.6),.96),lace:new T.MeshStandardMaterial({color:colour==='#c4bca9'?'#d6cebc':'#33261e',roughness:.95,bumpMap:texture('weave'),bumpScale:.00012}),metal:new T.MeshStandardMaterial({color:'#a38c68',metalness:.86,roughness:.26}),dark:standard('#0d0d0e',.95),elastic:new T.MeshStandardMaterial({color:'#171718',roughness:.88,bumpMap:texture('weave'),bumpScale:.00016}),wood:standard('#b18e5a',.5)};}
export function disposePalette(p){Object.values(p).forEach(m=>m.dispose());}
export function makeEnvironment(renderer){const scene=new T.Scene();scene.background=new T.Color('#424449');for(const [x,y,z,w,h,p]of [[-3,3,2,3,4,6],[3,2,-1,2,4,3.5],[0,5,0,4,3,2.7],[1,1,4,1.2,3,1.8]]){const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(1,1,1).multiplyScalar(p),side:T.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);scene.add(m);}const generator=new T.PMREMGenerator(renderer),target=generator.fromScene(scene,.035);generator.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return target.texture;}
