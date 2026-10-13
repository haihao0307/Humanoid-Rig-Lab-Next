/** Bounded interlace assembly seating, not post-animation hiding of collisions.
 * Only interlaced ribbons may move. Backing, templates, rest lengths, material
 * coefficients and seam constraints remain unchanged. Failure is explicit.
 */
export class ReadyLeatherShell extends ImplicitLeatherShell {
 constructor(data,options={}){super(data,options);this.initialization=null;
  if(!data.partNames?.some(n=>n.startsWith('woven-'))||!this.contact)return;
  const before=this.contact.initialAudit;if(before.penetrating===0)return;
  const original=this.x.slice(),movable=data.nodeParts.map(i=>data.partNames[i]?.startsWith('woven-'));
  let iteration=0,maximum=0,after=before;const epsilon=.00008;
  for(;iteration<18;iteration++){
   let maximumViolation=0;
   const pairs=this.contact.candidates(this.x,this.x,epsilon);
   for(const p of pairs){if(this.contact.sewnNeighbour(p))continue;const q=(p.pt?closestPT:closestEE)(this.x,p.ids),violation=p.gap+epsilon-q.d;if(violation<=0)continue;
    if(q.d<1e-9){this.failed='Interlace initially intersects; bounded seating refuses an ambiguous crossing';break;}
    let sum=0;for(let k=0;k<4;k++)if(movable[p.ids[k]])sum+=q.w[k]*q.w[k];if(sum<1e-12)continue;
    const step=Math.min(violation*.85,.00012)/sum;for(let k=0;k<4;k++)if(movable[p.ids[k]])for(let j=0;j<3;j++)this.x[3*p.ids[k]+j]+=step*q.w[k]*q.n[j];maximumViolation=Math.max(maximumViolation,violation);
   }
   maximum=0;for(let i=0;i<this.x.length;i+=3)maximum=Math.max(maximum,Math.hypot(this.x[i]-original[i],this.x[i+1]-original[i+1],this.x[i+2]-original[i+2]));
   if(this.failed||maximum>.001){this.failed=this.failed||'Interlace seating exceeds the explicit 1 mm assembly limit';break;}
   if(maximumViolation<epsilon*.2)break;
  }
  after=this.contact.audit(this.x);
  if(after.penetrating||after.minClearanceMM!==null&&after.minClearanceMM<=.001)this.failed=this.failed||'Interlace thickness clearance has not converged; physics held for review';
  this.initialization={method:'bounded ribbon-only finite-thickness assembly seating',restGeometryChanged:false,iterations:iteration+1,maximumDisplacementMM:maximum*1000,before,after,accepted:!this.failed};
  if(this.failed){this.x.set(original);this.active=false;return;}
  this.prev.set(this.x);this.v.fill(0);this.startPose=this.x.slice();this.contact.initialAudit=after;this.contact.stats.initialOverlaps=after.penetrating;this.contact.stats.initialMinGapMM=after.minClearanceMM;
 }
 reset(){super.reset();if(this.startPose){this.x.set(this.startPose);this.prev.set(this.x);}if(this.initialization&&!this.initialization.accepted){this.failed='Interlace assembly remains unverified';this.active=false;}}
 report(){return{...super.report(),initialization:this.initialization||null,convergedToR04Residual:!this.failed&&this.steps>0&&this.lastResidual<.0002};}
}
