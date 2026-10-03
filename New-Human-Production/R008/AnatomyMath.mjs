export const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),length=a=>Math.hypot(...a),unit=a=>mul(a,1/Math.max(1e-12,length(a))),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function projection(p,a,b){const d=sub(b,a);return clamp(dot(sub(p,a),d)/Math.max(1e-12,dot(d,d)));}
export const segmentPoint=(p,a,b)=>lerp(a,b,projection(p,a,b));
export function quantile(values,q){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*q,j=Math.floor(i);return a[j]+(a[Math.min(j+1,a.length-1)]-a[j])*(i-j);}
// C2 compact support. Geometry is a hypothesis, not an inferred muscle scan.
export function wendland(r){r=clamp(r);return (1-r)**4*(4*r+1);}
export function fatTransmission(thickness,wavelength){if(thickness<0||!(wavelength>0))throw Error('Invalid tissue length');return Math.exp(-.5*(2*Math.PI*thickness/wavelength)**2);}
export function contractionRadius(restLength,currentLength,restRadius){if(!(restLength>0&&currentLength>0&&restRadius>0))throw Error('Invalid muscle path');return restRadius*Math.sqrt(restLength/currentLength);}
