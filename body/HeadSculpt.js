/* Authored sculpt construction, in canonical metres.
 * Broad plane-projection strokes shape the actual three-dimensional head,
 * including the original side surface outside the fitted frontal patch.
 * Anatomy/art sources and rejected approaches: docs/face-knowledge/R24_SCULPT_RESEARCH_20260918.md.
 * No mesh, photograph, scan or baked displacement is stored here.
 */
const HEAD_SCULPT={revision:'r24-integrated-malar-mandibular-planes',steps:8,strokes:[
  {id:'malarUpper',anchor:[.045,1.495,.168],normal:[.72,.12,.684],centre:[.043,1.494,.166],radii:[.032,.019,.055],strength:.36},
  {id:'cheekSide',anchor:[.045,1.477,.164],normal:[.80,-.13,.586],centre:[.043,1.477,.161],radii:[.030,.026,.055],strength:.35},
  {id:'mandibularSide',anchor:[.055,1.455,.147],normal:[.92,-.20,.337],centre:[.054,1.452,.132],radii:[.022,.027,.058],strength:.32}
]};
// Projection onto a plane changes its whole supported orientation. A flat
// centre and C2 falloff blend the stroke into adjacent anatomical planes.
// Every attached surface uses this map after local expression, before identity.
function compactHeadSculptPoint(point){
  let p=Array.from(point),jacobian=[[1,0,0],[0,1,0],[0,0,1]];
  if(p[1]<1.40||p[1]>1.52||Math.abs(p[0])>.09||p[2]<.045||p[2]>.225)return {point:p,jacobian};
  for(const side of [-1,1])for(const stroke of HEAD_SCULPT.strokes){
    const mirror=a=>[a[0]*side,a[1],a[2]],a=mirror(stroke.anchor),c=mirror(stroke.centre),raw=mirror(stroke.normal),length=Math.hypot(...raw),normal=raw.map(v=>v/length);
    // Integrate the supported plane field in small steps: a single large
    // projection can invert the falloff shoulder. The calibrated step retains
    // the requested total contraction where the complete path is in the core.
    const strength=1-Math.pow(1-stroke.strength,1/HEAD_SCULPT.steps);
    for(let step=0;step<HEAD_SCULPT.steps;step++){
    const q=p.map((v,k)=>(v-c[k])/stroke.radii[k]),r2=q.reduce((sum,v)=>sum+v*v,0);if(r2>=1)break;
    const t=Math.max(0,Math.min(1,(r2-.18)/.82)),w=1-t*t*t*(t*(t*6-15)+10),dw=-30*t*t*(t-1)*(t-1)/.82;
    const gradient=q.map((v,k)=>2*v*dw/stroke.radii[k]),distance=p.reduce((sum,v,k)=>sum+(v-a[k])*normal[k],0);
    const g=normal.map((v,k)=>-strength*(w*v+distance*gradient[k]));
    const old=jacobian;jacobian=old.map((row,i)=>row.map((value,j)=>value+normal[i]*g.reduce((sum,v,k)=>sum+v*old[k][j],0)));
    p=p.map((v,k)=>v-normal[k]*strength*w*distance);
    }
  }
  return {point:p,jacobian};
}
const HEAD_SCULPT_GLSL=`
void compactSculptPlane(inout vec3 p,inout vec3 n,vec3 anchor,vec3 planeNormal,vec3 centre,vec3 radii,float strength){
  for(int step=0;step<${HEAD_SCULPT.steps};step++){
  vec3 q=(p-centre)/radii;float r2=dot(q,q);if(r2>=1.)break;
  float t=clamp((r2-.18)/.82,0.,1.),w=1.-t*t*t*(t*(t*6.-15.)+10.),dw=-30.*t*t*(t-1.)*(t-1.)/.82;
  vec3 bn=normalize(planeNormal),gradient=2.*q*dw/radii;float distance=dot(p-anchor,bn);
  vec3 g=-strength*(w*bn+distance*gradient);float det=1.+dot(g,bn);
  n=normalize(det*n-g*dot(bn,n));p-=bn*strength*w*distance;
  }
}
void compactHeadSculpt(inout vec3 p,inout vec3 n){
  if(p.y<1.40||p.y>1.52||abs(p.x)>.09||p.z<.045||p.z>.225)return;
  for(int sideIndex=0;sideIndex<2;sideIndex++){
    float side=sideIndex==0?-1.:1.;
    ${HEAD_SCULPT.strokes.map(s=>{const vec=a=>'vec3('+a.map((v,i)=>(i===0?'side*':'')+Number(v).toFixed(9)).join(',')+')';return 'compactSculptPlane(p,n,'+vec(s.anchor)+','+vec(s.normal)+','+vec(s.centre)+',vec3('+s.radii.map(v=>v.toFixed(9)).join(',')+'),'+(1-Math.pow(1-s.strength,1/HEAD_SCULPT.steps)).toFixed(12)+');';}).join('\n    ')}
  }
}`;
