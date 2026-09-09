/* R9 lower-limb construction; shared skeletal and tissue design. */
const LOWER_LIMB_SPEC=Object.freeze({revision:9,skinFatMaleM:.007,skinFatFemaleM:.008,
 thighGrid:{rows:73,sides:48,min:-.04,max:1.12},
 shankGrid:{rows:73,sides:48,min:-.035,max:1.09},footGrid:{rows:57,sides:48,min:-.067,max:.156},
 toeRadiiM:[.0128,.0094,.0088,.0081,.0074],toeRestPlantarDeg:[4,6,7,9,10],
 toeTipCoverM:[.0045,.0035,.0035,.0035,.0035],
 footRows:[[-.067,.0015,.002,.002,0,-.049],[-.056,.021,.015,.020,0,-.048],
 [-.035,.032,.030,.025,0,-.047],[0,.033,.045,.023,-.001,-.046],
 [.035,.034,.035,.019,-.002,-.044],[.065,.039,.030,.022,-.003,-.047],
 [.101,.049,.025,.022,-.002,-.051],[.121,.050,.022,.020,-.002,-.054],
 [.156,.044,.017,.015,-.004,-.055]],
 muscles:[
 {id:'soleus',start:.025,end:.94,angle:Math.PI,width:2.65,peak:.022},
 {id:'gastrocnemius_medial',start:.015,end:.74,angle:-2.18,width:1.42,peak:.031},
 {id:'gastrocnemius_lateral',start:.005,end:.65,angle:2.23,width:1.31,peak:.027},
 {id:'tibialis_anterior',start:.035,end:.89,angle:.56,width:.95,peak:.016},
 {id:'fibularis',start:.09,end:.94,angle:1.48,width:.80,peak:.012}]});
