import {MeshContact} from './mesh-contact.mjs';
import {triangleCrossing} from './rf37-contact-probe.mjs';
const vec=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const tri=(p,F,f)=>[0,1,2].map(j=>vec(p,F[f+j]));
export class StageProbe {
 constructor(world){
  this.w=world;this.m=world.acceleration.models[1];this.s=this.m.source;this.node=191;this.rows=[];this.step=0;this.totalMS=0;
  this.full=new MeshContact(world.actor.positions.slice(),world.body.faces);this.lower=new MeshContact(world.actor.positions.slice(),world.acceleration.lowerBodyContact.surface.faces);
  let offset=0,found=false;for(const p of this.s.packet.spec.panels){if(p.id==='pant_b_l'){if(this.s.map[offset+212]!==this.node)throw Error('TARGET_TOPOLOGY_CHANGED');found=true;}offset+=p.uvMm.length;}if(!found)throw Error('TARGET_PANEL_MISSING');
  const c=world.acceleration.lowerBodyContact;this.incident=[];for(let f=0;f<this.s.faces.length;f+=3)if([0,1,2].some(j=>this.s.faces[f+j]===this.node))this.incident.push(f);
  this.coverage={node:this.node,panel:'pant_b_l',localVertex:212,totalFineNodes:this.s.count,totalFineTriangles:this.s.faces.length/3,coveredFineNodes:c.vertices.length,coveredFineTriangles:c.triangles.length,fineNodeIncluded:Array.from(c.vertices).includes(this.node),incidentFaces:this.incident,coveredIncidentFaces:this.incident.filter(f=>Array.from(c.triangles).includes(f)),sourceInverseMass:this.s.w[this.node],nativeClearanceM:this.s.settings.clearanceMM*.001,binding:[]};
  for(let j=0;j<8;j++){const k=this.node*8+j,id=this.m.bindingIds[k],weight=this.m.bindingWeights[k];if(id>=0&&weight>0)this.coverage.binding.push({id,weight,dynamicWeight:this.m.weight[id],coarseReferenceClearanceM:this.m.coarseRefs[id].clearance});}
 }
 begin(){this.step=this.w.frameSequence-48+1;if(this.step===7||this.step===8){this.full.refit(this.w.actor.positions.slice());this.lower.refit(this.w.actor.positions.slice());this.at('step-entry');}}
 query(point,target=this.full){const f=target.nearest(...point),q=new Float64Array(4);target.evaluate(f,...point,q);return {distanceM:q[0],faceOffset:f,triangleId:f/3,point:point.slice(),closest:Array.from(target.tmp.subarray(1,4)),direction:Array.from(q.subarray(1)),triangle:tri(target.p,target.faces,f)};}
 reconstructed(){const m=this.m,k=this.node*3,delta=[0,0,0];for(const b of this.coverage.binding)for(let j=0;j<3;j++)delta[j]+=m.delta[b.id*3+j]*b.weight;const normal=vec(m.fineNormals,this.node),dot=delta.reduce((s,x,j)=>s+x*normal[j],0),minimum=this.s.settings.clearanceMM*.001-m.refs[this.node].clearance;const unclamped=vec(m.fineRef,this.node).map((x,j)=>x+delta[j]);let d=0;if(dot<minimum){d=minimum-dot;for(let j=0;j<3;j++)delta[j]+=normal[j]*d;}const point=vec(m.fineRef,this.node).map((x,j)=>x+delta[j]);point[1]=Math.max(this.w.acceleration.floorY+.001,point[1]);return {point,unclamped,reference:vec(m.fineRef,this.node),normal,normalDotM:dot,minimumDotM:minimum,planeCorrectionM:d,referenceClearanceM:m.refs[this.node].clearance};}
 at(stage,detail={}){
  if(this.step!==7&&this.step!==8)return;if(detail.role!=null&&detail.role!==1)return;
  const start=performance.now(),m=this.m,s=this.s,k=this.node*3,before=[s.p[k],s.p[k+1],s.p[k+2],...this.coverage.binding.flatMap(b=>vec(m.delta,b.id))];
  const reconstructed=this.reconstructed(),actual=this.query(vec(s.p,this.node)),raw=this.query(reconstructed.point),pre=this.query(reconstructed.unclamped),lower=this.query(vec(s.p,this.node),this.lower);
  const triangles=this.incident.map(f=>({faceOffset:f,nodes:[s.faces[f],s.faces[f+1],s.faces[f+2]],points:tri(s.p,s.faces,f)}));
  const crossings=triangles.map(t=>({sourceFaceOffset:t.faceOffset,hit:triangleCrossing(t.points,actual.triangle)})).filter(x=>x.hit);
  const coarse=this.coverage.binding.map(b=>{const point=vec(m.ref,b.id).map((v,j)=>v+m.delta[b.id*3+j]);return {...b,delta:vec(m.delta,b.id),velocity:vec(m.velocity,b.id),contact:this.query(point)};});
  const after=[s.p[k],s.p[k+1],s.p[k+2],...this.coverage.binding.flatMap(b=>vec(m.delta,b.id))];if(JSON.stringify(before)!==JSON.stringify(after))throw Error('PHASE_PROBE_CHANGED_NATIVE_VALUES');
  this.rows.push({step:this.step,stage,detail,actualFine:actual,actualFineAgainstLowerSurface:lower,reconstructedPrediction:{...reconstructed,contact:raw,beforePlaneContact:pre},coarse,incidentTriangles:triangles,crossings,readOnlyChecked:true,note:'actualFine can still be last-step positions before reconstruction; reconstructedPrediction is a read-only calculation, not a committed solver update'});this.totalMS+=performance.now()-start;
 }
 report(){return {schema:'kaopu/contact-propagation-trace@1',coverage:this.coverage,rows:this.rows,measurementMS:this.totalMS,phaseScope:[7,8],sourceMutation:false,fullSurfaceCertified:false};}
}
