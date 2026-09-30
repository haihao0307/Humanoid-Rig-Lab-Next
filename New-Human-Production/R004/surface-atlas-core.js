import * as THREE from 'three';

export const HUMAN_SURFACE_ATLAS_SCHEMA='kaopu/human_surface_atlas@0.1';
export const REGION_DEFS=Object.freeze([
 {id:'head',label:'头部与头发',color:0xd8b7ff},{id:'neck',label:'颈部',color:0xa7d9ff},
 {id:'chest',label:'胸腔与肩带',color:0x75c9ff},{id:'abdomen',label:'腹部与腰部',color:0x66dfbf},
 {id:'pelvis_shorts',label:'骨盆与短裤遮挡区',color:0xf1c56b},
 {id:'arm_xminus_upper',label:'X− 上臂',color:0xff927e},{id:'arm_xplus_upper',label:'X+ 上臂',color:0xffad7e},
 {id:'arm_xminus_lower',label:'X− 前臂',color:0xff7eb3},{id:'arm_xplus_lower',label:'X+ 前臂',color:0xff8ed8},
 {id:'hand_xminus',label:'X− 手',color:0xffd3a3},{id:'hand_xplus',label:'X+ 手',color:0xffe3a3},
 {id:'thigh_xminus',label:'X− 大腿',color:0xb6e46d},{id:'thigh_xplus',label:'X+ 大腿',color:0xd1e46d},
 {id:'knee_xminus',label:'X− 膝区',color:0x91d47e},{id:'knee_xplus',label:'X+ 膝区',color:0xaed47e},
 {id:'calf_xminus',label:'X− 小腿',color:0x74c6d6},{id:'calf_xplus',label:'X+ 小腿',color:0x74d6bf},
 {id:'foot_xminus',label:'X− 足',color:0xb7a4ff},{id:'foot_xplus',label:'X+ 足',color:0x9caeff},
 {id:'unresolved',label:'待确认表面',color:0x9aa4ad}
]);
export const SECTION_DEFS=Object.freeze([
 {id:'head',label:'头部',height:.91,regions:['head']},{id:'neck',label:'颈部',height:.805,regions:['neck']},
 {id:'shoulder',label:'肩胸',height:.735,regions:['chest']},{id:'chest',label:'胸腔',height:.665,regions:['chest']},
 {id:'waist',label:'腰腹',height:.555,regions:['abdomen']},{id:'pelvis',label:'骨盆/短裤',height:.455,regions:['pelvis_shorts']},
 {id:'thigh',label:'大腿',height:.335,regions:['thigh_xminus','thigh_xplus']},
 {id:'knee',label:'膝部',height:.245,regions:['knee_xminus','knee_xplus']},
 {id:'calf',label:'小腿',height:.145,regions:['calf_xminus','calf_xplus']},
 {id:'ankle',label:'踝足',height:.065,regions:['calf_xminus','calf_xplus','foot_xminus','foot_xplus']}
]);
const REGION_MAP=new Map(REGION_DEFS.map((r,i)=>[r.id,{...r,index:i}]));
const CORE_REGIONS=new Set(['head','neck','chest','abdomen','pelvis_shorts']);
const SLICE_COUNT=96,SLICE_SAMPLE_LIMIT=2048,SECTION_SAMPLE_LIMIT=5000;

export function classifySurfacePoint(point,frame){
 const v=(point.y-frame.min.y)/frame.height,dx=point.x-frame.center.x,ax=Math.abs(dx)/frame.height,side=dx<0?'xminus':'xplus';
 if(v>=.835)return'head';
 if(v>=.765&&ax<.085)return'neck';
 if(v>=.62)return ax>.13?`arm_${side}_upper`:'chest';
 if(v>=.515)return ax>.135?`arm_${side}_lower`:'abdomen';
 if(v>=.405)return ax>.145?`hand_${side}`:'pelvis_shorts';
 if(v>=.285)return`thigh_${side}`;
 if(v>=.215)return`knee_${side}`;
 if(v>=.075)return`calf_${side}`;
 if(v>=-.015)return`foot_${side}`;
 return'unresolved';
}
function makeFrame(root){
 const box=new THREE.Box3().makeEmpty(),p=new THREE.Vector3();
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){p.set(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(mesh.matrix);box.expandByPoint(p);}});
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());return{min:box.min.clone(),max:box.max.clone(),size,center,height:size.y};
}
function makeBin(){return{count:0,samples:[],coreCount:0,coreSamples:[]};}
function reservoir(list,value,count,limit,seed){if(list.length<limit){list.push(value);return;}const at=((Math.imul(seed+1,2654435761)>>>0)%count);if(at<limit)list[at]=value;}
function quantile(values,p,key){if(!values.length)return null;const a=values.map(key).sort((x,y)=>x-y),at=(a.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at),w=at-lo;return a[lo]*(1-w)+a[hi]*w;}
function convexHull(points){if(points.length<3)return points.slice();const unique=[...new Map(points.map(p=>[`${Math.round(p.x*1e6)},${Math.round(p.z*1e6)}`,p])).values()].sort((a,b)=>a.x-b.x||a.z-b.z);if(unique.length<3)return unique;const cross=(o,a,b)=>(a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x),lo=[],hi=[];for(const p of unique){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}for(let i=unique.length-1;i>=0;i--){const p=unique[i];while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}lo.pop();hi.pop();return lo.concat(hi);}

