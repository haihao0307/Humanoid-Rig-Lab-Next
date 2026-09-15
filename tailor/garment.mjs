import {add,sub,mul,dot,cross,len,unit,mix,clamp,smooth,bodySection,normals,orientMesh} from './geometry.mjs';
/* A measured digital fitting candidate. This is NOT a calibrated historical
 * PQD437 cutting pattern, and no cloth dynamics is claimed by this module. */
export function createMeasuredTop(bvh,joints,{easeCm=8,lengthCm=0}={}){
 const hip=joints.hips,t1=joints.T1||joints.C7,shoulders=['left','right'].map(s=>joints[s+'_upperArm']),cx=hip[0];
 const centre=y=>[cx,y,hip[2]+(t1[2]-hip[2])*clamp((y-hip[1])/(t1[1]-hip[1]),0,1)];
 const sy=(shoulders[0][1]+shoulders[1][1])/2,shoulderW=(Math.abs(shoulders[0][0]-cx)+Math.abs(shoulders[1][0]-cx))/2+.016;
 const chestY=sy-.195,waistY=hip[1]+.16,hemY=hip[1]-.12-lengthCm/100,outerY=sy+.035,neckY=joints.C7[1]+.01;
 const chest=bodySection(bvh,centre(chestY)),waist=bodySection(bvh,centre(waistY)),hipS=bodySection(bvh,centre(hip[1]));
 const sections=Array.from({length:15},(_,k)=>bodySection(bvh,centre(hemY+.035+(chestY-hemY-.035)*k/14),48));const torsoMax={rx:Math.max(...sections.map(s=>s.rx)),front:Math.max(...sections.map(s=>s.front)),back:Math.max(...sections.map(s=>s.back))};
 const ease=easeCm/100/(2*Math.PI),minGap=.0035,thickness=.0012;
 const p=[],uv=[],indices=[],seams=[],parts=[],grids={},N=48,M=54,bridgeN=8;
 const sideUnderRow=clamp(Math.round((sy-.215-hemY)/(outerY-hemY)*M),25,M-8),underY=hemY+(outerY-hemY)*sideUnderRow/M;
 const neckCols=Math.max(4,Math.round(.078/shoulderW*N/2)),neckU=neckCols/(N/2);
 function profile(y){let a,b,t;if(y<=waistY){a=hipS;b=waist;t=clamp((y-hip[1])/(waistY-hip[1]),0,1);}else{a=waist;b=chest;t=clamp((y-waistY)/(chestY-waistY),0,1);}const o={};for(const k of ['rx','front','back'])o[k]=Math.max(a[k]+(b[k]-a[k])*t,torsoMax[k])+ease+.004;const top=smooth((y-chestY)/(outerY-chestY));o.rx=o.rx*(1-top)+shoulderW*top;return o;}
 function vtx(pos,c){const i=p.length/3;p.push(...pos);uv.push(...c);return i;}
 function quad(a,b,c,d,flip=false){if(flip)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d);}
 function pos(id){return p.slice(id*3,id*3+3);}
 const chestWidth=chest.circumference/2+easeCm/200;
 for(const front of [true,false]){const name=front?'front.shell × 2':'back.shell × 1',start=indices.length,grid=[];
  for(let j=0;j<=M;j++){const row=[];for(let i=0;i<=N;i++){const u=i/N*2-1,au=Math.abs(u);let top;
   if(au<neckU)top=neckY-(front?.077:.021)*Math.sqrt(Math.max(0,1-(au/neckU)**2));else top=neckY+(outerY-neckY)*(au-neckU)/(1-neckU);
   const y=hemY+(top-hemY)*j/M,pr=profile(y),at=smooth((j/M-.88)/.12),half=pr.rx*(1-at)+shoulderW*at-.025*Math.sin(Math.PI*smooth((y-underY)/(outerY-underY))),x=cx+u*half,zc=centre(y)[2];
   const edge=(.050*smooth((y-underY)/(outerY-underY))+.014*Math.exp(-(((y-chestY)/.045)**2)))*Math.pow(au,8),zshape=(front?pr.front:-pr.back)*Math.pow(Math.max(0,1-Math.abs(u)**2.6),1/2.6)+(front?edge:-edge);
   let z=zc+zshape;const ray=bvh.ray([x,y,zc+(front?.48:-.48)],[0,0,front?-1:1],.85);
   if(ray&&Math.abs(ray.p[2]-zc)<.28)z=front?Math.max(z,ray.p[2]+.016):Math.min(z,ray.p[2]-.016);
   row.push(vtx([x,y,z],[(i/N-.5)*chestWidth*100,(y-hemY)*100]));
  }grid.push(row);}
  for(let j=0;j<M;j++)for(let i=0;i<N;i++)quad(grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i],!front);
  parts.push({id:name,firstTriangle:start/3,triangleCount:(indices.length-start)/3});grids[front?'front':'back']=grid;
 }
 const F=grids.front,B=grids.back,outerBridge={};
 // Material coordinates are measured on each generated panel edge in centimetres,
 // not normalized 0..1 UVs stretched across the whole garment.
 for(const grid of [F,B]){const vv=Array.from({length:N+1},()=>0);for(let j=0;j<=M;j++){const arc=[0];for(let i=1;i<=N;i++)arc.push(arc.at(-1)+len(sub(pos(grid[j][i]),pos(grid[j][i-1]))));for(let i=0;i<=N;i++){if(j)vv[i]+=len(sub(pos(grid[j][i]),pos(grid[j-1][i])));uv[grid[j][i]*2]=(arc[i]-arc[N/2])*100;uv[grid[j][i]*2+1]=vv[i]*100;}}}
 for(const edge of [0,N]){const line=[];for(let j=0;j<=sideUnderRow;j++){line.push(F[j][edge]);if(j<sideUnderRow)quad(F[j][edge],B[j][edge],B[j+1][edge],F[j+1][edge],edge===0);}seams.push(line);}
 // Both shoulder bridges belong to front/back sewn shoulder allowances.
 for(const side of [-1,1]){const from=side<0?0:N/2+neckCols,to=side<0?N/2-neckCols:N,grid=[];
  for(let j=0;j<=bridgeN;j++){const row=[];for(let i=from;i<=to;i++){
   if(j===0)row.push(F[M][i]);else if(j===bridgeN)row.push(B[M][i]);else{const q=mix(pos(F[M][i]),pos(B[M][i]),j/bridgeN);q[1]+=.004*Math.sin(j/bridgeN*Math.PI);const above=bvh.ray([q[0],q[1]+.06,q[2]],[0,-1,0],.12);if(above)q[1]=Math.max(q[1],above.p[1]+.006);row.push(vtx(q,[(i/N-.5)*chestWidth*100,((q[1]-hemY)+.10*j/bridgeN)*100]));}
  }grid.push(row);}
  const cols=to-from;for(let j=0;j<bridgeN;j++)for(let i=0;i<cols;i++)quad(grid[j][i],grid[j+1][i],grid[j+1][i+1],grid[j][i+1],true);
  const edgeIndex=side<0?0:cols;outerBridge[side]=grid.map(row=>row[edgeIndex]);seams.push(grid[Math.round(bridgeN/2)]);
 }
 const sleeveMetrics={};
 for(const label of ['left','right']){const S=joints[label+'_upperArm'],E=joints[label+'_forearm'],W=joints[label+'_hand'];sleeveMetrics[label]={bodyLengthCm:(len(sub(E,S))+len(sub(W,E)))*100,garmentLengthCm:null,cuffCircumferenceCm:null};}
 seams.push(F[0],B[0],F.map(r=>r[N/2]),F[M].slice(N/2-neckCols,N/2+neckCols+1),B[M].slice(N/2-neckCols,N/2+neckCols+1));
 // Do not displace against unreliable nearest-face signs; validate by ray parity.
 const corrected=0,maxCorrection=0;
 // Smooth normals are welded at coincident pattern seams; UVs remain per-panel cm.
 const i32=Uint32Array.from(indices),p32=Float32Array.from(p),n=normals(p32,i32),groups=new Map();for(let k=0;k<p.length/3;k++){const key=p.slice(k*3,k*3+3).map(v=>Math.round(v*1e6)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(k);}for(const ids of groups.values()){const total=unit(ids.reduce((a,id)=>add(a,Array.from(n.slice(id*3,id*3+3))),[0,0,0]));for(const id of ids)n.set(total,id*3);}
 const garmentSections={};for(const [name,y] of [['chest',chestY],['waist',waistY]]){const pr=profile(y);let circumference=0,previous=null;for(let k=0;k<=128;k++){const a=k/128*Math.PI*2,q=[pr.rx*Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**(2/2.6),0,(Math.cos(a)>=0?pr.front:pr.back)*Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**(2/2.6)];if(previous)circumference+=len(sub(q,previous));previous=q;}garmentSections[name]=circumference;}
 const metrics={body:{heightCm:null,chestCm:chest.circumference*100,waistCm:waist.circumference*100,hipCm:hipS.circumference*100,shoulderJointWidthCm:len(sub(shoulders[0],shoulders[1]))*100},garment:{chestEnvelopeCm:garmentSections.chest*100,waistEnvelopeCm:garmentSections.waist*100,shoulderWidthCm:shoulderW*200,lengthCm:(neckY-hemY)*100,sleeves:sleeveMetrics},requestedEaseCm:easeCm,sectionMissingRays:chest.missing+waist.missing+hipS.missing,vertices:p.length/3,triangles:indices.length/3,correctionEvents:corrected,maxCorrectionMm:maxCorrection*1000,measurementMethod:'actual posed-skin triangle rays; analytic garment envelope estimate, not final sewn circumference',garmentType:'sleeveless-fitting-toile',productionPatternApproved:false,visualApproved:false};
 return {p:p32,n,uv:Float32Array.from(uv),indices:i32,seams,parts,metrics,thickness,parameters:{easeCm,lengthCm},centre:centre((neckY+hemY)/2),chestTarget:centre(chestY),neckTarget:centre(neckY-.025),hemY,neckY};
}
export function sampleClearance(mesh,bvh){let min=Infinity,violations=0,samples=0,insideSamples=0,ambiguous=0;const examples=[];const parity=(p,d)=>{let o=p,count=0;for(let k=0;k<24;k++){const h=bvh.ray(o,d,4);if(!h)return count%2;o=add(h.p,mul(d,.000002));count++;}return null;};
 const check=p=>{const d=unit([p[0]-mesh.centre[0]+.00013,.0071,p[2]-mesh.centre[2]+.00017]);let inside=parity(p,d),hit=bvh.nearest(p,.035);if(inside===null){ambiguous++;samples++;return;}
 if(inside===1){const b=parity(p,unit([.371,.529,.764])),c=parity(p,unit([-.615,.231,.754]));if(b===null||c===null)ambiguous++;inside=(1+(b??0)+(c??0))>=2?1:0;}
 if(inside){insideSamples++;if(!hit)hit=bvh.nearest(p,.2);}if(hit){const gap=inside?-hit.distance:hit.distance;min=Math.min(min,gap);if(gap<mesh.thickness*.5+.00035){violations++;if(examples.length<24)examples.push({p,gapMm:gap*1000,inside:!!inside});}}else if(inside)violations++;samples++;};
 for(let k=0;k<mesh.p.length;k+=3)check(Array.from(mesh.p.slice(k,k+3)));for(let k=0;k<mesh.indices.length;k+=3){const points=Array.from(mesh.indices.slice(k,k+3)).map(i=>Array.from(mesh.p.slice(i*3,i*3+3)));check(mul(points.reduce((a,b)=>add(a,b),[0,0,0]),1/3));for(let j=0;j<3;j++)check(mix(points[j],points[(j+1)%3],.5));}
 return {samples,minSampledMidSurfaceGapMm:Number.isFinite(min)?min*1000:null,requiredGapMm:mesh.thickness*500+.35,violatingSamples:violations,insideSamples,ambiguousSamples:ambiguous,examples,classification:'triangle-ray parity; initially interior samples cross-checked with two oblique rays; absolute nearest triangle distance',scope:'vertices + every triangle centroid + edge midpoints, fixed fitting pose; no continuous collision certificate'};
}
