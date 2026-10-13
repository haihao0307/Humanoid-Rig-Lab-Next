/* R11 field-cap tailoring: new construction surfaces in metres.
   Visual rest shape with sewn constraints, NOT cloth dynamics.
   No reference mesh, image, recipe, or external asset input. */
(function(G){
'use strict';const H=G.HAT10,baseGenerate=H.generate;
const {shell,strand,normal,profile}=H.geometryTools,PI=Math.PI,TAU=2*PI;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const sm=x=>{x=clamp(x);return x*x*(3-2*x);};
const gauss=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
const add=(a,b,s=1)=>a.map((v,k)=>v+b[k]*s);
const norm=a=>{let d=Math.hypot(...a)||1;return a.map(v=>v/d);};
const delta=(a,b)=>a.map((v,k)=>v-b[k]);
const periodic=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function merge(name,items,role){
 let count=0,ic=0;for(const p of items){count+=p.position.length;ic+=p.index.length;}
 const position=new Float32Array(count),normal=new Float32Array(count),uv=new Float32Array(count/3*2),index=new Uint32Array(ic);
 let po=0,io=0;for(const p of items){position.set(p.position,po);normal.set(p.normal,po);uv.set(p.uv,po/3*2);for(let i=0;i<p.index.length;i++)index[io+i]=p.index[i]+po/3;po+=p.position.length;io+=p.index.length;}
 return{name,position,normal,uv,index,groups:[{start:0,count:ic,role}],thickness:.00032,closedVolume:true};
}
function field(input,lod=0){
 const t0=performance.now(),s=H.sanitize(input),c=H.categories.find(c=>c.id==='field'),hd=H.headShape(s);
 const thickness=c.thickness*s.thickness,ease=s.ease*.001,wearY=.033;
 const a=hd.a*H.headRadius(wearY)+ease+thickness,b=hd.b*H.headRadius(wearY)+ease+thickness;
 const requested=.079*s.height,ht=Math.max(requested,hd.top-wearY+thickness+ease+.009);
 const cols=lod?80:160,rows=lod?38:76,parts=[],thread=[],ridges=[];
 const ringTable=[[1,0],[1.005,.15],[1.018,.34],[1.00,.58],[.96,.80],[.925,.945],[.83,1],[.54,1.008],[0,1.002]];
 const upperV=.666,bandY=.019,dartAngles=[.86,2.38,3.87,5.42];
 function crown(u,v){
  const angle=TAU*u,sn=Math.sin(angle),cs=Math.cos(angle);let [r,h]=profile(ringTable,v);
  let y=wearY+ht*h-.0085*cs*r*sm(v/.55),radial=r*(1+(s.fullness-1)*Math.sin(PI*v)*.50);
  const wall=sm(v/.08)*(1-sm((v-.68)/.16));
  let fold=.0036*Math.sin(angle*5+.6)*gauss(v,.37,.22)+.0021*Math.sin(angle*9-v*5+.8)*gauss(v,.19,.13);
  fold+=.0028*Math.sin(angle*3+1.4)*gauss(v,.54,.18);
  for(const angle0 of dartAngles){
   const d=periodic(angle,angle0+.08*Math.sin(v*PI));
   fold-=.00065*gauss(d,0,.025)*wall;
   fold+=.00135*(gauss(d,.055,.032)+gauss(d,-.055,.032))*wall;
   fold+=.00040*Math.cos(v*PI*28+angle0)*gauss(d,0,.08)*wall;
  }
  fold*=wall;radial+=fold/Math.sqrt(a*b);
  radial+=(-.0007*gauss(v,upperV,.010)+.00035*gauss(v,upperV+.022,.016))/Math.sqrt(a*b);
  if(v>.74)y-=.0023*Math.sin(angle*2+.7)**2*Math.sin((v-.74)/.26*PI)*sm((v-.74)/.08)*r*r;
  let x=a*radial*sn,z=b*radial*cs+.0065*sm(v/.9);
  if(v<.9999&&y<hd.top){const safe=H.headRadius(y-thickness)+(ease+thickness)/Math.min(hd.a,hd.b),actual=Math.hypot(x/hd.a,z/hd.b);if(actual<safe){x*=safe/actual;z*=safe/actual;}}
  if(v>.99999){x=0;z=.0065;}return[x,y,z];
 }
 // Distinct closed sewn sidewall and top panel, with a small lapped allowance.
 const wallFn=(u,v)=>crown(u,v*upperV),topFn=(u,v)=>crown(u,upperV-.002+(1-upperV+.002)*v);
 const crownShell=shell('tailored-crown',wallFn,cols,rows,thickness,{cap:false,uvHeight:ht*.945,uvWidth:s.circumference*.01});
 const roof=shell('crown-top-panel',topFn,cols,lod?20:40,thickness,{cap:true,uvWidth:.20,uvHeight:.23});
 function remap(p,fn,nu,nv,mapper){
  const sideCount=(nu+1)*(nv+1);for(let side=0;side<2;side++)for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
   const k=side*sideCount+j*(nu+1)+i,v=mapper(fn(i/nu,j/nv),i/nu,j/nv);p.uv[k*2]=v[0];p.uv[k*2+1]=v[1];
  }return p;
 }
 remap(crownShell,wallFn,cols,rows,(p,u,v)=>[u*s.circumference*.01,p[1]]);
 remap(roof,topFn,cols,lod?20:40,p=>[p[0]+.30,p[2]+.30]);
 const pole=norm([0,1,.0085/b]),nr=lod?20:40;
 for(let side=0;side<2;side++)for(let i=0;i<=cols;i++){const k=(side*(nr+1)*(cols+1)+nr*(cols+1)+i)*3;for(let j=0;j<3;j++)roof.normal[k+j]=pole[j]*(side?-1:1);}
 parts.push(crownShell,roof);
 function band(u,v){const vv=.005+v*.17,p=crown(u,vv),n=normal(crown,u,vv);return add(p,n,.0008+.00025*Math.sin(v*PI));}
 parts.push(shell('lower-felled-band',band,cols,10,.0008,{role:'band',innerRole:'lining',edgeRole:'band',uvHeight:bandY,uvWidth:s.circumference*.01}));
 const inner=(u,v)=>[(a-thickness-.0007)*Math.sin(TAU*u),wearY-.001+v*.018,(b-thickness-.0007)*Math.cos(TAU*u)];
 parts.push(shell('cotton-sweatband',inner,cols,6,.0010,{role:'lining',innerRole:'lining',edgeRole:'lining',uvHeight:.018,uvWidth:s.circumference*.01}));
 const width=.061*s.brim;
 function bill(u,v){
  const th=(u-.5)*PI*.96,cs=Math.cos(th),sn=Math.sin(th),length=width*Math.max(.001,cs)**.70;
  const inset=Math.min(.0015,thickness*.60,ease*.45+.0002),r=-inset+v*(length+inset);
  const y=wearY+.0008-.012*v-.0125*sn*sn*v+.0023*Math.sin(v*PI);
  return[(a+r)*sn,y,(b+r)*cs];
 }
 const nc=lod?52:112,nv=lod?14:30,billThickness=Math.max(.0017,thickness*1.05);
 const visor=shell('laminated-curved-peak',bill,nc,nv,billThickness,{closed:false,sign:-1,role:'outer',innerRole:'underbrim',uvHeight:width,uvWidth:.30});
 remap(visor,bill,nc,nv,p=>[p[0]+.20,p[2]+.20]);parts.push(visor);
 // Arc-length stitch layout: thread enters cloth at both ends, not floating dashes.
 function sew(fn,outward,spacing=.0029,offset=.00008){
  const count=lod?128:384,pts=Array.from({length:count+1},(_,i)=>fn(i/count)),lengths=[0];
  for(let i=1;i<=count;i++)lengths.push(lengths[i-1]+Math.hypot(...delta(pts[i],pts[i-1])));
  const L=lengths[count],n=Math.max(2,Math.round(L/spacing)),pitch=L/n;
  function sample(d){d=clamp(d,0,L);let lo=0,hi=count;while(hi-lo>1){const m=(lo+hi)>>1;if(lengths[m]<d)lo=m;else hi=m;}const f=(d-lengths[lo])/(lengths[hi]-lengths[lo]||1);return{p:pts[lo].map((x,k)=>lerp(x,pts[hi][k],f)),t:(lo+f)/count};}
  for(let i=0;i<n;i++){
   const fn2=q=>{const v=sample((i+.02+.94*q)*pitch),normal=outward(v.t);return add(v.p,normal,offset+.00019*Math.sin(PI*q)-.00012*Math.cos(TAU*q));};
   thread.push(strand('lockstitch',fn2,lod?3:5,.00015,'thread',5));
  }
 }
 for(const v of [.82,.64])sew(t=>bill(t,v),t=>normal(bill,t,v,-1),.00285,.00008);
 const edge=t=>{const p=bill(t,1),n=normal(bill,t,1,-1);return add(p,n,-billThickness*.4);};
 parts.push(strand('turned-peak-edge',edge,lod?72:168,billThickness*.53,'binding',8));
 for(const v of [.04,.145])sew(t=>band(t,v/.17),t=>normal(band,t,v/.17),.0032,0);
 const topSeam=t=>add(crown(t,upperV),normal(crown,t,upperV),.00025);
 parts.push(strand('top-panel-felled-edge',topSeam,cols,.00052,'band',6));
 for(const v of [upperV-.021,upperV+.022])sew(t=>crown(t,v),t=>normal(crown,t,v),.00315,.00004);
 for(const angle0 of dartAngles){
  const seam=t=>{const v=.16+t*(upperV-.18),u=(angle0+.08*Math.sin(v*PI))/TAU;return{p:crown(u,v),n:normal(crown,u,v),u,v};};
  for(const side of [-1,1])sew(t=>{const k=seam(t),u=k.u+side*.0042;return crown(u,k.v);},t=>seam(t).n,.0032,.00007);
 }
 // Recessed cloth-bound inserts; not claimed to be through-holes or airflow simulation.
 for(const side of [-1,1])for(const turn of [-.12,.12]){
  const u=(side>0?.25:.75)+turn*.25,v=.43,origin=crown(u,v),n=normal(crown,u,v),tangent=norm(delta(crown(u+.001,v),crown(u-.001,v))),vertical=norm(delta(crown(u,v+.001),crown(u,v-.001)));
  const ring=t=>add(add(add(origin,tangent,.0018*Math.cos(t*TAU)),vertical,.0018*Math.sin(t*TAU)),n,.0005);
  ridges.push(strand('vent-binding',ring,lod?14:24,.00040,'band',6));
  const well=(uu,vv)=>add(add(add(origin,tangent,.00145*Math.cos(uu*TAU)*(1-vv)),vertical,.00145*Math.sin(uu*TAU)*(1-vv)),n,.00018);
  parts.push(shell('vent-recess',well,24,2,.00025,{cap:true,role:'recess',innerRole:'recess',edgeRole:'recess',sign:1}));
 }
 if(thread.length)parts.push(merge('metric-lockstitches',thread,'thread'));
 if(ridges.length)parts.push(merge('bound-vent-rings',ridges,'band'));
 const bartacks=[];
 for(const u of [.06,.94])for(let j=0;j<7;j++)bartacks.push(strand('bartack',t=>{let p=bill(u+(t-.5)*.014,.11+j*.007);return add(p,[0,1,0],.00035);},3,.00018,'thread',5));
 parts.push(merge('peak-root-bartacks',bartacks,'thread'));
 const fluff=[];
 function rng(i){let a=Math.imul(i+193,747796405);a=Math.imul(a^(a>>>11),1597334677);return ((a^(a>>>16))>>>0)/4294967296;}
 for(let i=0;i<(lod?60:360);i++){
  const u=rng(i*5),v=i%2?.62+rng(i*5+1)*.11:.05+rng(i*5+1)*.20,p=crown(u,v),n=normal(crown,u,v),tangent=norm(delta(crown(u+.001,v),crown(u-.001,v))),len=.00020+rng(i*5+2)*.00030;
  fluff.push(strand('cotton-fibre',t=>add(add(p,tangent,(t-.5)*len),n,.00004+Math.sin(PI*t)*len*.35),3,.000018,'fiber',3));
 }
 parts.push(merge('cotton-edge-fibres',fluff,'fiber'));
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],vertices=0,triangles=0,bytes=0;
 for(const p of parts){vertices+=p.position.length/3;triangles+=p.index.length/3;for(const k of ['position','normal','uv','index'])bytes+=p[k].byteLength;for(let i=0;i<p.position.length;i++){min[i%3]=Math.min(min[i%3],p.position[i]);max[i%3]=Math.max(max[i%3],p.position[i]);}}
 return{schema:H.schema,id:s.id,spec:s,head:{a:hd.a,b:hd.b,top:hd.top},pieces:parts,bounds:{min,max},stats:{vertices,triangles,bytes,requestedCrownHeight:requested,effectiveCrownHeight:ht,heightFitClamped:ht>requested+1e-8,generationMS:performance.now()-t0,fit:'rest-shape tailoring plus static envelope; no dynamics',wearPlaneMetres:wearY,stitchPitchMetres:.003,threadDiameterMetres:.0003,construction:'tailored side panels, crown panel, felled band, curved laminated peak, turned binding'},origin:'equations-and-new-category-spectrum'};
}
H.generate=(s,lod=0)=>s.id==='field'?field(s,lod):baseGenerate(s,lod);
})(globalThis);
