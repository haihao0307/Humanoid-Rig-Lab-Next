/* R2 extension: deterministic variable yarn cross-sections and spun-fiber paths.
   Source kernel, orbit UI and path tracer are inherited from R1 unchanged.
   It is an independent geometric model, not Fibric or a cloth dynamics solver. */
Object.assign(C,{version:'YARN_ATELIER_R2',n:36,cellX:.42,cellY:.40,density:.93,flatten:.48,disorder:.68,seed:7319,fuzzAmount:.6,roughness:.72,warp:'#bcb19a',weft:'#a99f8b',geometryDetail:1,view:'macro'});
STATUS.version=C.version;STATUS.parentVersion='YARN_ATELIER_R1';
function r2noise(t,p){return .53*Math.sin(TAU*t+p)+.29*Math.sin(TAU*2.31*t+p*1.71)+.18*Math.sin(TAU*5.17*t-p*.63);}
function r2section(c,s){const t=clamp(s*2,0,c.ax.length-1);return {a:interpolate(c.ax,t),b:interpolate(c.by,t),shift:interpolate(c.shift,t)};}
makeContactCurves=function(){
 const draft=expandedDraft(),b0=.128-C.flatten*.045;
 const kernel=WeaveKernel.compileWeaveDraft(draft,{cellWidthM:C.cellX/1000,cellHeightM:C.cellY/1000,warpRadiusM:b0/1000,weftRadiusM:b0/1000,crossingClearanceM:.004/1000,samplesPerCell:C.spc});
 const curves=kernel.curves.map((q,k)=>{
  const pitch=q.family==='warp'?C.cellX:C.cellY,phase=hash(k+710+C.seed)*TAU;
  const c={id:q.id,family:q.family,index:q.index,z:Float64Array.from({length:q.pointCount},(_,i)=>q.points[i*3+2]*1000),a:pitch*C.density*.5,b:b0,phase};
  const N=2*(q.pointCount-1),ax=new Float64Array(N+1),by=new Float64Array(N+1),shift=new Float64Array(N+1);
  for(let i=0;i<=N;i++){
   const u=i/N,wave=.55*Math.sin(TAU*u*9+phase)+.3*Math.sin(TAU*u*23-phase*.7)+.15*Math.sin(TAU*u*41+phase*2);
   shift[i]=C.disorder*pitch*.045*(.65*Math.sin(TAU*u*5+phase)+.35*Math.sin(TAU*u*13-phase));
   ax[i]=Math.min(pitch*.494-Math.abs(shift[i]),c.a*(1+C.disorder*(wave*.28+.09*(hash(k+C.seed)-.5))));
   // Approximate cross-section area preservation, not constitutive mechanics.
   by[i]=b0*c.a/ax[i]*(1+C.disorder*.07*Math.sin(TAU*u*7+phase));
  }
  Object.assign(c,{ax,by,shift});return c;
 });
 const warp=curves.slice(0,C.n),weft=curves.slice(C.n),gap=.004,div=16;
 let checks=0;
 function sweep(project){let worst=0;checks=0;
  for(let row=0;row<C.n;row++)for(let col=0;col<C.n;col++){
   const w=warp[col],f=weft[row],sign=draft.cells[row*C.n+col]?1:-1;
   for(let j=-8;j<=8;j++){
    const sy=(row+.5+j/div)*C.spc,iw=Math.min(w.z.length-2,Math.floor(sy)),tw=sy-iw,uw=1-tw,ki=Math.round(sy*2),a=w.ax[ki],b=w.by[ki],shift=w.shift[ki];
    for(let i=-8;i<=8;i++){
     const sx=(col+.5+i/div)*C.spc,jf=Math.min(f.z.length-2,Math.floor(sx)),tf=sx-jf,uf=1-tf,kj=Math.round(sx*2),dx=i/div*C.cellX-shift,dy=j/div*C.cellY-f.shift[kj];
     if(Math.abs(dx)>=a||Math.abs(dy)>=f.ax[kj])continue;
     const need=b*Math.sqrt(Math.max(0,1-dx*dx/(a*a)))+f.by[kj]*Math.sqrt(Math.max(0,1-dy*dy/(f.ax[kj]*f.ax[kj])))+gap;
     const def=need-sign*(w.z[iw]*uw+w.z[iw+1]*tw-f.z[jf]*uf-f.z[jf+1]*tf);
     worst=Math.max(worst,def);checks++;
     if(project&&def>0){const d=def/(uw*uw+tw*tw+uf*uf+tf*tf);w.z[iw]+=sign*d*uw;w.z[iw+1]+=sign*d*tw;f.z[jf]-=sign*d*uf;f.z[jf+1]-=sign*d*tf;}
    }
   }
  }
  return worst;
 }
 const initial=sweep(false);
 for(let t=0;t<18;t++){
  sweep(true);
  if(t<10)for(const c of curves){const old=c.z.slice();for(let s=1;s<c.z.length-1;s++)c.z[s]=old[s]*.9+(old[s-1]+old[s+1])*.05;}
  for(const c of curves){const end=c.z.length-1;c.z[0]=c.z[end]=(c.z[0]+c.z[end])*.5;}
 }
 const final=sweep(false);if(!Number.isFinite(final)||final>.001)throw Error('R2 contact residual exceeds 1 micrometer: '+final);
 let open=0,total=65536;const W=C.n*C.cellX,H=C.n*C.cellY;
 for(let i=0;i<total;i++){
  const px=hash(17+i*2)*W,py=hash(18+i*2)*H,c=Math.floor(px/C.cellX),r=Math.floor(py/C.cellY),ws=r2section(warp[c],py/C.cellY*C.spc),fs=r2section(weft[r],px/C.cellX*C.spc);
  if(Math.abs(px-(c+.5)*C.cellX-ws.shift)>ws.a&&Math.abs(py-(r+.5)*C.cellY-fs.shift)>fs.a)open++;
 }
 return {kernel,curves,draft,W,H,contact:{method:'variable_section_sampled_vertical_projection',checks,maxInitialPenetrationMm:initial,maxResidualMm:final,targetGapMm:gap,scope:'sampled_bulk_envelopes_in_flat_coordinates_only',continuousCollisionGuarantee:false,fiberCollisionGuaranteed:false},openFraction:open/total,exactFlatOpenFraction:null};
};
curveLocal=function(c,s,theta,d=0){
 s=clamp(s,0,c.z.length-1);const along=s/C.spc*(c.family==='warp'?C.cellY:C.cellX),height=interpolate(c.z,s),sh=r2section(c,s),cs=Math.cos(theta),sn=Math.sin(theta),nr=norm([cs/sh.a,sn/sh.b]);
 const trans=sh.shift+sh.a*cs+nr[0]*d,z=height+sh.b*sn+nr[1]*d;
 return c.family==='warp'?[(c.index+.5)*C.cellX+trans,along,z]:[along,(c.index+.5)*C.cellY+trans,z];
};
// Tube frames are based on the actual local fiber tangent, rather than joining
// disconnected short cylinders. Centers, colors and IDs are stable under rebuild.
function r2weld(g,ring){const n=g.getAttribute('normal');for(let i=0;i<n.count;i+=ring){let j=i+ring-1,x=n.getX(i)+n.getX(j),y=n.getY(i)+n.getY(j),z=n.getZ(i)+n.getZ(j),l=Math.hypot(x,y,z)||1;n.setXYZ(i,x/l,y/l,z/l);n.setXYZ(j,x/l,y/l,z/l);}n.needsUpdate=true;return g;}
function r2tube(builder,centers,radii,colors,uvLength){
 const ring=4;let prev=-1;
 for(let i=0;i<centers.length;i++){
  const p=centers[i],p0=centers[Math.max(0,i-1)],p1=centers[Math.min(centers.length-1,i+1)],t=norm(p1.map((v,j)=>v-p0[j]));
  const ref=Math.abs(t[2])<.9?[0,0,1]:[0,1,0],n=norm(cross(t,ref)),b=norm(cross(t,n)),start=builder.v;
  for(let q=0;q<ring;q++){let a=q/3*TAU;builder.vertex(p.map((v,j)=>v+radii[i]*(Math.cos(a)*n[j]+Math.sin(a)*b[j])),colors[i],q/3,i/(centers.length-1)*uvLength);}
  if(prev>=0)builder.join(start,prev,ring);prev=start;
 }
}
generateGeometry=function(data){
 const {curves,W,H}=data,surface=makeSurface(W,H),npts=curves[0].z.length,rad=16,R=rad+1;
 const builders={warp:new Builder(C.n*npts*R,C.n*(npts-1)*rad*6),weft:new Builder(C.n*npts*R,C.n*(npts-1)*rad*6)};
 for(const c of curves){const b=builders[c.family];for(let s=0;s<npts;s++){
  const start=b.v,col=tint(c,s);for(let j=0;j<=rad;j++){const th=-PI/2+j/rad*TAU;b.vertex(surface(...curveLocal(c,s,th,-.023)),col,j/rad,s/C.spc*(c.family==='warp'?C.cellY:C.cellX));}
  if(s)b.join(start,start-R,R);
 }}
 const isMacro=true,fiberCount=C.geometryDetail===2?88:C.geometryDetail===0?32:64,step=C.geometryDetail===0?4:2,fp=Math.ceil((npts-1)/step)+1,FR=4;
 const halfRegion=Math.max(W,H),visibleCurves=curves;
 const fbuilders={warp:new Builder(C.n*fiberCount*fp*FR,C.n*fiberCount*(fp-1)*18),weft:new Builder(C.n*fiberCount*fp*FR,C.n*fiberCount*(fp-1)*18)};
 for(const c of visibleCurves)for(let f=0;f<fiberCount;f++){
  const id=C.seed+c.index*811+f*73+(c.family==='warp'?0:98127),phase=c.phase+TAU*(f+.45*(hash(id)-.5))/fiberCount;
  const radius=(isMacro?.0055:.0045)+.0025*hash(id+91),pitch=1.85+.45*hash(C.seed+c.index*811+(c.family==='warp'?0:991)),shade=.78+.30*hash(id+717),centers=[],radii=[],cols=[];
  const endMm=c.family==='warp'?H:W,ptch=c.family==='warp'?C.cellY:C.cellX;const lo=isMacro?Math.max(0,Math.floor((endMm/2-halfRegion)/ptch*C.spc/step)*step):0,hi=isMacro?Math.min(npts-1,Math.ceil((endMm/2+halfRegion)/ptch*C.spc/step)*step):npts-1;
  for(let s=lo;s<=hi;s+=step){const along=s/C.spc*ptch;
   const ar=phase+TAU*along/pitch+C.disorder*.095*r2noise(along*.71,phase),sh=r2section(c,s);let th=ar;const ek=1.2*(sh.a-sh.b)/(sh.a+sh.b);for(let t=0;t<3;t++)th-=(th-ek*.5*Math.sin(2*th)-ar)/(1-ek*Math.cos(2*th));
   const migration=C.disorder*.007*r2noise(along*.49,phase*1.91);
   const local=curveLocal(c,s,th,-radius*.3+migration),p=surface(...local);
   centers.push(p);radii.push(radius*(1+C.disorder*.12*r2noise(along*1.4,phase)));cols.push(tint(c,s,shade));
  }
  r2tube(fbuilders[c.family],centers,radii,cols,(c.family==='warp'?H:W));
 }
 seed=C.seed;const fuzzN=Math.round(1200+4200*C.fuzzAmount),FSTEP=10,FU=4,fb=new Builder(fuzzN*FSTEP*FU,fuzzN*(FSTEP-1)*18);
 for(let k=0;k<fuzzN;k++){
  const c=curves[Math.floor(rnd()*curves.length)],s=3+rnd()*(npts-7),th=rnd()*TAU,loop=rnd()<.68,span=.1+Math.pow(rnd(),2)*.95,lift=.018+Math.pow(rnd(),2)*(.07+.1*C.fuzzAmount),dir=rnd()<.5?1:-1,curve=rnd()-.5,centers=[],radii=[],cols=[];
  for(let j=0;j<FSTEP;j++){const t=j/(FSTEP-1),ss=clamp(s+dir*t*span/(c.family==='warp'?C.cellY:C.cellX)*C.spc,0,npts-1),height=(loop?Math.sin(PI*t):t*t)*lift;
   const p=curveLocal(c,ss,th+curve*t*.9,.003+height);p[c.family==='warp'?0:1]+=.035*curve*Math.sin(t*PI);
   centers.push(surface(...p));radii.push(.0024*(loop?(.7+.3*Math.sin(PI*t)):Math.max(.04,1-t)));cols.push(tint(c,ss,.78+.35*hash(k+717)));
  }
  r2tube(fb,centers,radii,cols,span);
 }
 return {bulk:{warp:r2weld(builders.warp.geometry(),R),weft:r2weld(flipWinding(builders.weft.geometry()),R)},fibers:{warp:r2weld(flipWinding(fbuilders.warp.geometry()),FR),weft:r2weld(flipWinding(fbuilders.weft.geometry()),FR)},fuzz:r2weld(flipWinding(fb.geometry()),FU),surface,explicitFilamentCount:visibleCurves.length*fiberCount,fuzzCount:fuzzN};
};
tint=function(c,s,k=1){const along=s/C.spc*(c.family==='warp'?C.cellY:C.cellX),v=(.87+C.disorder*(.15*(hash(c.index+C.seed+(c.family==='warp'?0:333))-.5)+.085*r2noise(along*.67,c.phase)))*k;return [v,v*.994,v*.981];};
fiberNormals=function(){
 const w=512,h=512,a=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h,phase=TAU*(u*41-v*2),n=.38*Math.sin(phase+.4*Math.sin(v*TAU*3))+.19*Math.sin(phase*1.97+v*TAU*4);
  const nx=n,ny=-n*.06,nz=1,d=Math.hypot(nx,ny,nz),i=(y*w+x)*4;a[i]=(nx/d*.5+.5)*255;a[i+1]=(ny/d*.5+.5)*255;a[i+2]=(nz/d*.5+.5)*255;a[i+3]=255;
 }const t=new T.DataTexture(a,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
};
material=function(color,detail=false){return new T.MeshPhysicalMaterial({color,vertexColors:true,roughness:detail?Math.max(.4,C.roughness-.15):Math.min(.94,C.roughness+.08),metalness:0,ior:1.46,specularIntensity:.58,sheen:detail?.35:.6,sheenColor:new T.Color('#e1d9ca'),sheenRoughness:.8,normalMap:detail?null:normalTex,normalScale:new T.Vector2(.18,.09),side:T.DoubleSide});};
const r2oldCreate=createModel;
createModel=function(data){const m=r2oldCreate(data);m.g.traverse(o=>{if(o.isMesh&&o.name.startsWith('filaments')){o.castShadow=false;}});STATUS.geometryModel='variable_elliptic_envelopes_spun_fibers_radial_migration';STATUS.seed=C.seed;STATUS.fiberScattering='GGX_sheen_surface_approximation_not_Chiang';return m;};
const r2oldLighting=lighting;
lighting=function(which){r2oldLighting(which);scene.background=new T.Color(which==='back'?'#303331':'#343532');if(ground)ground.material.color.set('#3c3d38');scene.environmentIntensity=.65;for(let l of lights){l.shadow.normalBias=.002;l.shadow.mapSize.set(2048,2048);l.shadow.bias=-.000005;}
 if(which==='studio'){lights[0].intensity=2700;lights[1].intensity=2100;}else if(which==='grazing'){lights[0].intensity=1900;lights[1].intensity=1100;}else{lights[0].intensity=2500;lights[1].intensity=600;}if(pt&&trace){pt.updateLights();pt.reset();}dirty=true;};
const r2oldSetView=setView;
setView=async function(name){C.view=name;r2oldSetView(name);if(name==='macro'){
 const center=makeSurface(geoData.W,geoData.H)(geoData.W*.5,geoData.H*.5,0);controls.target.set(...center);camera.position.copy(controls.target).add(v3(.9,-3.2,5.8));camera.focusDistance=camera.position.distanceTo(controls.target);camera.lookAt(controls.target);controls.update();if(pt){pt.updateCamera();pt.reset();}dirty=true;
 }};
