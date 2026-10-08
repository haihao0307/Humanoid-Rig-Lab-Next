/* Yarn Atelier R1. Independently authored dense-yarn surface extension.
   Inherits the exact metric weave compiler. No Fibric/LYNX runtime is embedded.
   Coordinates stay meter-based in the kernel and are explicitly converted to
   millimeters for numerically stable rendering. Contact is a sampled vertical
   geometric constraint, NOT a textile constitutive or dynamic simulation. */
'use strict';
(async function(){
const {THREE:T,OrbitControls,WebGLPathTracer,PhysicalCamera,RectAreaLightUniformsLib}=LabLib;
const $=id=>document.getElementById(id), wait=ms=>new Promise(r=>setTimeout(r,ms));
const C={version:'YARN_ATELIER_R1', n:36, spc:8, cellX:.42,cellY:.40, density:.94,flatten:.70, fibers:true,curved:true,light:'studio',view:'hero',quality:1,exposure:1,warp:'#b7a888',weft:'#9b8a6b',dof:false};
const STATUS=window.__YARN_ATELIER__={version:C.version,ready:false,errors:[],sourceKernelCommit:'6d7f47f433662796d299ae66ce93d9410a8fb8e5',officialFibricReproduction:false,physicsSimulation:false,visualAcceptance:false};
function fail(e){console.error(e);STATUS.errors.push(String(e.stack||e));$('err').style.display='block';$('err').textContent='运行失败，未用图片替代三维画面。\n'+String(e.stack||e);$('loading').classList.add('hidden');$('status').textContent='运行失败';}
window.addEventListener('error',e=>{if(e.error)fail(e.error)});
const PI=Math.PI,TAU=2*PI, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function hash(i){let x=(i|0)^0x45d9f3b;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;}
let seed=19793;function rnd(){seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296;}
let renderer,scene,camera,controls,pt=null,model=null,lights=[],bulk=null,micro=null,fuzz=null,ground,env,geoData,trace=false,busy=false,dirty=true,ptDirty=true,lightAngle=0,lastT=0,lightBucket=0;
const v3=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const norm=a=>{let n=Math.hypot(...a)||1;return a.map(x=>x/n)}, cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function interpolate(a,s){const i=Math.min(a.length-2,Math.max(0,Math.floor(s))),t=s-i;return a[i]*(1-t)+a[i+1]*t;}
function expandedDraft(){const f=WeaveKernel.makeHerringbone12x12Fixture(),cells=new Uint8Array(C.n*C.n);for(let y=0;y<C.n;y++)for(let x=0;x<C.n;x++)cells[y*C.n+x]=f.cells[(y%12)*12+x%12];return {width:C.n,height:C.n,cells,sourceId:f.sourceId+'-repeat'+(C.n/12),authority:f.authority};}
function makeContactCurves(){
 const draft=expandedDraft(),b0=.070-C.flatten*.025;
 const kernel=WeaveKernel.compileWeaveDraft(draft,{cellWidthM:C.cellX/1000,cellHeightM:C.cellY/1000,warpRadiusM:b0/1000,weftRadiusM:b0/1000,crossingClearanceM:.009/1000,samplesPerCell:C.spc});
 const curves=kernel.curves.map((q,k)=>({id:q.id,family:q.family,index:q.index,z:Float64Array.from({length:q.pointCount},(_,i)=>q.points[i*3+2]*1000),a:(q.family==='warp'?C.cellX:C.cellY)*C.density*.5*(.989+.019*hash(k+17)),b:b0*(.97+.055*hash(k+193)),phase:hash(k+710)*TAU}));
 const warp=curves.slice(0,C.n),weft=curves.slice(C.n),gap=.007,div=16;
 let checks=0,initial=0,final=0;
 // Quarter-cell-independent contact constraints. Projection distributes each
 // correction over both neighboring centerline samples using linear weights.
 function sweep(project){let worst=0,count=0;
  for(let row=0;row<C.n;row++)for(let col=0;col<C.n;col++){
   const w=warp[col],f=weft[row],sign=draft.cells[row*C.n+col]?1:-1;
   for(let j=-7;j<=7;j++){
    const dy=j/div*C.cellY;if(Math.abs(dy)>=f.a)continue;
    const sy=(row+.5)*C.spc+j/div*C.spc,iw=Math.floor(sy),tw=sy-iw,uw=1-tw;
    const fcap=f.b*Math.sqrt(Math.max(0,1-dy*dy/(f.a*f.a)));
    for(let i=-7;i<=7;i++){
     const dx=i/div*C.cellX;if(Math.abs(dx)>=w.a)continue;
     const sx=(col+.5)*C.spc+i/div*C.spc,jf=Math.floor(sx),tf=sx-jf,uf=1-tf;
     const need=w.b*Math.sqrt(Math.max(0,1-dx*dx/(w.a*w.a)))+fcap+gap;
     const actual=sign*((w.z[iw]*uw+w.z[iw+1]*tw)-(f.z[jf]*uf+f.z[jf+1]*tf)),def=need-actual;
     worst=Math.max(worst,def);count++;
     if(project&&def>0){const d=def/(uw*uw+tw*tw+uf*uf+tf*tf);w.z[iw]+=sign*d*uw;w.z[iw+1]+=sign*d*tw;f.z[jf]-=sign*d*uf;f.z[jf+1]-=sign*d*tf;}
    }
   }
  }
  checks=count;return worst;
 }
 initial=sweep(false);
 for(let t=0;t<12;t++){
  sweep(true);
  if(t<8)for(const c of curves){const old=c.z.slice();for(let s=1;s<c.z.length-1;s++)c.z[s]=old[s]*.85+(old[s-1]+old[s+1])*.075;}
  for(const c of curves){const end=c.z.length-1;const z=(c.z[0]+c.z[end])*.5;c.z[0]=c.z[end]=z;}
 }
 final=sweep(false);
 if(!Number.isFinite(final)||final>.0006)throw Error('接触投影未收敛，剩余误差 '+final+' mm');
 // Independently supersampled overhead projected bulk-envelope open fraction.
 let open=0,total=0;const K=384,W=C.n*C.cellX,H=C.n*C.cellY;
 for(let i=0;i<K*K;i++){let px=hash(17+i*2)*W,py=hash(18+i*2)*H,c=Math.floor(px/C.cellX),r=Math.floor(py/C.cellY);if(Math.abs(px-(c+.5)*C.cellX)>warp[c].a&&Math.abs(py-(r+.5)*C.cellY)>weft[r].a)open++;total++;}
 return {kernel,curves,draft,W,H,contact:{method:'sampled_vertical_elliptic_envelope_projection',checks,maxInitialPenetrationMm:initial,maxResidualMm:final,targetGapMm:gap,scope:'bulk_envelopes_only_flat_material_coordinates',continuousCollisionGuarantee:false},openFraction:open/total,exactFlatOpenFraction:(1-warp.reduce((n,c)=>n+2*c.a,0)/W)*(1-weft.reduce((n,c)=>n+2*c.a,0)/H)};
}
function makeSurface(W,H){
 const N=2048,xp=new Float64Array(N+1),zp=new Float64Array(N+1),a=new Float64Array(N+1);
 for(let i=0;i<=N;i++){let u=i/N;a[i]=C.curved?(.66*Math.sin(u*TAU-.7)+.19*Math.sin(u*TAU*2+.4)) :0;if(i){let m=(a[i]+a[i-1])*.5;xp[i]=xp[i-1]+W/N*Math.cos(m);zp[i]=zp[i-1]+W/N*Math.sin(m);}}
 const xmid=xp[N]/2,zmid=(Math.min(...zp)+Math.max(...zp))/2;
 return (x,y,z)=>{let u=clamp(x/W*N,0,N),sx=interpolate(xp,u),sz=interpolate(zp,u),ang=interpolate(a,u),ca=Math.cos(ang),sa=Math.sin(ang),bend=C.curved?.27*Math.sin(y/H*PI+.25):0,dy=C.curved?.27*PI/H*Math.cos(y/H*PI+.25):0;let no=norm([-sa,-dy*ca,ca]);return [sx-xmid+z*no[0],y-H/2+z*no[1],sz-zmid+bend+z*no[2]];};
}
class Builder{
 constructor(vertices,indices){this.p=new Float32Array(vertices*3);this.c=new Float32Array(vertices*4);this.u=new Float32Array(vertices*2);this.ix=new Uint32Array(indices);this.v=0;this.i=0;}
 vertex(p,c,u=0,v=0){const k=this.v++;this.p.set(p,k*3);this.c[k*4]=c[0];this.c[k*4+1]=c[1];this.c[k*4+2]=c[2];this.c[k*4+3]=1;this.u[k*2]=u;this.u[k*2+1]=v;return k;}
 tri(a,b,c){this.ix[this.i++]=a;this.ix[this.i++]=b;this.ix[this.i++]=c;}
 join(start,prev,ring){for(let j=0;j<ring-1;j++){this.tri(prev+j,start+j,prev+j+1);this.tri(start+j,start+j+1,prev+j+1);}}
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(this.p.subarray(0,this.v*3),3));g.setAttribute('color',new T.BufferAttribute(this.c.subarray(0,this.v*4),4));g.setAttribute('uv',new T.BufferAttribute(this.u.subarray(0,this.v*2),2));g.setIndex(new T.BufferAttribute(this.ix.subarray(0,this.i),1));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
}
function curveLocal(c,s,theta,d=0){
 const along=s/C.spc*(c.family==='warp'?C.cellY:C.cellX),height=interpolate(c.z,clamp(s,0,c.z.length-1));
 const cs=Math.cos(theta),sn=Math.sin(theta),a=c.a,b=c.b;
 let nr=norm([cs/a,sn/b]),trans=a*cs+nr[0]*d,z=height+b*sn+nr[1]*d;
 return c.family==='warp'?[(c.index+.5)*C.cellX+trans,along,z]:[along,(c.index+.5)*C.cellY+trans,z];
}
function tint(c,s,k=1){let base=c.family==='warp'?[1,.996,.977]:[1,.99,.97];let val=(.9+.18*hash(c.index+(c.family==='warp'?33:788))+.045*Math.sin(s*.07+c.phase)+.025*Math.sin(s*.31+c.phase*3))*k;return base.map(x=>x*val);}
function flipWinding(g){const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}g.computeVertexNormals();return g;}
function generateGeometry(data){
 const {curves,W,H}=data,surface=makeSurface(W,H),npts=curves[0].z.length,rad=12,R=rad+1;
 const builders={warp:new Builder(C.n*npts*R,C.n*(npts-1)*rad*6),weft:new Builder(C.n*npts*R,C.n*(npts-1)*rad*6)};
 for(const c of curves){const b=builders[c.family];for(let s=0;s<npts;s++){let start=b.v,col=tint(c,s);for(let j=0;j<=rad;j++){let theta=-PI/2+j/rad*TAU,local=curveLocal(c,s,theta,-.003);b.vertex(surface(...local),col,j/rad,s/C.spc*(c.family==='warp'?C.cellY:C.cellX)/2.2);}if(s)b.join(start,start-R,R);}}
 const fiberCount=32,step=1,fp=Math.ceil((npts-1)/step)+1,frad=3,FR=frad+1;
 const fbuilders={warp:new Builder(C.n*fiberCount*fp*FR,C.n*fiberCount*(fp-1)*frad*6),weft:new Builder(C.n*fiberCount*fp*FR,C.n*fiberCount*(fp-1)*frad*6)};
 for(const c of curves)for(let f=0;f<fiberCount;f++){
  const bu=fbuilders[c.family],phase=c.phase+f/fiberCount*TAU,variance=.72+.40*hash(f+c.index*11);
  let prev=-1;
  for(let s=0;s<npts;s+=step){let s0=clamp(s,0,npts-1),along=s0/C.spc*(c.family==='warp'?C.cellY:C.cellX),th=phase+TAU*along/2.3+.025*Math.sin(along*7+phase),loc=curveLocal(c,s0,th,.0014),p=surface(...loc);
   let ds=.12,loc2=curveLocal(c,clamp(s0+ds,0,npts-1),th+TAU*ds/C.spc*(c.family==='warp'?C.cellY:C.cellX)/2.3,.0014);
   if(s0+ds>=npts-1)loc2=curveLocal(c,s0-ds,th-TAU*ds/C.spc*(c.family==='warp'?C.cellY:C.cellX)/2.3,.0014);
   let p2=surface(...loc2),t=norm(p2.map((a,i)=>(a-p[i])*(s0+ds>=npts-1?-1:1))),out=surface(...curveLocal(c,s0,th,.006)),normal=norm(out.map((a,i)=>a-p[i])),bi=norm(cross(t,normal));normal=norm(cross(bi,t));
   const start=bu.v,col=tint(c,s,variance),r=.0042;
   for(let j=0;j<=frad;j++){let a=j/frad*TAU,q=p.map((v,i)=>v+r*(Math.cos(a)*normal[i]+Math.sin(a)*bi[i]));bu.vertex(q,col,j/frad,along/2.2);}if(prev>=0)bu.join(start,prev,FR);prev=start;
  }
 }
 seed=765821;const fuzzN=3200,FSTEP=9,FU=4,fb=new Builder(fuzzN*FSTEP*FU,fuzzN*(FSTEP-1)*3*6);
 for(let k=0;k<fuzzN;k++){
  const c=curves[Math.floor(rnd()*curves.length)],s=4+rnd()*(npts-9),theta=rnd()*TAU,loop=rnd()<.72,span=.11+rnd()*.45,len=.05+rnd()*.18,dir=rnd()<.5?1:-1,bend=(rnd()-.5)*.06,centers=[];
  for(let j=0;j<FSTEP;j++){const t=j/(FSTEP-1),ss=clamp(s+dir*t*span/(c.family==='warp'?C.cellY:C.cellX)*C.spc,0,npts-1),th=theta+.10*t,d=(loop?Math.sin(t*PI):t*t)*len,local=curveLocal(c,ss,th,.004+d);local[c.family==='warp'?0:1]+=Math.sin(t*PI)*bend;centers.push(surface(...local));}
  let prev=-1;
  for(let j=0;j<FSTEP;j++){const t=j/(FSTEP-1),p=centers[j],p0=centers[Math.max(0,j-1)],p1=centers[Math.min(FSTEP-1,j+1)],tangent=norm(p1.map((v,i)=>v-p0[i])),ref=Math.abs(tangent[2])<.9?[0,0,1]:[0,1,0],n=norm(cross(tangent,ref)),b=norm(cross(tangent,n)),r=.0026*(loop?(.8+.2*Math.sin(t*PI)):(1-.92*t)),start=fb.v;
   for(let q=0;q<FU;q++){const angle=q/3*TAU;fb.vertex(p.map((v,i)=>v+r*(Math.cos(angle)*n[i]+Math.sin(angle)*b[i])),tint(c,s,.94),q/3,t);}
   if(prev>=0)fb.join(start,prev,FU);prev=start;
  }
 }

 return {bulk:{warp:builders.warp.geometry(),weft:flipWinding(builders.weft.geometry())},fibers:{warp:flipWinding(fbuilders.warp.geometry()),weft:flipWinding(fbuilders.weft.geometry())},fuzz:flipWinding(fb.geometry()),surface,explicitFilamentCount:curves.length*fiberCount,fuzzCount:fuzzN};
}
function fiberNormals(){const w=512,h=256,a=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let u=x/w,v=y/h,ph=TAU*(u*47-v*4),v1=.55*Math.sin(ph)+.25*Math.sin(ph*2+.9)+.16*Math.sin(ph*3-.8),nx=v1*.34,ny=-v1*.045,nz=1;let n=Math.hypot(nx,ny,nz),i=(y*w+x)*4;a[i]=(nx/n*.5+.5)*255;a[i+1]=(ny/n*.5+.5)*255;a[i+2]=(nz/n*.5+.5)*255;a[i+3]=255;}let t=new T.DataTexture(a,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
let normalTex;
function material(color,detail=false){return new T.MeshPhysicalMaterial({color,vertexColors:true,roughness:detail?.58:.79,metalness:0,sheen:.8,sheenColor:new T.Color('#d6c7ac'),sheenRoughness:.75,normalMap:detail?null:normalTex,normalScale:new T.Vector2(.82,.36),side:T.DoubleSide});}
function createModel(data){const generated=generateGeometry(data),g=new T.Group();g.name='Dense_Herringbone';let bulkG=new T.Group(),fiberG=new T.Group();g.add(bulkG,fiberG);for(let f of ['warp','weft']){let m=material(f==='warp'?C.warp:C.weft),d=material(f==='warp'?C.warp:C.weft,true);const b=new T.Mesh(generated.bulk[f],m),fi=new T.Mesh(generated.fibers[f],d);b.name='envelope_'+f;fi.name='filaments_'+f;b.castShadow=b.receiveShadow=true;fi.castShadow=false;fi.receiveShadow=true;bulkG.add(b);fiberG.add(fi);}let fm=material(C.warp,true),f=new T.Mesh(generated.fuzz,fm);f.name='fuzz';f.castShadow=false;f.receiveShadow=true;fiberG.add(f);fiberG.visible=C.fibers;
 const box=new T.Box3().setFromObject(g),tri=Object.values(generated.bulk).reduce((n,g)=>n+g.index.count/3,0)+Object.values(generated.fibers).reduce((n,g)=>n+g.index.count/3,0)+generated.fuzz.index.count/3;
 Object.assign(STATUS,{yarns:data.kernel.curveCount,triangles:tri,filaments:generated.explicitFilamentCount,fuzz:generated.fuzzCount,physicalSizeMm:[data.W,data.H],contact:data.contact,openFraction:data.openFraction,exactFlatOpenFraction:data.exactFlatOpenFraction,generatedGeometry:true,usesOriginalCachedGeometry:false});
 $('yarnStat').textContent=C.n+' + '+C.n;$('triStat').textContent=(tri/10000).toFixed(1)+' 万';$('openStat').textContent=(data.openFraction*100).toFixed(2)+'%';$('contactStat').textContent=(data.contact.maxResidualMm*1000).toFixed(2)+' μm 残差';
 return {g,bulkG,fiberG,minZ:box.min.z,box};}
function clearModel(){if(!model)return;scene.remove(model.g);model.g.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}
function environment(){const w=256,h=128,a=new Float32Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h;let dome=.12+.16*Math.max(0,Math.cos(v*PI)),box1=Math.exp(-Math.pow((u-.22)/.13,8)-Math.pow((v-.27)/.12,8))*.55,box2=Math.exp(-Math.pow((u-.78)/.08,8)-Math.pow((v-.40)/.17,8))*.24;let i=(y*w+x)*4;a[i]=dome+box1+box2*.9;a[i+1]=dome*.99+box1*.99+box2*.96;a[i+2]=dome*.96+box1*.94+box2;a[i+3]=1;}const t=new T.DataTexture(a,w,h,T.RGBAFormat,T.FloatType);t.mapping=T.EquirectangularReflectionMapping;t.needsUpdate=true;return t;}
function lighting(which){C.light=which;for(let l of lights){scene.remove(l);if(l.target)scene.remove(l.target);if(l.dispose)l.dispose();}lights=[];const group=new T.Group();
 function spot(pos,intensity,color,angle=.55){const l=new T.SpotLight(color,intensity,0,angle,.6,2);l.position.set(...pos);l.target.position.set(0,0,0);l.castShadow=true;l.shadow.mapSize.set(2048,2048);l.shadow.camera.near=.5;l.shadow.camera.far=160;l.shadow.bias=-.000013;l.shadow.normalBias=.006;scene.add(l,l.target);lights.push(l);return l;}
 if(which==='studio'){spot([-22,-15,35],3500,'#fff5e5',.70);spot([25,10,23],1000,'#e2eaff',.75);}else if(which==='grazing'){spot([-28,-5,7],2100,'#fff2d7',.62);spot([10,23,27],500,'#dae6ff',.75);}else{spot([-5,22,-15],2300,'#fff4dc',.70);spot([7,-24,24],430,'#d8e3ff',.75);}
 if(ground)ground.visible=which!=='back';scene.environmentIntensity=which==='back'?.20:.40;scene.background=new T.Color(which==='back'?'#252a25':'#272d26');ptDirty=true;dirty=true;if(trace)refreshTracer();document.querySelectorAll('[data-light]').forEach(b=>b.classList.toggle('active',b.dataset.light===which));}
