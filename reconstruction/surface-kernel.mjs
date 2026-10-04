/** Compact scalar surface kernel. Coefficients are integers; no stored mesh. */
import {createLeftCalfSurface} from './radial-kernel.mjs';
const mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t),sub=(a,b)=>a.map((x,k)=>x-b[k]);
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),length=a=>Math.hypot(...a),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const B=[[1,4,1,0],[0,4,2,0],[0,2,4,0],[0,1,4,1]].map(a=>a.map(x=>x/6));
const pointKey=p=>p.map(x=>Math.round(x*1e12)).join(',');

// The source labels this narrow anterior head/neck collar as torso. Its open
// upper trim is the cranial interface at y=1.420 m; a 12 mm torso plane reaches
// across the whole 4.8 mm chart and creates a reverse slope just below that rim.
// Select the anatomical location and chart frame, not a generated chart id.
export function cranialInterfaceCollarWidth(c){
  if(c.semanticRegion!=='torso'||c.heightAxis!==2||c.outwardSign!==1||c.projectionAxes[0]!==0||c.projectionAxes[1]!==1)return null;
  const [lo,hi]=c.uvBoundsMetres,height=hi[1]-lo[1];
  return lo[0]>-.04&&hi[0]<.04&&lo[1]>1.410&&Math.abs(hi[1]-1.420)<.0002&&height<.006?height*.5:null;
}