const LOWER_LIMB_CACHE=new WeakMap(),LOWER_FOOT_PROFILE=tissueProfile(LOWER_LIMB_SPEC.footRows);
const lowerBand=(v,a,b)=>Math.sin(Math.PI*clamp((v-a)/(b-a),0,1))**4;
const lowerAngular=(a,centre,width)=>{const d=Math.abs(Math.atan2(Math.sin(a-centre),Math.cos(a-centre)));return d>=width?0:Math.cos(d/width*Math.PI*.5)**4;};
function lowerShankCentre(u){return [.006+.003*Math.sin(Math.PI*clamp(u,0,1)),-.003*tissueSmooth(.65,1.05,u)];}
function lowerFootSection(z){return LOWER_FOOT_PROFILE(z);}
function lowerToeDirection(side,index){
 const lateral=side*(index===0?-.035:index===4?.045:.005);
 return norm([lateral,-Math.tan(LOWER_LIMB_SPEC.toeRestPlantarDeg[index]*Math.PI/180),1]);
}
function lowerGridSample(cache,t,angle){
 const {rows,sides,min,max}=cache.spec,fy=clamp((t-min)/(max-min)*(rows-1),0,rows-1),j=Math.floor(fy);
 const fa=((angle/(Math.PI*2)%1)+1)%1*sides,k=Math.floor(fa),wy=axialSplineWeights(fy-j),wx=axialSplineWeights(fa-k);
 let radius=0;for(let y=0;y<4;y++)for(let a=0;a<4;a++)radius+=cache.grid[clamp(j+y-1,0,rows-1)*sides+(k+a-1+sides)%sides]*wy[y]*wx[a];
 return radius;
}
function buildLowerBoneGrid(spec,samples,minimum){
 const {rows,sides,min,max}=spec,cache={spec,grid:new Float32Array(rows*sides).fill(minimum)};
 for(const [t,a,r]of samples){const j=Math.round((t-min)/(max-min)*(rows-1)),k=Math.round(((a/(2*Math.PI)%1)+1)%1*sides)%sides;cache.grid[j*sides+k]=Math.max(cache.grid[j*sides+k],r+.0015);}
 const expanded=cache.grid.slice();
 for(let j=0;j<rows;j++)for(let k=0;k<sides;k++)for(let y=-1;y<=1;y++)for(let a=-1;a<=1;a++){
  const q=cache.grid[clamp(j+y,0,rows-1)*sides+(k+a+sides)%sides]-.0015*(Math.abs(y)+Math.abs(a));expanded[j*sides+k]=Math.max(expanded[j*sides+k],q);
 }cache.grid=expanded;
 for(let pass=0;pass<5;pass++){
  let deficit=0;const raise=new Float32Array(expanded.length);
  for(const [t,a,r]of samples){const d=r+.0015-lowerGridSample(cache,t,a);if(d<=.00005)continue;deficit=Math.max(deficit,d);
   const j=Math.floor((t-min)/(max-min)*(rows-1)),k=Math.floor(((a/(2*Math.PI)%1)+1)%1*sides);
   for(let y=-1;y<=2;y++)for(let b=-1;b<=2;b++){const id=clamp(j+y,0,rows-1)*sides+(k+b+sides)%sides;raise[id]=Math.max(raise[id],d+.00005);}
  }
  for(let i=0;i<expanded.length;i++)expanded[i]+=raise[i];if(deficit<=.00005)break;
 }
 let remaining=0;for(const[t,a,r]of samples)remaining=Math.max(remaining,r+.0015-lowerGridSample(cache,t,a));
 cache.report={samples:samples.length,remainingSampleDeficitM:Math.max(0,remaining),cacheBytes:expanded.byteLength};return cache;
}
function buildLowerLimbFoundation(tissue){
 const h=tissue.human,selected=h.bones.filter(b=>/^(left|right)_(femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|.*cuneiform|metatarsal_\d|toe_\d_\d)$/.test(b.id));
 const key=JSON.stringify({revision:9,sex:BODY_SEX,bind:h.joints.filter(j=>/_(femur|tibia|foot|metatarsal_|toe_)/.test(j.id)).map(j=>[j.id,j.bind,j.bindQ]),bones:selected.map(b=>[b.id,hashFloats(b.g.p),hashFloats(b.g.i)])});
 const old=LOWER_LIMB_CACHE.get(h);if(old?.key===key)return old;
 const core={key,parts:[],supports:[],sides:{}};
 for(const b of selected)core.parts.push({id:'lower_base_'+b.id,joint:b.joint,g:{p:b.g.p.slice(),n:b.g.n.slice(),i:b.g.i.slice()},color:[.68,.64,.49],materialKind:0,visible:false});
 for(const side of ['left','right']){
  const s=side==='left'?-1:1,leg=h.legs[side],hip=tissue.bind.get(side+'_femur'),knee=tissue.bind.get(side+'_tibia'),foot=tissue.bind.get(side+'_foot'),thighSamples=[],shankSamples=[],footSamples=[];
  for(const bone of selected.filter(b=>b.id.startsWith(side+'_'))){
   const isThigh=/_(femur|patella)$/.test(bone.id),isShank=/_(tibia|fibula)$/.test(bone.id),isFoot=!isThigh&&!isShank&&!/_toe_/.test(bone.id),f=tissue.bind.get(bone.joint.id);
   if(!isThigh&&!isShank&&!isFoot)continue;
   const base=isThigh?hip:isShank?knee:foot,q=inv(base.q),spec=isThigh?LOWER_LIMB_SPEC.thighGrid:isShank?LOWER_LIMB_SPEC.shankGrid:LOWER_LIMB_SPEC.footGrid;
   for(let i=0;i<bone.g.p.length;i+=3){
    const p=rotate(q,sub(point(f,Array.from(bone.g.p.subarray(i,i+3))),base.p)),t=isThigh?-p[1]/leg.L1:isShank?-p[1]/leg.L2:p[2];if(t<spec.min||t>spec.max)continue;
    const section=isThigh?lowerThighCentre(t):isShank?lowerShankCentre(t):lowerFootSection(t),isLeg=isThigh||isShank,x=s*p[0]-(isLeg?section[0]:section[3]),z=isLeg?p[2]-section[1]:p[1]-section[4];
    (isThigh?thighSamples:isShank?shankSamples:footSamples).push([t,Math.atan2(x,z),Math.hypot(x,z)]);
   }
  }
  core.sides[side]={s,hip,knee,foot,thighL:leg.L1,L:leg.L2,thigh:buildLowerBoneGrid(LOWER_LIMB_SPEC.thighGrid,thighSamples,.012),shank:buildLowerBoneGrid(LOWER_LIMB_SPEC.shankGrid,shankSamples,.009),footGrid:buildLowerBoneGrid(LOWER_LIMB_SPEC.footGrid,footSamples,.004)};
 }
 core.report={schema:'jarvis/lower_limb_foundation@9',sex:BODY_SEX,parts:core.parts.length,
  countsBySide:Object.fromEntries(['left','right'].map(side=>[side,{footBones:selected.filter(b=>b.id.startsWith(side+'_')&&!/_(femur|patella|tibia|fibula)$/.test(b.id)).length,phalanges:selected.filter(b=>b.id.startsWith(side+'_toe_')).length,toeRays:h.legs[side].footRays.length}])),
  sampledBounds:Object.fromEntries(Object.entries(core.sides).map(([s,d])=>[s,{thigh:d.thigh.report,shank:d.shank.report,foot:d.footGrid.report}])),
  poseRebuild:false,source:'actual generated bone vertices; periodic radial construction envelope',fullTriangleCollision:false,anatomicalValidation:false};
 LOWER_LIMB_CACHE.set(h,core);return core;
}
function lowerLegLayers(tissue,side,u,angle){return lowerCalibratedLayers(tissue,side,'shank',u,angle);}
function lowerLegSurfacePoint(tissue,side,u,angle,hardOnly=false){
 const d=tissue.lowerLimb.sides[side],[cx,cz]=lowerShankCentre(u),hard=lowerGridSample(d.shank,u,angle);
 const r=hard+(hardOnly?0:lowerLegLayers(tissue,side,u,angle).total);
 return point(d.knee,[d.s*(cx+Math.sin(angle)*r),-u*d.L,cz+Math.cos(angle)*r]);
}
function lowerLegSkinWeights(tissue,side,u){
 const d=tissue.lowerLimb.sides[side],knee=tissueSmooth(-.12,.13,u),height=(1-u)*d.L;
 const ankle=1-tissueSmooth(-.028,.065,height);
 return surfaceWeights([[side+'_femur',1-knee],[side+'_tibia',knee*(1-ankle)],[side+'_foot',knee*ankle]]);
}
function lowerFootFloor(y){
 const floor=-ADULT_STANCE.ankleHeightM+.0012,d=y-floor;
 return floor+.5*(d+Math.sqrt(d*d+.00035*.00035));
}
function lowerFootSurfaceLocal(tissue,side,z,angle,hardOnly=false){
 const d=tissue.lowerLimb.sides[side],r=lowerFootSection(z),sn=Math.sin(angle),cs=Math.cos(angle);
 const [rx,up,down,cx,cy]=r;
 if(hardOnly){const radius=lowerGridSample(d.footGrid,z,angle);return [d.s*(cx+sn*radius),cy+cs*radius,z];}
 let x=cx+sn*rx,y=cy+cs*(cs>=0?up:down);
 // Medial longitudinal arch is higher; the heel and metatarsal pad remain low.
 const arch=lowerBand(z,-.007,.097)*tissueSmooth(-.006,.025,-x)*Math.max(0,-cs);
 y+=.012*arch;
 const theta=Math.atan2(x-cx,y-cy),rho=Math.hypot(x-cx,y-cy),bone=lowerGridSample(d.footGrid,z,theta);
 const clearance=bone+(cs<0?.009:.007),weight=tissueSmooth(-.067,-.049,z)*(1-tissueSmooth(.149,.156,z));
 // Smooth majorant plus padding covers the bone envelope without isolated
 // point clipping. Heel and forefoot pads share the same support convention.
 const delta=clearance-rho,radius=rho+.5*(delta+Math.sqrt(delta*delta+.006*.006))*weight;
 x=cx+Math.sin(theta)*radius;y=cy+Math.cos(theta)*radius;
 return [d.s*x,lowerFootFloor(y),z];
}
function lowerFootSurfacePoint(tissue,side,z,angle,hardOnly=false){return point(tissue.lowerLimb.sides[side].foot,lowerFootSurfaceLocal(tissue,side,z,angle,hardOnly));}
function buildLowerAnkleBridge(cage,tissue,side,start,hole){
 const d=tissue.lowerLimb.sides[side],frameValue={...d.foot,center:d.foot.p};
 const A=surfaceAngularLoop(cage,start,frameValue),B=surfaceAngularLoop(cage,hole,frameValue),local=p=>rotate(inv(d.foot.q),sub(p,d.foot.p));
 const sample=(loop,angle)=>{
  let k=0;while(k<loop.angles.length&&loop.angles[k]<angle)k++;
  const n=loop.ids.length,lo=(k+n-1)%n,hi=k%n,a=loop.angles[lo],b=loop.angles[hi]+(hi===0?2*Math.PI:0),theta=angle+(angle<a?2*Math.PI:0);
  return mix(cage.v[loop.ids[lo]].p,cage.v[loop.ids[hi]].p,clamp((theta-a)/Math.max(b-a,1e-8),0,1));
 };
 let previous=A.ids;
 for(let step=1;step<=5;step++){
  const u=step/6,next=cage.ring(A.angles.map((angle,k)=>{
   const p=mix(cage.v[A.ids[k]].p,sample(B,angle),u),q=local(p),height=q[1],v=1-height/d.L,centre=lowerShankCentre(v);
   const theta=Math.atan2(d.s*q[0]-centre[0],q[2]-centre[1]),radius=Math.hypot(d.s*q[0]-centre[0],q[2]-centre[1]);
   const hard=lowerGridSample(d.shank,v,theta)+.0045,delta=Math.max(0,hard-radius)*Math.sin(Math.PI*u)**2;
   q[0]+=d.s*Math.sin(theta)*delta;q[2]+=Math.cos(theta)*delta;return point(d.foot,q);
  }),(k,p)=>lowerLegSkinWeights(tissue,side,1-local(p)[1]/d.L));
  cage.join(previous,next);previous=next;
 }
 surfaceAngularJoin(cage,surfaceAngularLoop(cage,previous,frameValue),B);
}
function lowerToeSample(tissue,side,ray,index,t,angle){
 const lengths=ray.toes.map((j,k)=>k+1<ray.toes.length?len(ray.toes[k+1].bind):ray.tipLength),total=lengths.reduce((a,b)=>a+b,0)+LOWER_LIMB_SPEC.toeTipCoverM[index],starts=[0];
 for(const L of lengths)starts.push(starts.at(-1)+L);
 let k=0;while(k<lengths.length-1&&t>starts[k+1])k++;
 const jf=tissue.bind.get(ray.toes[k].id),ff=tissue.lowerLimb.sides[side].foot,centre=point(jf,[0,-(t-starts[k]),0]);
 const tangent=rotate(jf.q,[0,-1,0]),across=norm(cross(rotate(ff.q,[0,1,0]),tangent)),up=norm(cross(tangent,across));
 const rootR=LOWER_LIMB_SPEC.toeRadiiM[index],capLength=Math.min(rootR*.90,total*.32),capStart=total-capLength;
 const cap=t>capStart?Math.sqrt(Math.max(0,1-((t-capStart)/capLength)**2)):1;
 const width=rootR*(1-.12*t/total)*cap,dorsal=rootR*(index===0?.68:.65)*cap,plantar=rootR*.84*cap;
 const sn=Math.sin(angle),cs=Math.cos(angle),p=add(centre,add(mul(across,sn*width),mul(up,cs*(cs>=0?dorsal:plantar))));
 const local=rotate(inv(ff.q),sub(p,ff.p));local[1]=lowerFootFloor(local[1]);
 let weights=[[ray.toes[k].id,1]];
 for(let j=1;j<lengths.length;j++){
  // Short middle phalanges must not have overlapping transition bands.
  const width=Math.min(.006,lengths[j-1]*.42,lengths[j]*.42);
  if(Math.abs(t-starts[j])<width)weights=tissueBlendWeights(ray.toes[j-1].id,ray.toes[j].id,tissueSmooth(starts[j]-width,starts[j]+width,t));
 }
 const mtp=tissueSmooth(-.002,.020,t);weights=surfaceWeights([[side+'_foot',1-mtp],...weights.map(([id,w])=>[id,w*mtp])]);
 return {p:point(ff,local),weights,total};
}
function buildLowerToe(cage,tissue,side,boundary,ray,index){
 const jf=tissue.bind.get(ray.toes[0].id),lengths=ray.toes.map((j,k)=>k+1<ray.toes.length?len(ray.toes[k+1].bind):ray.tipLength),total=lengths.reduce((a,b)=>a+b,0)+LOWER_LIMB_SPEC.toeTipCoverM[index];
 let previous=surfaceLoopOrder(cage,boundary,jf);
 const start=Math.min(.011,total*.27),steps=18;
 for(let r=0;r<=steps;r++){
  const t=start+(total-.00025-start)*r/steps,samples=Array.from({length:16},(_,k)=>lowerToeSample(tissue,side,ray,index,t,k/16*Math.PI*2));
  const next=cage.ring(samples.map(s=>s.p),k=>samples[k].weights);
  if(r===0)surfaceAngularJoin(cage,surfaceAngularLoop(cage,previous,jf),surfaceAngularLoop(cage,next,jf));else cage.join(previous,next);previous=next;
 }
 const tip=lowerToeSample(tissue,side,ray,index,total,0);cage.cap(previous,tip.p,[[ray.toes.at(-1).id,1]]);
}
function buildLowerForefoot(cage,tissue,side,exit){
 const d=tissue.lowerLimb.sides[side],ff=d.foot,local=p=>rotate(inv(ff.q),sub(p,ff.p));
 const slots=tissue.human.legs[side].footRays.map((ray,index)=>({ray,index,p:local(tissue.bind.get(ray.toes[0].id).p),radius:LOWER_LIMB_SPEC.toeRadiiM[index]})).sort((a,b)=>a.p[0]-b.p[0]);
 const borders=[slots[0].p[0]-slots[0].radius*1.02,...slots.slice(1).map((f,k)=>(f.p[0]+slots[k].p[0])*.5),slots.at(-1).p[0]+slots.at(-1).radius*1.02];
 const front=[],back=[],bars=[];
 for(let c=0;c<=5;c++){
  const a=slots[Math.max(0,c-1)],b=slots[Math.min(c,4)],index=Math.min(a.index,b.index),y=(a.p[1]+b.p[1])*.5;
  const z=(a.p[2]+b.p[2])*.5+(index===0?.0035:.0055),top=y+(a.radius+b.radius)*.40,bottom=lowerFootFloor(y-(a.radius+b.radius)*.64);
  bars.push(Array.from({length:5},(_,k)=>{const u=k/4;return cage.vertex(point(ff,[borders[c],top+(bottom-top)*u,z+.0007*Math.sin(Math.PI*u)]),[[side+'_foot',1]]);}));
 }
 for(let c=0;c<5;c++){
  const a=bars[c],b=bars[c+1],f=[a[0]],r=[a[4]];
  for(let k=1;k<4;k++){const u=k/4;f.push(cage.vertex(mix(cage.v[a[0]].p,cage.v[b[0]].p,u),[[side+'_foot',1]]));r.push(cage.vertex(mix(cage.v[a[4]].p,cage.v[b[4]].p,u),[[side+'_foot',1]]));}
  f.push(b[0]);r.push(b[4]);front.push(f);back.push(r);
 }
 const perimeter=[...front.flatMap(f=>f.slice(0,-1)),bars.at(-1)[0],...bars.at(-1).slice(1),...back.slice().reverse().flatMap(b=>b.slice(0,-1).reverse()),...bars[0].slice(1,-1).reverse()];
 const exitFrame={p:ff.p,q:qm(ff.q,fromTo([0,-1,0],[0,0,1]))},loop=surfaceLoopOrder(cage,perimeter,exitFrame),section=lowerFootSection(LOWER_BODY_PLAN.foot.forefootExitZ);
 let previous=exit;
 for(let step=1;step<=3;step++){
  const u=step/4,next=cage.ring(loop.map(id=>{
   const end=local(cage.v[id].p),dy=end[1]-section[4],angle=Math.atan2((d.s*end[0]-section[3])/section[0],dy/(dy>=0?section[1]:section[2])),start=lowerFootSurfaceLocal(tissue,side,LOWER_BODY_PLAN.foot.forefootExitZ,angle),dz=end[2]-start[2];
   const p=surfaceBezier(start,add(start,[0,0,dz*.30]),sub(end,[0,0,dz*.30]),end,u);p[1]=lowerFootFloor(p[1]);return point(ff,p);
  }),[[side+'_foot',1]]);
  if(step===1)surfaceAngularJoin(cage,surfaceAngularLoop(cage,previous,exitFrame),surfaceAngularLoop(cage,next,exitFrame));else cage.join(previous,next);previous=next;
 }cage.join(previous,loop);
 for(let c=0;c<5;c++)buildLowerToe(cage,tissue,side,[...front[c].slice(0,-1),...bars[c+1].slice(0,-1),...back[c].slice(1).reverse(),...bars[c].slice(1).reverse()],slots[c].ray,slots[c].index);
}

