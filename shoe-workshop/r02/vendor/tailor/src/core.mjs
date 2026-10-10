/* Original KAOPU seam laboratory. Public data are mm; solver coordinates are m.
 * Distance XPBD follows Macklin et al. 2016, not GarmentCode/PatternGSL source.
 * This is a swatch experiment, not a validated garment or calibrated material. */
export const SCHEMA = 'kaopu-sewing-graph@1';
export const clone = x => JSON.parse(JSON.stringify(x));
const freeze = o => {if(o && typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const distance = (a,b) => Math.hypot(...a.map((x,i)=>x-b[i]));
const finite = p => Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const fail = (code, detail) => {throw new Error(`${code}: ${detail}`);};
const len = (p, ids) => ids.slice(1).reduce((s,id,k)=>s+distance(p.uvMm[id],p.uvMm[ids[k]]),0);
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on = (a,b,p) => Math.abs(cross(a,b,p))<1e-7 && p[0]>=Math.min(a[0],b[0])-1e-7 && p[0]<=Math.max(a[0],b[0])+1e-7 && p[1]>=Math.min(a[1],b[1])-1e-7 && p[1]<=Math.max(a[1],b[1])+1e-7;
const intersect = (a,b,c,d) => cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0 || on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);

function makePanel(id,width,height,side,nx=10,ny=16){
  // The first and last 10 mm are real, meshed seam allowance strips.
  const xs=[0,...Array.from({length:nx-1},(_,i)=>10+(width-20)*i/(nx-2)),width];
  const uvMm=[],triangles=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)uvMm.push([xs[i],height*j/ny]);
  const at=(i,j)=>j*(nx+1)+i;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);triangles.push([a,b,d],[a,d,c]);}
  const boundary=[...Array.from({length:nx+1},(_,i)=>at(i,0)),...Array.from({length:ny},(_,j)=>at(nx,j+1)),...Array.from({length:nx},(_,i)=>at(nx-i-1,ny)),...Array.from({length:ny-1},(_,j)=>at(0,ny-j-1))];
  const seam=Array.from({length:ny+1},(_,j)=>at(side==='left'?nx-1:1,side==='left'?j:ny-j));
  return {id,source:{kind:'original_synthetic_swatch',version:'rect-mm-r1'},materialId:'uncalibrated-demo',uvMm,triangles,boundary,edges:{join:seam},edgeNotches:{join:[{id:'N1',t:side==='left'?0.25:0.75},{id:'N2',t:side==='left'?0.75:0.25}]},grain:[0,1],seamAllowanceMm:10,allowanceState:'meshed_flat_unfolded',placement:{translationMm:[side==='left'?-width-40:40,130,side==='left'?0:5],rotationYDeg:0},temporaryPins:side==='left'?[at(0,0)]:[],grid:{nx,ny}};
}

export function createExample({width=150,height=220,ease=0,invalid='none',revision=1}={}){
  if(!Number.isFinite(width)||width<60||width>300||!Number.isFinite(height)||height<80||height>360||!Number.isFinite(ease)||ease<0||ease>0.15)fail('PARAMETERS','demo dimensions outside supported limits');
  const spec={schema:SCHEMA,id:'two-swatch-straight-seam',revision,units:'mm',purpose:'synthetic_constraint_learning',materials:[{id:'uncalibrated-demo',densityKgM2:0.2,stretchCompliance:1e-7,bendCompliance:0.02,calibrated:false}],panels:[makePanel('A',width,height,'left'),makePanel('B',width,height*(1+ease),'right')],seams:[{id:'S1',a:{panelId:'A',edge:'join',reverse:false},b:{panelId:'B',edge:'join',reverse:true},easeMm:height*ease,notches:['N1','N2'],stageId:'join'}],stages:[{id:'cut',requires:[],seams:[]},{id:'join',requires:['cut'],seams:['S1']}],acceptance:{productionReady:false,fitValidated:false}};
  if(invalid==='direction')spec.seams[0].b.reverse=false;
  if(invalid==='ease')spec.seams[0].easeMm=24;
  if(invalid==='reference')spec.seams[0].b.panelId='missing';
  return spec;
}

export function directedEdge(spec,end){const p=spec.panels.find(p=>p.id===end.panelId);if(!p)fail('MISSING_PANEL',end.panelId);const ids=p.edges[end.edge];if(!ids)fail('MISSING_EDGE',`${p.id}.${end.edge}`);return {panel:p,ids:end.reverse?[...ids].reverse():[...ids]};}

