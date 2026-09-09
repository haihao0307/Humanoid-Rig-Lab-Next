// Original attachment-aligned muscle volumes. No model or texture assets.
const MUSCLE_SHEET_SPEC=Object.freeze(/*__MUSCLE_SHEETS_JSON__*/);
function normalizedJointInfluences(entries,jointIds){
  const summed=new Map();
  for(const [joint,w] of entries){if(w<=0)continue;const id=jointIds.get(joint);
    if(id==null)throw Error('Unknown muscle attachment '+joint);summed.set(id,(summed.get(id)||0)+w);}
  const chosen=[...summed].sort((a,b)=>b[1]-a[1]).slice(0,4),total=chosen.reduce((n,e)=>n+e[1],0);
  if(!(total>0))throw Error('Muscle has no joint influence');return chosen.map(([id,w])=>[id,w/total]);
}
// Each constant-v curve follows one fibre from a broad origin to its insertion.
// The surface chart is rectangular, NOT a centre-polar disk. Opposite faces share
// their entire rim, and a paired fit preserves thickness instead of clipping it.
function muscleFibreChart(anchors,u,v){
  const b=[(1-u)**2,2*u*(1-u),u*u];let p=[0,0,0];const weights=[];
  for(let k=0;k<3;k++)for(let j=0;j<2;j++){
    const a=anchors[2*k+j],w=b[k]*(j?v:1-v);p=add(p,mul(a.rest,w));weights.push([a.joint,w]);
  }
  return {p,weights};
}
function refreshMuscleSamples(m){
  const g=m.sheet.g,chart=m.sheetChart,at=(u,v)=>chart.nodes[u*(chart.across+1)+v].center;
  m.sheetSamples=[];
  for(let u=0;u<chart.along;u+=6)for(let v=0;v<chart.across;v+=6){
    const a=at(u,v),b=at(Math.min(u+6,chart.along),v),c=at(u,Math.min(v+6,chart.across)),d=at(Math.min(u+6,chart.along),Math.min(v+6,chart.across));
    m.sheetSamples.push({a,b,c},{a:b,b:d,c});
  }
  m.sheetBounds={lo:[0,1,2].map(k=>{let n=Infinity;for(let i=k;i<g.p.length;i+=3)n=Math.min(n,g.p[i]);return n-.030;}),
    hi:[0,1,2].map(k=>{let n=-Infinity;for(let i=k;i<g.p.length;i+=3)n=Math.max(n,g.p[i]);return n+.030;})};
}
function makeMuscleSheets(tissue){
  tissue.sheetItems=[];
  for(const side of ['left','right'])for(const spec of MUSCLE_SHEET_SPEC.groups){
    const s=side==='left'?-1:1,m=tissue.muscles.find(m=>m.id===side+'_'+spec.id);
    if(!m)throw Error('Missing muscle controller '+spec.id);
    const thickness=spec.thicknessM*Math.sqrt(clamp(proceduralComposition(tissue).ratios[proceduralMuscleGroup(m.id)]??1,.3,2.6));
    const anchor=([id,p])=>tissue.anchor(id.startsWith('@')?side+'_'+id.slice(1):id,mirrorBodyPoint(p,s));
    const anchors=[...spec.origin,...spec.via,...spec.insertion].map(anchor),axis=(spec.id==='deltoid'||spec.id==='gluteus_medius')?0:2;
    const outward=axis===0?s:(spec.conform==='back'?-1:1),normal=[0,0,0];normal[axis]=outward;
    const p=[],indices=[],weights=[],parameters=[],nodes=[],along=36,across=24,faces=[[],[]];
    const vertex=(pos,w,u,v,half)=>{const id=p.length/3;p.push(...pos);weights.push(normalizedJointInfluences(w,tissue.jointIds));parameters.push([u,v,half]);return id;};
    for(let u=0;u<=along;u++)for(let v=0;v<=across;v++){
      const U=u/along,V=v/across,chart=muscleFibreChart(anchors,U,V);
      if(spec.id==='deltoid'){
        const shoulder=tissue.bind.get(side+'_upperArm').p;
        chart.p=[shoulder[0]+s*.037,shoulder[1]+.019*(1-U)**2*Math.sin(Math.PI*V)-.150*U,
          shoulder[2]+(.025*(1-U)+.007*U)*(2*V-1)];
      }
      const half=thickness*.5*Math.sin(Math.PI*U)**.65*Math.sin(Math.PI*V)**.65;
      const a=vertex(add(chart.p,mul(normal,half)),chart.weights,U,V,half);
      const b=(u===0||v===0||u===along||v===across)?a:vertex(sub(chart.p,mul(normal,half)),chart.weights,U,V,half);
      faces[0].push(a);faces[1].push(b);nodes.push({a,b,base:chart.p,center:chart.p,half});
    }
    for(let f=0;f<2;f++)for(let u=0;u<along;u++)for(let v=0;v<across;v++){
      const k=u*(across+1)+v,A=faces[f][k],B=faces[f][k+across+1],C=faces[f][k+1],D=faces[f][k+across+2];
      // At corners the diagonal must reach the interior node; a triangle made
      // solely from rim nodes would duplicate both faces as a zero-thickness fin.
      const acrossCorner=(u===along-1&&v===0)||(u===0&&v===across-1);
      if(acrossCorner)f?indices.push(A,C,B,B,C,D):indices.push(A,B,C,B,D,C);
      else f?indices.push(A,D,B,A,C,D):indices.push(A,B,D,A,D,C);
    }
    const g=mesh(p,indices),count=p.length/3;g.skinJoints=new Float32Array(count*4);g.skinWeights=new Float32Array(count*4);
    g.tissueIds=new Float32Array(count*2).fill(tissue.muscles.indexOf(m));g.tissueData=new Float32Array(count*4);
    for(let k=0;k<count;k++){weights[k].forEach(([j,w],n)=>{g.skinJoints[k*4+n]=j;g.skinWeights[k*4+n]=w;});g.tissueData.set([1,parameters[k][2],parameters[k][0],parameters[k][1]],k*4);}
    m.sheet={id:m.id+'_volume',g,materialKind:8,color:[.38,.065,.042],visible:false};
    m.sheetChart={axis,outward,along,across,nodes};m.sheetThickness=thickness;m.sheetAnchors=anchors;
    m.controlRest=[0,2,4].map(k=>mix(anchors[k].rest,anchors[k+1].rest,.5));m.restLength=tissue.arcLength(m.controlRest);m.length=m.restLength;m.radius=thickness*.5;
    refreshMuscleSamples(m);tissue.sheetItems.push(m.sheet);
  }
}
function muscleTriangleDistance(p,a,b,c){
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),bb=dot(ab,ab),cc=dot(ac,ac),bc=dot(ab,ac),den=bb*cc-bc*bc;
  if(den>1e-12){const u=(dot(ap,ab)*cc-dot(ap,ac)*bc)/den,v=(dot(ap,ac)*bb-dot(ap,ab)*bc)/den;
    if(u>=0&&v>=0&&u+v<=1)return dist(p,add(a,add(mul(ab,u),mul(ac,v))));}
  let d=Infinity;for(const [A,B] of [[a,b],[b,c],[c,a]]){const D=sub(B,A),t=clamp(dot(sub(p,A),D)/Math.max(dot(D,D),1e-9),0,1);d=Math.min(d,dist(p,add(A,mul(D,t))));}return d;
}
function muscleSurfaceInfluence(tissue,m,p){
  if(m.sheet){
    if(p.some((v,k)=>v<m.sheetBounds.lo[k]||v>m.sheetBounds.hi[k]))return null;
    let nearest=Infinity;for(const tri of m.sheetSamples)nearest=Math.min(nearest,muscleTriangleDistance(p,tri.a,tri.b,tri.c));
    const A=m.controlRest[0],D=sub(m.controlRest[2],A),t=clamp(dot(sub(p,A),D)/Math.max(dot(D,D),1e-9),0,1);
    return {weight:Math.exp(-1.4*(nearest/(m.sheetThickness*.5+.018))**2),t};
  }
  if(p.some((v,k)=>Math.abs(v-m.bindCenter[k])>m.bindReach))return null;
  const [A,V,B]=m.anchors.map(a=>a.rest),D=sub(B,A),t=clamp(dot(sub(p,A),D)/Math.max(dot(D,D),1e-9),0,1);
  return {weight:Math.exp(-1.4*(dist(p,tissue.curve([A,V,B],t))/(m.radius+.014))**2),t};
}