function makeLowerLimbSupports(tissue){
 if(tissue.lowerLimb.supports.length)return;
 const items=[];
 for(const side of ['left','right']){
  const d=tissue.lowerLimb.sides[side];
  for(const kind of ['thigh','shank','foot']){
   const F=kind==='thigh'?d.hip:kind==='shank'?d.knee:d.foot,joint=tissue.human.byId.get(side+(kind==='thigh'?'_femur':kind==='shank'?'_tibia':'_foot'));
   const rows=kind==='shank'?40:32,sides=48,p=[],indices=[];
   for(let j=0;j<=rows;j++)for(let k=0;k<sides;k++){
    const t=kind==='foot'?-.058+.206*j/rows:-.01+1.04*j/rows,a=k/sides*Math.PI*2;
    const world=kind==='thigh'?lowerThighSurfacePoint(tissue,side,t,a,true):kind==='shank'?lowerLegSurfacePoint(tissue,side,t,a,true):lowerFootSurfacePoint(tissue,side,t,a,true);
    p.push(...rotate(inv(F.q),sub(world,F.p)));
    if(j<rows){const A=j*sides+k,B=j*sides+(k+1)%sides;indices.push(A,B,B+sides,A,B+sides,A+sides);}
   }
   for(const end of [0,rows]){const id=p.length/3,centre=[0,0,0];for(let k=0;k<sides;k++)for(let a=0;a<3;a++)centre[a]+=p[(end*sides+k)*3+a]/sides;p.push(...centre);for(let k=0;k<sides;k++)end?indices.push(id,end*sides+k,end*sides+(k+1)%sides):indices.push(id,(k+1)%sides,k);}
   const g=mesh(p,indices);let volume=0;for(let i=0;i<g.i.length;i+=3){const[a,b,c]=Array.from(g.i.subarray(i,i+3)).map(id=>Array.from(g.p.subarray(id*3,id*3+3)));volume+=dot(a,cross(b,c))/6;}
   if(volume<0){for(let i=0;i<g.i.length;i+=3)[g.i[i+1],g.i[i+2]]=[g.i[i+2],g.i[i+1]];g.n=mesh(Array.from(g.p),Array.from(g.i)).n;}
   items.push({id:side+'_'+kind+'_support',joint,g,materialKind:0,color:[.43,.55,.57],visible:false});
  }
 }
 tissue.lowerLimb.supports=items;
}

