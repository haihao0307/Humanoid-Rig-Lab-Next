// Spatial equality elimination only for an actually completed source stitch.
// Original material vertices, UVs, masses and swept previous positions remain
// distinct. Every constraint must aggregate its gradients before projection.
function createShortsStitchDofs(particles,{joinTolerance=.005}={}){
 if(!Array.isArray(particles)||!particles.length||!(joinTolerance>=0)||!Number.isFinite(joinTolerance))throw Error('Invalid source stitch DOFs');
 const groups=new Map(),owner=[];let joins=0;
 const finite3=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
 for(let i=0;i<particles.length;i++){const p=particles[i];if(!(p.mass>0)||!Number.isFinite(p.mass)||!(p.invMass>=0)||!Number.isFinite(p.invMass)||!finite3(p.pos))throw Error('Invalid physical source material particle');groups.set(i,{id:i,members:[i],mass:p.mass,fixed:p.invMass===0,position:[...p.pos],velocity:[...(p.velocity||[0,0,0])]});owner[i]=i;}
 const assign=g=>{for(const i of g.members)for(let k=0;k<3;k++)particles[i].pos[k]=g.position[k];};
 // Calls are synchronous. Reuse internal scratch, keeping exactly the former
 // Map's first-occurrence order and scalar accumulation/multiplication order.
 // No scratch array escapes through the public results or source particles.
 const marks=new Uint32Array(particles.length),sums=new Float64Array(particles.length*3),deltas=new Float64Array(particles.length*3),ordered=[];let stamp=0;
 const collect=(indices,gradients)=>{if(!Array.isArray(indices)||!Array.isArray(gradients)||indices.length!==gradients.length)throw Error('Invalid material gradients');stamp=(stamp+1)>>>0;if(stamp===0){marks.fill(0);stamp=1;}let count=0;for(let j=0;j<indices.length;j++){const id=owner[indices[j]];if(!Number.isInteger(indices[j])||!groups.has(id)||!finite3(gradients[j]))throw Error('Invalid source gradient');const offset=id*3;if(marks[id]!==stamp){marks[id]=stamp;ordered[count++]=groups.get(id);sums[offset]=0;sums[offset+1]=0;sums[offset+2]=0;}for(let k=0;k<3;k++)sums[offset+k]+=gradients[j][k];}return count;};
 const denominator=count=>{let result=0;for(let j=0;j<count;j++){const group=ordered[j],offset=group.id*3;if(!group.fixed)result+=(sums[offset]*sums[offset]+sums[offset+1]*sums[offset+1]+sums[offset+2]*sums[offset+2])/group.mass;}return result;};
 return {
  same(a,b){return owner[a]!==undefined&&owner[a]===owner[b];},
  join(a,b,{started=false,closureProgress=0}={}){
   if(!started||closureProgress!==1)throw Error('Only completed actual stitches can share a spatial degree of freedom');
   const left=groups.get(owner[a]),right=groups.get(owner[b]);if(!left||!right)throw Error('Unknown source stitch endpoint');if(left===right)return false;
   const gap=Math.hypot(...left.position.map((v,k)=>v-right.position[k]));if(gap>joinTolerance)return false;
   if(left.fixed&&right.fixed&&gap>1e-12)return false;
   const mass=left.mass+right.mass,fixed=left.fixed||right.fixed,hold=left.fixed?left:right;
   const merged={id:left.id,members:[...left.members,...right.members],mass,fixed,position:fixed?[...hold.position]:left.position.map((v,k)=>(v*left.mass+right.position[k]*right.mass)/mass),velocity:fixed?[0,0,0]:left.velocity.map((v,k)=>(v*left.mass+right.velocity[k]*right.mass)/mass)};
   groups.delete(right.id);groups.set(left.id,merged);for(const i of merged.members)owner[i]=left.id;assign(merged);joins++;return true;
  },
  effectiveInverseMass(indices,gradients){return denominator(collect(indices,gradients));},
  project(indices,gradients,value,{alpha=0,lambda=0,tensionOnly=false,minimumLambda}={}){
   if(!Number.isFinite(value)||!Number.isFinite(alpha)||alpha<0||!Number.isFinite(lambda))throw Error('Invalid source scalar constraint');
   if(minimumLambda!==undefined&&(!Number.isFinite(minimumLambda)||(tensionOnly&&minimumLambda>0)))throw Error('Invalid source multiplier lower bound');
   const count=collect(indices,gradients),den=denominator(count);if(den<=1e-30)return {lambda,deltaLambda:0,denominator:den,applied:false,aggregatedDegrees:count};
   const candidate=lambda+(-value-alpha*lambda)/(den+alpha),unbounded=tensionOnly?Math.min(0,candidate):candidate,next=minimumLambda===undefined?unbounded:Math.max(minimumLambda,unbounded),deltaLambda=next-lambda;if(!Number.isFinite(deltaLambda))throw Error('Nonfinite source constraint correction');
   let movableCount=0;for(let j=0;j<count;j++){const group=ordered[j];if(group.fixed)continue;const offset=group.id*3;for(let k=0;k<3;k++)deltas[offset+k]=sums[offset+k]*deltaLambda/group.mass;for(let k=0;k<3;k++)if(!Number.isFinite(group.position[k]+deltas[offset+k]))throw Error('Nonfinite source position');movableCount++;}
   for(let j=0;j<count;j++){const group=ordered[j];if(group.fixed)continue;const offset=group.id*3;for(let k=0;k<3;k++)group.position[k]+=deltas[offset+k];assign(group);}
   return {lambda:next,deltaLambda,denominator:den,applied:deltaLambda!==0&&movableCount>0,aggregatedDegrees:count};
  },
  beginStep(h,{gravity=[0,-9.81,0],damping=0}={}){
   if(!(h>0)||!Number.isFinite(h)||!finite3(gravity)||!(damping>=0)||!Number.isFinite(damping))throw Error('Invalid DOF integration');
   for(const p of particles)p.previous=[...p.pos];
   const attenuation=Math.exp(-damping*h);for(const g of groups.values()){if(g.fixed)continue;for(let k=0;k<3;k++){g.velocity[k]=(g.velocity[k]+gravity[k]*h)*attenuation;g.position[k]+=g.velocity[k]*h;}assign(g);}
  },
  endStep(h){if(!(h>0)||!Number.isFinite(h))throw Error('Invalid DOF velocity step');for(const g of groups.values()){const previous=[0,0,0];for(const i of g.members)for(let k=0;k<3;k++)previous[k]+=particles[i].mass*particles[i].previous[k]/g.mass;for(let k=0;k<3;k++)g.velocity[k]=g.fixed?0:(g.position[k]-previous[k])/h;for(const i of g.members)particles[i].velocity=[...g.velocity];}},
  report(){return {enabled:true,method:'completed_source_stitch_spatial_equality_elimination',sourceParticleCount:particles.length,spatialDofCount:groups.size,joinedStitchCount:joins,totalMass:[...groups.values()].reduce((sum,g)=>sum+g.mass,0),originalMaterialIdentityPreserved:true,groups:[...groups.values()].filter(g=>g.members.length>1).map(g=>({members:[...g.members],mass:g.mass,fixed:g.fixed}))};}
 };
}
