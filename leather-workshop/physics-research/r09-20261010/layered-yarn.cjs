'use strict';
// Explicit two-carrier embedding for a sewn passage. Reference implementation,
// not an independent yarn friction/tension model. Callers must supply semantic
// front/back panel anchors; never choose an owner using camera/world direction.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unit(a){const l=Math.hypot(...a);if(l<1e-12)throw Error('Degenerate frame');return a.map(v=>v/l);}
function frame(ids,weights,palette){
 let p=[0,0,0],t=[0,0,0],n=[0,0,0];
 for(let k=0;k<ids.length;k++){const i=ids[k]*12,w=weights[k];for(let j=0;j<3;j++){p[j]+=w*palette[i+j];t[j]+=w*palette[i+4+j];n[j]+=w*palette[i+8+j];}}
 n=unit(n);const along=dot(t,n);t=unit(t.map((x,i)=>x-n[i]*along));return{p,t,y:cross(n,t),n};
}
function anchor(ids,weights,restPoint,palette){
 if(ids.length!==weights.length||Math.abs(weights.reduce((s,w)=>s+w,0)-1)>1e-7)throw Error('Invalid material anchor');
 const f=frame(ids,weights,palette),d=restPoint.map((v,i)=>v-f.p[i]);
 return{ids:[...ids],weights:[...weights],delta:[dot(d,f.t),dot(d,f.y),dot(d,f.n)]};
}
function evaluateAnchor(a,palette){const f=frame(a.ids,a.weights,palette);return f.p.map((p,j)=>p+f.t[j]*a.delta[0]+f.y[j]*a.delta[1]+f.n[j]*a.delta[2]);}
function bindPassage(front,back,depthFromFront){
 if(!Number.isFinite(depthFromFront)||depthFromFront<0||depthFromFront>1)throw Error('Invalid depth fraction');
 return{front,back,blend:depthFromFront,mode:'explicit material-side passage'};
}
function evaluatePassage(p,palette){const a=evaluateAnchor(p.front,palette),b=evaluateAnchor(p.back,palette);return a.map((v,i)=>v*(1-p.blend)+b[i]*p.blend);}
module.exports={anchor,frame,evaluateAnchor,bindPassage,evaluatePassage};