function setView(name){
 C.view=name;const W=geoData?geoData.W:20;
 let target=v3(0,0,.2),pos=name==='macro'?v3(1.5,-4.8,6.0):name==='edge'?v3(W*.81,-W*.63,W*.22):v3(W*.66,-W*.87,W*.87);
 camera.fov=name==='macro'?40:38;
 if(name==='hero'&&model){
  target=model.box.getCenter(v3());const outward=v3(.66,-.87,.87).normalize(),right=v3().crossVectors(camera.up,outward).normalize(),up=v3().crossVectors(outward,right).normalize();
  const tv=Math.tan(camera.fov*PI/360),th=tv*camera.aspect;let dist=0;
  for(const x of [model.box.min.x,model.box.max.x])for(const y of [model.box.min.y,model.box.max.y])for(const z of [model.box.min.z,model.box.max.z]){const q=v3(x,y,z).sub(target),depth=q.dot(outward);dist=Math.max(dist,depth+Math.abs(q.dot(right))/th,depth+Math.abs(q.dot(up))/tv);}
  pos=target.clone().addScaledVector(outward,dist*1.16);
 }
 controls.target.copy(target);camera.position.copy(pos);camera.lookAt(target);camera.near=.01;camera.far=300;camera.focusDistance=camera.position.distanceTo(target);camera.updateProjectionMatrix();controls.update();dirty=true;
 if(pt){pt.pausePathTracing=false;pt.updateCamera();pt.reset();}
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
}
function saveFile(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}
let pendingRebuild=false;async function rebuild(){if(busy){pendingRebuild=true;return;}busy=true;const wasTrace=trace;trace=false;$('loading').classList.remove('hidden');$('loadText').textContent='计算椭圆纱线接触与表面纤维…';await wait(40);try{geoData=makeContactCurves();clearModel();model=createModel(geoData);scene.add(model.g);ground.position.z=model.minZ-.30;dirty=true;ptDirty=true;if(wasTrace){trace=true;await refreshTracer();}STATUS.ready=true;STATUS.parameters={...C};$('status').textContent='三维就绪';}finally{busy=false;$('loading').classList.add('hidden');if(pendingRebuild){pendingRebuild=false;await rebuild();}}}
async function refreshTracer(){if(!pt) return;scene.traverseVisible(o=>{if(o.isMesh){const c=o.geometry.getAttribute("color");if(c&&(c.itemSize!==4||c.count!==o.geometry.getAttribute("position").count))throw Error("Invalid color attribute: "+o.name);}});pt.setScene(scene,camera);pt.updateLights();pt.updateEnvironment();pt.updateMaterials();ptDirty=false;pt.pausePathTracing=false;pt.reset();}
async function toggleTrace(){if(busy)return;trace=!trace;$('trace').textContent=trace?'返回交互预览':'静止精看 · 路径追踪';$('trace').classList.toggle('active',trace);$('lightRotate').checked=false;
 if(trace){$('status').textContent='建立光线加速结构…';$('modeInfo').textContent='逐步采样中。拖动镜头可重新构图，停下后继续收敛。';await wait(50);if(!pt){pt=new WebGLPathTracer(renderer);if(!pt._generator?.bvhOptions)throw Error("Pinned scene generator contract changed");pt._generator.bvhOptions={strategy:0,maxLeafTris:8};pt.bounces=5;pt.transmissiveBounces=4;pt.filterGlossyFactor=.7;pt.tiles.set(3,3);pt.renderDelay=180;pt.minSamples=2;pt.fadeDuration=650;pt.renderScale=C.quality;pt.dynamicLowRes=true;pt.lowResScale=.15;pt.textureSize.set(512,512);}if(ptDirty)await refreshTracer();else{pt.pausePathTracing=false;pt.reset();}}else{$('modeInfo').textContent='交互模式即时响应。精看模式会逐步计算真实阴影与多次反射。';dirty=true;$('status').textContent='交互预览';}STATUS.trace=trace;}