export function buildHumanSurfaceAtlas(replay,{sourceSHA256=null,sourceBytes=null}={}){
 const frame=makeFrame(replay),bins=Array.from({length:SLICE_COUNT},makeBin),counts=Object.fromEntries(REGION_DEFS.map(r=>[r.id,0])),sectionSamples=SECTION_DEFS.map(()=>Object.fromEntries(REGION_DEFS.map(r=>[r.id,[]]))),meshReports=[],point=new THREE.Vector3();let globalIndex=0,totalVertices=0;
 replay.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry?.attributes?.position)totalVertices+=mesh.geometry.attributes.position.count;});
 replay.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;const a=mesh.geometry.attributes.position,colors=new Float32Array(a.count*3),byRegion={};
  for(let i=0;i<a.count;i++,globalIndex++){
   point.set(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(mesh.matrix);const id=classifySurfacePoint(point,frame),def=REGION_MAP.get(id),c=new THREE.Color(def.color);colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;counts[id]++;byRegion[id]=(byRegion[id]||0)+1;
   const v=(point.y-frame.min.y)/frame.height,bi=Math.max(0,Math.min(SLICE_COUNT-1,Math.floor(v*SLICE_COUNT))),b=bins[bi];b.count++;reservoir(b.samples,{x:point.x,z:point.z},b.count,SLICE_SAMPLE_LIMIT,globalIndex);if(CORE_REGIONS.has(id)){b.coreCount++;reservoir(b.coreSamples,{x:point.x,z:point.z},b.coreCount,SLICE_SAMPLE_LIMIT,globalIndex+7919);}
   for(let s=0;s<SECTION_DEFS.length;s++){const d=SECTION_DEFS[s],y=frame.min.y+d.height*frame.height;if(Math.abs(point.y-y)<=frame.height*.0075&&d.regions.includes(id))reservoir(sectionSamples[s][id],{x:point.x,y,z:point.z},counts[id],SECTION_SAMPLE_LIMIT,globalIndex+s*101);}
  }
  mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));const dominant=Object.entries(byRegion).sort((x,y)=>y[1]-x[1])[0]||['unresolved',0];meshReports.push({mesh:mesh.name,vertices:a.count,dominantRegion:dominant[0],dominantShare:a.count?dominant[1]/a.count:0,regionCounts:byRegion});
 });
 const slices=[];let residualSum=0,residualWeight=0;
 for(let i=0;i<bins.length;i++){const b=bins[i],sample=b.coreSamples.length>=24?b.coreSamples:b.samples;if(!sample.length){slices.push(null);continue;}const minX=quantile(sample,.02,p=>p.x),maxX=quantile(sample,.98,p=>p.x),minZ=quantile(sample,.02,p=>p.z),maxZ=quantile(sample,.98,p=>p.z),cx=quantile(sample,.5,p=>p.x),cz=(minZ+maxZ)/2,width=maxX-minX,residual=width>1e-9?Math.abs((cx-minX)-(maxX-cx))/width:0;residualSum+=residual*b.count;residualWeight+=b.count;slices.push({index:i,y:frame.min.y+(i+.5)/SLICE_COUNT*frame.height,normalizedHeight:(i+.5)/SLICE_COUNT,count:b.count,center:[cx,cz],width,depth:maxZ-minZ,extents:{minX,maxX,minZ,maxZ},symmetryResidual:residual});}
 const sections=SECTION_DEFS.map((d,s)=>({id:d.id,label:d.label,normalizedHeight:d.height,y:frame.min.y+d.height*frame.height,loops:d.regions.flatMap(id=>{const pts=sectionSamples[s][id];if(pts.length<3)return[];const h=convexHull(pts),xs=pts.map(p=>p.x),zs=pts.map(p=>p.z);return[{regionId:id,points:h.map(p=>[p.x,frame.min.y+d.height*frame.height,p.z]),sampleCount:pts.length,width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)}];})}));
 return{schema:HUMAN_SURFACE_ATLAS_SCHEMA,version:'R004',source:{sha256:sourceSHA256,bytes:sourceBytes},units:'source model units',coordinateFrame:{upAxis:'Y',xSides:'X−/X+',frontAxis:'unconfirmed Z sign'},shorts:{state:'preserved',region:'pelvis_shorts',removalDeferred:true},frame:{min:frame.min.toArray(),max:frame.max.toArray(),size:frame.size.toArray(),center:frame.center.toArray(),height:frame.height},regions:REGION_DEFS.map(r=>({id:r.id,label:r.label,color:`#${r.color.toString(16).padStart(6,'0')}`,vertices:counts[r.id],share:totalVertices?counts[r.id]/totalVertices:0})),meshReports,slices,sections,symmetry:{weightedResidual:residualWeight?residualSum/residualWeight:null,method:'slice percentile balance; diagnostic only'},gates:{allSourceVerticesClassified:Object.values(counts).reduce((a,b)=>a+b,0)===totalVertices,primitiveBodyAssembly:false,visualAcceptance:false,productionReady:false}};
}
