/** Original semantic surface fields. Uses existing licensed GNM/Anny metadata only.
 * The mapping is baked in native rest space once, then interpolated by the same
 * immutable recipes as the canonical geometry. No camera/screen masks. */
export const SKIN_REGION_VERSION='common-skin-regions/1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function contourDistance(x,y,poly){let inside=false,d=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[j],b=poly[i];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));d=Math.min(d,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
 }return inside?d:-d;}
function point(a,i){return [a[i*3],a[i*3+1],a[i*3+2]];}
const sub=(a,b)=>a.map((x,k)=>x-b[k]),dot=(a,b)=>a.reduce((n,x,k)=>n+x*b[k],0),norm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function buildSkinRegions(model){
 const m=model,g=m.gnm,c=m.canonical,N=m.vertexCount;
 if(!g.materialId||!g.regionId||!g.landmarkIndices||!g.landmarkWeights)throw Error('原生皮肤语义和唇轮廓不可用');
 const skinId=g.meta.materialNames.indexOf('skin');if(skinId<0)throw Error('GNM skin material missing');
 const native=new Float32Array(g.numVertices*8),types=new Float32Array(N),rest=new Float32Array(N*3),regions=new Float32Array(N*4),extra=new Float32Array(N*4);
 const landmarks=[];for(let i=48;i<60;i++){const p=[0,0,0];for(let j=0;j<3;j++){const vi=g.landmarkIndices[i*3+j],w=g.landmarkWeights[i*3+j];for(let k=0;k<3;k++)p[k]+=g.template[vi*3+k]*w;}landmarks.push(p);}
 const lipZ=Math.min(...landmarks.map(p=>p[2]));
 const materialTypes={skin:0,teeth:1,gums:2,tongue:3,scleras:4,irises:5,pupils:6};
 for(let i=0;i<g.numVertices;i++){
  if(g.materialId[i]!==skinId)continue;const name=g.meta.regionNames[g.regionId[i]]||'',p=point(g.template,i),lipRegion=name==='upper_lip'||name==='lower_lip';
  native[i*8]=1;
  // Landmark contour determines vermilion; broad upper_lip/lower_lip labels alone
  // would paint the philtrum/chin. The anatomical material gate excludes teeth.
  native[i*8+1]=lipRegion?smooth(-.0007,.0010,contourDistance(p[0],p[1],landmarks))*smooth(lipZ-.007,lipZ-.003,p[2]):0;
  native[i*8+2]=name==='nose'?1:name==='forehead'?.58:name==='middle_brow'?.62:name==='chin'?.34:0;
  native[i*8+3]=name.includes('cheek')?.70:name.includes('zygomatic')?1:name==='nose'?.26:0;
  native[i*8+4]=name.includes('orbital')?.9:name.includes('temple')?.25:0;
  native[i*8+5]=name.includes('cheek')?.32:name==='chin'?.25:0;
 }
 const bone=name=>{const i=m.anny.boneLabels.indexOf(name);return i<0?null:point(m.neutral.boneHeads,i);};
 const wrists=['L','R'].map(side=>{const w=bone('wrist.'+side),f=bone('finger3-1.'+side),a=bone('finger2-1.'+side),b=bone('finger5-1.'+side);if(!w||!f||!a||!b)return null;let normal=norm(cross(sub(a,w),sub(b,w)));if(side==='R')normal=normal.map(x=>-x);return{w,dir:norm(sub(f,w)),normal};}).filter(Boolean);
 const jointNames=['lowerarm01.L','lowerarm01.R','lowerleg01.L','lowerleg01.R'];
 const dryJoints=jointNames.map(bone).filter(Boolean);
 const bodyNormals=new Float32Array(m.bodyCount*3);
 for(let i=0;i<m.bodyCount;i++){const[a,b,t]=c.annyRecipes[i];const p=[0,1,2].map(k=>m.neutral.vertices[a*3+k]*(1-t)+m.neutral.vertices[b*3+k]*t);rest.set([p[0],p[2],-p[1]],i*3);regions[i*4]=1;}
 for(let i=0;i<m.faces.length;i+=3){const a=m.faces[i],b=m.faces[i+1],d=m.faces[i+2];if(a>=m.bodyCount||b>=m.bodyCount||d>=m.bodyCount)continue;const n=cross(sub(point(rest,b),point(rest,a)),sub(point(rest,d),point(rest,a)));for(const vi of[a,b,d])for(let k=0;k<3;k++)bodyNormals[vi*3+k]+=n[k];}
 for(let i=0;i<m.bodyCount;i++){
  const q=point(rest,i),p=[q[0],-q[2],q[1]],n0=norm(point(bodyNormals,i)),n=[n0[0],-n0[2],n0[1]];
  let palm=0,dry=0;for(const w of wrists){const r=sub(p,w.w),along=dot(r,w.dir),radial=Math.sqrt(Math.max(0,dot(r,r)-along*along));palm=Math.max(palm,smooth(-.015,.018,along)*(1-smooth(.17,.22,along))*(1-smooth(.06,.09,radial))*smooth(-.05,.6,dot(n,w.normal)));}
  for(const j of dryJoints)dry=Math.max(dry,Math.exp(-dot(sub(p,j),sub(p,j))/.003));
  extra.set([0,dry*.5,palm,0],i*4);
 }
 for(let hi=0;hi<c.gnmRecipes.length;hi++){
  const i=m.bodyCount+hi,[a,b,t]=c.gnmRecipes[hi],T=c.headTransform.translation,p=[0,1,2].map(k=>g.template[a*3+k]*(1-t)+g.template[b*3+k]*t);
  rest.set([p[0]+T[0],p[1]+T[2],p[2]-T[1]],i*3);
  // Mixed material recipe vertices are never allowed to acquire skin/lip masks.
  const skin=g.materialId[a]===skinId&&g.materialId[b]===skinId;
  if(skin){for(let k=0;k<4;k++){regions[i*4+k]=native[a*8+k]*(1-t)+native[b*8+k]*t;extra[i*4+k]=native[a*8+4+k]*(1-t)+native[b*8+4+k]*t;}}
  types[i]=materialTypes[g.meta.materialNames[g.materialId[t>.5?b:a]]]??0;
 }
 // Surface adjacency feathering cannot cross eyes/teeth/material boundaries.
 const adjacency=Array.from({length:N},()=>new Set());for(let i=0;i<m.faces.length;i+=3)for(const[a,b]of[[m.faces[i],m.faces[i+1]],[m.faces[i+1],m.faces[i+2]],[m.faces[i+2],m.faces[i]]])if(regions[a*4]&&regions[b*4]){adjacency[a].add(b);adjacency[b].add(a);}
 for(let it=0;it<5;it++){const old=regions.slice(),ex=extra.slice();for(let i=0;i<N;i++){const adj=adjacency[i];if(!adj.size)continue;for(const k of[2,3]){let total=0;for(const j of adj)total+=old[j*4+k];regions[i*4+k]=old[i*4+k]*.55+total/adj.size*.45;}for(const k of[0,1,2]){let total=0;for(const j of adj)total+=ex[j*4+k];extra[i*4+k]=ex[i*4+k]*.55+total/adj.size*.45;}}}
 const counts={skin:0,lips:0,tzone:0,cheeks:0,thin:0,dry:0,palms:0,nonSkin:0};let lipOnNonSkin=0;for(let i=0;i<N;i++){if(regions[i*4])counts.skin++;else counts.nonSkin++;if(regions[i*4+1]>.05)counts.lips++;if(!regions[i*4]&&regions[i*4+1])lipOnNonSkin++;if(regions[i*4+2]>.05)counts.tzone++;if(regions[i*4+3]>.05)counts.cheeks++;if(extra[i*4]>.05)counts.thin++;if(extra[i*4+1]>.05)counts.dry++;if(extra[i*4+2]>.05)counts.palms++;}
 return {rest,regions,extra,types,report:{version:SKIN_REGION_VERSION,topology:c.topologySha256,counts,lipOnNonSkin,landmarkRange:[48,59],source:'GNM material/region IDs + barycentric lip landmarks, Anny neutral bone frames; fixed canonical recipes',textureCoordinates:'fixed rest metres, interpolated on surface',cameraDependent:false}};
}
