// Original procedural control cage, shared branch boundaries and Catmull-Clark.
// References describe algorithms/anatomical relations, not source vertices.
const CONNECTED_SURFACE_SPEC=Object.freeze({version:'1.12.0',subdivisions:2,bodySides:48,
  fingerSides:16,toeSides:16,closedMainSurface:true,externalControlMesh:false});

function surfaceWeights(parts){
  const m=new Map();for(const [id,w] of parts)if(w>0)m.set(id,(m.get(id)||0)+w);
  const sum=[...m.values()].reduce((a,b)=>a+b,0);if(!(sum>0))throw Error('Empty surface influence');
  return [...m].map(([id,w])=>[id,w/sum]);
}
function averageSurfaceWeights(vertices,coefficients=null){
  return surfaceWeights(vertices.flatMap((v,i)=>v.w.map(([id,w])=>[id,w*(coefficients?coefficients[i]:1/vertices.length)])));
}
class HumanSurfaceCage{
  constructor(){this.v=[];this.f=[];this.seams=[];}
  vertex(p,w){if(!p.every(Number.isFinite))throw Error('Non-finite surface point');const id=this.v.length;this.v.push({p,w:surfaceWeights(w)});return id;}
  face(ids){if(new Set(ids).size!==ids.length||ids.length<3)throw Error('Collapsed surface face');this.f.push(ids);}
  ring(points,weights){return points.map((p,k)=>this.vertex(p,typeof weights==='function'?weights(k,p):weights));}
  join(a,b){
    let i=0,j=0;while(i<a.length||j<b.length){
      const nextA=(i+1)/a.length,nextB=(j+1)/b.length,A=a[i%a.length],B=b[j%b.length];
      if(Math.abs(nextA-nextB)<1e-8){this.face([A,a[(i+1)%a.length],b[(j+1)%b.length],B]);i++;j++;}
      else if(nextA<nextB){this.face([A,a[(i+1)%a.length],B]);i++;}
      else{this.face([A,b[(j+1)%b.length],B]);j++;}
    }
  }
  cap(loop,p,w){const tip=this.vertex(p,w);for(let k=0;k<loop.length;k++)this.face([loop[k],loop[(k+1)%loop.length],tip]);}
  tube(rings,holes=[]){
    const n=rings[0].length;
    for(let r=0;r<rings.length-1;r++)for(let k=0;k<n;k++){
      if(holes.some(h=>r>=h.r0&&r<h.r1&&((k-h.c0+n)%n)<h.width))continue;
      this.face([rings[r][k],rings[r][(k+1)%n],rings[r+1][(k+1)%n],rings[r+1][k]]);
    }
    return holes.map(h=>{
      const get=(r,k)=>rings[r][(k+n)%n],loop=[];
      for(let k=0;k<h.width;k++)loop.push(get(h.r0,h.c0+k));
      for(let r=h.r0;r<h.r1;r++)loop.push(get(r,h.c0+h.width));
      for(let k=h.width;k>0;k--)loop.push(get(h.r1,h.c0+k));
      for(let r=h.r1;r>h.r0;r--)loop.push(get(r,h.c0));
      this.seams.push({name:h.name,vertices:loop.length});return loop;
    });
  }
  orient(){
    // Grid cells removed for a branch leave unused interior points, not skin.
    const used=new Set(this.f.flat()),remap=new Map(),vertices=[];
    this.v.forEach((v,k)=>{if(used.has(k)){remap.set(k,vertices.length);vertices.push(v);}});
    this.f=this.f.map(f=>f.map(id=>remap.get(id)));this.v=vertices;
    const edges=new Map();this.f.forEach((f,fi)=>f.forEach((a,k)=>{
      const b=f[(k+1)%f.length],key=a<b?a+':'+b:b+':'+a;
      if(!edges.has(key))edges.set(key,[]);edges.get(key).push({fi,forward:a<b});
    }));
    for(const [key,e] of edges)if(e.length!==2)throw Error('Surface is not closed at '+key+' ('+e.length+')');
    const graph=this.f.map(()=>[]);
    for(const e of edges.values()){const [a,b]=e;graph[a.fi].push([b.fi,a.forward===b.forward]);graph[b.fi].push([a.fi,a.forward===b.forward]);}
    const flip=new Int8Array(this.f.length).fill(-1);let components=0;
    for(let start=0;start<flip.length;start++)if(flip[start]===-1){components++;flip[start]=0;const todo=[start];
      for(let i=0;i<todo.length;i++){const f=todo[i];for(const [next,different] of graph[f]){
        const wanted=flip[f]^(different?1:0);if(flip[next]===-1){flip[next]=wanted;todo.push(next);}else if(flip[next]!==wanted)throw Error('Non-orientable skin');
      }}
    }
    if(components!==1)throw Error('Disconnected main skin: '+components);
    this.f.forEach((f,k)=>{if(flip[k])f.reverse();});
    let volume=0;for(const f of this.f)for(let k=1;k<f.length-1;k++)volume+=dot(this.v[f[0]].p,cross(this.v[f[k]].p,this.v[f[k+1]].p))/6;
    if(volume<0)this.f.forEach(f=>f.reverse());
    return {components,boundaryEdges:0,nonManifoldEdges:0,vertices:this.v.length,faces:this.f.length,edges:edges.size,eulerCharacteristic:this.v.length-edges.size+this.f.length};
  }
  subdivide(){
    const next=new HumanSurfaceCage(),facePoints=this.f.map(f=>({p:mul(f.reduce((s,id)=>add(s,this.v[id].p),[0,0,0]),1/f.length),w:averageSurfaceWeights(f.map(id=>this.v[id]))}));
    const edges=new Map(),adjF=this.v.map(()=>[]),adjE=this.v.map(()=>[]);
    this.f.forEach((f,fi)=>f.forEach((a,k)=>{adjF[a].push(fi);const b=f[(k+1)%f.length],key=a<b?a+':'+b:b+':'+a;
      if(!edges.has(key)){edges.set(key,{a,b,faces:[]});adjE[a].push(key);adjE[b].push(key);}edges.get(key).faces.push(fi);
    }));
    for(let id=0;id<this.v.length;id++){
      const v=this.v[id],n=adjF[id].length,F=adjF[id].map(i=>facePoints[i]);
      const E=adjE[id].map(key=>{const e=edges.get(key),a=this.v[e.a],b=this.v[e.b];return {p:mix(a.p,b.p,.5),w:averageSurfaceWeights([a,b])};});
      if(n<3||E.length!==n)throw Error('Invalid cage valence');
      const avg=a=>mul(a.reduce((p,v)=>add(p,v.p),[0,0,0]),1/a.length);
      const p=mul(add(add(avg(F),mul(avg(E),2)),mul(v.p,n-3)),1/n);
      const weights=surfaceWeights([...F.flatMap(f=>f.w.map(([j,w])=>[j,w/(n*n)])),...E.flatMap(e=>e.w.map(([j,w])=>[j,2*w/(n*n)])),...v.w.map(([j,w])=>[j,w*(n-3)/n])]);
      next.vertex(p,weights);
    }
    for(const e of edges.values()){
      if(e.faces.length!==2)throw Error('Open subdivision edge');const vs=[this.v[e.a],this.v[e.b],...e.faces.map(i=>facePoints[i])];
      e.id=next.vertex(mul(vs.reduce((p,v)=>add(p,v.p),[0,0,0]),.25),averageSurfaceWeights(vs));
    }
    const faceIds=facePoints.map(f=>next.vertex(f.p,f.w)),edgeId=(a,b)=>edges.get(a<b?a+':'+b:b+':'+a).id;
    this.f.forEach((f,fi)=>f.forEach((a,k)=>next.face([a,edgeId(a,f[(k+1)%f.length]),faceIds[fi],edgeId(f[(k+f.length-1)%f.length],a)])));
    next.seams=this.seams;return next;
  }
}

