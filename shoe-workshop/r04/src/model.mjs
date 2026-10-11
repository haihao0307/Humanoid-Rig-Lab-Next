import * as T from 'three';
import {ShoeAssembly as R03B,PARTS as OLD_PARTS,defaultState as oldDefault,validate as oldValidate} from '../../r03b/src/model.mjs';
import {MeshRay,boundaryDistance,norm,makeTemplate,makeShell} from '../../r03b/src/surface.mjs';
import {transferredSaddle} from './sewing.mjs';
export const VERSION='R04.0';
export const PARTS=OLD_PARTS.map(p=>({...p,name:p.name.replace(' · 对应候选','')}));
export const LEATHER_IDS=['heritage','tan','wax','black','nubuck','cross','croco','ostrich','suede','vintage','patent','metallic','pearl'];
export const defaultState=()=>({...oldDefault(),revisionTag:'R04',leatherId:'heritage',laces:true,threadDiameter:.32});
export function validate(s){const old=oldValidate(s);if(!LEATHER_IDS.includes(s.leatherId))throw Error('皮革预设不属于指定 R10');if(typeof s.laces!=='boolean')throw Error('鞋带开关非法');if(!Number.isFinite(s.threadDiameter)||s.threadDiameter<.24||s.threadDiameter>.5)throw Error('线径超出本轮范围');return {...old,revisionTag:'R04',leatherId:s.leatherId,laces:s.laces,threadDiameter:s.threadDiameter};}
const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Current geometry derived from the existing source mappings, not a new replacement shoe. */
export class ShoeAssembly extends R03B{
 constructor(data,outsole){super(data,outsole);this.registration=this.registerSole();this.laceCache=null;}
 createSeams(){
  // P20 and P21 previously used unrelated radial fields and an 8.18mm air bridge.
  // Give the first 4.7mm of P20 a lap on the existing P21 surface, then C1 blend back.
  const original20=this.maps[20],long=this.maps[21];
  this.maps[20]=(x,y)=>{const a=long(x-4.7,y),b=original20(x,y),w=smooth(-832,-815,x);return {p:mix(a.p,b.p,w),n:norm(mix(a.n,b.n,w))};};
  super.createSeams();const prior=this.seams.filter(s=>s.id!=='binding-turn');this.seams=[];this.holes=Object.fromEntries(PARTS.map(p=>[p.id,[]]));
  for(const seam of prior)this.addSeam(seam.id,seam.a,seam.b,seam.pairs,seam.description);
  this.addSeam('binding-turn',20,21,Array.from({length:5},(_,i)=>({a:[-834.3,-703.7+i*2.5],b:[-839,-703.7+i*2.5]})),'P20 端部 4.7mm 几何搭接，复用 P21 表面，非原 CAD 自带缝份');
 }
 registerSole(){
  const ray=new MeshRay(this.data.last),gaps=[];
  for(let x=346;x<588;x+=4)for(let y=-1445;y<-1350;y+=4){const h=ray.ray([x,y,-100],[0,0,1]),s=this.soleRay.ray([-x-151.8,-y-2006.2,150],[0,0,-1]);if(h&&s&&Math.abs(h.n[2])>.75)gaps.push(h.p[2]+14-(s.p[2]+1.3));}
  if(gaps.length<100)throw Error('鞋底对应测点不足');gaps.sort((a,b)=>a-b);const q=p=>gaps[Math.min(gaps.length-1,Math.floor(p*gaps.length))];return {samples:gaps.length,medianBeforeMm:q(.5),p05BeforeMm:q(.05),p95BeforeMm:q(.95),rawMinBeforeMm:q(0),rawMaxBeforeMm:q(1),method:'Overlapping source surfaces: upward last-underside ray vs downward native outsole-top ray; robust vertical registration. Not contact dynamics.'};
 }
 soleLift(s){return this.registration.medianBeforeMm-s.thickness[19]-.1-.65;}
 offsets(th){return {28:.65,22:.69+th[28],23:.69+th[28],24:.73+th[28]+th[22],25:.73+th[28]+th[23],27:.69+th[28],21:.73+th[28]+Math.max(th[22],th[23]),20:.77+th[28]+Math.max(th[22],th[23])+th[21],19:.1};}
 build(s){s=validate(s);this.state=s;const parts=super.build(s);for(const p of parts){const g=p.geometry,n=g.userData.vertexPairs,template=g.userData.template,pos=g.attributes.position.array,ns=g.attributes.normal.array,uv=g.attributes.uv.array,expected=new Float32Array(n),rest=template.restUV||template.vertices;const area=this.pieces.get(p.id).footprints[0];
   for(let i=0;i<n;i++){const q=rest[i];let t=s.thickness[p.id];if(p.kind==='patch')t*=.55+.45*smooth(0,2.0,boundaryDistance(q,area.outer));expected[i]=t;const delta=t-s.thickness[p.id];for(let k=0;k<3;k++)pos[(n+i)*3+k]+=ns[(n+i)*3+k]*delta;uv[i*2]=uv[(i+n)*2]=(q[0]+1200)/96;uv[i*2+1]=uv[(i+n)*2+1]=(q[1]+900)/96;}
   // Boundary wall duplicates must follow the changed outer thickness as well.
   const logical=g.userData.logicalIndices;for(let i=n*2;i<logical.length;i++){const j=logical[i];for(let k=0;k<3;k++)pos[i*3+k]=pos[j*3+k];uv[i*2]=uv[j*2];uv[i*2+1]=uv[j*2+1];}
   if(p.id===19&&s.view!=='flat')for(let i=1;i<pos.length;i+=3)pos[i]+=this.soleLift(s);
   // Give grain, flesh and cut edges independent material roles, not one double-sided shader.
   const raw=Array.from(g.index.array),face=template.triangles.length,outer=[],inner=[];for(let i=0;i<face;i++){outer.push(...raw.slice(i*6,i*6+3));inner.push(...raw.slice(i*6+3,i*6+6));}const edges=raw.slice(face*6);g.setIndex([...outer,...inner,...edges]);g.clearGroups();g.addGroup(0,outer.length,0);g.addGroup(outer.length,inner.length,1);g.addGroup(outer.length+inner.length,edges.length,2);
   g.setAttribute('compression',new T.Float32BufferAttribute(new Float32Array(pos.length/3),1));g.userData.expectedThickness=expected;g.userData.report.skivedEdge=p.kind==='patch';g.userData.report.restUVTileMm=96;g.computeBoundingBox();g.computeBoundingSphere();
  }this.currentParts=parts;return parts;}
 outsoleGeometry(s=this.state||defaultState()){const g=super.outsoleGeometry();g.translate(0,this.soleLift(s),0);return g;}
 stations(seam,s){const offset=this.offsets(s.thickness);return seam.pairs.map(pair=>{const a=this.maps[seam.a](...pair.a),b=this.maps[seam.b](...pair.b);return {outer:add(a.p,a.n.map(v=>v*(offset[seam.a]+s.thickness[seam.a]))),inner:add(b.p,b.n.map(v=>v*offset[seam.b])),n:a.n,gap:Math.hypot(...sub(a.p,b.p))};});}
 threadPaths(s){const paths=[];for(const seam of this.seams){const stations=this.stations(seam,s);const transfer=transferredSaddle(stations,s.threadDiameter||.32);for(const [i,p]of transfer.entries())paths.push({...p,id:seam.id+(i?'-'+i:''),a:seam.a,b:seam.b,stations,count:stations.length,maxBaseResidualMm:Math.max(...stations.map(h=>h.gap))});}return paths;}
 eyelets(s){const out=[];for(const id of [22,23])for(const [index,loop]of this.pieces.get(id).footprints[0].holes.entries()){const lo=[Math.min(...loop.map(q=>q[0])),Math.min(...loop.map(q=>q[1]))],hi=[Math.max(...loop.map(q=>q[0])),Math.max(...loop.map(q=>q[1]))],q=mix(lo,hi,.5),f=this.maps[id](...q),o=this.offsets(s.thickness)[id];out.push({id,index,q,loop,inner:add(f.p,f.n.map(v=>v*(o-.35))),outer:add(f.p,f.n.map(v=>v*(o+s.thickness[id]+.5))),n:f.n});}return out;}
 lacing(s){const eyes=this.eyelets(s),left=eyes.filter(e=>e.id===22).sort((a,b)=>b.outer[2]-a.outer[2]),right=eyes.filter(e=>e.id===23).sort((a,b)=>b.outer[2]-a.outer[2]);const v=p=>new T.Vector3(...p),paths=[];
  const cross=(a,b,raise=4)=>{const center=v(a).lerp(v(b),.5);center.y=Math.max(a[1],b[1])+raise;return [v(a),v(a).lerp(center,.5),center,v(b).lerp(center,.5),v(b)];};
  // One lace: through existing four source holes, two real crossings, two free ends.
  const L0=left[0],L1=left[1],R0=right[0],R1=right[1];const mid=v(L1.outer).lerp(v(R1.outer),.5);mid.y=Math.max(L1.outer[1],R1.outer[1])+7;mid.z-=1;
  const route=[mid.clone().add(new T.Vector3(10,-3,-14)),mid.clone().add(new T.Vector3(18,2,-7)),mid.clone().add(new T.Vector3(16,3,4)),mid.clone(),...cross(mid.toArray(),L1.outer,1).reverse().reverse(),v(L1.inner),...cross(L1.inner,R0.inner,3).slice(1),v(R0.outer),...cross(R0.outer,L0.outer,3).slice(1),v(L0.inner),...cross(L0.inner,R1.inner,5).slice(1),v(R1.outer),...cross(R1.outer,mid.toArray(),2).slice(1),mid.clone().add(new T.Vector3(-15,3,5)),mid.clone().add(new T.Vector3(-17,2,-7)),mid.clone(),mid.clone().add(new T.Vector3(-11,-3,-17))];
  const curve=new T.CatmullRomCurve3(route,false,'centripetal');const host=this.currentParts?.find(p=>p.id===28),mesh=host?new T.Mesh(host.geometry,new T.MeshBasicMaterial({side:T.DoubleSide})):null,ray=new T.Raycaster();const points=curve.getPoints(600).map(v=>{if(mesh&&!eyes.some(e=>v.distanceTo(new T.Vector3(...e.outer))<4)){ray.set(new T.Vector3(v.x,250,v.z),new T.Vector3(0,-1,0));const h=ray.intersectObject(mesh)[0];if(h)v.y=Math.max(v.y,h.point.y+1.0);}return v.toArray();});mesh?.material.dispose();paths.push({id:'one-lace-four-source-eyelets',points,diameter:2.0,normalHint:[0,1,0],originalHoleCount:4,geometryOnly:true});return {eyes,paths};
 }
 eyeletGeometries(s){return this.eyelets(s).map(e=>{const ring=factor=>e.loop.map(q=>q.map((v,k)=>e.q[k]+(v-e.q[k])*factor));const template=makeTemplate([{outer:ring(1.22),holes:[ring(1.0)]}],[],2);return {...e,geometry:makeShell(template,this.maps[e.id],.42,this.offsets(s.thickness)[e.id]+s.thickness[e.id]-.04)};});}
 report(s,parts){const r=super.report(s,parts),lift=this.soleLift(s);return {...r,version:VERSION,materialDonor:'af389cc216ddd01e3b1aa66c972f42b2587bc797/leather-workshop/r10',leatherId:s.leatherId,registration:{...this.registration,liftMm:lift,stackMm:s.thickness[19]+.1+.65,p05StackResidualMm:this.registration.p05BeforeMm-this.registration.medianBeforeMm,p95StackResidualMm:this.registration.p95BeforeMm-this.registration.medianBeforeMm},rearLapBaseResidualMm:Math.max(...this.stations(this.seams.find(t=>t.id==='binding-turn'),s).map(h=>h.gap)),laceSourceHoles:4,physicalSolver:false,fullShellSelfIntersectionVerified:false,manufacturingApproved:false};}
}
