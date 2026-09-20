/* Dense, source-fitted facial skin with authored secondary anatomical forms.
 * The temporary grid and fibres are generated at upload; only these parameters
 * persist. This is a geometric refinement, not measured anatomy or a scan. */
const COMPACT_FACE_ANATOMY={revision:'r24-anatomical-nasal-body-and-rolled-alar-rim',columns:192,rows:224,
  bounds:[-.080,.079,1.420,1.605],ellipse:[-.0005,1.512,.062,.086],
  smoothingRadiusM:.0065,nostrils:{x:.0095,y:1.4780,rx:.0039,ry:.00255,tilt:.46,medialTaper:.30,bend:.12,depth:.0105,vestibuleSkinRows:2,rings:28},
  lips:{centreX:COMPACT_PERIORAL_STRUCTURE.centreX,halfWidth:COMPACT_PERIORAL_STRUCTURE.halfWidth,
    seamY:COMPACT_PERIORAL_STRUCTURE.seamY,apron:COMPACT_PERIORAL_STRUCTURE.attachmentRadius,
    innerDepth:.0027,rings:64,outline:COMPACT_PERIORAL_STRUCTURE.outline},
  perioral:COMPACT_PERIORAL_STRUCTURE,
  jaw:{pivotY:1.4910,pivotZ:.1120,maxRotationRad:.1850,forwardM:.0090,downM:.0015,skinFullY:1.4440,skinFadeY:1.4780},
  oral:{upperGumY:1.4646,lowerGumY:1.4492,upperArchHalfWidth:.0240,lowerArchHalfWidth:.0226,upperFrontZ:.1818,lowerFrontZ:.1808,upperArchDepth:.0150,lowerArchDepth:.0140,
    toothGap:.00018,crownSegments:12,crownRings:7,gumSegments:56,gumSides:10,tongueFloor:{heightM:.018,halfAngle:.85,firstRow:5,lastRow:21,grooveM:.00022}},
  // One nasal loft joins the broad premaxillary bed to the nose. x/y/z are
  // canonical metres; cross-section values are fractions of central projection
  // above the fitted cheek chord. Paired domes may slightly exceed 1.
  nose:{guideX:[0,.0046,.0094,.0142],sidewallX:.0205,cheekHalfWidth:.0310,
    bridgeSections:[[1.488,.0042,.0210],[1.500,.0032,.0188],[1.515,.0029,.0175],[1.530,.0031,.0168],[1.543,.0040,.0200]],
    centreline:[[1.462,0.189],[1.469,0.1908],[1.474,0.1934],[1.478,0.1981],[1.483,0.2028],[1.487,0.2048],[1.49,0.2049],[1.494,0.2033],[1.505,0.1970],[1.519,0.1890],[1.532,0.1845],[1.543,0.1835]],
    crossSections:[
      [1.462,1,0.985,0.91,0.73],
      [1.469,1,0.975,0.87,0.7],
      [1.474,1,0.945,0.69,0.7],
      [1.478,1,0.94,0.56,0.84],
      [1.483,1,1.013,0.85,0.77],
      [1.487,1,1.006,0.83,0.59],
      [1.49,1,0.98,0.75,0.43],
      [1.494,1,0.94,0.58,0.26],
      [1.505,1,0.91,0.64,0.32],
      [1.519,1,0.9,0.62,0.3],
      [1.532,1,0.92,0.7,0.39],
      [1.543,1,0.96,0.8,0.53]],
    lowerBlendM:.009,upperBlendM:.012,lateralBlendStartM:.021},
  forms:[
    ...[-1,1].flatMap(side=>[
      {id:'orbitalTransition',x:side*.030,y:1.532,rx:.029,ry:.018,z:-.00032},
      {id:'upperLidSulcus',x:side*.030,y:1.538,rx:.021,ry:.0075,z:-.00012},
      {id:'infraorbitalTransition',x:side*.030,y:1.505,rx:.028,ry:.017,z:-.00022},
      {id:'lowerLidTransition',x:side*.030,y:1.500,rx:.023,ry:.0075,z:-.00006},
      // Broad authored volumes establish frontal/side planes before pores or
      // hair. Millimetre amplitudes are art direction, not population averages.
      {id:'supraorbitalPlane',x:side*.029,y:1.534,rx:.032,ry:.017,z:.00165}
    ])],
  // One continuous cheek rail replaces three isolated radial bumps. A broad
  // transverse shoulder carries the cheekbone into the side plane; the shared
  // longitudinal tangents join malar support, submalar recession and jaw bed.
  // Values are authored offsets in metres, not measurements of a person.
  cheekRail:{innerM:.025,shoulderInM:.037,shoulderOutM:.048,outerM:.063,
    stations:[[1.434,0],[1.449,.00060],[1.470,-.00240],[1.484,-.00070],[1.498,.00265],[1.517,0]]},
  brow:COMPACT_BROW_ANATOMY,beard:COMPACT_BEARD_ANATOMY};
// Original procedural tongue dorsum replaces an explicit oral-floor patch.
// Shared boundaries use the same mouth field; no overlapping enclosed sphere.
// Tongue rests on the oral floor (NCBI NBK545271); these dimensions are authored
// compact art controls, not measured human anatomy. The visible dorsum owns the
// replaced floor triangles and shares boundary positions, normals and lighting.
function compactTongueFloorPatch(mouthP,mouthI,mouthLight,lipAngles,mouthRings,controls={}){
  const c={heightM:.018,halfAngle:.85,firstRow:5,lastRow:21,grooveM:.00022,...controls};
  const angleCentre=-Math.PI/2,angles=lipAngles.map(a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;});
  const selected=angles.map((a,i)=>({a,i})).filter(q=>q.a>=angleCentre-c.halfAngle&&q.a<=angleCentre+c.halfAngle).sort((a,b)=>a.a-b.a);
  if(selected.length<4)throw Error('Insufficient mouth-floor angular samples');
  const first=selected[0].i,last=selected[selected.length-1].i,lo=selected[0].a,hi=selected[selected.length-1].a,rows=c.lastRow-c.firstRow+1;
  if(last-first+1!==selected.length)throw Error('Tongue patch cannot cross the periodic oral seam');
  const positions=[],indices=[],light=[],mapping=new Map(),boundary=[];
  for(let i=first;i<=last;i++)for(let j=c.firstRow;j<=c.lastRow;j++){
    const mouthId=i*mouthRings+j,id=positions.length/3,u=2*(angles[i]-lo)/(hi-lo)-1,v=(j-c.firstRow)/(c.lastRow-c.firstRow);
    const transverse=Math.max(0,1-u*u)**2,longitudinal=16*v*v*(1-v)*(1-v),groove=c.grooveM*Math.exp(-((u/.18)**2))*longitudinal;
    const q=mouthP.slice(mouthId*3,mouthId*3+3);q[1]+=Math.max(0,c.heightM*transverse*longitudinal-groove*transverse);
    const edge=i===first||i===last||j===c.firstRow||j===c.lastRow;
    if(edge){q.splice(0,3,...mouthP.slice(mouthId*3,mouthId*3+3));boundary.push([id,mouthId]);}
    positions.push(...q);light.push(...mouthLight.slice(mouthId*4,mouthId*4+4));mapping.set(mouthId,id);
  }
  const floorIndices=[];
  for(let k=0;k<mouthI.length;k+=3){const tri=mouthI.slice(k,k+3);
    if(tri.every(id=>mapping.has(id)))indices.push(...tri.map(id=>mapping.get(id)));else floorIndices.push(...tri);
  }
  const accum=(P,I)=>{const sums=Array.from({length:P.length/3},()=>[0,0,0]);
    for(let k=0;k<I.length;k+=3){const ids=I.slice(k,k+3),q=ids.map(i=>P.slice(i*3,i*3+3)),n=cross(sub(q[1],q[0]),sub(q[2],q[0]));for(const id of ids)for(let a=0;a<3;a++)sums[id][a]+=n[a];}return sums;};
  const mouthSums=accum(mouthP,floorIndices),tongueSums=accum(positions,indices);
  for(let j=0;j<mouthRings;j++){const end=(lipAngles.length)*mouthRings+j,sum=add(mouthSums[j],mouthSums[end]);mouthSums[j]=sum;mouthSums[end]=sum;}
  for(const [id,mouthId]of boundary){const sum=add(tongueSums[id],mouthSums[mouthId]);tongueSums[id]=sum;mouthSums[mouthId]=sum;}
  const normals=tongueSums.map(norm),mouthNormals=mouthSums.map(n=>Math.hypot(...n)>1e-15?norm(n):[0,1,0]);
  return {positions,indices,light,normals,mouthIndices:floorIndices,mouthNormals,boundary,report:{...c,firstAngular:first,lastAngular:last,angularSamples:selected.length,rows,vertices:positions.length/3,triangles:indices.length/3,replacedFloorTriangles:(mouthI.length-floorIndices.length)/3,sharedBoundaryVertices:boundary.length}};
}