export function validate(spec){
  if(!spec||spec.schema!==SCHEMA)fail('SCHEMA',`expected ${SCHEMA}`);
  if(spec.units!=='mm')fail('UNITS','explicit millimetres required');
  if(!Number.isInteger(spec.revision)||spec.revision<1)fail('REVISION','positive integer required');
  if(!Array.isArray(spec.panels)||!spec.panels.length||spec.panels.length>32)fail('PANELS','1–32 panels required');
  for(const key of ['panels','materials','seams','stages']){
    if(!Array.isArray(spec[key]))fail('SCHEMA',`${key} array required`);
    const ids=spec[key].map(p=>p.id);if(ids.some(x=>typeof x!=='string'||!x)||new Set(ids).size!==ids.length)fail('DUPLICATE_ID',key);
  }
  if(spec.acceptance?.productionReady!==false||spec.acceptance?.fitValidated!==false)fail('ACCEPTANCE','learning input cannot pre-accept garment');
  let vertexCount=0,triangleCount=0;
  for(const m of spec.materials)if(![m.densityKgM2,m.stretchCompliance,m.bendCompliance].every(Number.isFinite)||!(m.densityKgM2>0&&m.densityKgM2<10&&m.stretchCompliance>=0&&m.bendCompliance>=0)||m.calibrated!==false)fail('MATERIAL','uncalibrated finite positive demo material required');
  for(const p of spec.panels){
    if(!p.source?.version||!p.source?.kind)fail('SOURCE',p.id);
    if(!spec.materials.some(m=>m.id===p.materialId))fail('MATERIAL_REFERENCE',p.id);
    if(!Array.isArray(p.uvMm)||p.uvMm.length<3||p.uvMm.length>3000||p.uvMm.some(x=>!finite(x)||x.some(v=>Math.abs(v)>2000)))fail('MATERIAL_COORDINATES',p.id);
    const indices=ids=>Array.isArray(ids)&&ids.length>=2&&ids.every(i=>Number.isInteger(i)&&i>=0&&i<p.uvMm.length);
    if(!Array.isArray(p.triangles)||!p.triangles.length||p.triangles.length>6000)fail('TRIANGLES',p.id);
    for(const tri of p.triangles)if(!indices(tri)||tri.length!==3||new Set(tri).size!==3||cross(...tri.map(i=>p.uvMm[i]))<=1e-7)fail('TRIANGLE_AREA',p.id);
    const usedVertices=new Set(p.triangles.flat()),meshEdges=new Map(),triIds=new Set();
    for(const tri of p.triangles){const key=[...tri].sort((a,b)=>a-b).join(':');if(triIds.has(key))fail('DUPLICATE_TRIANGLE',p.id);triIds.add(key);for(let i=0;i<3;i++){const key=[tri[i],tri[(i+1)%3]].sort((a,b)=>a-b).join(':');meshEdges.set(key,(meshEdges.get(key)||0)+1);}}
    if(usedVertices.size!==p.uvMm.length)fail('UNUSED_MATERIAL_POINT',p.id);
    if([...meshEdges.values()].some(n=>n>2))fail('NONMANIFOLD_MATERIAL',p.id);
    if(!indices(p.boundary)||new Set(p.boundary).size!==p.boundary.length)fail('BOUNDARY',p.id);
    const b=p.boundary.map(i=>p.uvMm[i]);
    for(let i=0;i<b.length;i++)for(let j=i+2;j<b.length;j++){if(i===0&&j===b.length-1)continue;if(intersect(b[i],b[(i+1)%b.length],b[j],b[(j+1)%b.length]))fail('BOUNDARY_INTERSECTION',p.id);}
    const cutEdges=new Set(p.boundary.map((a,i)=>[a,p.boundary[(i+1)%p.boundary.length]].sort((a,b)=>a-b).join(':')));
    for(const [key,count] of meshEdges)if((count===1)!==cutEdges.has(key))fail('CUT_MESH_BOUNDARY',p.id);
    for(const key of cutEdges)if(meshEdges.get(key)!==1)fail('CUT_MESH_BOUNDARY',p.id);
    if(!p.edges||Object.values(p.edges).some(ids=>!indices(ids)))fail('EDGES',p.id);
    for(const ids of Object.values(p.edges))for(let i=1;i<ids.length;i++)if(!meshEdges.has([ids[i-1],ids[i]].sort((a,b)=>a-b).join(':')))fail('SEAM_NOT_ON_MATERIAL',p.id);
    if(!p.placement||!Array.isArray(p.placement.translationMm)||p.placement.translationMm.length!==3||!p.placement.translationMm.every(Number.isFinite)||!Number.isFinite(p.placement.rotationYDeg))fail('PLACEMENT',p.id);
    if(!Array.isArray(p.temporaryPins)||p.temporaryPins.some(i=>!Number.isInteger(i)||i<0||i>=p.uvMm.length))fail('PINS',p.id);
    if(p.allowanceState!=='meshed_flat_unfolded'||!Number.isFinite(p.seamAllowanceMm)||p.seamAllowanceMm<0)fail('ALLOWANCE',p.id);
    vertexCount+=p.uvMm.length;triangleCount+=p.triangles.length;
  }
  const stages=new Map(spec.stages.map(s=>[s.id,s])),visited=new Set(),visiting=new Set(),owners=[];
  function visit(id){if(!stages.has(id))fail('STAGE_REFERENCE',id);if(visiting.has(id))fail('STAGE_CYCLE',id);if(visited.has(id))return;visiting.add(id);const s=stages.get(id);if(!Array.isArray(s.requires)||!Array.isArray(s.seams))fail('STAGE_SCHEMA',id);s.requires.forEach(visit);visiting.delete(id);visited.add(id);}
  for(const s of spec.stages){visit(s.id);for(const id of s.seams){const seam=spec.seams.find(x=>x.id===id);if(!seam||seam.stageId!==s.id)fail('SEAM_STAGE',id);owners.push(id);}}
  if(owners.length!==spec.seams.length||new Set(owners).size!==owners.length)fail('SEAM_OWNERSHIP','each seam belongs to one stage');
  const used=new Set(),seamReports=[];
  for(const s of spec.seams){
    for(const endpoint of [s.a,s.b]){if(typeof endpoint?.reverse!=='boolean')fail('DIRECTION','explicit edge direction required');const k=`${endpoint.panelId}:${endpoint.edge}`;if(used.has(k))fail('EDGE_REUSE',k);used.add(k);}
    const a=directedEdge(spec,s.a),b=directedEdge(spec,s.b),la=len(a.panel,a.ids),lb=len(b.panel,b.ids);
    if(la<=0||lb<=0||!Number.isFinite(s.easeMm)||Math.abs(lb-la-s.easeMm)>0.1)fail('EASE_LENGTH',`${s.id}: B−A must match declared ease, not rescale rest geometry`);
    if(Math.abs(s.easeMm)/la>0.15)fail('EASE_LIMIT','demo supports up to 15% declared ease');
    if(!Array.isArray(s.notches)||s.notches.length<2)fail('NOTCHES','two or more anchors required');
    if(a.ids.length!==b.ids.length)fail('SAMPLING','R1 solver requires equal seam sample count; resampling is not implemented');
    for(const id of s.notches){
      const na=a.panel.edgeNotches?.[s.a.edge]?.find(n=>n.id===id),nb=b.panel.edgeNotches?.[s.b.edge]?.find(n=>n.id===id);
      if(!na||!nb)fail('NOTCH_REFERENCE',`${s.id}.${id}`);
      if(![na.t,nb.t].every(t=>Number.isFinite(t)&&t>=0&&t<=1))fail('NOTCH_RANGE',s.id);
      const ta=s.a.reverse?1-na.t:na.t,tb=s.b.reverse?1-nb.t:nb.t;
      if(Math.abs(ta-tb)>1e-6)fail('NOTCH_DIRECTION',`${s.id}.${id}: oriented notches mismatch`);
    }
    seamReports.push({id:s.id,lengthAMm:la,lengthBMm:lb,easeMm:lb-la,pairCount:a.ids.length});
  }
  return {valid:true,vertexCount,triangleCount,panelCount:spec.panels.length,seams:seamReports,productionReady:false};
}