export function createHeightFunction(c,{cubic=false}={}){
  const [lo,hi]=c.uvBoundsMetres,extent=sub(hi,lo),unit=c.unitMetres;
  const layers=c.layers.map(l=>{
    const [nu,nv]=l.intervals,indices=l.basisIndices,values=l.heightCoefficients,rowStart=new Uint32Array(nu+2);let at=0;
    const denseCount=(nu+1)*(nv+1);
    if(denseCount<=65536&&indices.length>denseCount*.18){
      const dense=new Float64Array(denseCount),corners=new Float64Array(4);let previous=-1;
      for(let i=0;i<indices.length;i++)dense[indices[i]]=values[i]*unit;
      return {nu,nv,get:(row,col)=>dense[row*(nv+1)+col],cell:(row,col)=>{const at=row*(nv+1)+col;if(at!==previous){
        corners[0]=dense[at];corners[1]=dense[at+nv+1];corners[2]=dense[at+1];corners[3]=dense[at+nv+2];previous=at;
      }return corners;}};
    }
    for(let row=0;row<=nu+1;row++){while(at<indices.length&&indices[at]<row*(nv+1))at++;rowStart[row]=at;}
    function get(row,col){const wanted=row*(nv+1)+col;let a=rowStart[row],b=rowStart[row+1];
      while(a<b){const m=(a+b)>>>1;if(indices[m]<wanted)a=m+1;else b=m;}
      return a<indices.length&&indices[a]===wanted?values[a]*unit:0;}
    // Nearby probes repeatedly visit the same four coefficients. Cache exact
    // cell values, never interpolated samples or rounded UV coordinates.
    const cells=new Map();let previousKey=-1,previousValues;
    function cell(row,col){const key=row*nv+col;if(key===previousKey)return previousValues;let values=cells.get(key);
      if(values===undefined){values=[get(row,col),get(row+1,col),get(row,col+1),get(row+1,col+1)];
        if(cells.size>=4096)cells.clear();cells.set(key,values);}
      previousKey=key;previousValues=values;return values;
    }
    return {nu,nv,get,cell};
  });
  // Shared nodal jets make a tensor Hermite patch C1 across INTERNAL grid
  // lines. The former bilinear evaluator had a different slope on each side.
  // Harmonic edge slopes preserve extrema (PCHIP principle); a single nodal
  // scale bounds all incident Bezier control points by their cell corners.
  // This prevents the sparse coefficient field's zero exterior from creating
  // cubic overshoot. No output clamp, sampled mesh, or stored normals are used.
  // Methods reviewed: scipy.interpolate.PchipInterpolator; pbrt 3e 8.6.1.
  if(cubic)for(const layer of layers){
    const {nu,nv,get}=layer,nodes=new Map(),cells=new Map();
    const at=(i,j)=>i<0?2*at(0,j)-at(1,j):i>nu?2*at(nu,j)-at(nu-1,j):j<0?2*at(i,0)-at(i,1):j>nv?2*at(i,nv)-at(i,nv-1):get(i,j);
    const slope=(a,b)=>a*b>0?2*a*b/(a+b):0;
    function jet(i,j){const key=i*(nv+1)+j;let jet=nodes.get(key);if(jet)return jet;
      const q=at(i,j),du=slope(q-at(i-1,j),at(i+1,j)-q),dv=slope(q-at(i,j-1),at(i,j+1)-q),duv=(at(i+1,j+1)-at(i+1,j-1)-at(i-1,j+1)+at(i-1,j-1))*.25;
      let scale=1;
      for(const su of [-1,1])for(const sv of [-1,1]){
        const values=[q,at(i+su,j),at(i,j+sv),at(i+su,j+sv)],lo=Math.min(...values)-q,hi=Math.max(...values)-q;
        for(const d of [su*du/3,sv*dv/3,su*du/3+sv*dv/3+su*sv*duv/9])if(d!==0)scale=Math.min(scale,(d>0?hi:lo)/d);
      }
      jet=[q,du*scale,dv*scale,duv*scale];if(nodes.size>=8192)nodes.clear();nodes.set(key,jet);return jet;
    }
    layer.cubicCell=(i,j)=>{const key=i*nv+j;let net=cells.get(key);if(net)return net;net=new Float64Array(16);
      for(let a=0;a<2;a++)for(let b=0;b<2;b++){
        const [q,du,dv,duv]=jet(i+a,j+b),ou=a*3,ov=b*3,iu=a?2:1,iv=b?2:1,su=a?-1:1,sv=b?-1:1;
        net[ou*4+ov]=q;net[iu*4+ov]=q+su*du/3;net[ou*4+iv]=q+sv*dv/3;net[iu*4+iv]=q+su*du/3+sv*dv/3+su*sv*duv/9;
      }
      if(cells.size>=4096)cells.clear();cells.set(key,net);return net;
    };
  }
  return (u,v)=>{let q=0,qu=0,qv=0;
    for(const {nu,nv,cell,cubicCell} of layers){const su=clamp((u-lo[0])/extent[0]*nu,0,nu),sv=clamp((v-lo[1])/extent[1]*nv,0,nv),i=Math.min(Math.floor(su),nu-1),j=Math.min(Math.floor(sv),nv-1),a=su-i,b=sv-j;
      if(cubicCell){const x=1-a,y=1-b,U=[x*x*x,3*a*x*x,3*a*a*x,a*a*a],V=[y*y*y,3*b*y*y,3*b*b*y,b*b*b],dU=[-3*x*x,3*x*x-6*a*x,6*a*x-3*a*a,3*a*a],dV=[-3*y*y,3*y*y-6*b*y,6*b*y-3*b*b,3*b*b],net=cubicCell(i,j);
        for(let k=0;k<4;k++)for(let l=0;l<4;l++){const value=net[k*4+l];q+=U[k]*V[l]*value;qu+=dU[k]*V[l]*value*nu/extent[0];qv+=U[k]*dV[l]*value*nv/extent[1];}continue;}
      const [v00,v10,v01,v11]=cell(i,j);
      q+=(1-a)*(1-b)*v00+a*(1-b)*v10+(1-a)*b*v01+a*b*v11;
      qu+=((1-b)*(v10-v00)+b*(v11-v01))*nu/extent[0];qv+=((1-a)*(v01-v00)+a*(v11-v10))*nv/extent[1];}
    return {q,qu,qv};};
}

// Anatomical gates have zero first/second derivative at their rims. Central
// face openings, ear folds and the inferior head interface retain the exact
// linear source. Only broad cranial/cheek skin reaches full cubic influence.
export function headInteriorBlend(p){
  const step=(a,b,x,axis)=>{const t=clamp((x-a)/(b-a),0,1),v=t*t*t*(t*(t*6-15)+10),d=30*t*t*(t-1)*(t-1)/(b-a),q=[v,0,0,0];q[axis+1]=d;return q;};
  const mul=(a,b)=>[a[0]*b[0],a[1]*b[0]+a[0]*b[1],a[2]*b[0]+a[0]*b[2],a[3]*b[0]+a[0]*b[3]],inv=a=>[1-a[0],-a[1],-a[2],-a[3]];
  const ax=Math.abs(p[0]),sx=(a,b)=>{const r=step(a,b,ax,0);r[1]*=Math.sign(p[0]);return r;},sy=(a,b)=>step(a,b,p[1],1),sz=(a,b)=>step(a,b,p[2],2);
  const central=mul(mul(inv(sx(.050,.060)),mul(sy(1.415,1.425),inv(sy(1.535,1.545)))),sz(.115,.125));
  const ear=mul(mul(sx(.065,.072),mul(sy(1.45,1.46),inv(sy(1.548,1.558)))),inv(sz(.145,.155)));
  return mul(mul(sy(1.430,1.442),inv(central)),inv(ear));
}