function surfaceLoopOrder(cage,loop,frameValue){
  const center=mul(loop.reduce((p,id)=>add(p,cage.v[id].p),[0,0,0]),1/loop.length),q=inv(frameValue.q);
  const theta=id=>{const p=rotate(q,sub(cage.v[id].p,center));return Math.atan2(p[0],p[2]);};
  let start=0;for(let k=1;k<loop.length;k++)if(Math.abs(theta(loop[k]))<Math.abs(theta(loop[start])))start=k;
  let result=loop.map((_,k)=>loop[(start+k)%loop.length]);
  const a=theta(result[1])-theta(result.at(-1));if(Math.atan2(Math.sin(a),Math.cos(a))<0)result=[result[0],...result.slice(1).reverse()];
  return result;
}
// Preserve boundary adjacency, but measure correspondence in space. A rectangular
// socket has many more samples along its height than across its width; its index
// fraction is NOT a polar angle. Sorting vertices would conceal a folded loop.
function surfaceAngularLoop(cage,loop,frameValue,scale=[1,1]){
  const center=frameValue.center||mul(loop.reduce((p,id)=>add(p,cage.v[id].p),[0,0,0]),1/loop.length);
  const theta=id=>{const p=rotate(inv(frameValue.q),sub(cage.v[id].p,center));return (Math.atan2(p[0]/scale[0],p[2]/scale[1])+2*Math.PI)%(2*Math.PI);};
  let ids=loop.slice(),turn=0;
  for(let k=0;k<ids.length;k++)turn+=angleDiff(theta(ids[(k+1)%ids.length]),theta(ids[k]));
  if(turn<0)ids.reverse();
  let start=0;for(let k=1;k<ids.length;k++)if(theta(ids[k])<theta(ids[start]))start=k;
  ids=ids.map((_,k)=>ids[(start+k)%ids.length]);const angles=ids.map(theta);
  if(angles.some((a,k)=>k&&a<angles[k-1]-1e-6))throw Error('Non-monotone anatomical boundary '+JSON.stringify({center,angles}));
  return {ids,angles};
}
function surfaceAngularJoin(cage,A,B){
  let i=0,j=0,a=A.ids.at(-1),b=B.ids.at(-1);
  while(i<A.ids.length||j<B.ids.length){
    const x=A.angles[i]??Infinity,y=B.angles[j]??Infinity;
    if(Math.abs(x-y)<1e-6){cage.face([a,A.ids[i],B.ids[j],b]);a=A.ids[i++];b=B.ids[j++];}
    else if(x<y){cage.face([a,A.ids[i],b]);a=A.ids[i++];}
    else{cage.face([a,B.ids[j],b]);b=B.ids[j++];}
  }
}
function surfaceBezier(a,b,c,d,t){const v=1-t;return add(add(mul(a,v*v*v),mul(b,3*v*v*t)),add(mul(c,3*v*t*t),mul(d,t*t*t)));}
function surfaceSpineWeights(tissue,y){
  const ids=['hips',...tissue.human.spine.map(j=>j.id),'head'],rows=ids.map(id=>[id,tissue.bind.get(id).p[1]]).sort((a,b)=>a[1]-b[1]);
  let k=0;while(k<rows.length-2&&y>rows[k+1][1])k++;
  const [a,ay]=rows[k],[b,by]=rows[k+1];return tissueBlendWeights(a,b,tissueSmooth(ay,by,y));
}
function surfaceTorsoPoint(tissue,t,theta){
  const rawTheta=theta,authorT=bodyAuthorY(t);
  const y=tissue.bind.get('hips').p[1]+t,head=tissue.bind.get('head'),headY=y-head.p[1];
  // Concentrate the original procedural ring samples across the face, where the
  // nose needs millimetre-scale spacing. This is not subdivision of a flat nose.
  theta-=.62*Math.sin(theta)*tissueSmooth(-.085,-.045,headY);
  const cs=Math.cos(theta),sn=Math.sin(theta);
  const torso=tissueProfile(ANATOMICAL_PROFILES.torso)(t),face=tissueProfile(ANATOMICAL_PROFILES.head)(headY);
  const blend=tissueSmooth(-.084,-.047,headY),r=torso.map((v,k)=>v+(face[k]-v)*blend);
  let x=sn*r[0],z=r[4]+(cs>=0?r[1]:r[2])*cs;
  if(blend>.001)z+=head.p[2]*blend;
  const gauss=(v,s)=>Math.exp(-((v/s)**2));
  if(cs>0){
    z+=(.007*gauss(Math.abs(x)-.074,.052)*gauss(authorT-.36,.080)
      -.002*gauss(x,.013)*gauss(authorT-.34,.11)
      -.0020*gauss(x,.010)*gauss(authorT-.185,.013)
      +.0025*gauss(Math.abs(x)-.065,.065)*gauss(authorT-.477,.016))*(1-blend)*cs*cs;
  }
  if(blend>.99&&cs>0)z=head.p[2]+tissueHeadFront(x,headY);
  return headNeckSurfacePoint(tissue,t,rawTheta,[x,y,z]);
}
function surfaceTubeRing(cage,frameValue,t,rx,rf,rb,count,weights,center=[0,0]){
  return cage.ring(Array.from({length:count},(_,k)=>{const a=k/count*Math.PI*2,cs=Math.cos(a);return point(frameValue,[Math.sin(a)*rx+center[0],-t,cs*(cs>=0?rf:rb)+center[1]]);}),weights);
}
function buildConnectedHumanSurface(tissue){
  let cage=new HumanSurfaceCage();const sides=CONNECTED_SURFACE_SPEC.bodySides,hip=tissue.bind.get('hips'),head=tissue.bind.get('head');
  const top=head.p[1]+ADULT_SPEC.head.vertexY,rows=[];
  for(let t=.020;t<.510-.0001;t+=.010)rows.push(bodyAxialY(t));
  for(let y=hip.p[1]+bodyAxialY(.510);y<top-.002;y+=.006)rows.push(y-hip.p[1]);
  rows.push(top-hip.p[1]-.0018);
  const rings=rows.map(t=>cage.ring(Array.from({length:sides},(_,k)=>surfaceTorsoPoint(tissue,t,k/sides*Math.PI*2)),(k,p)=>{
    const base=surfaceSpineWeights(tissue,p[1]),outer=tissueSmooth(.112,.17,Math.abs(p[0]))*Math.exp(-(((bodyAuthorY(t)-.46)/.060)**2))*.55;
    const side=p[0]<0?'left':'right';return [...base.map(([id,w])=>[id,w*(1-outer)]),[side+'_AC',outer]];
  }));
  const rowAt=t=>rows.reduce((best,v,k)=>Math.abs(v-t)<Math.abs(rows[best]-t)?k:best,0);
  const shoulderHoles=[{name:'right_shoulder',r0:rowAt(bodyAxialY(.400)),r1:rowAt(bodyAxialY(.505)),c0:9,width:6},
    {name:'left_shoulder',r0:rowAt(bodyAxialY(.400)),r1:rowAt(bodyAxialY(.505)),c0:33,width:6}];
  const armHoles=cage.tube(rings,shoulderHoles);
  // Freeze the published seam correspondence before reshaping its shared rim.
  const shoulderPorts=armHoles.map((hole,k)=>surfaceAngularLoop(cage,hole,{q:qz((k===0?1:-1)*Math.PI/2)}));
  const shoulderTangents=shapeShoulderSockets(cage,tissue,rings,rows,shoulderHoles);
  cage.cap(rings.at(-1),[0,top,head.p[2]-.003],[['head',1]]);
  // The two leg exits share one crotch seam, including exactly the same indices.
  const bottom=rings[0],seam=[bottom[0]];
  for(let k=1;k<12;k++){
    const u=k/12,A=cage.v[bottom[0]].p,B=cage.v[bottom[sides/2]].p,p=mix(A,B,u);p[1]-=.140*Math.sin(Math.PI*u)**.60;
    seam.push(cage.vertex(p,[['hips',1]]));
  }
  seam.push(bottom[sides/2]);
  const legExits={right:[...bottom.slice(0,sides/2+1),...seam.slice(1,-1).reverse()],left:[...bottom.slice(sides/2),bottom[0],...seam.slice(1,-1)]};

  function digits(exit,fingers,owner,{toe=false}={}){
    const frameValue=tissue.bind.get(owner),toLocal=p=>rotate(inv(frameValue.q),sub(p,frameValue.p));
    const slots=fingers.map(f=>({...f,local:toLocal(tissue.bind.get(f.joints[0].id).p)})).sort((a,b)=>a.local[0]-b.local[0]);
    const borders=[slots[0].local[0]-(toe?.009:.010),...slots.slice(1).map((f,k)=>(f.local[0]+slots[k].local[0])/2),slots.at(-1).local[0]+(toe?.009:.010)];
    const front=[],back=[],crossbars=[],cells=slots.length;
    for(let c=0;c<=cells;c++){
      const left=slots[Math.max(0,c-1)],right=slots[Math.min(c,cells-1)];
      const depth=toe?(left.local[2]+right.local[2])/2-.001:Math.max(left.local[1],right.local[1])-.010;
      const digitY=(left.local[1]+right.local[1])/2,digitR=(left.radius+right.radius)/2;
      const bar=[];
      for(let k=0;k<=4;k++){const u=k/4,lateral=borders[c],bow=Math.sin(Math.PI*u)*(toe?.004:.008);
        const local=toe?[lateral,digitY+digitR*.80*(1-2*u),depth+bow*.5]:[lateral,depth-bow*.5,.011-.022*u];
        bar.push(cage.vertex(point(frameValue,local),[[owner,1]]));
      }crossbars.push(bar);
    }
    for(let c=0;c<cells;c++){
      const a=crossbars[c],b=crossbars[c+1],f=[a[0]],r=[a[4]];
      for(let k=1;k<4;k++){const u=k/4;f.push(cage.vertex(mix(cage.v[a[0]].p,cage.v[b[0]].p,u),[[owner,1]]));r.push(cage.vertex(mix(cage.v[a[4]].p,cage.v[b[4]].p,u),[[owner,1]]));}
      f.push(b[0]);r.push(b[4]);front.push(f);back.push(r);
    }
    const perimeter=[...front.flatMap(f=>f.slice(0,-1)),crossbars.at(-1)[0],...crossbars.at(-1).slice(1),
      ...back.slice().reverse().flatMap(b=>b.slice(0,-1).reverse()),...crossbars[0].slice(1,-1).reverse()];
    // Keep the wrist/forefoot connected even when the two rings have different resolutions.
    const exitFrame=toe?{p:frameValue.p,q:qm(frameValue.q,fromTo([0,-1,0],[0,0,1]))}:frameValue;
    const normalized=surfaceLoopOrder(cage,perimeter,exitFrame);
    surfaceAngularJoin(cage,surfaceAngularLoop(cage,exit,exitFrame),surfaceAngularLoop(cage,normalized,exitFrame));
    for(let c=0;c<cells;c++){
      const loop=[...front[c].slice(0,-1),...crossbars[c+1].slice(0,-1),...back[c].slice(1).reverse(),...crossbars[c].slice(1).reverse()];
      fingerTube(loop,slots[c],toe);
    }
  }
  function fingerTube(boundary,f,toe){
    const j0=f.joints[0],frameValue=tissue.bind.get(j0.id),lengths=f.lengths,total=lengths.reduce((a,b)=>a+b,0),starts=[0];
    for(const L of lengths)starts.push(starts.at(-1)+L);
    let previous=surfaceLoopOrder(cage,boundary,frameValue),first=true;
    const radius=f.radius,steps=toe?16:24;
    if(f.entryFrame){
      const port=surfaceAngularLoop(cage,boundary,f.entryFrame);previous=port.ids;
      for(let step=1;step<=3;step++){
        const u=step/3,next=cage.ring(port.ids.map((id,k)=>{
          const a=port.angles[k],cs=Math.cos(a),target=point(frameValue,[Math.sin(a)*radius,-.004,cs*radius*(cs>=0?.82:.86)]);
          return mix(cage.v[id].p,target,u);
        }),k=>[...cage.v[port.ids[k]].w.map(([id,w])=>[id,w*(1-u)]),[j0.id,u]]);
        cage.join(previous,next);previous=next;
      }
    }
    for(let r=0;r<=steps;r++){
      const tipRadius=radius*.83,capStart=total+.001-tipRadius;
      const t=.008+(total+.0005-.008)*r/steps;let k=0;while(k<lengths.length-1&&t>starts[k+1])k++;
      const jf=tissue.bind.get(f.joints[k].id),localT=t-starts[k];
      const cap= t>capStart?Math.sqrt(Math.max(.001,1-((t-capStart)/tipRadius)**2)):1;
      const knuckle=starts.slice(1,-1).reduce((v,a)=>v+.045*Math.exp(-(((t-a)/.006)**2)),0),rad=radius*(1-.17*Math.min(t,capStart)/total+knuckle)*cap;
      let weights=[[f.joints[k].id,1]];
      for(let hinge=1;hinge<lengths.length;hinge++)if(Math.abs(t-starts[hinge])<.006)
        weights=tissueBlendWeights(f.joints[hinge-1].id,f.joints[hinge].id,tissueSmooth(starts[hinge]-.006,starts[hinge]+.006,t));
      const next=surfaceTubeRing(cage,jf,localT,rad,rad*(toe?.73:.82),rad*.86,16,weights);
      if(first){surfaceAngularJoin(cage,surfaceAngularLoop(cage,previous,frameValue),surfaceAngularLoop(cage,next,frameValue));first=false;}
      else cage.join(previous,next);previous=next;
    }
    const tip=point(tissue.bind.get(f.joints.at(-1).id),[0,-lengths.at(-1)-.001,0]);cage.cap(previous,tip,[[f.joints.at(-1).id,1]]);
  }
  for(const side of ['right','left']){
    const s=side==='right'?1:-1,a=side+'_',arm=tissue.human.arms[side],leg=tissue.human.legs[side];
    const frameValue=tissue.bind.get(a+'upperArm'),L=arm.L1+arm.L2;
    const shoulder=shoulderPorts[side==='right'?0:1];
    let previous=shoulder.ids;
    // The branch ENDS below the axilla. The old .005 m port turned the skin
    // back upward around the humeral head, producing a folded sleeve.
    const armStart=.125,collarStart=previous.slice();
    const radii=tissueProfile([[armStart,.043,.040,.050,0,0],[.175,.039,.039,.043,0,0],[arm.L1-.035,.030,.031,.032,0,0],
      [arm.L1,.029,.030,.030,0,0],[arm.L1+.052,.033,.033,.032,0,0],[L-.040,.026,.026,.022,0,0],[L,.027,.021,.018,0,0]]);
    for(let step=1;step<=7;step++){
      const u=step/7,points=collarStart.map((id,k)=>{
        return shoulderCollarPoint(tissue,side,cage.v[id].p,shoulder.angles[k],u,frameValue,armStart,radii,shoulderTangents.get(id));
      });
      const next=cage.ring(points,k=>{
        // Posterior axillary skin needs a gentler gradient when the arm closes;
        // the clavicular border retains zero-slope endpoints as the arm rises.
        const angle=shoulder.angles[k],w=shoulderCollarSkinWeight(side,angle,u);
        return [...cage.v[collarStart[k]].w.map(([id,value])=>[id,value*(1-w)]),[a+'upperArm',w]];
      });
      cage.join(previous,next);previous=next;
    }
    const stations=Array.from({length:30},(_,k)=>armStart+(L-armStart)*(k+1)/30);
    for(let k=1;k<=12;k++)stations.push(L-k*.003);
    stations.sort((a,b)=>a-b);
    const armStations=stations.filter((t,k)=>!k||t-stations[k-1]>.0003);
    for(let r=0;r<armStations.length;r++){
      const t=armStations[r],[rx,rf,rb]=t>arm.L1?handForearmSection(tissue,side,t):shoulderArmSection(tissue,side,t,radii(t)),elbow=tissueSmooth(arm.L1-.045,arm.L1+.045,t),twist=tissueSmooth(arm.L1+.06,L-.035,t),wrist=handWristSkinWeight(tissue,t-L);
      const w=[[a+'upperArm',(1-elbow)],[a+'forearm',elbow*(1-twist)],[a+'radiusRotation',elbow*twist*(1-wrist)],[a+'hand',elbow*twist*wrist]];
      const ring=surfaceTubeRing(cage,frameValue,t,rx,rf,rb,32,w);
      if(r===0)surfaceAngularJoin(cage,{ids:previous,angles:shoulder.angles},shoulderArmJoinLoop(ring,frameValue,t,radii));else cage.join(previous,ring);previous=ring;
    }
    buildRefinedHandSurface(cage,tissue,side,previous);

    const legFrame=tissue.bind.get(a+'femur'),LL=leg.L1+leg.L2;
    const hipPort=surfaceAngularLoop(cage,legExits[side],{...legFrame,center:legFrame.p});previous=hipPort.ids;
    const hipBoundary=previous.slice(),legStart=leg.L1*.32;
    for(let step=1;step<=7;step++){
      const u=step/7,w=tissueSmooth(0,1,u),next=cage.ring(hipBoundary.map((id,k)=>{
        const angle=hipPort.angles[k],start=cage.v[id].p;
        return lowerHipBridgePoint(tissue,side,start,angle,u,legStart);
      }),k=>[...cage.v[hipBoundary[k]].w.map(([id,value])=>[id,value*(1-w)]),[a+'femur',w]]);
      cage.join(previous,next);previous=next;
    }
    const legStations=[...Array.from({length:42},(_,r)=>legStart+(LL-legStart)*(r+1)/42).filter(t=>t<LL-.026),
      ...[.14,.11,.09,.07,.05,.035,.026].map(offset=>LL-offset)].sort((a,b)=>a-b).filter((t,k,list)=>!k||t-list[k-1]>.00001);
    for(let r=0;r<legStations.length;r++){
      const t=legStations[r],u=(t-leg.L1)/leg.L2;
      const ring=cage.ring(Array.from({length:32},(_,k)=>lowerWholeLegPoint(tissue,side,t,k/32*Math.PI*2)),lowerLegSkinWeights(tissue,side,u));
      if(r===0)surfaceAngularJoin(cage,{ids:previous,angles:hipPort.angles},surfaceAngularLoop(cage,ring,legFrame));else cage.join(previous,ring);previous=ring;
    }
    const ankleLoop=previous,ff=tissue.bind.get(a+'foot'),footRings=[];
    for(let r=0;r<=24;r++){
      const z=LOWER_BODY_PLAN.foot.heelZ+(LOWER_BODY_PLAN.foot.forefootExitZ-LOWER_BODY_PLAN.foot.heelZ)*r/24;
      footRings.push(cage.ring(Array.from({length:32},(_,k)=>lowerFootSurfacePoint(tissue,side,z,s*k/32*Math.PI*2)),[[a+'foot',1]]));
    }
    cage.cap(footRings[0],point(ff,[0,-.049,LOWER_BODY_PLAN.foot.heelZ-.001]),[[a+'foot',1]]);
    const hole=cage.tube(footRings,[{name:a+'ankle',r0:5,r1:13,c0:28,width:8}])[0];
    buildLowerAnkleBridge(cage,tissue,side,ankleLoop,hole);
    buildLowerForefoot(cage,tissue,side,footRings.at(-1));
  }
  fairShoulderSurface(cage,tissue,rings,rows);
  fairHandCarrier(cage,tissue);
  const cageTopology=cage.orient();
  for(let i=0;i<CONNECTED_SURFACE_SPEC.subdivisions;i++)cage=cage.subdivide();
  // Re-evaluate facial landmarks on the final shared skin. Eye/lip edges use
  // exactly this function, so subdivision cannot leave them floating above it.
  for(const v of cage.v){const y=v.p[1]-head.p[1],[rx,rf,,cx,cz]=FACE_PROFILE(y),x=v.p[0];
    const mask=tissueSmooth(-.067,-.045,y)*(1-tissueSmooth(.102,.125,y))*tissueSmooth(.20,.50,(v.p[2]-head.p[2]-cz)/rf);
    if(mask>0&&Math.abs((x-cx)/rx)<.97)v.p[2]+=(head.p[2]+tissueHeadFront(x,y)-v.p[2])*mask;
  }
  // A collar-index weight concentrates a 95-degree hip rotation into a narrow
  // groin strip. Distribute it by angle around the hip axis instead. Over the
  // full sagittal half-circle the smoothstep slope is bounded by 1.5 / pi.
  // This is an authored geometric binding rule, not a muscle/force simulation.
  for(const v of cage.v){const dy=v.p[1]-hip.p[1],x=v.p[0];
    if(dy<-.27||dy>.22||Math.abs(x)>.185)continue;
    const angle=Math.atan2(Math.abs(v.p[2]),-dy),moving=1-tissueSmooth(0,Math.PI,angle);
    const side=tissueSmooth(-.018,.018,x),mask=tissueSmooth(-.27,-.21,dy)*(1-tissueSmooth(.12,.22,dy));
    const base=dy>0?surfaceSpineWeights(tissue,v.p[1]):[['hips',1]];
    const angular=[...base.map(([id,w])=>[id,w*(1-moving)]),['left_femur',moving*(1-side)],['right_femur',moving*side]];
    v.w=surfaceWeights([...v.w.map(([id,w])=>[id,w*(1-mask)]),...angular.map(([id,w])=>[id,w*mask])]);
  }
  refineHandSurfaceVertices(tissue,cage);
  refineTorsoSurfaceVertices(tissue,cage);
  refineCervicoscapularContour(tissue,cage);
  refineBackAndPresetSurface(tissue,cage);
  rebuildAxialSurface(tissue,cage);
  refineShoulderSkinWeights(tissue,cage);
  refineHeadNeckSurfaceVertices(tissue,cage);
  const topology=cage.orient(),p=cage.v.flatMap(v=>v.p),indices=[];
  for(const f of cage.f)for(let k=1;k<f.length-1;k++)indices.push(f[0],f[k],f[k+1]);
  const g=mesh(p,indices),count=cage.v.length;
  g.skinJoints=new Float32Array(count*4);g.skinWeights=new Float32Array(count*4);
  for(let i=0;i<count;i++){
    const w=cage.v[i].w.slice().sort((a,b)=>b[1]-a[1]).slice(0,4),total=w.reduce((n,p)=>n+p[1],0);
    w.forEach(([joint,weight],k)=>{const id=tissue.jointIds.get(joint);if(id==null)throw Error('Unknown procedural skin joint '+joint);g.skinJoints[i*4+k]=id;g.skinWeights[i*4+k]=weight/total;});
  }
  g.surfaceTopology={cage:cageTopology,subdivided:topology,seams:cage.seams,method:'shared boundary control cage / Catmull-Clark',subdivisions:CONNECTED_SURFACE_SPEC.subdivisions};
  return g;
}