export function fingerprint(spec){let hash=2166136261;for(const ch of JSON.stringify(spec)){hash=Math.imul(hash^ch.charCodeAt(0),16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
export function cut(spec){validate(spec);return freeze({schema:'kaopu-cut-snapshot@1',signature:fingerprint(spec),revision:spec.revision,spec:clone(spec),productionReady:false});}

export class ClothLab {
  constructor(snapshot){
    if(snapshot?.schema!=='kaopu-cut-snapshot@1'||snapshot.signature!==fingerprint(snapshot.spec))fail('SNAPSHOT','valid immutable cut snapshot required');
    validate(snapshot.spec);this.snapshot=freeze(clone(snapshot));this.spec=this.snapshot.spec;this.positions=[];this.previous=[];this.velocity=[];this.invMass=[];this.baseInvMass=[];this.offsets=new Map();this.constraints=[];this.seamConstraints=[];this.triangles=[];this.pins=new Map();this.completed=new Set(['cut']);this.active=new Set();this.elapsed=0;this.seamElapsed=0;this.seamDetached=false;this.gravity=true;this.obstacle=false;this.pull=false;this.sphere={center:[0,-0.025,-0.02],radius:0.052};this.floorY=-0.3;
    this.pullDirections=[];
    for(const p of this.spec.panels){const start=this.positions.length;this.offsets.set(p.id,start);const theta=p.placement.rotationYDeg*Math.PI/180,m=specMaterial(this.spec,p),mass=new Array(p.uvMm.length).fill(0),panelIndex=this.spec.panels.indexOf(p);
      for(const tri of p.triangles){const area=cross(...tri.map(i=>p.uvMm[i]))/2e6;tri.forEach(i=>mass[i]+=area*m.densityKgM2/3);this.triangles.push({ids:tri.map(i=>start+i),uv:tri.map(i=>p.uvMm[i]),panelId:p.id});}
      for(let i=0;i<p.uvMm.length;i++){const [u,v]=p.uvMm[i],t=p.placement.translationMm;const point=[(u*Math.cos(theta)+t[0])/1000,(t[1]-v)/1000,(u*Math.sin(theta)+t[2])/1000];this.positions.push(point);this.previous.push([...point]);this.velocity.push([0,0,0]);this.invMass.push(1/mass[i]);this.baseInvMass.push(1/mass[i]);this.pullDirections.push(panelIndex===0?-1:panelIndex===this.spec.panels.length-1?1:0);}
      for(const i of p.temporaryPins){this.pins.set(start+i,[...this.positions[start+i]]);this.invMass[start+i]=0;}
      const edges=new Map();for(const tri of p.triangles)for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=[a,b].sort((a,b)=>a-b).join(':');if(!edges.has(key))edges.set(key,{a,b,opposite:[]});edges.get(key).opposite.push(tri[(i+2)%3]);}
      for(const e of edges.values()){this.constraints.push({a:start+e.a,b:start+e.b,rest:distance(p.uvMm[e.a],p.uvMm[e.b])/1000,compliance:m.stretchCompliance,lambda:0,type:'stretch'});if(e.opposite.length===2){const [a,b]=e.opposite;this.constraints.push({a:start+a,b:start+b,rest:distance(p.uvMm[a],p.uvMm[b])/1000,compliance:m.bendCompliance,lambda:0,type:'bend-distance-proxy'});}}
    }
  }
  assertCurrent(spec){if(fingerprint(spec)!==this.snapshot.signature)fail('STALE_CUT','pattern/material/placement changed: cut and sew again');}
  activate(stageId,current=this.spec){this.assertCurrent(current);const stage=this.spec.stages.find(s=>s.id===stageId);if(!stage)fail('STAGE_REFERENCE',stageId);if(stage.requires.some(id=>!this.completed.has(id)))fail('STAGE_DEPENDENCY',stageId);if(this.completed.has(stageId))return;
    for(const id of stage.seams){const seam=this.spec.seams.find(s=>s.id===id),a=directedEdge(this.spec,seam.a),b=directedEdge(this.spec,seam.b);for(let i=0;i<a.ids.length;i++){const ia=this.offsets.get(a.panel.id)+a.ids[i],ib=this.offsets.get(b.panel.id)+b.ids[i];this.seamConstraints.push({a:ia,b:ib,rest:0.0008,startRest:distance(this.positions[ia],this.positions[ib]),activatedAt:this.elapsed,compliance:1e-8,lambda:0,type:'seam',seamId:id});}this.active.add(id);}
    this.seamElapsed=0;this.completed.add(stageId);
  }
  releasePins(){this.pins.clear();this.invMass=[...this.baseInvMass];}
  detach(){this.seamConstraints=[];this.active.clear();this.completed=new Set(['cut']);this.seamDetached=true;}
  step(dt=1/60){
    if(!Number.isFinite(dt)||dt<=0||dt>0.05)fail('TIMESTEP','positive timestep up to 0.05 seconds required');
    const sub=3,h=dt/sub;
    for(let substep=0;substep<sub;substep++){
      this.elapsed+=h;this.seamElapsed+=h;
      for(let i=0;i<this.positions.length;i++){this.previous[i]=[...this.positions[i]];if(!this.invMass[i])continue;const v=this.velocity[i],p=this.positions[i];v[1]-=(this.gravity?9.81:0)*h;if(this.pull)v[0]+=this.pullDirections[i]*2.2*h;for(let k=0;k<3;k++)p[k]+=v[k]*h;}
      const constraints=[...this.constraints,...this.seamConstraints];constraints.forEach(c=>c.lambda=0);
      for(let iter=0;iter<12;iter++){
        for(const c of constraints){const a=this.positions[c.a],b=this.positions[c.b],w1=this.invMass[c.a],w2=this.invMass[c.b],dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2],d=Math.hypot(dx,dy,dz);if(d<1e-12||w1+w2===0)continue;const alpha=c.compliance/(h*h),target=c.type==='seam'?c.rest+(c.startRest-c.rest)*Math.max(0,1-(this.elapsed-c.activatedAt)/1.2):c.rest;const dl=(-(d-target)-alpha*c.lambda)/(w1+w2+alpha);c.lambda+=dl;const f=dl/d;for(let k=0;k<3;k++){const n=[dx,dy,dz][k];a[k]+=w1*f*n;b[k]-=w2*f*n;}}
        for(let i=0;i<this.positions.length;i++){if(!this.invMass[i])continue;const p=this.positions[i];p[1]=Math.max(this.floorY,p[1]);if(this.obstacle){const c=this.sphere.center,d=distance(p,c),r=this.sphere.radius+0.001;if(d<r){const n=d>1e-10?p.map((x,k)=>(x-c[k])/d):[0,0,1];for(let k=0;k<3;k++)p[k]=c[k]+n[k]*r;}}}
      }
      const decay=Math.exp(-3*h);for(let i=0;i<this.positions.length;i++)for(let k=0;k<3;k++)this.velocity[i][k]=(this.positions[i][k]-this.previous[i][k])/h*decay;
    }
  }
  metrics(){
    let maxStrain=0,minRatio=1,finite=true,maxSpeed=0,penetration=0;
    for(const t of this.triangles){const [u0,u1,u2]=t.uv,du=u1[0]-u0[0],dv=u1[1]-u0[1],eu=u2[0]-u0[0],ev=u2[1]-u0[1],det=du*ev-dv*eu;const [p0,p1,p2]=t.ids.map(i=>this.positions[i]),f1=[],f2=[];for(let k=0;k<3;k++){const a=(p1[k]-p0[k])*1000,b=(p2[k]-p0[k])*1000;f1.push((a*ev-b*dv)/det);f2.push((-a*eu+b*du)/det);}const aa=f1.reduce((s,x)=>s+x*x,0),bb=f2.reduce((s,x)=>s+x*x,0),ab=f1.reduce((s,x,k)=>s+x*f2[k],0),disc=Math.sqrt((aa-bb)**2+4*ab*ab);const large=Math.sqrt(Math.max(0,(aa+bb+disc)/2)),small=Math.sqrt(Math.max(0,(aa+bb-disc)/2));maxStrain=Math.max(maxStrain,large-1,1-small);minRatio=Math.min(minRatio,small);}
    for(let i=0;i<this.positions.length;i++){finite&&=this.positions[i].every(Number.isFinite);maxSpeed=Math.max(maxSpeed,Math.hypot(...this.velocity[i]));if(this.obstacle)penetration=Math.max(penetration,(this.sphere.radius+0.001-distance(this.positions[i],this.sphere.center))*1000);}
    const s=this.spec.seams.flatMap(seam=>{const a=directedEdge(this.spec,seam.a),b=directedEdge(this.spec,seam.b);return a.ids.map((id,i)=>distance(this.positions[this.offsets.get(a.panel.id)+id],this.positions[this.offsets.get(b.panel.id)+b.ids[i]])*1000);});
    return {finite,maxPrincipalStrain:maxStrain,minStretchRatio:minRatio,maxSeamGapMm:Math.max(0,...s),meanSeamGapMm:s.reduce((a,b)=>a+b,0)/Math.max(1,s.length),maxSpeedMmS:maxSpeed*1000,maxVertexSpherePenetrationMm:Math.max(0,penetration),pins:this.pins.size,activeStitches:this.seamConstraints.length,vertexCount:this.positions.length,triangleCount:this.triangles.length,restSignature:this.snapshot.signature,elapsed:this.elapsed,bodyContact:'not_implemented',selfCollision:'not_implemented',productionReady:false};
  }
  export(){return {schema:'kaopu-cloth-experiment@1',snapshot:this.snapshot,positionsMm:this.positions.map(p=>p.map(x=>x*1000)),activeSeams:[...this.active],temporaryPins:[...this.pins.keys()],metrics:this.metrics(),solver:{type:'distance-XPBD',version:'r1',bending:'uncalibrated-distance-proxy',contacts:'vertex-sphere-and-floor-only',continuousCollision:false,selfCollision:false},productionReady:false};}
}
function specMaterial(spec,p){return spec.materials.find(m=>m.id===p.materialId);}