/** RDP uses corresponding curve parameters, bounding speed as well as shape. */
function simplify(points,tolerance){
  if(!tolerance||points.length<3)return points;
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
  while(stack.length){const [lo,hi]=stack.pop(),a=points[lo],b=points[hi];let error=0,chosen=-1;
    for(let i=lo+1;i<hi;i++){const t=(points[i][3]-a[3])/(b[3]-a[3]);let e=0;for(let k=0;k<3;k++)e+=(points[i][k]-a[k]-(b[k]-a[k])*t)**2;
      if(e>error){error=e;chosen=i;}}
    if(error>tolerance*tolerance){keep[chosen]=1;stack.push([lo,chosen],[chosen,hi]);}}
  return points.filter((_,i)=>keep[i]);
}

export function createCompactSurface(data,{boundaryTolerance=0,canonicalChordTolerance=2.5e-7,normalField=null,smoothHeadInterior=true}={}){
  const fields=data.fields,domains=new Map(fields.domains.map(d=>[`${fields.region}/${d.id}`,d]));
  const curves=new Map(data.boundaries.curves.map(c=>[c.id,c])),owners=new Map(),cache=new Map();
  for(const c of curves.values())for(const owner of c.owners){const id=`${c.region}/${owner}`;if(!owners.has(id))owners.set(id,[]);owners.get(id).push(c.id);}
  // A trim boundary is a chart boundary, not an anatomical incision. Adjacent
  // broad skin charts share one plane containing the SAME canonical edge.
  // Broad cranial skin uses a smaller metric support than the torso. Central
  // facial folds, the pinna, fingers and open interfaces retain their shape.
  const supportByRegion={torso:.012,pelvis:.008,shoulder_neck:.008,left_arm:.008,right_arm:.008,right_lower_limb:.010,head_face_ears:.004};
  const rawCache=new Map(),planeCache=new Map(),planeKeys=new Set(),cranialKeys=new Set(),fallbackKeys=new Set();
  const cranialPlaneEligible=p=>{
    const ax=Math.abs(p[0]),y=p[1],z=p[2];
    if(y<=1.43)return false;
    // Preserve the source orbital/nasal/oral folds, which have their own
    // explicit anatomical reconstruction. A skin seam is not a crease here.
    if(z>.125&&ax<.050&&y>1.445&&y<1.535)return false;
    // Preserve concha/helix folds rather than averaging the ear into the head.
    if(ax>.072&&y>1.46&&y<1.548&&z<.145)return false;
    return true;
  };
  const rawFor=c=>{let raw=rawCache.get(c.id);if(raw)return raw;raw=createHeightFunction(c);
    if(smoothHeadInterior&&c.semanticRegion==='head_face_ears'){
      const linear=raw;raw=createHeightFunction(c,{cubic:true});raw.reference=linear;
    }
    // The visible pinna belongs to its own feature surface, not head skin.
    // Retain the same source coefficients and protect its canonical fold rims.
    if(c.semanticRegion==='FJ2811'){const linear=raw;raw=createHeightFunction(c,{cubic:true});raw.reference=linear;raw.pinna=true;}
    rawCache.set(c.id,raw);if(rawCache.size>16)rawCache.delete(rawCache.keys().next().value);return raw;};
  function sharedPlane(curveId,index,a,b){
    if(!normalField)return null;
    const curve=curves.get(curveId),charts=curve.owners.map(owner=>domains.get(`${curve.region}/${owner}`));
    if(charts.length!==2||charts.some(c=>!c||!supportByRegion[c.semanticRegion]))return null;
    const key=curveId+'/'+index;if(planeCache.has(key))return planeCache.get(key);
    const p=mix(a,b,.5),edge=sub(b,a),edgeLength=length(edge),direction=edge.map(v=>v/edgeLength),hint=[0,0,0];
    const cranial=charts.some(c=>c.semanticRegion==='head_face_ears');
    if(cranial&&!cranialPlaneEligible(p)){planeCache.set(key,null);return null;}
    for(const c of charts){const raw=rawFor(c),value=(raw.reference||raw)(...c.projectionAxes.map(k=>p[k])),n=[0,0,0];
      n[c.heightAxis]=c.outwardSign;n[c.projectionAxes[0]]=-c.outwardSign*value.qu;n[c.projectionAxes[1]]=-c.outwardSign*value.qv;
      const size=length(n);for(let k=0;k<3;k++)hint[k]+=n[k]/size;}
    let plane=null;const size=length(hint);
    if(edgeLength>1e-12&&size>1e-8){
      const source=normalField('skin',p,hint.map(v=>v/size)),along=dot(source,direction),projected=source.map((v,k)=>v-along*direction[k]),norm=length(projected);
      if(norm>1e-8){const n=projected.map(v=>v/norm);
        // Reject a plane that is vertical or points inward in either chart.
        // Both owners make this decision together, so fallback cannot split it.
        // Both owners use the same minimum. The canonical shared edge and its
        // tangent plane stay fixed; only the influence away from it is bounded
        // by the thin chin collar, so it cannot fight the opposite open rim.
        if(charts.every(c=>n[c.heightAxis]*c.outwardSign>=.25))plane={n,support:Math.min(...charts.map(c=>Math.min(supportByRegion[c.semanticRegion],cranialInterfaceCollarWidth(c)??Infinity)))};
      }
    }
    (plane?planeKeys:fallbackKeys).add(key);if(plane&&cranial)cranialKeys.add(key);planeCache.set(key,plane);if(planeCache.size>8192)planeCache.delete(planeCache.keys().next().value);return plane;
  }
  let maximumFlattenBound=0,maximumEvaluatedDisplacementM=0;
  function polyline(id){
    if(cache.has(id)){const p=cache.get(id);cache.delete(id);cache.set(id,p);return p;}
    const c=curves.get(id);if(!c)throw Error('Unknown boundary '+id);
    if(c.basis==='linear-knots/v1'){
      let p=Array.from(c.parameterKnots,(t,i)=>[c.coefficientChannelsXYZ[0][i]*c.unitMetres,c.coefficientChannelsXYZ[1][i]*c.unitMetres,c.coefficientChannelsXYZ[2][i]*c.unitMetres,t*c.parameterUnit]);
      p[0][3]=0;p.at(-1)[3]=1;
      if(c.closed)p[p.length-1]=[...p[0].slice(0,3),1];
      else{p[0]=[...data.boundaries.junctions[c.endpointAnchors[0]].positionMetres,0];p[p.length-1]=[...data.boundaries.junctions[c.endpointAnchors[1]].positionMetres,1];}
      // Curves are simplified once during parameter preparation, not every load.
      cache.set(id,p);return p;
    }
    const n=c.intervals,count=c.coefficientChannelsXYZ[0].length;
    function piece(i){return B.map(row=>[0,1,2].map(k=>row.reduce((sum,w,j)=>sum+w*c.coefficientChannelsXYZ[k][c.closed?(i+j-1+n)%n:i+j+1]*c.unitMetres,0)));}
    const first=piece(0),last=piece(n-1),anchor0=c.closed?first[0]:data.boundaries.junctions[c.endpointAnchors[0]].positionMetres,
      anchor1=c.closed?first[0]:data.boundaries.junctions[c.endpointAnchors[1]].positionMetres,
      delta0=sub(anchor0,first[0]),delta1=sub(anchor1,last[3]);
    const points=[];
    function flatten(p,u0,u1,depth=0){const bound=Math.max(...p.map((q,i)=>length(sub(q,mix(p[0],p[3],i/3)))));
      if(bound<=canonicalChordTolerance){points.push([...p[0],u0]);maximumFlattenBound=Math.max(maximumFlattenBound,bound);return;}
      if(depth>=24)throw Error('Boundary subdivision failed');
      const a=mix(p[0],p[1],.5),b=mix(p[1],p[2],.5),cc=mix(p[2],p[3],.5),d=mix(a,b,.5),e=mix(b,cc,.5),f=mix(d,e,.5),um=(u0+u1)/2;
      flatten([p[0],a,d,f],u0,um,depth+1);flatten([f,e,cc,p[3]],um,u1,depth+1);}
    for(let i=0;i<n;i++){const p=piece(i);if(!c.closed)p.forEach((q,j)=>{const d=mix(delta0,delta1,(i+j/3)/n);for(let k=0;k<3;k++)q[k]+=d[k];});
      if(i===0)p[0]=anchor0.slice();if(i===n-1)p[3]=anchor1.slice();flatten(p,i/n,(i+1)/n);}
    points.push([...anchor1,1]);let p;
    if(c.closed){const mid=Math.floor((points.length-1)/2);p=[...simplify(points.slice(0,mid+1),boundaryTolerance).slice(0,-1),...simplify(points.slice(mid),boundaryTolerance)];if(p.length<4)p=points;}
    else p=simplify(points,boundaryTolerance);
    cache.set(id,p);while(cache.size>24)cache.delete(cache.keys().next().value);return p;
  }
  function evaluateBoundary(id,u){const p=polyline(id);let lo=0,hi=p.length-2;
    while(lo<hi){const mid=(lo+hi)>>>1;if(u>p[mid+1][3])lo=mid+1;else hi=mid;}
    const a=p[lo],b=p[lo+1],t=clamp((u-a[3])/(b[3]-a[3]),0,1);return [0,1,2].map(k=>a[k]+(b[k]-a[k])*t);}
  function makeChart(id){const c=domains.get(id);if(!c)throw Error('Unknown chart '+id);
    const raw=rawFor(c),segments=[],bins=new Map(),rows=new Map(),support=normalField?(supportByRegion[c.semanticRegion]||.002):.002,paths=[];
    const bin=(u,v)=>`${Math.floor(u/support)},${Math.floor(v/support)}`;
    for(const curveId of owners.get(id)||[]){const p=polyline(curveId);paths.push(p.map(q=>q.slice(0,3)));
      for(let i=0;i<p.length-1;i++){const a=p[i].slice(0,3),b=p[i+1].slice(0,3),uvA=c.projectionAxes.map(k=>a[k]),uvB=c.projectionAxes.map(k=>b[k]),e=sub(uvB,uvA),length2=dot(e,e);
        if(length2<1e-24)throw Error('Collapsed chart boundary '+id);
        const plane=sharedPlane(curveId,i,a,b),radius=plane?.support||.002;
        const s={a,b,uvA,uvB,e,length2,radius,slope:plane?c.projectionAxes.map(k=>-plane.n[k]/plane.n[c.heightAxis]):null};segments.push(s);
        const lower=uvA.map((x,k)=>Math.floor((Math.min(x,uvB[k])-support)/support)),upper=uvA.map((x,k)=>Math.floor((Math.max(x,uvB[k])+support)/support));
        for(let u=lower[0];u<=upper[0];u++)for(let v=lower[1];v<=upper[1];v++){const k=`${u},${v}`;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(s);}
        for(let v=Math.floor(Math.min(uvA[1],uvB[1])/support);v<=Math.floor(Math.max(uvA[1],uvB[1])/support);v++){if(!rows.has(v))rows.set(v,[]);rows.get(v).push(s);}}
    }
    function inside(u,v){let n=0;for(const s of rows.get(Math.floor(v/support))||[]){const a=s.uvA,b=s.uvB;if((a[1]>v)!==(b[1]>v)&&a[0]+(v-a[1])*(b[0]-a[0])/(b[1]-a[1])>u)n++;}return n%2===1;}
    function evaluateHeight(u,v,raw,reference=false){const base=raw(u,v),rawHeight=base.q;let numerator=0,denominator=1,numU=0,numV=0,denU=0,denV=0,onBoundary=false;
      for(const s of bins.get(bin(u,v))||[]){
        const eu=s.e[0],ev=s.e[1],t=clamp(((u-s.uvA[0])*eu+(v-s.uvA[1])*ev)/s.length2,0,1);
        const pu=s.uvA[0]+eu*t,pv=s.uvA[1]+ev*t,ru=u-pu,rv=v-pv,distance=Math.hypot(ru,rv),radius=s.radius;if(distance>=radius)continue;
        const height=s.a[c.heightAxis]+(s.b[c.heightAxis]-s.a[c.heightAxis])*t,
          at=reference?(t===0?(s.linearStart??=raw(pu,pv)):t===1?(s.linearEnd??=raw(pu,pv)):raw(pu,pv)):(t===0?(s.rawStart??=raw(pu,pv)):t===1?(s.rawEnd??=raw(pu,pv)):raw(pu,pv));
        const slope=s.b[c.heightAxis]-s.a[c.heightAxis]-at.qu*eu-at.qv*ev,interior=t>0&&t<1;
        let delta=height-at.q,deltaU=interior?eu/s.length2*slope:0,deltaV=interior?ev/s.length2*slope:0;
        if(s.slope){
          // Extend the shared edge as a tangent plane, then blend its HEIGHT
          // into the actual surface. Subtract raw(u,v), not a Taylor series of
          // raw at the edge: bilinear gradient jumps must not create new steps.
          // The plane contains the edge, so closest-point derivatives cancel.
          delta=height+s.slope[0]*ru+s.slope[1]*rv-base.q;
          deltaU=s.slope[0]-base.qu;deltaV=s.slope[1]-base.qv;
        }
        if(distance<1e-13){base.q=height;if(s.slope){base.qu=s.slope[0];base.qv=s.slope[1];}else{base.qu+=deltaU;base.qv+=deltaV;}onBoundary=true;break;}
        // Dimensionless weights allow each seam to use its anatomical width.
        // The value and derivative of a seam's influence vanish at its rim.
        const a=1-distance/radius,w=a**6*(radius/distance)**2,factor=-6/(radius*a)-2/distance,gradU=w*factor*ru/distance,gradV=w*factor*rv/distance;
        numerator+=w*delta;denominator+=w;numU+=gradU*delta+w*deltaU;numV+=gradV*delta+w*deltaV;denU+=gradU;denV+=gradV;
      }
      if(!onBoundary){const correction=numerator/denominator;base.q+=correction;base.qu+=(numU-correction*denU)/denominator;base.qv+=(numV-correction*denV)/denominator;}
      maximumEvaluatedDisplacementM=Math.max(maximumEvaluatedDisplacementM,Math.abs(base.q-rawHeight));
      return base;
    }
    // Keep the original helix/concha trim positions AND tangent hints. The
    // cubic interior enters over one normal-field cell (0.25 mm); multiplying
    // C2 edge gates also preserves corners where two trim supports overlap.
    function pinnaInteriorBlend(u,v){
      const radius=.00025;let w=1,du=0,dv=0;
      for(const s of bins.get(bin(u,v))||[]){
        const t=clamp(((u-s.uvA[0])*s.e[0]+(v-s.uvA[1])*s.e[1])/s.length2,0,1),ru=u-s.uvA[0]-s.e[0]*t,rv=v-s.uvA[1]-s.e[1]*t,d=Math.hypot(ru,rv);
        if(d>=radius)continue;if(d<1e-13)return [0,0,0,0];
        const a=d/radius,g=a*a*a*(a*(a*6-15)+10),slope=30*a*a*(a-1)*(a-1)/radius;
        du=du*g+w*slope*ru/d;dv=dv*g+w*slope*rv/d;w*=g;
      }
      const gradient=[0,0,0];gradient[c.projectionAxes[0]]=du;gradient[c.projectionAxes[1]]=dv;return [w,...gradient];
    }
    function evaluate(u,v){let base;
      if(raw.reference){
        const reference=raw.reference(u,v),point=[0,0,0];point[c.heightAxis]=reference.q;point[c.projectionAxes[0]]=u;point[c.projectionAxes[1]]=v;
        const [w,...gradient]=raw.pinna?pinnaInteriorBlend(u,v):headInteriorBlend(point);
        if(w===0)base=evaluateHeight(u,v,raw.reference,true);
        else{base=evaluateHeight(u,v,raw);if(w<1){
          const old=evaluateHeight(u,v,raw.reference,true),delta=base.q-old.q;
          base={q:old.q+w*delta,qu:old.qu+w*(base.qu-old.qu)+(gradient[c.projectionAxes[0]]+gradient[c.heightAxis]*reference.qu)*delta,
            qv:old.qv+w*(base.qv-old.qv)+(gradient[c.projectionAxes[1]]+gradient[c.heightAxis]*reference.qv)*delta};
        }}
      }else base=evaluateHeight(u,v,raw);
      const p=[0,0,0],n=[0,0,0];p[c.heightAxis]=base.q;p[c.projectionAxes[0]]=u;p[c.projectionAxes[1]]=v;
      n[c.heightAxis]=c.outwardSign;n[c.projectionAxes[0]]=-c.outwardSign*base.qu;n[c.projectionAxes[1]]=-c.outwardSign*base.qv;
      const len=length(n);return {p,n:n.map(x=>x/len),uv:[u,v]};}
    function loops(){const unused=new Set(paths.map((_,i)=>i)),result=[];
      while(unused.size){const start=unused.values().next().value;unused.delete(start);let p=paths[start].slice();
        while(pointKey(p[0])!==pointKey(p.at(-1))){let found=false;const end=pointKey(p.at(-1));
          for(const i of unused){const q=paths[i];if(pointKey(q[0])===end||pointKey(q.at(-1))===end){p.push(...(pointKey(q[0])===end?q:q.slice().reverse()).slice(1));unused.delete(i);found=true;break;}}
          if(!found)throw Error('Open compact trim '+id);}
        p.pop();if(p.length<3)throw Error('Collapsed compact loop '+id);result.push(p.map(q=>c.projectionAxes.map(k=>q[k])));}
      return result;}
    return {id,c,evaluate,inside,loops,segmentCount:segments.length};
  }
  let tube=null,rings=null;
  function evaluateTube(chart,y,t){
    if(!data.tube)throw Error('No radial surface');
    if(!tube){tube=createLeftCalfSurface({...data.tube,schema:'human-calf-spline/v2'});rings=new Map(data.tube.heightRangeMetres.map(v=>[v,[]]));
      for(const c of curves.values()){const [axis,coordinate]=c.boundaryKind.split(':'),v=Number(coordinate);if(axis==='1'&&rings.has(v)){const p=polyline(c.id);for(let i=0;i<p.length-1;i++)rings.get(v).push([p[i],p[i+1]]);}}}
    const value=tube.evaluate(chart,y,t),[n,s]=data.tube.chartFramesXZ[chart],direction=n.map((x,k)=>x+t*s[k]),axis=data.tube.axisXZMetres;
    function derivatives(v){const nn=[v.normal[0],v.normal[2]],den=dot(nn,direction);return {qy:-v.normal[1]/den,qt:-v.radius*dot(nn,s)/den};}
    const raw=derivatives(value);let q=value.radius,qy=raw.qy,qt=raw.qt;
    const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
    for(const [end,sign] of [[data.tube.heightRangeMetres[0],1],[data.tube.heightRangeMetres[1],-1]]){
      const distance=sign*(y-end),width=.005;if(distance>=width)continue;let hit=null;
      for(const [pa,pb] of rings.get(end)){const a=[pa[0]-axis[0],pa[2]-axis[1]],e=[pb[0]-pa[0],pb[2]-pa[2]],den=cross(direction,e);if(Math.abs(den)<1e-20)continue;
        const r=cross(a,e)/den,along=cross(a,direction)/den;if(r>0&&along>=-1e-10&&along<=1+1e-10)hit={q:r,qt:-r*cross(s,e)/den};}
      if(!hit)throw Error('Missing radial boundary');const root=tube.evaluate(chart,end,t),rd=derivatives(root),a=1-distance/width,w=a**3;
      q+=w*(hit.q-root.radius);qy+=-3*sign*a*a/width*(hit.q-root.radius);qt+=w*(hit.qt-rd.qt);if(y===end)q=hit.q;}
    const pt=[qt*direction[0]+q*s[0],0,qt*direction[1]+q*s[1]],py=[qy*direction[0],1,qy*direction[1]],normal=[pt[2],py[2]*pt[0]-py[0]*pt[2],-pt[0]],len=length(normal);
    return {p:[axis[0]+q*direction[0],y,axis[1]+q*direction[1]],n:normal.map(x=>x/len),uv:[y,t]};
  }
  return {domainIds:[...domains.keys()],makeChart,evaluateBoundary,polyline,evaluateTube,
    inspectDomain:id=>domains.get(id),boundaryIds:[...curves.keys()],
    clearBoundaryCache:()=>{cache.clear();rawCache.clear();planeCache.clear();},get maximumFlattenBound(){return maximumFlattenBound;},
    get boundaryReport(){return {method:'r25-head-bounded-cubic-jets',headInteriorInterpolation:smoothHeadInterior?'bounded-bicubic-hermite':'source-bilinear',sharedPlaneSegments:planeKeys.size,cranialSharedPlaneSegments:cranialKeys.size,unsupportedPlaneSegments:fallbackKeys.size,maximumSupportM:.012,maximumEvaluatedDisplacementM,
      canonicalBoundaryMoved:false,globalC1Certificate:false,sourceFoldsReconstructed:false,visualAcceptance:false};}};
}