function compactFaceRaySampler(meshes){
  const bins=new Map(),size=.004;
  const decode=(m,id)=>{if(!m.normals)return null;let x=m.normals[id*2]/32767,y=m.normals[id*2+1]/32767,z=1-Math.abs(x)-Math.abs(y);if(z<0){const old=x;x=(1-Math.abs(y))*(old<0?-1:1);y=(1-Math.abs(old))*(y<0?-1:1);}return norm([x,y,z]);};
  for(const m of meshes){if(m.name!=='skin')continue;const p=m.canonicalPositions;
    for(let k=0;k<m.indices.length;k+=3){const ia=m.indices[k]*3,ib=m.indices[k+1]*3,ic=m.indices[k+2]*3;if(Math.max(p[ia+1],p[ib+1],p[ic+1])<1.395||Math.min(p[ia+1],p[ib+1],p[ic+1])>1.625||Math.max(p[ia+2],p[ib+2],p[ic+2])<.12)continue;const a=Array.from(p.subarray(ia,ia+3)),b=Array.from(p.subarray(m.indices[k+1]*3,m.indices[k+1]*3+3)),c=Array.from(p.subarray(m.indices[k+2]*3,m.indices[k+2]*3+3));
      const loX=Math.min(a[0],b[0],c[0]),hiX=Math.max(a[0],b[0],c[0]),loY=Math.min(a[1],b[1],c[1]),hiY=Math.max(a[1],b[1],c[1]);
      if(loX>.08||hiX<-.08||loY>1.625||hiY<1.395||Math.max(a[2],b[2],c[2])<.12)continue;
      const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-13)continue;
      const tri={a,b,c,den,mesh:m,ids:[m.indices[k],m.indices[k+1],m.indices[k+2]],normals:[decode(m,m.indices[k]),decode(m,m.indices[k+1]),decode(m,m.indices[k+2])]};for(let i=Math.floor(Math.max(-.08,loX)/size);i<=Math.floor(Math.min(.08,hiX)/size);i++)for(let j=Math.floor(Math.max(1.395,loY)/size);j<=Math.floor(Math.min(1.625,hiY)/size);j++){const key=i+'/'+j,list=bins.get(key)||[];list.push(tri);bins.set(key,list);}
    }
  }
  const hit=(x,y)=>{let best=null;for(const tri of bins.get(Math.floor(x/size)+'/'+Math.floor(y/size))||[]){const {a,b,c,den}=tri,u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;if(u<-.000001||v<-.000001||u+v>1.000001)continue;const z=u*a[2]+v*b[2]+(1-u-v)*c[2];if(z>.12&&(!best||z>best.z))best={z,u,v,tri};}return best;};
  const sample=(x,y)=>hit(x,y)?.z??null;
  sample.normal=(x,y)=>{const h=hit(x,y);if(!h||h.tri.normals.some(n=>!n))return null;const [a,b,c]=h.tri.normals;return norm(a.map((v,k)=>v*h.u+b[k]*h.v+c[k]*(1-h.u-h.v)));};
  sample.binding=(x,y)=>{const h=hit(x,y),binding=h?.tri.mesh.binding;if(!binding)return null;const weights=new Map(),bary=[h.u,h.v,1-h.u-h.v];for(let k=0;k<3;k++)for(let j=0;j<COMPACT_INFLUENCES;j++){const i=h.tri.ids[k]*COMPACT_INFLUENCES+j,w=Math.max(0,bary[k])*binding.weights[i]/65535,id=binding.ids[i];if(w)weights.set(id,(weights.get(id)||0)+w);}return weights;};
  // A refined triangle crossing a coarse source edge does not reproduce the
  // source plane between its vertices, even when every vertex lies on it.
  // Intersect the join band with the actual projected source triangles.
  sample.partition=poly=>{
    const candidates=new Set(),xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    for(let i=Math.floor(Math.min(...xs)/size);i<=Math.floor(Math.max(...xs)/size);i++)for(let j=Math.floor(Math.min(...ys)/size);j<=Math.floor(Math.max(...ys)/size);j++)for(const tri of bins.get(i+'/'+j)||[])candidates.add(tri);
    const pieces=[];
    for(const tri of candidates){
      let clipped=poly;const corners=[tri.a,tri.b,tri.c],sign=Math.sign(tri.den);
      for(let k=0;k<3&&clipped.length;k++){
        const a=corners[k],b=corners[(k+1)%3],distance=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),out=[];
        for(let i=0;i<clipped.length;i++){const p=clipped[i],q=clipped[(i+1)%clipped.length],dp=distance(p),dq=distance(q);if(dp>=0)out.push(p);if((dp<0)!==(dq<0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
        clipped=out;
      }
      if(clipped.length<3)continue;
      const centre=clipped.reduce((a,p)=>[a[0]+p[0]/clipped.length,a[1]+p[1]/clipped.length],[0,0]);
      if(hit(...centre)?.tri===tri)pieces.push(clipped);
    }
    return pieces;
  };
  return sample;
}
function compactFaceFormDepth(x,y){
  let depth=0;for(const f of COMPACT_FACE_ANATOMY.forms){const r=Math.hypot((x-f.x)/f.rx,(y-f.y)/f.ry);if(r<1)depth+=f.z*(1-r)**4*(1+4*r);}
  const rail=COMPACT_FACE_ANATOMY.cheekRail,ax=Math.abs(x),rows=rail.stations;
  if(y>rows[0][0]&&y<rows[rows.length-1][0]&&ax>rail.innerM&&ax<rail.outerM){
    const smooth=v=>{const t=clamp(v,0,1);return t*t*t*(t*(t*6-15)+10);};
    const lateral=smooth((ax-rail.innerM)/(rail.shoulderInM-rail.innerM))
      *(1-smooth((ax-rail.shoulderOutM)/(rail.outerM-rail.shoulderOutM)));
    depth+=compactLipCurve(rows,y)*lateral;
  }
  return depth;
}
function compactFaceBump(x,y,cx,cy,rx,ry,amplitude){
  const r=Math.hypot((x-cx)/rx,(y-cy)/ry);return r<1?amplitude*(1-r)**4*(1+4*r):0;
}
function compactPerioralDepth(x,y){return compactMuzzleDepth(x,y);}
// Shape-preserving cubic rails retain the intended peaks without overshoot.
function compactLipTangent(rows,i,k,freeSlope=false,endSlope=false){
  if(i===0)return freeSlope?(rows[1][k]-rows[0][k])/(rows[1][0]-rows[0][0]):0;
  if(i===rows.length-1)return endSlope?(rows[i][k]-rows[i-1][k])/(rows[i][0]-rows[i-1][0]):0;
  const a=rows[i-1],b=rows[i],c=rows[i+1],h0=b[0]-a[0],h1=c[0]-b[0],d0=(b[k]-a[k])/h0,d1=(c[k]-b[k])/h1;
  if(d0*d1<=0)return 0;
  const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/d0+w1/d1);
}
function compactLipCurve(rows,x,k=1,freeSlope=false,endSlope=false){
  if(x<=rows[0][0])return rows[0][k];if(x>=rows[rows.length-1][0])return rows[rows.length-1][k];
  let i=0;while(i<rows.length-2&&x>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],span=b[0]-a[0],t=(x-a[0])/span,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*span*compactLipTangent(rows,i,k,freeSlope,endSlope)+(-2*t3+3*t2)*b[k]+(t3-t2)*span*compactLipTangent(rows,i+1,k,freeSlope,endSlope);
}
function compactLipOutline(x){return compactAnatomicalLipOutline(x);}
// The first section turns around the free edge in 3D: dy/dr reaches zero at
// contact, while dz/dr stays positive. It joins the returning inner lip.
function compactLipRadial(r){const width=.16;if(r>=width)return r;const t=r/width;return width*(2*t*t-t*t*t);}
function compactLipReliefDepth(u,t,upper){return compactAnatomicalLipRelief(u,t*COMPACT_FACE_ANATOMY.lips.apron,upper);}
// C2 cubic guide with clamped end tangents. Independent Gaussian lobules and
// rotated strips made the old base a shelf; these rails describe the complete
// transverse section, including the columella, sill and paired alar volume.
function compactFaceGuideSpline(xs,values,firstSlope=0,lastSlope=0){
  const count=xs.length,h=xs.slice(1).map((x,i)=>x-xs[i]),a=new Float64Array(count),b=new Float64Array(count),c=new Float64Array(count),d=new Float64Array(count);
  b[0]=2*h[0];c[0]=h[0];d[0]=6*((values[1]-values[0])/h[0]-firstSlope);
  for(let i=1;i<count-1;i++){a[i]=h[i-1];b[i]=2*(h[i-1]+h[i]);c[i]=h[i];d[i]=6*((values[i+1]-values[i])/h[i]-(values[i]-values[i-1])/h[i-1]);}
  a[count-1]=h[count-2];b[count-1]=2*h[count-2];d[count-1]=6*(lastSlope-(values[count-1]-values[count-2])/h[count-2]);
  for(let i=1;i<count;i++){const f=a[i]/b[i-1];b[i]-=f*c[i-1];d[i]-=f*d[i-1];}
  const second=new Float64Array(count);second[count-1]=d[count-1]/b[count-1];
  for(let i=count-2;i>=0;i--)second[i]=(d[i]-c[i]*second[i+1])/b[i];
  return x=>{if(x<=xs[0])return values[0];if(x>=xs[count-1])return values[count-1];let i=0;while(i<count-2&&x>xs[i+1])i++;
    const span=h[i],left=(xs[i+1]-x)/span,right=(x-xs[i])/span;
    return left*values[i]+right*values[i+1]+((left**3-left)*second[i]+(right**3-right)*second[i+1])*span*span/6;
  };
}
function compactFaceGeneratedMesh(name,positions,normals,indices,head,scale){
  const vertices=positions.length/3,ids=new Uint16Array(vertices*COMPACT_INFLUENCES),weights=new Uint16Array(ids.length);
  for(let i=0;i<vertices;i++){ids[i*COMPACT_INFLUENCES]=head;weights[i*COMPACT_INFLUENCES]=65535;}
  return {name,sourceGroup:'procedural-facial-anatomy',origin:[0,0,0],extent:[1,1,1],vertices,triangles:indices.length/3,
    canonicalPositions:Float32Array.from(positions),positions:Float32Array.from(positions,p=>p*scale),normals:Int16Array.from(normals),indices:Uint16Array.from(indices),
    binding:{ids,weights,colors:new Uint8Array(vertices*3),groupCounts:{head:vertices},maximumWeightError:0}};
}
// The dorsal roof has a broad, gently curved front plane. A C2 bevel turns
// into the sidewall and returns to the actual cheek value AND tangent. The
// former cosine ridge made a narrow rounded rod even after smoothing.
// This is an authored sculpt profile, not a measured population template.
function compactNasalBridgeDepth(x,half,cheekDepth,cheekSlope,centreDepth,y=1.519){
  // The nasal body's width is independent of the distant cheek attachment.
  // Bone and lateral-cartilage stations change the front plane and shoulder;
  // all millimetre values are authored, not measured population anatomy.
  const rows=COMPACT_FACE_ANATOMY.nose.bridgeSections,front=compactLipCurve(rows,y,1),body=compactLipCurve(rows,y,2);
  const q=clamp(Math.abs(x)/half,0,1),bedCentre=cheekDepth-cheekSlope*half*.5;
  const bed=bedCentre+cheekSlope*half*.5*q*q,t=clamp((Math.abs(x)-front)/(body-front),0,1);
  const bevel=t*t*t*(t*(t*6-15)+10),ridge=clamp(1-bevel,0,1)**1.80;
  return bed+(centreDepth-bedCentre)*ridge;
}
// The nasal wall rolls over a narrow rim before entering the vestibule.
// The old broad quadratic bowl left a visible shallow skin-coloured floor.
// Shared t=1 position and zero rim tangent remain exact; the interior is now
// a monotone loft with appreciable depth immediately behind that small roll.
function compactNostrilDepth(t){
  return COMPACT_FACE_ANATOMY.nostrils.depth*compactLipCurve([[0,1],[0.42,0.99],[0.7,0.91],[0.80,0.75],[0.88,0.40],[0.94,0.11],[1,0]],clamp(t,0,1));
}
function compactCreateFaceAnatomy(meshes,rig,scale){
  const p=COMPACT_FACE_ANATOMY,nx=p.columns,ny=p.rows,[x0,x1,y0,y1]=p.bounds,dx=(x1-x0)/nx,dy=(y1-y0)/ny,head=rig.jointIds.get('head');
  if(!Number.isInteger(head))throw Error('面部结构缺少头部绑定');
  const sample=compactFaceRaySampler(meshes),raw=new Float64Array((nx+1)*(ny+1)),valid=new Uint8Array(raw.length),height=new Float64Array(raw.length);let observed=0;
  const at=(i,j)=>j*(nx+1)+i;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const z=sample(x0+i*dx,y0+j*dy),k=at(i,j);raw[k]=z??NaN;if(z!==null){valid[k]=1;observed++;}}
  // Fill only derivative support inside source apertures. Triangles touching
  // missing samples remain omitted, preserving the eye and mouth openings.
  for(let pass=0;pass<24;pass++){const next=raw.slice();let missing=0;for(let j=1;j<ny;j++)for(let i=1;i<nx;i++){const k=at(i,j);if(Number.isFinite(raw[k]))continue;const near=[raw[k-1],raw[k+1],raw[k-nx-1],raw[k+nx+1]].filter(Number.isFinite);if(near.length)next[k]=near.reduce((a,b)=>a+b,0)/near.length;else missing++;}raw.set(next);if(!missing)break;}
  const [cx,cy,rx,ry]=p.ellipse,smoothedX=new Float64Array(raw.length),smoothed=new Float64Array(raw.length);
  // Regularize the coarse source shell before sculpting anatomical volumes.
  // A separable metric kernel removes inherited triangular planes throughout
  // forehead, cheeks and chin instead of retaining a faceted outer mask ring.
  for(let axis=0;axis<2;axis++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    let sum=0,total=0;for(let n=-18;n<=18;n++){const q=(axis?smoothedX:raw)[at(clamp(i+(axis?0:n),0,nx),clamp(j+(axis?n:0),0,ny))];if(!Number.isFinite(q))continue;const d=n*(axis?dy:dx),w=Math.exp(-d*d/(2*p.smoothingRadiusM**2));sum+=q*w;total+=w;}
    (axis?smoothed:smoothedX)[at(i,j)]=total?sum/total:.16;
  }
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const k=at(i,j),x=x0+i*dx,y=y0+j*dy,z=Number.isFinite(raw[k])?raw[k]:smoothed[k];
    const r=Math.hypot((x-cx)/rx,(y-cy)/ry),t=clamp((1-r)/.14,0,1),blend=t*t*(3-2*t);
    height[k]=z+blend*(smoothed[k]-z+compactFaceFormDepth(x,y)+.00003);
  }
  // Capture the broad unsculpted bed before nasal reconstruction. A nasal
  // column must never become an oral Hermite boundary and propagate downward.
  const originalHeight=height.slice();
  // Remove the inherited lip ridge before constructing vermilion. A bounded
  // Hermite bed preserves the top/bottom skin tangents and the lateral face.
  const oralHeight=originalHeight,readOral=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (oralHeight[at(i,j)]*(1-a)+oralHeight[at(i+1,j)]*a)*(1-b)+(oralHeight[at(i,j+1)]*(1-a)+oralHeight[at(i+1,j+1)]*a)*b;};
  const oralLo=1.433,oralHi=1.476,oralSpan=oralHi-oralLo;
  // Average the attachment profiles laterally so source triangle gradients do
  // not become vertical bands across the new perioral support.
  const oralProfile=x=>{const row=[0,0,0,0];let total=0;for(let k=-5;k<=5;k++){const xx=x+k*dx,w=Math.exp(-.5*(k*dx/.0023)**2),e=.001;
    const values=[readOral(xx,oralLo),readOral(xx,oralHi),(readOral(xx,oralLo+e)-readOral(xx,oralLo-e))/(2*e),(readOral(xx,oralHi+e)-readOral(xx,oralHi-e))/(2*e)];
    for(let q=0;q<4;q++)row[q]+=values[q]*w;total+=w;}return row.map(v=>v/total);};
  const oralProfiles=Array.from({length:nx+1},(_,i)=>oralProfile(x0+i*dx));
  for(let j=0;j<=ny;j++){const y=y0+j*dy;if(y<=oralLo||y>=oralHi)continue;const t=(y-oralLo)/oralSpan,t2=t*t,t3=t2*t;
    for(let i=0;i<=nx;i++){const x=x0+i*dx,u=clamp((.034-Math.abs(x-p.lips.centreX))/.012,0,1);if(!u)continue;
      const [a,b,d0,d1]=oralProfiles[i],m0=clamp(d0,-.35,.65)*oralSpan,m1=clamp(d1,-.35,.65)*oralSpan;
      const bed=(2*t3-3*t2+1)*a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b+(t3-t2)*m1;
      const v=clamp(Math.min((y-oralLo)/.011,(oralHi-y)/.011),0,1),blend=u*u*(3-2*u)*v*v*(3-2*v);
      height[at(i,j)]+=(bed-height[at(i,j)])*blend;
    }}
  // Replace the inherited central-chin facets with a second bounded Hermite
  // bed. It preserves the upper/lower attachment values and tangents, while
  // lateral averaging removes the horizontal source layers visible in closeup.
  const chinSource=height.slice(),readChin=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (chinSource[at(i,j)]*(1-a)+chinSource[at(i+1,j)]*a)*(1-b)+(chinSource[at(i,j+1)]*(1-a)+chinSource[at(i+1,j+1)]*a)*b;};
  const chinLo=1.4270,chinHi=1.4495,chinSpan=chinHi-chinLo;
  const chinProfile=x=>{const row=[0,0,0,0];let total=0;for(let k=-7;k<=7;k++){const xx=x+k*dx,w=Math.exp(-.5*(k*dx/.0032)**2),e=.0011;
    const values=[readChin(xx,chinLo),readChin(xx,chinHi),(readChin(xx,chinLo+e)-readChin(xx,chinLo-e))/(2*e),(readChin(xx,chinHi+e)-readChin(xx,chinHi-e))/(2*e)];
    for(let q=0;q<4;q++)row[q]+=values[q]*w;total+=w;}return row.map(v=>v/total);};
  const chinProfiles=Array.from({length:nx+1},(_,i)=>chinProfile(x0+i*dx));
  for(let j=0;j<=ny;j++){const y=y0+j*dy;if(y<=chinLo||y>=chinHi)continue;const t=(y-chinLo)/chinSpan,t2=t*t,t3=t2*t;
    for(let i=0;i<=nx;i++){const x=x0+i*dx,u=clamp((.037-Math.abs(x-p.lips.centreX))/.013,0,1);if(!u)continue;
      const [a,b,d0,d1]=chinProfiles[i],m0=clamp(d0,-.35,.55)*chinSpan,m1=clamp(d1,-.35,.55)*chinSpan;
      const bed=(2*t3-3*t2+1)*a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b+(t3-t2)*m1;
      const v=clamp(Math.min((y-chinLo)/.0065,(chinHi-y)/.0065),0,1),blend=.82*u*u*(3-2*u)*v*v*(3-2*v);
      height[at(i,j)]+=(bed-height[at(i,j)])*blend;
    }}
  // Reapply bounded columella, philtral, labiomental and mentalis volumes after
  // the inherited oral and central-chin ridges have been replaced.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const x=x0+i*dx,y=y0+j*dy;height[at(i,j)]+=compactPerioralDepth(x,y);}
  // The oral commissures are shallow three-dimensional insertions, not two
  // sharp lip wedges meeting at a black point.
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const x=x0+i*dx,y=y0+j*dy,q=compactLipOutline(x),r=Math.hypot((Math.abs(x-p.lips.centreX)-p.lips.halfWidth*.975)/.0044,(y-q.seam)/.0033);
    if(r<1)height[at(i,j)]-=.00034*Math.pow(1-r,4)*(1+4*r);
  }
  // Reconstruct the nose only after the broad oral bed. The nostril sill is a
  // bridge from columellar base to ala and from vestibule to upper lip, rather
  // than a common horizontal under-nose plane (Kim & Jeong, 2019, Fig. 14-16:
  // https://pubmed.ncbi.nlm.nih.gov/31256550/).
  // Each cross-section varies across the columella, nostril and alar station;
  // no post-sculpt rotation forces all of these into the same underside angle.
  const nose=p.nose,noseBase=height.slice(),guideY=nose.crossSections.map(row=>row[0]);
  const centreGuide=compactFaceGuideSpline(nose.centreline.map(row=>row[0]),nose.centreline.map(row=>row[1]));
  const transverseGuides=nose.guideX.map((_,i)=>compactFaceGuideSpline(guideY,nose.crossSections.map(row=>row[i+1])));
  const readNoseBase=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;return (noseBase[at(i,j)]*(1-a)+noseBase[at(i+1,j)]*a)*(1-b)+(noseBase[at(i,j+1)]*(1-a)+noseBase[at(i+1,j+1)]*a)*b;};
  const noseLo=guideY[0],noseHi=guideY[guideY.length-1],half=nose.cheekHalfWidth;
  for(let j=0;j<=ny;j++){
    const y=y0+j*dy;if(y<=noseLo||y>=noseHi)continue;
    const left=readNoseBase(-half,y),right=readNoseBase(half,y),mid=(left+right)*.5,projection=centreGuide(y)-mid;
    // Fit the sidewall height AND transverse tangent to the actual cheek.
    // A zero-valued, zero-slope chord at a fixed x forced an artificial long
    // gutter alongside the nose even when every derivative was continuous.
    const e=.0005,fittedSidewall=(readNoseBase(-nose.sidewallX,y)+readNoseBase(nose.sidewallX,y))*.5;
    // The inherited sidewall contains a second nasal shoulder. Keeping that
    // interior anchor verbatim made the rebuilt bridge flatten and then fall
    // again (a long highlight trough). Keep the actual cheek endpoint/tangent,
    // but regularize this interior station toward the alar-to-cheek chord.
    // The basal ala retains its separate three-dimensional projection.
    const station=nose.guideX.length-1,alarDepth=mid+projection*transverseGuides[station](y);
    const sideFraction=(nose.sidewallX-nose.guideX[station])/(half-nose.guideX[station]);
    const shoulder=alarDepth+(mid-alarDepth)*sideFraction;
    const bridgeWeight=.75*compactPerioralSmooth((y-1.487)/.010)*(1-compactPerioralSmooth((y-1.523)/.010));
    const sidewall=fittedSidewall+(shoulder-fittedSidewall)*bridgeWeight;
    const endSlope=(readNoseBase(half+e,y)-readNoseBase(half-e,y)+readNoseBase(-half-e,y)-readNoseBase(-half+e,y))/(4*e);
    const lateralGuide=compactFaceGuideSpline([...nose.guideX,nose.sidewallX,half],[...transverseGuides.map(fn=>mid+projection*fn(y)),sidewall,mid],0,endSlope);
    const dorsal=compactPerioralSmooth((y-1.488)/.013)*(1-compactPerioralSmooth((y-1.526)/.015));
    const vertical=compactPerioralSmooth((y-noseLo)/nose.lowerBlendM)*(1-compactPerioralSmooth((y-(noseHi-nose.upperBlendM))/nose.upperBlendM));
    for(let i=0;i<=nx;i++){
      const x=x0+i*dx,ax=Math.abs(x);if(ax>=half)continue;
      const lateral=1-compactPerioralSmooth((ax-nose.lateralBlendStartM)/(half-nose.lateralBlendStartM));
      const basal=lateralGuide(ax)+(right-left)*x/(2*half);
      const bridge=compactNasalBridgeDepth(ax,half,mid,endSlope,centreGuide(y),y)+(right-left)*x/(2*half);
      const basalDelta=(basal-height[at(i,j)])*lateral;
      height[at(i,j)]+=(basalDelta+(bridge-height[at(i,j)]-basalDelta)*dorsal)*vertical;
    }
  }
  const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
  const sculptSurface=(x,y)=>{const u=clamp((x-x0)/dx,0,nx-.00001),v=clamp((y-y0)/dy,0,ny-.00001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,rows=[];for(let k=-1;k<=2;k++){const jj=clamp(j+k,0,ny),sample=n=>height[at(clamp(i+n,0,nx),jj)];rows.push(cubic(sample(-1),sample(0),sample(1),sample(2),a));}return cubic(...rows,b);};
  // The complete sculpt, including chin support applied after smoothing, must
  // return to the actual source triangles. Matching the initial height grid
  // alone left a 1.43 mm step at the chin and unsupported strips at the temples.
  const sourceBlend=(x,y)=>{const r=Math.hypot((x-cx)/rx,(y-cy)/ry),t=clamp((r-.80)/.18,0,1);return t*t*t*(t*(t*6-15)+10);};
  const joinedSurface=(x,y)=>{const z=sculptSurface(x,y),t=sourceBlend(x,y),original=t?sample(x,y):null;return original===null?z:z+(original-z)*t;};
  // Build the lower chin as one longitudinal transition. Multiplying a
  // 2.9 mm sculpt/source difference by the old radial fade introduced a new
  // reverse slope (w' * heightDifference), even where both input profiles
  // receded. Match the actual lower source and upper sulcus position/tangent
  // directly; do not stack a second mentalis bump over that connection.
  const chinRails=new Map(),chinEndpoints=new Map();
  const chinEndpoint=x=>{
    const key=x.toFixed(9);if(chinEndpoints.has(key))return chinEndpoints.get(key);
    const side=(x-cx)/rx,lo=cy-ry*Math.sqrt(Math.max(0,1-side*side))+.001,hi=1.4455,span=hi-lo;
    const weight=(1-compactPerioralSmooth((Math.abs(x-p.lips.centreX)-.022)/.016))*compactPerioralSmooth((span-.006)/.006);
    const e=.00020,a=joinedSurface(x,lo),b=joinedSurface(x,hi),d0=(joinedSurface(x,lo+e)-joinedSurface(x,lo-e))/(2*e),d1=(joinedSurface(x,hi+e)-joinedSurface(x,hi-e))/(2*e);
    // Each source triangle is planar at the lower anchor. The upper endpoint
    // retains the sulcus curvature, so the transition does not shift the
    // lower-lip valley or introduce a second highlight break there.
    const e2=.0004,k1=clamp((joinedSurface(x,hi+e2)-2*b+joinedSurface(x,hi-e2))/(e2*e2),-250,250);
    const q={lo,hi,span,weight,a,b,d0,d1,k1};chinEndpoints.set(key,q);return q;
  };
  const chinRail=x=>{
    const key=x.toFixed(9);if(chinRails.has(key))return chinRails.get(key);
    const q=chinEndpoint(x);if(!q.weight){chinRails.set(key,null);return null;}
    // Source triangle slopes vary discontinuously across x. Extending each
    // slope through an entire longitudinal rail produced vertical grooves in
    // R19's first render. Filter the endpoint jets laterally as one surface,
    // retaining the exact endpoint residuals only in short attachment collars.
    const fields=['a','b','d0','d1','k1'],mean=Object.fromEntries(fields.map(k=>[k,0]));let total=0;
    for(let i=-8;i<=8;i++){const d=i*.00065,near=chinEndpoint(x+d),w=Math.exp(-.5*(d/.0024)**2);if(near.span<.004)continue;for(const k of fields)mean[k]+=near[k]*w;total+=w;}
    for(const k of fields)mean[k]/=total;
    const m0=mean.d0*q.span,m1=mean.d1*q.span,k1=mean.k1*q.span*q.span,A=mean.b-mean.a-m0,B=m1-m0;
    const coeff=[mean.a,m0,0,10*A-4*B+.5*k1,-15*A+7*B-k1,6*A-3*B+.5*k1];
    const rail={...q,mean,coeff};chinRails.set(key,rail);return rail;
  };
  const surface=(x,y)=>{
    const z=joinedSurface(x,y);if(y>1.4455||Math.abs(x-p.lips.centreX)>.038)return z;
    const q=chinRail(x);if(!q||y<=q.lo)return z;
    const dy0=y-q.lo,dy1=y-q.hi,t=dy0/q.span,collar=.0025;
    const lower=1-compactPerioralSmooth(dy0/collar),upper=1-compactPerioralSmooth(-dy1/collar);
    const h=q.coeff.reduceRight((sum,value)=>sum*t+value,0)
      +lower*(q.a-q.mean.a+(q.d0-q.mean.d0)*dy0)
      +upper*(q.b-q.mean.b+(q.d1-q.mean.d1)*dy1+.5*(q.k1-q.mean.k1)*dy1*dy1);
    return z+(h-z)*q.weight;
  };
  // The source-fitted skin is intentionally detailed. Reusing every lateral
  // microgradient at the lip free edge creates column-aligned ridges when the
  // mouth opens, so the lip bed receives a bounded one-dimensional low-pass.
  // The blend returns exactly to the original skin at the outer attachment.
  const lipBedSurface=(x,y,t)=>{let sum=0,total=0;for(let k=-4;k<=4;k++){const w=Math.exp(-.5*(k/2.2)**2);sum+=surface(x+k*dx,y)*w;total+=w;}
    const smooth=sum/total,a=clamp((t*p.lips.apron-.45)/.55,0,1),attach=a*a*(3-2*a);return smooth+(surface(x,y)-smooth)*attach;};
  const facePoint=(x,y)=>[x,y,surface(x,y)],faceNormal=(x,y)=>{const e=.00012,n=norm(cross(sub(facePoint(x+e,y),facePoint(x-e,y)),sub(facePoint(x,y+e),facePoint(x,y-e)))),r=Math.hypot((x-cx)/rx,(y-cy)/ry),t=clamp((r-.88)/.12,0,1),source=t?sample.normal(x,y):null;return source?norm(n.map((v,k)=>v+(source[k]-v)*t*t*(3-2*t))):n;};
  const positions=[],normals=[],indices=[],parameters=[],vertexMap=new Map(),key=(x,y)=>x.toFixed(10)+'/'+y.toFixed(10),n=p.nostrils;
  const vertex=(x,y)=>{const id=vertexMap.get(key(x,y));if(id!==undefined)return id;const k=positions.length/3;vertexMap.set(key(x,y),k);parameters.push([x,y]);positions.push(...facePoint(x,y));normals.push(...compactEyeEncodeNormal(faceNormal(x,y)));return k;};
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)vertex(x0+i*dx,y0+j*dy);
  // Nostril dimensions live in the actual basal tangent plane, not the frontal
  // XY plane. A fixed XY ellipse exposed the entire opening from the front
  // regardless of how far downward the nose surface faced. Project its two
  // physical tangent axes back into the shared skin parameter domain instead.
  const apertures=[-1,1].map(side=>{
    const cx=side*n.x,cy=n.y,axis=faceNormal(cx,cy),e=.00005;
    const tangent=norm(sub(facePoint(cx+e,cy),facePoint(cx-e,cy)));
    const horizontal=norm(sub(tangent,mul(axis,tangent.reduce((sum,value,k)=>sum+value*axis[k],0)))),vertical=norm(cross(axis,horizontal));
    const angle=side*Math.atan(n.tilt),co=Math.cos(angle),si=Math.sin(angle);
    const major=add(mul(horizontal,co),mul(vertical,si)),minor=sub(mul(vertical,co),mul(horizontal,si));
    const frame=[major[0]*n.rx,minor[0]*n.ry,major[1]*n.rx,minor[1]*n.ry],det=frame[0]*frame[3]-frame[1]*frame[2];
    const uv=q=>{const x=q[0]-cx,y=q[1]-cy;return [(frame[3]*x-frame[1]*y)/det,(-frame[2]*x+frame[0]*y)/det];};
    const parameter=(u,v)=>[cx+frame[0]*u+frame[1]*v,cy+frame[2]*u+frame[3]*v];
    return {side,cx,cy,axis,frame,uv,parameter,rim:new Map(),distance:q=>{const [u,v]=uv(q),bend=n.bend*(1-u*u);return u*u+((v-bend)/Math.max(.25,1+n.medialTaper*side*u))**2-1;}};
  });
  const lipAperture={rim:new Map(),rx:.033,ry:.0145,distance:q=>((q[0]-p.lips.centreX)/.033)**2+((q[1]-p.lips.seamY)/.0145)**2-1};
  function clipAperture(poly,hole){
    const out=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=hole.distance(a),db=hole.distance(b);if(da>=0)out.push(a);
      if((da<0)!==(db<0)){let lo=0,hi=1;for(let k=0;k<36;k++){const t=(lo+hi)/2,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if((hole.distance(q)<0)===(da<0))lo=t;else hi=t;}
        const t=(lo+hi)/2,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];out.push(q);hole.rim.set(key(...q),q);}}
    return out;
  }
  // Clip geometry in its original parameter domain. A screen-space discard
  // would cut the returning underside a second time and leave a floating rim.
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=at(i,j),b=a+nx+1;for(const tri of [[a,a+1,b],[a+1,b+1,b]])if(tri.every(k=>valid[k])){
    const sourcePoly=tri.map(k=>parameters[k]),radii=sourcePoly.map(([x,y])=>Math.hypot((x-cx)/rx,(y-cy)/ry));
    const pieces=Math.max(...radii)>.97&&Math.min(...radii)<1.025?sample.partition(sourcePoly):[sourcePoly];
    for(let poly of pieces){for(const hole of [...apertures,lipAperture])if(poly.length)poly=clipAperture(poly,hole);
      for(let k=1;k<poly.length-1;k++){const a=poly[0],b=poly[k],c=poly[k+1],pa=a.map(Math.fround),pb=b.map(Math.fround),pc=c.map(Math.fround);
        // Reject only sub-quantization slivers that collapse or reverse in the
        // Float32 position stream used by the renderer.
        if((pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0])>1e-13)indices.push(vertex(...a),vertex(...b),vertex(...c));}}}}
  const createFittedSkin=()=>{const mesh=compactFaceGeneratedMesh('faceSkin',positions,normals,indices,head,scale);for(let i=0;i<mesh.vertices;i++){const x=positions[i*3],y=positions[i*3+1],t=sourceBlend(x,y),source=t?sample.binding(x,y):null;if(!source)continue;const weights=new Map([...source].map(([id,w])=>[id,w*t]));weights.set(head,(weights.get(head)||0)+1-t);const influences=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,COMPACT_INFLUENCES),total=influences.reduce((s,q)=>s+q[1],0);let sum=0;mesh.binding.weights.fill(0,i*COMPACT_INFLUENCES,(i+1)*COMPACT_INFLUENCES);for(let j=0;j<influences.length;j++){const [id,w]=influences[j],value=Math.round(w/total*65535);mesh.binding.ids[i*COMPACT_INFLUENCES+j]=id;mesh.binding.weights[i*COMPACT_INFLUENCES+j]=value;sum+=value;}mesh.binding.weights[i*COMPACT_INFLUENCES]+=65535-sum;}return mesh;};
  const output=[createFittedSkin()];
  const cavityP=[],cavityN=[],cavityI=[],vestibuleI=[],cavityLight=[],nostrilFrames=[];
  // Analytic aperture-cone visibility, not pigment or a painted shadow.
  // This local approximation is needed when the preview omits shadow maps.
  const cavityVisibility=t=>{const depth=compactNostrilDepth(t),radius=n.ry*Math.max(.4,t);return Math.max(.025,1/(1+2*(depth/radius)**2));};
  for(const hole of apertures){const {side,cx,cy,axis}=hole,start=cavityP.length/3,rings=n.rings,centre=facePoint(cx,cy);
    const angles=[...hole.rim.values()].map(q=>{const [u,v]=hole.uv(q);return Math.atan2((v-n.bend*(1-u*u))/(1+n.medialTaper*side*u),u);}).sort((a,b)=>a-b),segments=angles.length;
    // A shared skin rim, short rounded turn and steep inner wall. The surface
    // and local aperture-light estimate consume the same depth function.
    const point=(a,t)=>{
      // A real rolled vestibular return: the internal wall widens behind the
      // free aperture before narrowing into the passage. The alar side and
      // anterior roof carry more overhang than the medial columellar side.
      // The C2 hook vanishes in position and tangent at the shared skin rim.
      const wing=.5+.5*side*Math.cos(a),roof=Math.max(0,Math.sin(a))**3;
      const hook=(.14+.08*wing+.035*roof)*compactPerioralSmooth((t-.60)/.20)*(1-compactPerioralSmooth((t-.89)/.11));
      const r=t+hook,u=Math.cos(a)*r,v=Math.sin(a)*r*(1+n.medialTaper*side*u)+n.bend*(r*r-u*u),[x,y]=hole.parameter(u,v);
      return sub(facePoint(x,y),mul(axis,compactNostrilDepth(t)));
    };
    for(let i=0;i<=segments;i++)for(let j=0;j<=rings;j++){const a=angles[i%segments],t=.035+.965*j/rings,q=point(a,t),u=sub(point(a+.001,t),point(a-.001,t)),v=sub(point(a,Math.min(1,t+.001)),point(a,Math.max(0,t-.001)));cavityP.push(...q);cavityN.push(...compactEyeEncodeNormal(norm(cross(v,u))));cavityLight.push(cavityVisibility(t),...axis);}
    // Both materials use the very same parametric wall and boundary samples.
    // Their triangle domains are disjoint: skin owns the rolled vestibule,
    // while recessed mucosa owns the deeper cavity, with no coplanar overlay.
    for(let i=0;i<segments;i++)for(let j=0;j<rings;j++){const a=start+i*(rings+1)+j,b=a+rings+1;(j>=rings-n.vestibuleSkinRows?vestibuleI:cavityI).push(a,a+1,b,a+1,b+1,b);}
    const center=cavityP.length/3;cavityP.push(...point(0,0));cavityN.push(...compactEyeEncodeNormal(axis));cavityLight.push(cavityVisibility(0),...axis);
    for(let i=0;i<segments;i++)cavityI.push(center,start+i*(rings+1),start+(i+1)*(rings+1));
    nostrilFrames.push({side,centre,normal:axis,projectedAxes:hole.frame,physicalRadii:[n.rx,n.ry],floorVertex:center,rimVertices:segments,depth:n.depth,vestibuleSkinRows:n.vestibuleSkinRows,sharedWall:true});
  }
  for(const [name,triangles] of [['faceSkin',vestibuleI],['noseInterior',cavityI]]){const mesh=compactFaceGeneratedMesh(name,cavityP,cavityN,triangles,head,scale);mesh.cavityLight=Float32Array.from(cavityLight);output.push(mesh);}
  // Continuous upper and lower vermilion, with a narrow recessed closure line.
  const lp=p.lips,lipP=[],lipN=[],lipI=[],mouthP=[],mouthN=[],mouthI=[];
  // One closed annulus connects the oral fissure to an actual clipped facial
  // boundary. No overlapping skin apron or fragment-discard attachment.
  const boundaryEdges=new Map();
  for(let i=0;i<indices.length;i+=3)for(const [a,b] of [[0,1],[1,2],[2,0]]){const u=indices[i+a],v=indices[i+b],key=Math.min(u,v)+'/'+Math.max(u,v);boundaryEdges.set(key,(boundaryEdges.get(key)||0)+1);}
  const lipBoundaryIds=new Set(),lipNeighbours=new Map();
  for(const [key,count] of boundaryEdges)if(count===1){const ids=key.split('/').map(Number);if(ids.every(id=>Math.abs(lipAperture.distance(parameters[id]))<.1))for(let k=0;k<2;k++){const id=ids[k];lipBoundaryIds.add(id);if(!lipNeighbours.has(id))lipNeighbours.set(id,[]);lipNeighbours.get(id).push(ids[1-k]);}}
  // Near tangencies a surviving grid vertex can lie between two intersections.
  // Include it: intersection points alone do not describe the actual mesh edge.
  const angleOf=id=>Math.atan2((parameters[id][1]-lp.seamY)/lipAperture.ry,(parameters[id][0]-lp.centreX)/lipAperture.rx);
  const first=[...lipBoundaryIds].sort((a,b)=>angleOf(a)-angleOf(b))[0],ordered=[first];let previous=-1,current=first;
  do{const candidates=lipNeighbours.get(current).filter(id=>id!==previous);if(previous<0)candidates.sort((a,b)=>angleOf(a)-angleOf(b));const next=candidates[0];if(next===first)break;if(next===undefined||ordered.includes(next))throw Error('Nonmanifold oral attachment');ordered.push(next);previous=current;current=next;}while(ordered.length<=lipBoundaryIds.size);
  // The free edge turns sharply around a very narrow neutral aperture. The
  // clipped face grid does not necessarily contain either commissure angle;
  // spanning it with one long quad creates an under-resolved fold. Insert
  // corner samples by splitting the actual face boundary, never by leaving
  // unattached lip vertices along a second independently sampled ellipse.
  const splitEdges=new Map(),refined=[],tau=2*Math.PI;
  for(let i=0;i<ordered.length;i++){
    const a=ordered[i],b=ordered[(i+1)%ordered.length],a0=angleOf(a),b0=angleOf(b)+(i===ordered.length-1?tau:0);
    const nearCorner=Math.min(Math.abs(Math.sin(a0)),Math.abs(Math.sin(b0)))<.14;
    const cuts=[],count=nearCorner?Math.max(1,Math.ceil((b0-a0)/.003)):1;
    for(let k=1;k<count;k++)cuts.push(a0+(b0-a0)*k/count);
    for(const angle of [-Math.PI,0,Math.PI,2*Math.PI])if(angle>a0+1e-9&&angle<b0-1e-9)cuts.push(angle);
    cuts.sort((x,y)=>x-y);const inserted=[];
    for(const angle of cuts){if(inserted.length&&Math.abs(angleOf(inserted[inserted.length-1])-angle)<1e-8)continue;
      let lo=0,hi=1;for(let k=0;k<40;k++){const f=(lo+hi)/2,pa=parameters[a],pb=parameters[b],x=pa[0]+(pb[0]-pa[0])*f,y=pa[1]+(pb[1]-pa[1])*f;let q=Math.atan2((y-lp.seamY)/lipAperture.ry,(x-lp.centreX)/lipAperture.rx);while(q<a0)q+=tau;if(q<angle)lo=f;else hi=f;}
      const f=(lo+hi)/2,pa=parameters[a],pb=parameters[b];inserted.push(vertex(pa[0]+(pb[0]-pa[0])*f,pa[1]+(pb[1]-pa[1])*f));
    }
    refined.push(a,...inserted);if(inserted.length)splitEdges.set(a+'/'+b,inserted);
  }
  if(splitEdges.size){
    const refinedIndices=[];
    for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3),poly=[];let changed=false;
      for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];poly.push(a);let split=splitEdges.get(a+'/'+b);if(!split){const reverse=splitEdges.get(b+'/'+a);if(reverse)split=reverse.slice().reverse();}if(split){poly.push(...split);changed=true;}}
      if(!changed){refinedIndices.push(...tri);continue;}
      const centre=vertex(tri.reduce((sum,id)=>sum+parameters[id][0],0)/3,tri.reduce((sum,id)=>sum+parameters[id][1],0)/3);
      for(let j=0;j<poly.length;j++)refinedIndices.push(centre,poly[j],poly[(j+1)%poly.length]);
    }
    indices.length=0;for(const id of refinedIndices)indices.push(id);
    output[0]=createFittedSkin();
  }
  const lipRim=refined.map(id=>parameters[id]);
  const lipAngles=refined.map(id=>{let angle=angleOf(id);if(angle<angleOf(refined[0]))angle+=tau;return angle;});
  const rimPoint=angle=>{const tau=2*Math.PI;while(angle<lipAngles[0])angle+=tau;while(angle>=lipAngles[0]+tau)angle-=tau;let lo=0,hi=lipAngles.length;while(lo<hi){const mid=(lo+hi)>>1;if(lipAngles[mid]<=angle)lo=mid+1;else hi=mid;}const i=Math.max(0,lo-1),next=(i+1)%lipRim.length,a=lipRim[i],b=lipRim[next],end=next?lipAngles[next]:lipAngles[0]+tau,f=(angle-lipAngles[i])/(end-lipAngles[i]);return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];};
  const annulusPoint=(angle,t)=>{
    const upper=Math.sin(angle)>=0,xInner=lp.centreX+lp.halfWidth*Math.cos(angle),q=compactLipOutline(xInner),edge=upper?q.top:q.bottom;
    const border=1/lp.apron,outer=clamp((t-border)/(1-border),0,1),attach=outer*outer*(3-2*outer),rim=rimPoint(angle);
    const cap=compactCommissureCap(angle,t*lp.apron);
    const x=xInner+(rim[0]-xInner)*attach+cap.x;
    const endY=rim[1],m0=(edge-q.seam)*(1-border)/border,m1=endY-edge,o2=outer*outer,o3=o2*outer;
    const y=(t<=border?q.seam+(edge-q.seam)*compactLipRadial(t/border):(2*o3-3*o2+1)*edge+(o3-2*o2+outer)*m0+(-2*o3+3*o2)*endY+(o3-o2)*m1)+COMPACT_PERIORAL_STRUCTURE.neutralHalfGapM*Math.tanh(6*Math.sin(angle))*(1-attach);
    const relief=compactLipReliefDepth(q.u,t,upper);
    const fittedY=y+(compactLipOutline(x).seam-q.seam)*(1-attach)+cap.y;
    // The insertion depth belongs to the common perioral bed. A second radial
    // cap indentation propagated onto the apron and made two forked creases.
    return [x,fittedY,lipBedSurface(x,fittedY,Math.min(1,t/border)/lp.apron)+relief];
  };
  for(let i=0;i<lipRim.length;i++){
    const rim=lipRim[i],angle=lipAngles[i];
    for(let j=0;j<=lp.rings;j++){
      const t=j/lp.rings,e=.00005,point=j===lp.rings?facePoint(...rim):annulusPoint(angle,t);
      const a=sub(annulusPoint(angle+e,t),annulusPoint(angle-e,t)),b=sub(annulusPoint(angle,Math.min(1,t+e)),annulusPoint(angle,Math.max(0,t-e)));
      const normal=j===lp.rings?faceNormal(...rim):norm(cross(b,a));
      lipP.push(...point);lipN.push(...compactEyeEncodeNormal(normal));
    }
  }
  for(let i=0;i<lipRim.length;i++)for(let j=0;j<lp.rings;j++){const a=i*(lp.rings+1)+j,b=((i+1)%lipRim.length)*(lp.rings+1)+j;lipI.push(a,a+1,b,a+1,b+1,b);}
  // Surface identity is explicit. Inner mucosa must never be classified by
  // a world/reference Z threshold: face depth varies with the source person.
  const outerLip=compactFaceGeneratedMesh('faceLip',lipP,lipN,lipI,head,scale);
  outerLip.faceBoundaryVertexIds=lipRim.map(q=>vertexMap.get(key(...q)));
  outerLip.lipSurface='vermilion';lipP.length=0;lipN.length=0;lipI.length=0;
  // One returning mucosal ring uses exactly the same circumferential vertices
  // as the outer free edge, including both rounded commissures. Two separate
  // x-sampled strips left unmatched edges and stopped short of the corners.
  const innerRows=10,innerFrames=new Map();
  const innerPoint=(angle,t)=>{
    let frame=innerFrames.get(angle);if(!frame){const a=annulusPoint(angle,0),e=.00005,tangent=sub(annulusPoint(angle+e,0),annulusPoint(angle-e,0)),length=Math.hypot(tangent[0],tangent[1])||1;frame={a,outward:[tangent[1]/length,-tangent[0]/length]};innerFrames.set(angle,frame);}
    const {a,outward}=frame;
    const phi=t*Math.PI/2,thickness=.00065*(1-Math.cos(phi)),depth=lp.innerDepth*(.40+.60*Math.sin(angle)**2);
    return [a[0]+outward[0]*thickness,a[1]+outward[1]*thickness,a[2]-depth*Math.sin(phi)];
  };
  for(let i=0;i<lipRim.length;i++)for(let j=0;j<=innerRows;j++){
    const angle=lipAngles[i],t=j/innerRows,e=.00005,a=sub(innerPoint(angle+e,t),innerPoint(angle-e,t)),b=sub(innerPoint(angle,Math.min(1,t+e)),innerPoint(angle,Math.max(0,t-e)));
    lipP.push(...innerPoint(angle,t));
    if(j===0)lipN.push(outerLip.normals[i*(lp.rings+1)*2],outerLip.normals[i*(lp.rings+1)*2+1]);
    else lipN.push(...compactEyeEncodeNormal(norm(cross(a,b))));
  }
  for(let i=0;i<lipRim.length;i++)for(let j=0;j<innerRows;j++){const a=i*(innerRows+1)+j,b=((i+1)%lipRim.length)*(innerRows+1)+j;lipI.push(a,b,a+1,a+1,b,b+1);}
  // Authored vestibule / arched oral chamber, informed by anatomy principles:
  // https://www.ncbi.nlm.nih.gov/books/NBK545271/ . Dimensions are art settings.
  const mouthRings=24,mouthSegments=lipAngles.length,mouthLight=[];
  const mouthCentreDepth=surface(lp.centreX,lp.seamY),mouthDepth=.046;
  // The chamber expands behind the dental arch, then rounds into a deeper
  // back wall. One smooth parameter surface replaces the shallow large fan.
  const mouthPoint=(a,t)=>{
    const front=innerPoint(a,1),phi=t*Math.PI/2,r=Math.cos(phi),arch=Math.sin(Math.PI*t),side=Math.sin(a);
    const height=side>=0?.0185:.0200;
    return [lp.centreX+(front[0]-lp.centreX)*r*(1+.10*arch),
      lp.seamY+(front[1]-lp.seamY)*r+height*arch*side,
      mouthCentreDepth+(front[2]-mouthCentreDepth)*r*r-mouthDepth*Math.sin(phi)];
  };
  const mouthVisibility=(a,t)=>{
    const front=innerPoint(a,1),depth=Math.max(0,front[2]-mouthPoint(a,t)[2]);
    const apertureRadius=Math.sqrt(lp.halfWidth*.010);
    return Math.max(.045,1/(1+2*(depth/apertureRadius)**2));
  };
  for(let i=0;i<=mouthSegments;i++)for(let j=0;j<mouthRings;j++){
    const a=lipAngles[i%mouthSegments],t=j/mouthRings;
    mouthP.push(...mouthPoint(a,t));mouthLight.push(mouthVisibility(a,t),0,0,1);
  }
  for(let i=0;i<mouthSegments;i++)for(let j=0;j<mouthRings-1;j++){
    const a=i*mouthRings+j,b=a+mouthRings;mouthI.push(a,b,a+1,a+1,b,b+1);
  }
  const mouthBack=mouthP.length/3;mouthP.push(lp.centreX,lp.seamY,mouthCentreDepth-mouthDepth);
  mouthLight.push(mouthVisibility(Math.PI/2,1),0,0,1);
  for(let i=0;i<mouthSegments;i++)mouthI.push(mouthBack,i*mouthRings+mouthRings-1,(i+1)*mouthRings+mouthRings-1);
  const tongueFloor=compactTongueFloorPatch(mouthP,mouthI,mouthLight,lipAngles,mouthRings,p.oral.tongueFloor);
  for(const normal of tongueFloor.mouthNormals)mouthN.push(...compactEyeEncodeNormal(normal));
  const innerLip=compactFaceGeneratedMesh('faceLip',lipP,lipN,lipI,head,scale);innerLip.lipSurface='mucosa';
  innerLip.outerLipBoundaryVertexIds=lipRim.map((_,i)=>i*(lp.rings+1));innerLip.returnRows=innerRows;
  const mouthInterior=compactFaceGeneratedMesh('mouthInterior',mouthP,mouthN,tongueFloor.mouthIndices,head,scale);
  mouthInterior.cavityLight=Float32Array.from(mouthLight);
  mouthInterior.returnRows=mouthRings-1;
  mouthInterior.chamber={depthM:mouthDepth,roundedBack:true,geometricNormals:true,frontBoundaryVertices:mouthSegments};
  const tongueNormals=tongueFloor.normals.flatMap(compactEyeEncodeNormal);
  const tongue=compactFaceGeneratedMesh('tongue',tongueFloor.positions,tongueNormals,tongueFloor.indices,head,scale);
  tongue.cavityLight=Float32Array.from(tongueFloor.light);
  tongue.mouthBoundaryVertexIds=tongueFloor.boundary;
  tongue.oralFloor=tongueFloor.report;
  output.push(outerLip,innerLip,mouthInterior,tongue);
  // Programmatic oral structures provide layered occlusion for the new local
  // jaw controller. They are authored prototypes rather than measured dental
  // anatomy. Dental domains remain rigid; the attached tongue shares the oral
  // wall field through lip, facial-control and jaw motion.
  const oral=p.oral,oralTarget=()=>({p:[],n:[],i:[]}),upperTeeth=oralTarget(),lowerTeeth=oralTarget(),upperGum=oralTarget(),lowerGum=oralTarget();
  // Crown sections follow cervical, body and incisal/occlusal anatomy rather
  // than resizing one rounded box. Blade-like incisors and the separate canine
  // and premolar forms follow Elsevier Complete Anatomy / Wheeler's anatomy:
  // https://www.elsevier.com/resources/anatomy/skeletal-system/axial-skeleton/maxillary-central-incisor-tooth/23391
  // These compact authoring rails are not measured dental geometry.
  const crownProfiles=[
    [[0,.64,.58],[.14,.83,.91],[.36,.98,1],[.58,1,.87],[.82,.98,.58],[.95,.91,.25],[1,.76,.08]],
    [[0,.62,.60],[.14,.80,.93],[.36,.97,1],[.58,1,.89],[.82,.95,.60],[.95,.85,.26],[1,.67,.09]],
    [[0,.68,.65],[.14,.84,.92],[.36,1,1],[.58,.97,.92],[.80,.84,.67],[.95,.38,.30],[1,.12,.12]],
    [[0,.68,.63],[.14,.85,.88],[.36,1,1],[.58,1,.98],[.82,.97,.90],[.95,.91,.76],[1,.83,.58]]
  ];
  const appendCrown=(target,centre,radii,tooth,upper,rotation)=>{
    const base=target.p.length/3,startIndex=target.i.length,segments=24,rings=20,[cx,cy,cz]=centre,[rx,ry,rz]=radii;
    const profile=crownProfiles[Math.min(tooth,3)],direction=upper?1:-1,co=Math.cos(rotation),si=Math.sin(rotation);
    const rotate=v=>[co*v[0]+si*v[2],v[1],-si*v[0]+co*v[2]];
    const point=(t,angle)=>{
      const sx=Math.cos(angle),sz=Math.sin(angle),width=compactLipCurve(profile,t,1),thickness=compactLipCurve(profile,t,2);
      // Cross-sections remain gently convex across the labial face. Incisor
      // thickness decreases into a blade while cervical width narrows into gum.
      const px=rx*width*sx,pz=rz*thickness*Math.sign(sz)*Math.abs(sz)**.72+rz*.055*Math.sin(Math.PI*t);
      // The closing cutting/occlusal plane stays planar. Rounding is carried
      // by the last section rails, not a fan over a warped boundary that would
      // create tiny saddle facets at the distal incisal corners.
      const offset=rotate([px,direction*ry*(1-2*t),pz]);
      return [cx+offset[0],cy+offset[1],cz+offset[2]];
    };
    for(let ring=0;ring<=rings;ring++){
      const t=(1-Math.cos(Math.PI*ring/rings))*.5;
      for(let segment=0;segment<segments;segment++)target.p.push(...point(t,2*Math.PI*segment/segments));
    }
    const neck=target.p.length/3;target.p.push(cx,cy+direction*ry,cz);
    const edge=target.p.length/3;target.p.push(cx,cy-direction*ry,cz);
    const triangle=(a,b,c)=>{if(upper)target.i.push(a,b,c);else target.i.push(a,c,b);};
    for(let ring=0;ring<rings;ring++)for(let segment=0;segment<segments;segment++){
      const next=(segment+1)%segments,a=base+ring*segments+segment,b=base+ring*segments+next,c=a+segments,d=b+segments;
      triangle(a,b,c);triangle(b,d,c);
    }
    for(let segment=0;segment<segments;segment++){
      const next=(segment+1)%segments,last=base+rings*segments;
      triangle(neck,base+next,base+segment);triangle(edge,last+segment,last+next);
    }
    // Area-weighted normals are derived from the actual closed crown surface,
    // including its thin cutting edge. Lower crowns reverse construction
    // orientation once, rather than repairing winding by flipping normals.
    const normalSums=Array.from({length:target.p.length/3-base},()=>[0,0,0]);
    for(let i=startIndex;i<target.i.length;i+=3){const ids=target.i.slice(i,i+3),points=ids.map(id=>target.p.slice(id*3,id*3+3)),n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
      for(const id of ids)for(let k=0;k<3;k++)normalSums[id-base][k]+=n[k];}
    for(const n of normalSums)target.n.push(...compactEyeEncodeNormal(norm(n)));
  };
  const toothWidths=[.0075,.0060,.0060,.0064,.0061],upperHeights=[.0084,.0076,.0083,.0068,.0064],lowerHeights=[.0073,.0072,.0078,.0065,.0062];
  const appendDentition=(target,upper)=>{const half=upper?oral.upperArchHalfWidth:oral.lowerArchHalfWidth,front=upper?oral.upperFrontZ:oral.lowerFrontZ,depth=upper?oral.upperArchDepth:oral.lowerArchDepth,gumY=upper?oral.upperGumY:oral.lowerGumY,scaleWidth=upper?1:.92;let cursor=oral.toothGap*.5;
    for(let tooth=0;tooth<toothWidths.length;tooth++){const width=toothWidths[tooth]*scaleWidth,x=cursor+width*.5,height=(upper?upperHeights:lowerHeights)[tooth];cursor+=width+oral.toothGap;
      for(const side of [-1,1]){const angle=x/half,px=lp.centreX+side*half*Math.sin(angle),u=Math.min(1,Math.abs(px-lp.centreX)/half),py=gumY+(upper?.00055:-.00045)*Math.pow(u,1.5)+(upper?-height*.5:height*.5),pz=front-depth*(1-Math.cos(angle));
        appendCrown(target,[px,py,pz],[width*.49,height*.5,upper?.0021:.0019],tooth,upper,side*angle*.8);}}
  };
  appendDentition(upperTeeth,true);appendDentition(lowerTeeth,false);
  const appendGum=(target,upper)=>{const segments=oral.gumSegments,sides=oral.gumSides,base=target.p.length/3,half=upper?oral.upperArchHalfWidth:oral.lowerArchHalfWidth,front=(upper?oral.upperFrontZ:oral.lowerFrontZ)-.0015,depth=upper?oral.upperArchDepth:oral.lowerArchDepth,gumY=upper?oral.upperGumY:oral.lowerGumY,ry=upper?.00235:.00215,rz=upper?.0022:.0020;
    for(let segment=0;segment<=segments;segment++){const u=-1+2*segment/segments,x=lp.centreX+half*u,y=gumY+(upper?.00055:-.00045)*Math.pow(Math.abs(u),1.5),z=front-depth*Math.pow(Math.abs(u),1.65);
      for(let side=0;side<sides;side++){const angle=2*Math.PI*side/sides,c=Math.cos(angle),s=Math.sin(angle);target.p.push(x,y+ry*c,z+rz*s);target.n.push(...compactEyeEncodeNormal(norm([0,c/ry,s/rz])));}}
    for(let segment=0;segment<segments;segment++)for(let side=0;side<sides;side++){const next=(side+1)%sides,a=base+segment*sides+side,b=base+(segment+1)*sides+side,c=base+segment*sides+next,d=base+(segment+1)*sides+next;target.i.push(a,c,b,c,d,b);}
  };
  appendGum(upperGum,true);appendGum(lowerGum,false);
  const oralTargets=[['upperTeeth',upperTeeth],['lowerTeeth',lowerTeeth],['upperGum',upperGum],['lowerGum',lowerGum]];
  // Fit the dental assembly behind this person's facial envelope. The
  // tongue is already fitted through its floor and must retain that attachment.
  // A common translation preserves occlusion, arch spacing and surface normals.
  let oralDepthOffset=0;
  for(const [,target] of oralTargets)for(let i=0;i<target.p.length;i+=3)
    oralDepthOffset=Math.min(oralDepthOffset,surface(target.p[i],target.p[i+1])-.0035-target.p[i+2]);
  for(const [name,target] of oralTargets){for(let i=2;i<target.p.length;i+=3)target.p[i]+=oralDepthOffset;output.push(compactFaceGeneratedMesh(name,target.p,target.n,target.i,head,scale));}
  // R25C keeps the procedural beard generator available for later character
  // options, but the current face mother is explicitly clean-shaven.
  const brows=compactCreateBrows(surface),beard=compactBeardGeometry(surface,{lipOutline:compactLipOutline,halfWidth:p.lips.halfWidth,centreX:p.lips.centreX,density:0});
  output.push(compactFaceGeneratedMesh('faceBrow',brows.positions,brows.normals,brows.indices,head,scale));
  if(beard.report.strands)output.push(compactFaceGeneratedMesh('faceBeard',beard.positions,beard.normals,beard.indices,head,scale));
  return {meshes:output,report:{revision:p.revision,grid:[nx+1,ny+1],sourceSamples:observed,forms:p.forms.length,brows:brows.report,beard:beard.report,nostrilFrames,nasalUnderturn:true,innerVermilion:true,explicitLipMaterialDomains:true,continuousLipProfile:true,sharedLipBoundary:true,roundedInnerReturn:true,perioralContinuity:true,philtrum:true,labiomentalCrease:true,mentalisPad:true,jawPerformanceApproximation:true,oralStructures:{upperTeeth:true,lowerTeeth:true,upperGum:true,lowerGum:true,tongue:true,measuredDentition:false},triangles:output.reduce((s,m)=>s+m.triangles,0),sourceCoefficientsModified:false,measuredAnatomy:false}};
}
function compactLipShapeShader(){
  const p=COMPACT_FACE_ANATOMY.lips,rows=p.outline,vec=a=>'vec3('+a.map(v=>v.toFixed(9)).join(',')+')';
  const pieces=rows.slice(0,-1).map((a,i)=>{const b=rows[i+1],span=b[0]-a[0],m0=[1,2,3].map(k=>compactLipTangent(rows,i,k,false,false)*span),m1=[1,2,3].map(k=>compactLipTangent(rows,i+1,k,false,false)*span);
    return 'if(a<='+b[0].toFixed(9)+'){float t=(a-'+a[0].toFixed(9)+')/'+span.toFixed(9)+';float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*'+vec(a.slice(1))+'+(t3-2.*t2+t)*'+vec(m0)+'+(-2.*t3+3.*t2)*'+vec(b.slice(1))+'+(t3-t2)*'+vec(m1)+';}';});
  return 'vec3 compactLipLandmarks(float a){'+pieces.join('')+'return '+vec(rows[rows.length-1].slice(1))+';}\nvec4 compactLipShape(vec3 p){float u=(p.x-('+p.centreX+'))/'+p.halfWidth+';vec3 landmarks=compactLipLandmarks(abs(u));float seam='+p.seamY+'+landmarks.x+.00011*u*max(0.,1.-u*u)+.000035*sin(u*3.14159265359)*max(0.,1.-u*u);return vec4(u,seam,landmarks.y-landmarks.x,landmarks.x-landmarks.z);}';
}
function compactLipOpening(point,amount){
  const p=COMPACT_FACE_ANATOMY.lips,q=compactLipOutline(point[0]),u=(point[0]-p.centreX)/p.halfWidth,v=(point[1]-q.seam)/.019,w=(point[2]-.188)/.040;
  if(Math.abs(u)>=1||Math.abs(v)>=1||Math.abs(w)>=1)return 0;
  return amount*(v>=0?.0015:-.0035)*(1-u*u)**2*(1-v*v)**3*(1-w*w)**2;
}
function compactLipMotionShader(){
  const p=COMPACT_FACE_ANATOMY.lips;
  return `${compactLipShapeShader()}
  uniform float compactLipOpen;
  float compactLipShift(vec3 p){
    vec4 shape=compactLipShape(p);vec3 q=vec3(shape.x,(p.y-shape.y)/.019,(p.z-.188)/.040);
    if(any(greaterThanEqual(abs(q),vec3(1.))))return 0.;
    vec3 e=1.-q*q;return compactLipOpen*(q.y>=0.?.0015:-.0035)*e.x*e.x*e.y*e.y*e.y*e.z*e.z;
  }
  void compactLipMotion(inout vec3 p,inout vec3 n){
    if(faceEligible<.5||compactLipOpen<.00001||abs(p.x-(${p.centreX}))>=${p.halfWidth}||abs(p.y-${p.seamY})>=.020||abs(p.z-.188)>=.040)return;
    // Different free-edge sides are separated by the mouth aperture. Sample
    // derivatives on the same side so the closure discontinuity is never
    // mistaken for a skin tangent or averaged across touching lips.
    float d=compactLipShift(p),e=.000015,seam=compactLipShape(p).y;
    float ey=min(e,max(abs(p.y-seam)*.25,.0000001));
    vec3 g=vec3((compactLipShift(p+vec3(e,0.,0.))-compactLipShift(p-vec3(e,0.,0.)))/(2.*e),
      (compactLipShift(p+vec3(0.,ey,0.))-compactLipShift(p-vec3(0.,ey,0.)))/(2.*ey),
      (compactLipShift(p+vec3(0.,0.,e))-compactLipShift(p-vec3(0.,0.,e)))/(2.*e));
    float ny=n.y/max(.25,1.+g.y);n=normalize(vec3(n.x-g.x*ny,ny,n.z-g.z*ny));p.y+=d;
  }`;
}
function compactCavityJawWeight(point){
  const seam=compactLipOutline(point[0]).seam,t=clamp((point[1]-seam+.00050)/.00100,0,1);
  return 1-t*t*(3-2*t);
}
function compactLipJawWeight(point){
  const q=compactLipOutline(point[0]),side=clamp((point[1]-q.seam+.0000005)/.000001,0,1);
  const sideSmooth=side*side*(3-2*side),arc=Math.sqrt(Math.max(0,1-q.u*q.u));
  return .5+(.5-sideSmooth)*arc;
}
function compactJawMotionShader(){
  const j=COMPACT_FACE_ANATOMY.jaw,lp=COMPACT_FACE_ANATOMY.lips,rows=lp.outline,vec=a=>'vec3('+a.map(v=>v.toFixed(9)).join(',')+')';
  // Differentiate the same Hermite rails used by compactLipShapeShader. Keep
  // millimetre offsets separate from absolute Y to avoid cancellation, and
  // never difference positions across the open mouth's two distinct sides.
  const slopes=rows.slice(0,-1).map((a,i)=>{const b=rows[i+1],span=b[0]-a[0],m0=[1,2,3].map(k=>compactLipTangent(rows,i,k,false,false)*span),m1=[1,2,3].map(k=>compactLipTangent(rows,i+1,k,false,false)*span);
    return 'if(a<='+b[0].toFixed(9)+'){float t=(a-'+a[0].toFixed(9)+')/'+span.toFixed(9)+';return ((6.*t*t-6.*t)*'+vec(a.slice(1))+'+(3.*t*t-4.*t+1.)*'+vec(m0)+'+(-6.*t*t+6.*t)*'+vec(b.slice(1))+'+(3.*t*t-2.*t)*'+vec(m1)+')/'+span.toFixed(9)+';}';});
  return `uniform float compactJawOpen;
  vec3 compactJawLandmarkSlope(float a){${slopes.join('')}return vec3(0.);}
  vec4 compactJawShapeSlope(vec3 rest){
    vec4 shape=compactLipShape(rest);float u=shape.x,envelope=max(0.,1.-u*u);
    vec3 rail=compactJawLandmarkSlope(abs(u))*sign(u)/${lp.halfWidth};
    float asymmetry=abs(u)<1.?.00011*(1.-3.*u*u)+.000035*(3.14159265359*cos(u*3.14159265359)*envelope-2.*u*sin(u*3.14159265359)):0.;
    return vec4(1./${lp.halfWidth},rail.x+asymmetry/${lp.halfWidth},rail.y-rail.x,rail.x-rail.z);
  }
  float compactJawSmoothSlope(float lo,float hi,float x){float t=(x-lo)/(hi-lo);return t<=0.||t>=1.?0.:6.*t*(1.-t)/(hi-lo);}
  // xyz = gradient in canonical rest coordinates; w = unchanged jaw weight.
  vec4 compactJawWeightJet(vec3 rest){
    vec4 shape=compactLipShape(rest),shapeSlope=compactJawShapeSlope(rest);
    float seam=compactLipShape(rest).y,rigidLower=0.;
    if((compactFeature>11.5&&compactFeature<12.5)||(compactFeature>13.5&&compactFeature<14.5))rigidLower=1.;
    // Vermilion, returning mucosa and the oral wall share one rest field.
    // Their coincident boundary vertices must have identical motion.
    // Hair rooted on the clipped oral apron must use its actual host field.
    // The shared blend reaches the outer skin value and gradient at this edge.
    vec2 beardApron=(rest.xy-vec2(${lp.centreX},${lp.seamY}))/vec2(.033,.0145);
    bool oral=(compactFeature>2.5&&compactFeature<3.5)||(compactFeature>9.5&&compactFeature<10.5)||(compactFeature>14.5&&compactFeature<15.5)||
      (compactFeature>16.5&&compactFeature<17.5&&dot(beardApron,beardApron)<1.);
    float lowerLip=oral?1.-smoothstep(-.0000005,.0000005,rest.y-seam):0.;
    vec3 seamGradient=vec3(-shapeSlope.y,1.,0.),lipGradient=vec3(0.),faceGradient=vec3(0.);
    if(oral)lipGradient=-compactJawSmoothSlope(-.0000005,.0000005,rest.y-seam)*seamGradient;
    float lowerFace=0.;
    if(faceEligible>.5&&(compactFeature<.5||oral||(compactFeature>16.5&&compactFeature<17.5))){
      float vertical=1.-smoothstep(${j.skinFullY.toFixed(6)},${j.skinFadeY.toFixed(6)},rest.y);
      float frontal=smoothstep(.118,.165,rest.z),lateral=1.-smoothstep(.040,.074,abs(rest.x));lowerFace=vertical*frontal*(.45+.55*lateral);
      faceGradient=vec3(-.55*vertical*frontal*compactJawSmoothSlope(.040,.074,abs(rest.x))*sign(rest.x),
        -frontal*(.45+.55*lateral)*compactJawSmoothSlope(${j.skinFullY.toFixed(6)},${j.skinFadeY.toFixed(6)},rest.y),
        vertical*(.45+.55*lateral)*compactJawSmoothSlope(.118,.165,rest.z));
    }
    // Blend across the physical clipped mouth aperture, never across a
    // near-zero vermilion height at a corner. The former radial-height blend
    // reversed actual upper-apron triangles and opened the skin attachment.
    if(oral){
      float extent=rest.y>seam?shape.z:shape.w;
      float v=max(0.,1.-shape.x*shape.x),root=sqrt(v),corner=smoothstep(0.,.36,v),arc=root*corner;
      // Preserve the central circular opening. An authored C1 corner taper
      // removes the infinite sqrt slope over only the outer 4.88 mm per side.
      vec3 arcGradient=vec3(v>.00000001?(-2.*shape.x*shapeSlope.x)*(corner/(2.*root)+root*compactJawSmoothSlope(0.,.36,v)):0.,0.,0.);
      lipGradient=lipGradient*arc+(lowerLip-.5)*arcGradient;
      lowerLip=.5+(lowerLip-.5)*arc;
      float vertical=max(0.,abs(rest.y-seam)-extent),horizontal=max(0.,abs(rest.x-(${lp.centreX}))-${lp.halfWidth});
      vec3 verticalGradient=vertical>0.?sign(rest.y-seam)*seamGradient-vec3(rest.y>seam?shapeSlope.z:shapeSlope.w,0.,0.):vec3(0.);
      vec3 horizontalGradient=horizontal>0.?vec3(sign(rest.x-(${lp.centreX})),0.,0.):vec3(0.);
      float inside=length(vec2(horizontal,vertical));
      vec3 insideGradient=inside>.00000001?(horizontal*horizontalGradient+vertical*verticalGradient)/inside:vec3(0.);
      vec2 aperture=(rest.xy-vec2(${lp.centreX},${lp.seamY}))/vec2(.033,.0145);
      float radiusSquared=dot(aperture,aperture),outside=max(0.,1.-radiusSquared)*.025,total=inside+outside;
      vec3 outsideGradient=radiusSquared<1.?vec3(-.050*aperture/vec2(.033,.0145),0.):vec3(0.);
      float ratio=total>.00000001?inside/total:0.,blend=smoothstep(0.,1.,ratio);
      vec3 ratioGradient=total>.00000001?(outside*insideGradient-inside*outsideGradient)/(total*total):vec3(0.);
      lipGradient=mix(lipGradient,faceGradient,blend)+(lowerFace-lowerLip)*compactJawSmoothSlope(0.,1.,ratio)*ratioGradient;
      lowerLip=mix(lowerLip,lowerFace,blend);lowerFace=0.;faceGradient=vec3(0.);
    }
    float weight=clamp(max(max(rigidLower,lowerLip),lowerFace),0.,1.);
    vec3 gradient=rigidLower>=lowerLip?vec3(0.):lipGradient;float chosen=max(rigidLower,lowerLip);
    if(lowerFace>chosen)gradient=faceGradient;
    if(weight<=0.||weight>=1.)gradient=vec3(0.);return vec4(gradient,weight);
  }
  mat3 compactJawIncomingJacobian(vec3 rest){
    // compactJawMotion follows compactLipMotion and compactFace. The weight
    // lives in rest space, so its gradient needs their inverse transpose too.
    // Other feature classes (eyeballs/lids/brows) have zero jaw weight.
    vec3 source=rest;mat3 lipJacobian=mat3(1.);
    if(faceEligible>.5&&compactLipOpen>=.00001&&abs(rest.x-(${lp.centreX}))<${lp.halfWidth}&&abs(rest.y-${lp.seamY})<.020&&abs(rest.z-.188)<.040){
      vec4 shape=compactLipShape(rest),shapeSlope=compactJawShapeSlope(rest);vec3 q=vec3(shape.x,(rest.y-shape.y)/.019,(rest.z-.188)/.040);
      if(all(lessThan(abs(q),vec3(1.)))){
        vec3 e=1.-q*q;float amplitude=compactLipOpen*(q.y>=0.?.0015:-.0035);
        float dv=amplitude*e.x*e.x*(-6.*q.y*e.y*e.y)*e.z*e.z;
        vec3 gradient=vec3(amplitude*(-4.*q.x*e.x)*e.y*e.y*e.y*e.z*e.z/${lp.halfWidth}-dv*shapeSlope.y/.019,
          dv/.019,amplitude*e.x*e.x*e.y*e.y*e.y*(-4.*q.z*e.z)/.040);
        lipJacobian[0].y+=gradient.x;lipJacobian[1].y+=gradient.y;lipJacobian[2].y+=gradient.z;
      }
      source.y+=compactLipShift(rest);
    }
    if(faceEligible<.5||source.y<1.39||source.y>1.585||source.z<.10||abs(source.x)>.092||(faceEnabled<.5&&faceHeatmap<.5))return lipJacobian;
    mat3 faceJacobian=mat3(1.);
    for(int i=0;i<faceCentres.length();i++){
      vec3 q=(source-faceCentres[i])/faceRadii[i];float radius=length(q);if(radius>=1.)continue;
      float t=1.-radius;vec3 d=faceOffsets[i]*faceEnabled,gradient=-20.*t*t*t*q/faceRadii[i];
      faceJacobian+=outerProduct(d,gradient);
    }
    for(int i=0;i<faceMuscleCentres.length();i++){
      float activation=faceMuscles[i]*faceEnabled;if(activation<.00001)continue;
      vec3 relative=source-faceMuscleCentres[i],q=relative/faceMuscleRadii[i];float radiusSquared=dot(q,q);if(radiusSquared>=1.)continue;
      float t=1.-radiusSquared,w=t*t*t;mat3 strain=faceMuscleStrain[i];vec3 d=faceMuscleBias[i]+strain*relative,gradient=-6.*t*t*q/faceMuscleRadii[i];
      faceJacobian+=activation*(w*strain+outerProduct(d,gradient));
    }
    return faceJacobian*lipJacobian;
  }
  void compactJawMotion(inout vec3 p,inout vec3 n,vec3 rest){
    float amount=clamp(compactJawOpen,0.,1.);if(amount<.00001)return;
    vec4 jet=compactJawWeightJet(rest);float weight=jet.w;if(weight<.00001)return;
    float angle=amount*weight*${j.maxRotationRad.toFixed(6)},c=cos(angle),s=sin(angle);vec3 pivot=vec3(0.,${j.pivotY.toFixed(6)},${j.pivotZ.toFixed(6)}),q=p-pivot;
    if(dot(jet.xyz,jet.xyz)>.00000001){
      mat3 before=compactJawIncomingJacobian(rest);float beforeDet=determinant(before);
      if(abs(beforeDet)>.0000001){
        vec3 gradient=(jet.x*cross(before[1],before[2])+jet.y*cross(before[2],before[0])+jet.z*cross(before[0],before[1]))/beforeDet;
        vec3 translation=vec3(0.,-${j.downM.toFixed(6)}*amount,${j.forwardM.toFixed(6)}*amount);
        vec3 unrotatedDerivative=amount*${j.maxRotationRad.toFixed(6)}*vec3(0.,-q.z,q.y)+vec3(translation.x,c*translation.y+s*translation.z,-s*translation.y+c*translation.z);
        float determinantRatio=1.+dot(gradient,unrotatedDerivative);
        // Sherman-Morrison inverse transpose of R + dp/dweight * grad(weight).
        // Singular positions have no unique normal; retain the rigid fallback.
        if(abs(determinantRatio)>.0000001)n-=gradient*dot(unrotatedDerivative,n)/determinantRatio;
      }
    }
    p=pivot+vec3(q.x,c*q.y-s*q.z,s*q.y+c*q.z)+vec3(0.,-${j.downM.toFixed(6)}*amount*weight,${j.forwardM.toFixed(6)}*amount*weight);
    n=normalize(vec3(n.x,c*n.y-s*n.z,s*n.y+c*n.z));
  }`;
}
function compactFaceSurfaceShader(){
  const p=COMPACT_FACE_ANATOMY,[x,y,rx,ry]=p.ellipse;
  return `uniform float compactFaceSkinMode,compactLipOpen,compactJawOpen,compactLipInner;
  ${compactLipShapeShader()}
  float compactLipMottle(vec2 p);
  float compactLipPigment(vec3 p){
    vec4 q=compactLipShape(p);float extent=p.y>q.y?q.z:q.w,radial=abs(p.y-q.y)/max(extent,.00001);
    float border=1.01+.035*compactLipMottle(vec2(q.x*19.,radial*2.));
    return (1.-smoothstep(border,border+.20,radial))*smoothstep(0.,.38,1.-abs(q.x));
  }
  float compactLipHash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
  float compactLipMottle(vec2 p){
    vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float id=cell.x+cell.y*57.;
    return mix(mix(compactLipHash(id),compactLipHash(id+1.),f.x),mix(compactLipHash(id+57.),compactLipHash(id+58.),f.x),f.y)-.5;
  }
  vec3 compactLipTint(vec3 p){
    vec4 q=compactLipShape(p);float t=abs(p.y-q.y)/max(p.y>q.y?q.z:q.w,.00001);
    float variation=compactLipMottle(vec2(q.x*8.,t*3.));
    float planeTone=p.y>q.y?.90:1.015;
    vec3 outer=vec3(.91,.72,.78)*(planeTone+.10*variation),inner=vec3(.54,.30,.35)*(1.+.025*variation);
    float blood=compactLipMottle(vec2(q.x*27.,t*6.));
    outer*=vec3(1.+.09*blood,1.-.07*blood,1.-.08*blood);
    return mix(outer,inner,compactLipInner);
  }
  float compactLipMoisture(vec3 p){
    vec4 q=compactLipShape(p);float t=abs(p.y-q.y)/max(p.y>q.y?q.z:q.w,.00001);
    float zone=smoothstep(.03,.25,t)*(1.-smoothstep(.60,.95,t))*(1.-smoothstep(.65,.95,abs(q.x)));
    return zone*(p.y>q.y?.28:1.);
  }
  float compactLipContactShadow(vec3 p){
    vec4 q=compactLipShape(p);float u=abs(q.x),width=mix(.00020,.00011,smoothstep(.70,1.,u));
    float line=exp(-pow((p.y-q.y)/width,2.));
    float distribution=.10+.42*exp(-pow(u/.46,2.))+.36*smoothstep(.72,.98,u);
    return line*distribution*(1.-smoothstep(.94,1.04,u))*(1.-smoothstep(.025,.18,max(compactLipOpen,compactJawOpen)));
  }
  float compactLipGrooves(vec2 uv,float count,float seed){
    float phase=(uv.x+1.)*.5*count,cell=floor(phase),grooves=0.;
    for(int i=-1;i<=1;i++){
      float id=cell+float(i),h=compactLipHash(id+seed),h2=compactLipHash(id+seed+71.);
      float centre=id+.18+.64*h+(.05+.12*h2)*sin(uv.y*(2.+h*3.)+h2*6.28);
      float d=(phase-centre)/(.060+.050*h2);
      float lengthMask=smoothstep(.015+.12*h,.16+.15*h,uv.y)*(1.-smoothstep(.52+.20*h2,.82+.16*h2,uv.y));
      grooves+=exp(-.5*d*d)*lengthMask*(.35+.65*h);
    }
    return grooves*(1.-smoothstep(.18,.80,fwidth(phase)));
  }
  float compactLipMicrorelief(vec3 p){
    vec4 q=compactLipShape(p);bool upper=p.y>q.y;
    float t=abs(p.y-q.y)/max(upper?q.z:q.w,.00001),seed=upper?19.:83.;
    vec2 uv=vec2(q.x,t);
    // R is the neutral material coordinate, so creases remain attached and
    // stretch with the lips instead of disappearing when the mouth opens.
    float outerGate=1.-compactLipInner;
    return -.000075*(compactLipGrooves(uv,23.,seed)+.25*compactLipGrooves(uv,47.,seed+31.))*compactLipPigment(p)*outerGate;
  }
  void compactFaceSurfaceMask(vec3 p){
    float oralOpening=max(compactLipOpen,compactJawOpen);
    // The recessed oral wall also backs the neutral fissure; hiding it exposes
    // the scene through submillimetre separation of the upper/lower free edges.
    // The tongue owns part of the closed floor and stays present behind lips.
    if(compactFeature>10.5&&compactFeature<14.5&&oralOpening<.035)discard;
    if(compactFaceSkinMode<.5)return;
    float r=length((p.xy-vec2(${x},${y}))/vec2(${rx},${ry}));
    if(compactFaceSkinMode<1.5&&p.z>.12&&r<1.)discard;
    if(compactFaceSkinMode>1.5&&r>1.)discard;
    // The procedural face now contains a geometric oral opening.
  }`;
}