function makeLowerLimbMuscleSheets(tissue){
 const report={schema:'jarvis/lower_limb_muscles@9',sheetCount:0,degenerateSheets:[],source:'shared thigh/shank bone envelopes and calibrated named tissue fields',forceDynamics:false};
 for(const side of ['left','right'])for(const kind of ['thigh','shank'])for(const spec of kind==='thigh'?LOWER_BODY_PLAN.thighMuscles:LOWER_LIMB_SPEC.muscles){
  const d=tissue.lowerLimb.sides[side],m=tissue.muscles.find(m=>m.id===side+'_'+spec.id);
  if(!m)throw Error('Missing lower-leg muscle controller '+spec.id);
  const along=30,across=18,p=[],indices=[],weights=[],parameters=[],nodes=[],faces=[[],[]];
  const vertex=(pos,w,U,V,half)=>{const id=p.length/3;p.push(...pos);weights.push(normalizedJointInfluences(w,tissue.jointIds));parameters.push([1,half,U,V]);return id;};
  for(let u=0;u<=along;u++)for(let v=0;v<=across;v++){
   const U=u/along,V=v/across,t=spec.start+(spec.end-spec.start)*U,a=spec.angle+(V*2-1)*spec.width;
   const thigh=kind==='thigh',layers=thigh?lowerThighLayers(tissue,side,t,a):lowerLegLayers(tissue,side,t,a),hard=thigh?lowerThighSurfacePoint(tissue,side,t,a,true):lowerLegSurfacePoint(tissue,side,t,a,true),normal=rotate((thigh?d.hip:d.knee).q,[d.s*Math.sin(a),0,Math.cos(a)]);
   const rim=u===0||u===along||v===0||v===across,half=rim?0:layers.fields[spec.id]*.5;
   const centre=add(hard,mul(normal,layers.offsets[spec.id]+half)),w=kind==='thigh'?lowerThighSkinWeights(tissue,side,t):lowerLegSkinWeights(tissue,side,t);
   const A=vertex(add(centre,mul(normal,half)),w,U,V,half),B=rim?A:vertex(sub(centre,mul(normal,half)),w,U,V,half);
   faces[0].push(A);faces[1].push(B);nodes.push({a:A,b:B,base:centre,center:centre,half});
  }
  for(let f=0;f<2;f++)for(let u=0;u<along;u++)for(let v=0;v<across;v++){
   const k=u*(across+1)+v,A=faces[f][k],B=faces[f][k+across+1],C=faces[f][k+1],D=faces[f][k+across+2];
   if((u===along-1&&v===0)||(u===0&&v===across-1))f?indices.push(A,C,B,B,C,D):indices.push(A,B,C,B,D,C);
   else f?indices.push(A,D,B,A,C,D):indices.push(A,B,D,A,D,C);
  }
  const g=mesh(p,indices),count=p.length/3;let volume=0;
  for(let i=0;i<g.i.length;i+=3){const[a,b,c]=Array.from(g.i.subarray(i,i+3)).map(id=>Array.from(g.p.subarray(id*3,id*3+3)));volume+=dot(a,cross(b,c))/6;}
  if(!Number.isFinite(volume)||Math.abs(volume)<1e-12)report.degenerateSheets.push(m.id);
  if(volume<0){for(let i=0;i<g.i.length;i+=3)[g.i[i+1],g.i[i+2]]=[g.i[i+2],g.i[i+1]];g.n=mesh(Array.from(g.p),Array.from(g.i)).n;}
  g.skinJoints=new Float32Array(count*4);g.skinWeights=new Float32Array(count*4);g.tissueIds=new Float32Array(count*2).fill(tissue.muscles.indexOf(m));g.tissueData=new Float32Array(count*4);
  for(let k=0;k<count;k++){weights[k].forEach(([j,w],n)=>{g.skinJoints[k*4+n]=j;g.skinWeights[k*4+n]=w;});g.tissueData.set(parameters[k],k*4);}
  m.sheet={id:m.id+'_volume',g,materialKind:8,color:[.38,.065,.042],visible:false};
  m.sheetChart={axis:2,outward:-1,along,across,nodes};m.sheetThickness=spec.peak;
  m.sheetAnchors=m.anchors.flatMap(a=>[a,a]);m.controlRest=m.anchors.map(a=>a.rest);m.lowerLimbSheet=true;m.lowerLimbRegion=kind;
  refreshMuscleSamples(m);tissue.sheetItems.push(m.sheet);report.sheetCount++;
 }
 tissue.lowerLimbMuscleReport=report;
}

