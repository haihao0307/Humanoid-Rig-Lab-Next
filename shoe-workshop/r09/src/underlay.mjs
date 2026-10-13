import {inside} from '../../r03b/src/surface.mjs';
import {inward,resample,SeamField,sub,unit,add,mul,dist,smooth,mix} from '../../r07/src/geometry.mjs';
/** Repair the actual vamp cut under the quarter-to-facing turn. Previously the
 * receiving sheet ended on the needle row, forcing valid stitches to be omitted.
 * This adds a bounded, hidden seam allowance; not a line drawn across empty space. */
export function extendTransitionUnderlay(m){
 const D=m.domains[28],old=D.loop,field=new SeamField();field.cell=4;
 for(const id of [22,23]){const A=m.domains[id],curve=resample(inward(A.loop,q=>A.at(q).p,2),q=>A.at(q).p,.6,true);for(let i=0;i<curve.length;i++){const p=A.at(curve[i]).p,q=A.at(curve[(i+1)%curve.length]).p;if(p[1]>54&&p[1]<73&&p[2]>-12&&p[2]<27)field.put(p,q);}}
 let area=0;for(let i=0;i<old.length;i++){const a=old[i],b=old[(i+1)%old.length];area+=a[0]*b[1]-a[1]*b[0];}const sign=area>=0?1:-1,changed=[];
 const next=old.map((q,i)=>{
  const p=D.at(q).p;if(p[1]<49||p[1]>76||p[2]<-18||p[2]>33||Math.abs(p[0])<9)return q.slice();
  const d=field.sample(p).distance,w=1-smooth((d-1.4)/4.6);if(w<1e-6)return q.slice();
  const tangent=unit(sub(old[(i+1)%old.length],old[(i+old.length-1)%old.length])),direction=[tangent[1]*sign,-tangent[0]*sign],target=3.5*w;
  let step=target/Math.max(.05,dist(D.at(add(q,mul(direction,.1))).p,p)/.1),v;
  for(let j=0;j<4;j++){v=add(q,mul(direction,step));step*=target/Math.max(.05,dist(D.at(v).p,p));}v=add(q,mul(direction,step));
  const A=m.domains[p[0]>0?22:23],covered=t=>{const h=D.at(t),a=A.fromWorld(h.p);return a&&inside(a,A.loop)&&!A.sourceHoles.some(h=>inside(a,h));};
  // New receiving allowance stays behind the covering quarter, away from its
  // source eyelets. Failed coverage retains only the bounded safe interval.
  if(!covered(v)){let lo=0,hi=1;for(let j=0;j<18;j++){const t=(lo+hi)/2;if(covered(mix(q,v,t)))lo=t;else hi=t;}v=mix(q,v,lo*.995);}
  const moveMm=dist(D.at(v).p,p);if(moveMm>.02)changed.push({index:i,from:q.slice(),to:v.slice(),fromWorld:p,toWorld:D.at(v).p,moveMm,coveredBy:A.id});return v;
 });
 D.loop=next;D.fromWorld=p=>{try{const q=D.atlas.project([p[2]+464,p[0]-1402,p[1]-14]).map(v=>v*D.atlas.targetScale);return inside(q,D.loop)?q:null;}catch{return null;}};
 const piece=m.pieces.get(28);m.pieces.set(28,{...piece,derivedCut:true,footprints:[{...piece.footprints[0],outer:D.loop.map(D.toRest)}]});
 m.craftSupportReport={id:28,purpose:'real hidden seam allowance beneath facing turns',count:changed.length,maxMoveMm:Math.max(0,...changed.map(v=>v.moveMm)),changes:changed,rawCutUnchanged:true};
}
