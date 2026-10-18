// Geometric inspection only. Rest construction remains independent of this
// runtime map; none of these distances or angles are a material force solution.
// A shared angle field has finite flat stations around rigid attachments. Every
// assembled Canvas part consumes this same C1 field, including both cloth holes,
// seams, laces and underlying panels. The original bend remains outside its band.
const mul = (a, v) => [a[0]*v[0]+a[1]*v[1]+a[2]*v[2], a[3]*v[0]+a[4]*v[1]+a[5]*v[2], a[6]*v[0]+a[7]*v[1]+a[8]*v[2]];
const det = a => a[0]*(a[4]*a[8]-a[5]*a[7])-a[1]*(a[3]*a[8]-a[5]*a[6])+a[2]*(a[3]*a[7]-a[4]*a[6]);

function normalMap(n, j) {
  // Cofactor matrix / determinant = J^{-T}, including both longitudinal and
  // transverse variable-angle derivatives. Rotating the old normal alone is incorrect.
  const c = [j[4]*j[8]-j[5]*j[7], j[5]*j[6]-j[3]*j[8], j[3]*j[7]-j[4]*j[6],
    j[2]*j[7]-j[1]*j[8], j[0]*j[8]-j[2]*j[6], j[1]*j[6]-j[0]*j[7],
    j[1]*j[5]-j[2]*j[4], j[2]*j[3]-j[0]*j[5], j[0]*j[4]-j[1]*j[3]];
  const v = mul(c,n), sign = Math.sign(det(j)), length = Math.hypot(...v);
  if (!length || !sign) throw Error('Singular geometric flex differential');
  return v.map(x => x*sign/length);
}

function smoothInterval(z,lo,hi,a,b) {
  const u=Math.max(0,Math.min(1,(z-lo)/(hi-lo)));
  return {angle:a+(b-a)*u*u*(3-2*u),derivative:(b-a)*6*u*(1-u)/(hi-lo)};
}
export function createFlexContext(last,angleDeg,attachmentSpecs=[]) {
  const angle=angleDeg*Math.PI/180,axis=last.L*.13,band=last.L*.09,base=last.soleTop(.63);
  const original=z=>smoothInterval(z,axis-band,axis+band,0,angle);
  const makeProfile=specs=>{
    const stations=specs.map(a=>({id:a.id,lo:a.flexBoundsMm.min[2],hi:a.flexBoundsMm.max[2],value:original(a.frame.center[2]).angle})).sort((a,b)=>a.lo-b.lo);
    const active=stations.filter(s=>s.value>1e-12&&s.value<angle-1e-12);
    if(!active.length)return {evaluate:original,stations,changedRangeMm:null};
    const start=Math.max(axis-band,...stations.filter(s=>s.value===0).map(s=>s.hi));
    const finish=Math.min(axis+band,...stations.filter(s=>Math.abs(s.value-angle)<1e-12).map(s=>s.lo));
    let previous={hi:start,value:0};
    for(const s of active){if(s.lo<=previous.hi)throw Error('Overlapping rigid attachment stations');previous=s;}
    if(finish<=previous.hi)throw Error('Attachment station exceeds flex transition');
    const evaluate=z=>{
      if(z<=start)return {angle:0,derivative:0};
      let previous={hi:start,value:0};
      for(const s of active){
        if(z<s.lo)return smoothInterval(z,previous.hi,s.lo,previous.value,s.value);
        if(z<=s.hi)return {angle:s.value,derivative:0};previous=s;
      }
      return smoothInterval(z,previous.hi,finish,previous.value,angle);
    };
    return {evaluate,stations,changedRangeMm:[Math.min(axis-band,start),Math.max(axis+band,finish)]};
  };
  const left=attachmentSpecs.filter(a=>a.frame.center[0]<last.center(a.frame.center[2]/last.L+.5));
  const right=attachmentSpecs.filter(a=>!left.includes(a));
  const profiles=left.length&&right.length?[makeProfile(left),makeProfile(right)]:null;
  // Both side plateaus include the actual metal / cloth hole / lace end union. Only
  // the free central laces interpolate the small left/right angle difference.
  // This transverse angle derivative does not affect det(J); rigid regions
  // have zero angle gradient in both x and z.
  const xLeft=profiles?Math.max(...left.map(a=>a.flexBoundsMm.max[0])):0;
  const xRight=profiles?Math.min(...right.map(a=>a.flexBoundsMm.min[0])):1;
  if(profiles&&xRight<=xLeft)throw Error('Rigid side regions overlap across throat');
  const field=p=>{
    if(!profiles){const q=original(p[2]);return {angle:q.angle,dx:0,dz:q.derivative};}
    const a=profiles[0].evaluate(p[2]),b=profiles[1].evaluate(p[2]),w=smoothInterval(p[0],xLeft,xRight,0,1);
    return {angle:a.angle+(b.angle-a.angle)*w.angle,dx:(b.angle-a.angle)*w.derivative,dz:a.derivative+(b.derivative-a.derivative)*w.angle};
  };
  const global=p=>{
    const q=field(p),c=Math.cos(q.angle),s=Math.sin(q.angle),y=p[1]-base,z=p[2]-axis,Y=y*c+z*s,Z=z*c-y*s;
    return {p:[p[0],base+Y,axis+Z],angle:q.angle,j:[1,0,0,Z*q.dx,c,s+Z*q.dz,-Y*q.dx,-s,c-Y*q.dz]};
  };
  const attachments=attachmentSpecs.map(spec=>{
    const q=global(spec.frame.center),c=Math.cos(q.angle),s=Math.sin(q.angle),r=[1,0,0,0,c,s,0,-s,c];
    return {...spec,center:spec.frame.center,currentCenter:q.p,r,currentFrame:{center:q.p,across:mul(r,spec.frame.across),along:mul(r,spec.frame.along),normal:mul(r,spec.frame.normal)}};
  });
  const byId=new Map(attachments.map(a=>[a.id,a]));
  const rigid=(p,a)=>{const v=mul(a.r,p.map((x,i)=>x-a.center[i]));return {p:v.map((x,i)=>x+a.currentCenter[i]),j:a.r};};
  return {angleDeg,attachments,byId,global,evaluate:global,rigid,normalMap,profile:profiles?{type:'shared longitudinal C1 field with rigid attachment stations',sides:profiles.map(p=>({stations:p.stations,changedRangeMm:p.changedRangeMm})),transverseBlendMm:[xLeft,xRight]}:null};
}