// The nail surface is projected onto final subdivided skin triangles, in the
// distal toe's own frame. Missing projections are reported and omit that nail.
function makeToeNails(tissue){
 const items=[],skin=tissue.skin.g,audit=tissue.toeNailReport={schema:'jarvis/toe_nails@9',nails:0,samples:0,missingSamples:0,omitted:[],liftM:[.00010,.00028]};
 for(const side of ['left','right'])for(const [index,ray]of tissue.human.legs[side].footRays.entries()){
  const joint=ray.toes.at(-1),id=tissue.jointIds.get(joint.id),F=tissue.bind.get(joint.id),Q=inv(F.q),verts=new Map();
  for(let v=0;v<skin.p.length/3;v++)if([0,1,2,3].some(k=>skin.skinJoints[v*4+k]===id&&skin.skinWeights[v*4+k]>.20))verts.set(v,rotate(Q,sub(Array.from(skin.p.subarray(v*3,v*3+3)),F.p)));
  const tris=[];
  for(let k=0;k<skin.i.length;k+=3){const a=verts.get(skin.i[k]),b=verts.get(skin.i[k+1]),c=verts.get(skin.i[k+2]);if(!a||!b||!c)continue;
   const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)>1e-13)tris.push({a,b,c,den});}
  const cover=LOWER_LIMB_SPEC.toeTipCoverM[index],total=ray.toes.reduce((sum,j,k)=>sum+(k+1<ray.toes.length?len(ray.toes[k+1].bind):ray.tipLength),cover),rad=LOWER_LIMB_SPEC.toeRadiiM[index],capLength=Math.min(rad*.90,total*.32);
  const p=[],colors=[],indices=[],rows=12,cols=16,tip=ray.tipLength+cover,end=tip-.0018,length=Math.min(ray.tipLength*.69,index===0?.013:.007);
  let missing=0;
  for(let u=0;u<=rows;u++)for(let v=0;v<=cols;v++){
   const U=u/rows,V=v/cols*2-1,t=end-length+length*U+.0008*Math.abs(V)**4*(1-2*U),y=-t,T=total-tip+t;
   const cap=T>total-capLength?Math.sqrt(Math.max(0,1-((T-total+capLength)/capLength)**2)):1;
   const width=Math.min(rad*.58,rad*(1-.12*T/total)*cap*.80),x=V*width*(.84+.16*Math.sin(Math.PI*U));
   // fromTo(-Y, forward/down) makes toe-local +Z dorsal.
   let z=-Infinity;for(const {a,b,c,den}of tris){const A=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,B=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;if(A>=-1e-6&&B>=-1e-6&&A+B<=1.000001)z=Math.max(z,A*a[2]+B*b[2]+(1-A-B)*c[2]);}
   audit.samples++;if(!Number.isFinite(z)){missing++;z=0;}
   const lift=.00010+.00018*Math.sin(Math.PI*U)*(1-V*V),free=tissueSmooth(.85,1,U);
   p.push(x,y,z+lift);colors.push(.58+.14*free,.36+.20*free,.30+.18*free);
   if(u<rows&&v<cols){const A=u*(cols+1)+v,B=A+cols+1;indices.push(A,B,A+1,A+1,B,B+1);}
  }
  audit.missingSamples+=missing;if(missing){audit.omitted.push({joint:joint.id,missingSamples:missing});continue;}
  const g=mesh(p,indices);g.c=Float32Array.from(colors);items.push({id:side+'_toenail_'+(index+1),joint,g,materialKind:4,color:[.58,.36,.30],visible:false,castShadow:true});audit.nails++;
 }
 return items;
}

