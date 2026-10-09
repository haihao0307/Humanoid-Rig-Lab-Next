/** ET08-S1. Independent contour constraints, in millimetres relative to the
 * locked ocular centre. s=0 nasal, s=1 temporal. These are a fitted template,
 * NOT a recovery of this person's unobserved open-eye anatomy. No texture data.
 */
export const BASELINE='5be35195ad40d57507f7ab1785e4eecda6c648de';
export const SPECS=Object.freeze({
 right:Object.freeze({widthMM:23.4,
  upper:[[0,-1.15],[.055,.12],[.18,2.35],[.42,3.85],[.63,3.20],[.86,1.70],[1,.28]],
  lower:[[0,-1.15],[.07,-2.15],[.24,-4.05],[.56,-4.85],[.78,-3.58],[.93,-1.15],[1,.28]],
  closed:[[0,-1.15],[.12,-2.0],[.32,-3.02],[.55,-3.22],[.82,-2.07],[1,.28]]}),
 left:Object.freeze({widthMM:23.0,
  upper:[[0,-1.28],[.065,.05],[.19,2.45],[.40,3.72],[.60,3.42],[.84,1.85],[1,.18]],
  lower:[[0,-1.28],[.10,-2.90],[.32,-4.50],[.58,-4.98],[.80,-3.80],[.94,-1.25],[1,.18]],
  closed:[[0,-1.28],[.13,-2.10],[.34,-3.20],[.56,-3.25],[.81,-2.00],[1,.18]]})
});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
/** Shape-preserving piecewise cubic Hermite: no overshooting a specified peak,
 * no common ellipse, finite end tangents, and no coupling between the eyes. */
export function makeSpline(nodes){
 const n=nodes.length,h=[],d=[],m=[];
 if(n<2||nodes[0][0]!==0||nodes[n-1][0]!==1)throw Error('Contour endpoints must span [0,1]');
 for(let i=0;i<n-1;i++){h[i]=nodes[i+1][0]-nodes[i][0];if(h[i]<=0)throw Error('Unordered contour nodes');d[i]=(nodes[i+1][1]-nodes[i][1])/h[i];}
 m[0]=d[0];m[n-1]=d[n-2];
 for(let i=1;i<n-1;i++){
  if(d[i-1]*d[i]<=0)m[i]=0;
  else{const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];m[i]=(a+b)/(a/d[i-1]+b/d[i]);}
 }
 return s=>{s=clamp(s,0,1);let i=0;while(i<n-2&&s>nodes[i+1][0])i++;const t=(s-nodes[i][0])/h[i],t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*nodes[i][1]+(t3-2*t2+t)*h[i]*m[i]+(-2*t3+3*t2)*nodes[i+1][1]+(t3-t2)*h[i]*m[i+1];};
}
const curves=Object.fromEntries(Object.entries(SPECS).map(([name,s])=>[name,{upper:makeSpline(s.upper),lower:makeSpline(s.lower),closed:makeSpline(s.closed)}]));
export function sampleContour(name,s,{closure=0,opening=1,pitch=0,yaw=0,squint=0}={}){
 const spec=SPECS[name],q=curves[name];if(!spec)throw Error('Unknown eye '+name);
 for(const v of [s,closure,opening,pitch,yaw,squint])if(!Number.isFinite(v))throw Error('Non-finite contour input');
 s=clamp(s,0,1);closure=clamp(closure,0,1);const w=4*s*(1-s),base=q.upper(0)*(1-s)+q.upper(1)*s;
 let upper=base+(q.upper(s)-base)*opening-pitch*5.2*w-squint*1.75*w;
 let lower=base+(q.lower(s)-base)*opening-pitch*2.1*w+squint*1.75*w;
 if(upper<lower){const mid=(upper+lower)*.5;upper=mid;lower=mid;}
 const closed=q.closed(s),mix=v=>v+(closed-v)*closure;
 return {temporalXMM:(s-.5)*spec.widthMM+yaw*.52*w*(1-closure),upperMM:mix(upper),lowerMM:mix(lower),closedMM:closed};
}
export function contourSpecification(){return {schema:'kaopu/eye-contour-lock@1',baseline:BASELINE,units:'millimetres',sDirection:'nasal to temporal',eyes:JSON.parse(JSON.stringify(SPECS)),individualOpenScanAvailable:false,eyeballRadiusChanged:false,irisRadiusChanged:false,stage:1};}
