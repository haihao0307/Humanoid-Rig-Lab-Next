/* R7 axial construction. Joint coordinates remain the controller's coordinates;
 * anatomical tilt is baked into each rigid bone, not added to joint animation.
 * Metres, Y above hips, Z anterior. Authored geometry, not scan-derived anatomy. */
function axialSkeletonPlan(){
 const rows=SPINE_STATIONS.map(([region,number,y])=>({id:region+number,region,number,y,z:spineStationZ(region,y)}));
 for(let k=0;k<rows.length;k++){
  const r=rows[k],lo=rows[Math.max(0,k-1)],hi=rows[Math.min(rows.length-1,k+1)];
  r.center=[0,r.y,r.z+.012];
  r.up=norm([0,hi.y-lo.y,hi.z-lo.z]);r.q=fromTo([0,1,0],r.up);
  const before=k?Math.hypot(r.y-lo.y,r.z-lo.z):.030;
  const after=k<rows.length-1?Math.hypot(hi.y-r.y,hi.z-r.z):before;
  r.height=Math.min(before,after)*(r.region==='L'?.72:r.region==='T'?.76:.66);
  const u=r.region==='L'?(r.number-1)/4:r.region==='T'?(r.number-1)/11:(r.number-1)/6;
  r.rx=r.region==='L'?.020+.003*u:r.region==='T'?.013+.006*u:.0105+.0015*u;
  r.rz=r.region==='L'?.016+.002*u:r.region==='T'?.011+.004*u:.009+.001*u;
  r.processLength=r.region==='L'?.036+.003*u:r.region==='T'?.033+.008*Math.sin(Math.PI*u):.025+.008*u;
 }
 // Separate the projected endplate bounds, including their tilted rims.
 // Reducing a height cannot consume the gap at another neighbouring pair.
 // These are rest-construction conditions, not joint range-of-motion limits.
 for(let k=1;k<rows.length;k++){
  const a=rows[k-1],b=rows[k];if(b.id==='C1')continue;
  const axis=norm(sub(b.center,a.center)),gap=len(sub(b.center,a.center));
  const rim=r=>.91*Math.hypot(r.rx*dot(rotate(r.q,[1,0,0]),axis),r.rz*dot(rotate(r.q,[0,0,1]),axis));
  const available=gap-rim(a)-rim(b)-.002;
  const occupied=(a.height*dot(a.up,axis)+b.height*dot(b.up,axis))*.5;
  if(available<=0||occupied<=0)throw Error('Invalid axial endplate spacing: '+a.id+' / '+b.id);
  if(occupied>available){const scale=available/occupied;a.height*=scale;b.height*=scale;}
 }
 return rows;
}
function axialEndplate(record,sign,theta,radiusScale=1){
 const local=[Math.sin(theta)*record.rx*radiusScale,sign*record.height*.5,Math.cos(theta)*record.rz*radiusScale];
 return add(record.center,rotate(record.q,local));
}
function makeAxialVertebra(r){
 if(r.id==='C1'){
  // Atlas: a ring with lateral masses, not another vertebral body/disc.
  const g=combine([sweep(t=>[.018*Math.cos(t*Math.PI*2),0,.007+.018*Math.sin(t*Math.PI*2)],.0038,48,12),
   ellipsoid([-.014,0,.010],[.007,.006,.009],20,12),ellipsoid([.014,0,.010],[.007,.006,.009],20,12)]);
  for(let i=0;i<g.p.length;i+=3){g.p.set(rotate(r.q,Array.from(g.p.subarray(i,i+3))),i);g.n.set(rotate(r.q,Array.from(g.n.subarray(i,i+3))),i);}return g;
 }
 const p=[],indices=[],sides=32;
 const rings=[[-.5,.91],[-.44,.98],[-.28,1],[0,1.015],[.28,1],[.44,.98],[.5,.91]];
 for(const [h,scale]of rings)for(let k=0;k<sides;k++){
  const a=k/sides*Math.PI*2,cs=Math.cos(a);
  p.push(Math.sin(a)*r.rx*scale,h*r.height,.012+cs*r.rz*scale);
 }
 for(let j=0;j<rings.length-1;j++)for(let k=0;k<sides;k++){
  const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(a,b,b+sides,a,b+sides,a+sides);
 }
 for(const [j,reverse]of [[0,true],[rings.length-1,false]]){
  const pole=p.length/3;p.push(0,rings[j][0]*r.height,.012);
  for(let k=0;k<sides;k++){const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(...(reverse?[pole,b,a]:[pole,a,b]));}
 }
 const neck=.004,radius=r.rx,archZ=-.012;
 const parts=[mesh(p,indices),tube([-radius*.65,0,.004],[-radius*.72,0,archZ],neck),
  tube([radius*.65,0,.004],[radius*.72,0,archZ],neck),
  sweep(t=>[radius*.78*Math.cos(Math.PI*t),0,archZ-radius*.54*Math.sin(Math.PI*t)],.0035,20,10),
  tube([0,0,-.020],[0,r.region==='T'?-.009:-.003,-r.processLength],[.0045,.0025]),
  tube([-radius*.60,0,-.008],[-radius*1.7,-.002,-.004],[.004,.0028]),
  tube([radius*.60,0,-.008],[radius*1.7,-.002,-.004],[.004,.0028])];
 if(r.id==='C2')parts.push(ellipsoid([0,r.height*.5+.007,.012],[.0045,.010,.0045],20,12));
 const g=combine(parts);
 // Rotate about the vertebral body centre, while the parent joint stays put.
 for(let i=0;i<g.p.length;i+=3){
  const v=add([0,0,.012],rotate(r.q,sub(Array.from(g.p.subarray(i,i+3)),[0,0,.012])));
  g.p.set(v,i);g.n.set(rotate(r.q,Array.from(g.n.subarray(i,i+3))),i);
 }
 return g;
}
function makeAxialDisc(human,lower,upper){
 // Two independently owned endplates with a connected annulus. Skin weights
 // are exactly 1 at each end, so the disc follows both rigid adjoining bones.
 const p=[],indices=[],weights=[],sides=32,rings=6;
 for(let j=0;j<=rings;j++)for(let k=0;k<sides;k++){
  const u=j/rings,a=k/sides*Math.PI*2;
  const bottom=axialEndplate(lower,1,a,.91),top=axialEndplate(upper,-1,a,.91);
  const q=mix(bottom,top,u),bulge=.0007*Math.sin(Math.PI*u);
  q[0]+=Math.sin(a)*bulge;q[2]+=Math.cos(a)*bulge;q[1]+=human.rootHeight;p.push(...q);weights.push(u);
 }
 for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){
  const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(a,b,b+sides,a,b+sides,a+sides);
 }
 for(const [j,reverse]of [[0,true],[rings,false]]){
  const pole=p.length/3,c=j?axialEndplate(upper,-1,0,0):axialEndplate(lower,1,0,0);
  p.push(c[0],c[1]+human.rootHeight,c[2]);weights.push(j/rings);
  for(let k=0;k<sides;k++){const a=j*sides+k,b=j*sides+(k+1)%sides;indices.push(...(reverse?[pole,b,a]:[pole,a,b]));}
 }
 const g=mesh(p,indices),n=p.length/3;g.skinJoints=new Float32Array(n*4);g.skinWeights=new Float32Array(n*4);
 const lo=human.joints.indexOf(human.byId.get(lower.id)),hi=human.joints.indexOf(human.byId.get(upper.id));
 if(lo<0||hi<0)throw Error('Missing disc attachment');
 for(let i=0;i<n;i++){g.skinJoints.set([lo,hi,0,0],i*4);g.skinWeights.set([1-weights[i],weights[i],0,0],i*4);}
 return {id:'disc_'+lower.id+'_'+upper.id,joint:human.byId.get(upper.id),g,
  materialKind:9,color:[.40,.58,.57],visible:true,anatomyRegion:'intervertebral',castShadow:true};
}
function installAxialDiscs(human){
 const rows=human.axialPlan;
 // The pelvis owns S1. Its endplate is aligned with L5 without altering pelvis
 // animation; the generated annulus uses a dedicated, exact shared interface.
 const first=rows[0],s1={id:'hips',center:add(first.center,mul(first.up,-first.height*.5-.005)),
  q:first.q,rx:first.rx*1.07,rz:first.rz*1.08,height:0};
 human.axialSacralPlate=s1;
 human.cartilage.push(makeAxialDisc(human,s1,first));
 for(let k=1;k<rows.length;k++)if(rows[k].id!=='C1')human.cartilage.push(makeAxialDisc(human,rows[k-1],rows[k]));
 let minGap=Infinity;const interfaces=[],pairs=[[s1,first]];
 for(let k=1;k<rows.length;k++)if(rows[k].id!=='C1')pairs.push([rows[k-1],rows[k]]);
 for(const [lower,upper]of pairs){
  const axis=norm(sub(upper.center,lower.center));let gap=Infinity;
  for(let a=0;a<32;a++){const t=a/32*Math.PI*2;gap=Math.min(gap,dot(sub(axialEndplate(upper,-1,t,.91),axialEndplate(lower,1,t,.91)),axis));}
  interfaces.push({lower:lower.id,upper:upper.id,minEndplateGapM:gap});minGap=Math.min(minGap,gap);
 }
 human.axialReport={schema:'jarvis/axial_skeleton@7',vertebrae:rows.length,
  discs:human.cartilage.filter(c=>c.anatomyRegion==='intervertebral').length,
  individualizedGeometry:true,orientedEndplates:true,discTwoBoneBinding:true,
  minEndplateGapM:minGap,interfaces,negativeInterfaceCount:interfaces.filter(x=>!Number.isFinite(x.minEndplateGapM)||x.minEndplateGapM<=0).length,
  anatomicalValidation:false,ordinaryPoseRebuild:false};
}
function fitSacrumToAxialInterface(human,g){
 const r=human.axialPlan[0],c=add(r.center,mul(r.up,-r.height*.5-.005));
 const p=Array.from(g.p);
 for(let i=0;i<p.length;i+=3){
  const x=p[i],y=p[i+1],z=p[i+2];
  const mask=tissueSmooth(.065,.096,y)*(1-tissueSmooth(.024,.043,Math.abs(x)));
  const plane=c[1]-r.up[2]/Math.max(r.up[1],.1)*(z-c[2]);
  p[i+1]=y+(plane-.096)*mask;
 }
 return mesh(p,Array.from(g.i));
}