function lowerLimbInspectionSummary(tissue){
 const foundation=tissue.lowerLimb.report,muscles=tissue.lowerLimbMuscleReport,nails=tissue.toeNailReport,warnings=[];
 for(const [side,count]of Object.entries(foundation.countsBySide))if(count.footBones!==26||count.phalanges!==14||count.toeRays!==5)warnings.push(side+': unexpected foot element count');
 for(const [side,bounds]of Object.entries(foundation.sampledBounds))for(const [part,report]of Object.entries(bounds)){
  if(!report.samples)warnings.push(side+' '+part+': no bone samples');
  if(report.remainingSampleDeficitM>.0001)warnings.push(side+' '+part+': bone-envelope sample deficit');
 }
 if(muscles.sheetCount!==28||muscles.degenerateSheets.length)warnings.push('thigh/calf muscle volumes need inspection');
 if(tissue.lowerBodyVolumeReport.sections.some(r=>r.maxTargetErrorM>.012))warnings.push('one or more fitted belly sections miss the authored girth target');
 if(nails.nails!==10||nails.missingSamples)warnings.push('one or more toenails omitted after incomplete skin projection');
 return {schema:'jarvis/lower_limb_inspection@9',foundation,muscles,nails,volume:tissue.lowerBodyVolumeReport,bodyPlan:LOWER_BODY_PLAN,rig:{statureM:ADULT_SPEC.statureM,femurM:ADULT_RIG.femurLengthM,tibiaM:ADULT_RIG.tibiaLengthM,standingHipJointHeightM:REST_HIP_HEIGHT,ankleHeightM:ADULT_STANCE.ankleHeightM,axialRedistributionM:ADULT_SPEC.axialExtensionM,bindingRevision:tissue.human.proportionRevision},warnings,
  nominal:{toeRaysPerFoot:5,phalangesPerFoot:14,footBonesPerFoot:26},
  constructionOnly:true,posedContactVerified:false,fullTriangleCollision:false,anatomicalValidation:false,visualAcceptance:false};
}