try{
 const vp=$('viewport');renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(vp.clientWidth,vp.clientHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=C.exposure;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;vp.prepend(renderer.domElement);
 scene=new T.Scene();camera=new PhysicalCamera(38,vp.clientWidth/vp.clientHeight,.01,300);camera.up.set(0,0,1);camera.fStop=10;camera.bokehSize=0;controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=2.4;controls.maxDistance=130;controls.zoomSpeed=.65;controls.screenSpacePanning=true;controls.addEventListener('change',()=>{dirty=true;if(pt){pt.pausePathTracing=false;pt.updateCamera();pt.reset();}});
 normalTex=fiberNormals();env=environment();scene.environment=env;const mat=new T.MeshStandardMaterial({color:'#30352d',roughness:.94});ground=new T.Mesh(new T.PlaneGeometry(300,300),mat);ground.receiveShadow=true;ground.name='StudioGround';scene.add(ground);lighting('studio');
 const f=WeaveKernel.makeHerringbone12x12Fixture();for(const v of f.cells){let e=document.createElement('i');e.className='cell'+(v?'':' dark');$('draft').append(e);}
 await rebuild();setView('hero');
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.querySelectorAll('[data-light]').forEach(b=>b.onclick=()=>lighting(b.dataset.light));
 $('trace').onclick=()=>toggleTrace().catch(fail);$('mobilePanel').onclick=()=>document.body.classList.toggle('panel-open');$('reset').onclick=()=>setView('hero');
 $('exposure').oninput=e=>{C.exposure=+e.target.value;renderer.toneMappingExposure=C.exposure;$('exposureOut').textContent=C.exposure.toFixed(2);dirty=true;};
 for(const [id,key] of [['density','density'],['flatten','flatten']]){$(id).oninput=e=>{$(id+'Out').textContent=Math.round(+e.target.value*100)+'%';};$(id).onchange=e=>{C[key]=+e.target.value;rebuild().catch(fail);};}
 for(const key of ['warp','weft']){$(key+'Color').oninput=e=>{C[key]=e.target.value;model.g.traverse(o=>{if(o.isMesh&&(o.name.endsWith(key)||key==='warp'&&o.name==='fuzz'))o.material.color.set(C[key]);});if(pt){pt.pausePathTracing=false;pt.updateMaterials();pt.reset();}dirty=true;};}
 $('fibers').onchange=e=>{C.fibers=e.target.checked;model.fiberG.visible=C.fibers;dirty=true;ptDirty=true;if(trace)refreshTracer().catch(fail);};$('curved').onchange=e=>{C.curved=e.target.checked;rebuild().catch(fail);};
 $('dof').onchange=e=>{C.dof=e.target.checked;camera.bokehSize=C.dof?90:0;camera.focusDistance=camera.position.distanceTo(controls.target);if(pt){pt.pausePathTracing=false;pt.updateCamera();pt.reset();}dirty=true;};
 document.querySelectorAll('[data-quality]').forEach(b=>b.onclick=()=>{C.quality=+b.dataset.quality;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)*C.quality);document.querySelectorAll('[data-quality]').forEach(k=>k.classList.toggle('active',k===b));if(pt){pt.renderScale=C.quality;pt.pausePathTracing=false;pt.reset();}dirty=true;});
 $('save').onclick=()=>saveFile('Yarn_Atelier_R1_recipe.json',JSON.stringify({schema:'kaopu/dense_yarn_look@1',version:C.version,parameters:C,geometry:STATUS,source:'independent_herringbone_fixture_not_official_fibric'},null,2),'application/json');
 $('capture').onclick=()=>{const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='Yarn_Atelier_R1_'+C.view+'.png';a.click();};
 $('lightRotate').onchange=e=>{if(e.target.checked&&trace)toggleTrace().catch(fail);dirty=true;};
 new ResizeObserver(()=>{let w=vp.clientWidth,h=vp.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(C.view==='hero')setView('hero');if(pt){pt.pausePathTracing=false;pt.updateCamera();pt.reset();}dirty=true;}).observe(vp);
 window.__YARN_TEST__={setView,lighting,rebuild,toggleTrace,renderer,scene,camera,controls,config:C,finishFrame(){renderer.render(scene,camera);renderer.getContext().finish();dirty=false;},pauseTrace(){if(pt)pt.pausePathTracing=true;},isBusy(){return busy;}};
 function frame(t){requestAnimationFrame(frame);if(document.hidden||busy)return;
  if($('lightRotate').checked&&t-lightBucket>60){const dt=Math.min(.06,(t-lightBucket)/1000);lightBucket=t;lightAngle+=dt*.21;let l=lights[0],r=31;l.position.x=Math.cos(lightAngle)*r;l.position.y=Math.sin(lightAngle)*r;dirty=true;}
  if(trace&&pt){pt.renderSample();const s=pt.samples;$('sampleStat').textContent=s.toFixed(1);$('status').textContent=pt.isCompiling?'编译光线追踪…':s<2?'正在计算光线…':s<128?'光线追踪 · '+Math.floor(s)+' spp':'已累计 '+Math.floor(s)+' spp';$('progress').style.width=Math.min(100,s/128*100)+'%';STATUS.pathSamples=s;STATUS.renderMode='pathtraced';if(s>=256)pt.pausePathTracing=true;}
  else if(dirty){renderer.render(scene,camera);dirty=false;STATUS.renderMode='raster';$('sampleStat').textContent='交互预览';$('progress').style.width='0';}
  const dist=camera.position.distanceTo(controls.target),pixelPerMM=vp.clientHeight/(2*dist*Math.tan(camera.fov*PI/360)),bar=2*pixelPerMM;$('scaleBar').style.width=clamp(bar,20,160)+'px';$('scaleText').textContent=(clamp(bar,20,160)/pixelPerMM).toFixed(1)+' mm · 焦平面参考';
  STATUS.parameters={...C};STATUS.lastFrameTime=t;STATUS.renderer=renderer.getContext().getParameter(renderer.getContext().RENDERER);
 }
 requestAnimationFrame(frame);
}catch(e){fail(e);}
})();