export function flexPart(part, context) {
  const g = part.geometry, mode = part.deformation ?? {role:'flexible',attachmentIds:[]};
  if(!context.angleDeg)return;
  const attachment = mode.role==='rigid' ? context.byId.get(mode.attachmentId) : null;
  if(mode.role==='rigid'&&!attachment)throw Error('Rigid part has no attachment '+part.id);
  const evaluate = p => attachment ? context.rigid(p,attachment) : context.evaluate(p,mode.attachmentIds);
  const pos = g.attributes.position, normal = g.attributes.normal;let minDeterminant = Infinity;
  for(let i=0;i<pos.count;i++){
    const q = evaluate([pos.getX(i),pos.getY(i),pos.getZ(i)]);
    const n = context.normalMap([normal.getX(i),normal.getY(i),normal.getZ(i)],q.j);
    minDeterminant=Math.min(minDeterminant,det(q.j));pos.setXYZ(i,...q.p);normal.setXYZ(i,...n);
  }
  // Runtime inspection metadata is transformed with the actual geometry. The
  // rest frame and rest UV diagnostics are kept as rest construction records.
  for(const hole of g.userData.apertures ?? []){
    const q=evaluate(hole.centre);hole.centre=q.p;hole.axis=context.normalMap(hole.axis,q.j);
  }
  if(g.userData.supportPoints){
    const points=g.userData.supportPoints,normals=g.userData.supportNormals;
    g.userData.supportPoints=points.map((p,i)=>{const q=evaluate(p);if(normals?.[i])normals[i]=context.normalMap(normals[i],q.j);return q.p;});
  }
  if(attachment){part.apertureCenter=attachment.currentCenter;part.apertureAxis=attachment.currentFrame.normal;part.runtimeAttachmentFrame=attachment.currentFrame;}
  pos.needsUpdate=normal.needsUpdate=true;g.computeBoundingBox();
  g.userData.flexMode='geometric inspection with rest-frame attachments; not calibrated anatomy';
  g.userData.flexDiagnostics={role:mode.role,minJacobianDeterminant:minDeterminant,normalMethod:'analytic full-field inverse transpose',attachmentProfile:context.profile};
}
