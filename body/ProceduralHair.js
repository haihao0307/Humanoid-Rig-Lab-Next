/* V7: skin attachments -> fixed-length space curves -> independent ribbons.
 * No scalp coverage shell or radial body projection. Short-groom motion uses
 * clearance-bounded joint rotation; it is an explicit reduced model, not DER. */
const HAIR_SPEC=Object.freeze({seed:260909,maxShafts:24576,segments:8,motionGroups:32,
 fixedStep:1/60,maxSubsteps:2,springStiffness:180,springDamping:26,maxMotionM:.003,
 farDistanceM:2.2,sleepDistanceM:4,castShadows:false});
const hairSmooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function hairRandom(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
class HairScalp{
 constructor(human){
  const g=human.tissue.skin.g,bind=human.tissue.bind.get('head'),iq=inv(bind.q),vertices=[];let top=-Infinity;
  // Head landmarks define only the growth mask, never a radial collision shell.
  for(let k=0;k<g.p.length;k+=3){const p=rotate(iq,sub(hairRestVertex(g,k/3),bind.p));if(Math.abs(p[0])<.16&&Math.abs(p[2])<.20){top=Math.max(top,p[1]);vertices.push(p);}}
  if(!Number.isFinite(top))throw Error('头发：没有找到头皮顶点');
  const points=vertices.filter(p=>p[1]>top-.17),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
  this.top=top;this.center=[(lo[0]+hi[0])/2,top-.105,(lo[2]+hi[2])/2-.012];
  this.rx=Math.max(.05,(hi[0]-lo[0])/2);this.rz=Math.max(.06,(hi[2]-lo[2])/2);
  this.samples=vertices.length;this.bodySex=human.bodySex||'male';
  this.growthSurface=new HairSkinCollider(human,this,true);
  this.collider=new HairSkinCollider(human,this,false);
 }
 inGrowthRegion(p){
  const v=sub(p,this.center),d=norm(v),a=Math.atan2(d[0],d[2]);
  return p[1]>this.top-.165&&Math.acos(clamp(d[1],-1,1))<this.limit(a);
 }
 edgeDistance(p){const v=sub(p,this.center),d=norm(v);return Math.min(p[1]-(this.top-.165),(this.limit(Math.atan2(d[0],d[2]))-Math.acos(clamp(d[1],-1,1)))*len(v));}
 direction(a,t){return [Math.sin(t)*Math.sin(a),Math.cos(t),Math.sin(t)*Math.cos(a)];}
 limit(a){
  const az=Math.abs(Math.atan2(Math.sin(a),Math.cos(a))),knots=[[0,1.28],[.38,1.30],[.68,1.20],[1.05,1.52],[1.40,1.72],[1.70,1.76],[2.25,1.98],[Math.PI,2.02]];
  let limit=2.02;for(let k=1;k<knots.length;k++)if(az<=knots[k][0]){const [x,y]=knots[k-1],[xx,yy]=knots[k];limit=y+(yy-y)*hairSmooth(x,xx,az);break;}
  return limit+.012*Math.sin(a*19+.4)+.007*Math.sin(a*43+1.3);
 }
}
class ProceduralHair{
 constructor(lab){
  this.lab=lab;this.h=lab.human;this.enabled=true;this.windEnabled=true;this.windSpeed=.8;this.time=0;this.demo=null;this.revision=0;this.visible=true;
  this.motion=new Float32Array(HAIR_SPEC.motionGroups*4);this.velocity=new Float32Array(HAIR_SPEC.motionGroups*3);this.previousHeadVelocity=new Float32Array(3);
  this.build();this.gpu=new HairRenderer(this,lab.renderer.gl);lab.renderer.hair=this;
 }
 build(){
  this.scalp=new HairScalp(this.h);this.tissue=this.h.tissue;const spec=HAIR_SPEC,P=[],N=[],T=[],UV=[],meta=[],pivots=[],groups=[],out=[];
  this.follicleField=new HairFollicleField(this.scalp);
  const selected=this.follicleField.select(spec.maxShafts);this.selectedFollicles=[];
  this.curveAudit={attempted:selected.length,rejected:0,maxLengthErrorM:0,rootAttachment:'skin triangle and barycentric coordinates'};
  for(const index of selected){
   const follicle=this.follicleField.follicles[index],curve=hairFollicleCurve(this.scalp,follicle,spec.segments);
   if(!curve){this.curveAudit.rejected++;continue;}
   this.selectedFollicles.push(index);this.curveAudit.maxLengthErrorM=Math.max(this.curveAudit.maxLengthErrorM,Math.abs(curve.arcLength-follicle.lengthM));
   const {centers,directions,pivot,maxAngle}=curve,start=P.length/3,
    group=Math.min(31,Math.floor((Math.atan2(follicle.d[0],follicle.d[2])+Math.PI)/(2*Math.PI)*8)%8+8*Math.floor(clamp(follicle.d[1],0,.9999)*4));
   for(let j=0;j<=spec.segments;j++){
    const u=j/spec.segments,tangent=norm(sub(centers[Math.min(spec.segments,j+1)],centers[Math.max(0,j-1)]));
    let side=norm(cross(directions[j],tangent));if(len(side)<.5)side=norm(cross([0,0,1],tangent));
    const width=follicle.diameterM*(1-.65*hairSmooth(.75,1,u));
    for(const sign of [-1,1]){
     P.push(...add(centers[j],mul(side,sign*width*.5)));N.push(...directions[j]);T.push(...tangent);UV.push(sign<0?0:1,u);meta.push(follicle.shade,1);
     pivots.push(...pivot,j>1?maxAngle:0);groups.push(group);
    }
   }
   for(let j=0;j<spec.segments;j++){const aa=start+j*2,bb=aa+2;out.push(aa,bb,aa+1,aa+1,bb,bb+1);}
  }
  this.browIndexOffset=out.length;
  this.eyebrows=appendHairEyebrows(this.h,this.scalp,P,N,T,UV,meta);this.browIndexCount=this.eyebrows.indices.length;
  for(let k=groups.length;k<P.length/3;k++){pivots.push(0,0,0,0);groups.push(0);}
  const indices=Uint32Array.from(out.concat(this.eyebrows.indices));
  this.geometry={p:Float32Array.from(P),n:Float32Array.from(N),t:Float32Array.from(T),uv:Float32Array.from(UV),meta:Float32Array.from(meta),pivots:Float32Array.from(pivots),groups:Float32Array.from(groups),near:indices,far:indices};
  this.reset();this.revision++;if(this.gpu)this.gpu.rebuild();
 }
 headFrame(){const j=this.h.byId.get('head');return frame(j.world.p,j.world.q);}
 reset(){this.motion.fill(0);this.velocity.fill(0);this.motionRevision=(this.motionRevision||0)+1;this.previousHeadVelocity.fill(0);this.lastFrame=this.headFrame();this.accumulator=0;this.dirty=true;}
 update(dt){
  if(this.tissue!==this.h.tissue)this.build();if(!this.enabled||dt<=0)return;
  const f=this.headFrame(),r=this.lab.renderer;
  if(!this.visible||dist(f.p,r.eye)>HAIR_SPEC.sleepDistanceM||dt>.12||dist(f.p,this.lastFrame.p)>.25){this.reset();this.dirty=false;return;}
  const headVelocity=mul(sub(f.p,this.lastFrame.p),1/Math.max(dt,.001)),acceleration=rotate(inv(f.q),mul(sub(headVelocity,this.previousHeadVelocity),1/Math.max(dt,.001)));
  const dq=qm(inv(this.lastFrame.q),f.q),sign=dq[3]<0?-1:1,omega=dq.slice(0,3).map(x=>clamp(x*2*sign/Math.max(dt,.001),-5,5));
  this.previousHeadVelocity.set(headVelocity);this.lastFrame=f;
  const breeze=this.windEnabled?this.windSpeed:0,wind=rotate(inv(f.q),[breeze*(.8+.2*Math.sin(this.time*1.7)),0,breeze*.2]);
  const force=[wind[0]*.30-omega[1]*.40-clamp(acceleration[0],-12,12)*.025,wind[1]*.12,wind[2]*.30+omega[0]*.40-clamp(acceleration[2],-12,12)*.025];
  this.accumulator=Math.min(this.accumulator+dt,HAIR_SPEC.fixedStep*HAIR_SPEC.maxSubsteps);let changed=false;
  while(this.accumulator>=HAIR_SPEC.fixedStep){const step=HAIR_SPEC.fixedStep;
   // Independent local groups drive bounded joint rotations, never vertex shifts.
   for(let group=0;group<HAIR_SPEC.motionGroups;group++)for(let c=0;c<3;c++){
    const i=group*4+c,k=group*3+c,old=this.motion[i],phase=group*2.399963;
    const drive=force[c]*(.75+.25*Math.sin(this.time*1.7+phase));
    this.velocity[k]+=(drive-HAIR_SPEC.springStiffness*old-HAIR_SPEC.springDamping*this.velocity[k])*step;
    const next=old+this.velocity[k]*step;this.motion[i]=clamp(next,-HAIR_SPEC.maxMotionM,HAIR_SPEC.maxMotionM);
    if(next!==this.motion[i])this.velocity[k]=0;changed||=Math.abs(this.motion[i]-old)>1e-7;
   }
   this.accumulator-=step;this.time+=step;
  }
  this.dirty=changed;if(changed)this.motionRevision++;
 }
 visibleFor(items){this.visible=(this.enabled||this.browIndexCount>0)&&items.some(o=>o===this.h.tissue.skin||o===this.h.tissue.clay);return this.visible;}
 report(){return {schema:'jarvis/procedural_hair@7',representation:'independent-fixed-length-shafts',style:this.scalp.bodySex==='female'?'side-swept-pixie':'short-side-part',follicles:this.follicleField.report(),renderedShafts:this.selectedFollicles.length,curveAudit:this.curveAudit,collision:this.scalp.collider.report(),eyebrowShafts:this.eyebrows.shafts,triangles:this.geometry.near.length/3,motionModel:'clearance-bounded first-joint rotation',springCoordinates:HAIR_SPEC.motionGroups*3,dynamicGeometryUploadBytes:0,motionTextureUploadBytes:HAIR_SPEC.motionGroups*16,rootCoverageShell:false,radialProjection:false,windMps:this.windEnabled?this.windSpeed:0,previewRunning:!!this.demo,fullSelfCollision:false,calibrated:false,performanceMeasured:false,visualAcceptance:false};}
}
