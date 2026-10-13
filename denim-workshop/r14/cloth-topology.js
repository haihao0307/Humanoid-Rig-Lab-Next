/* R12 structural contract. SI solver, millimetre authoring domain.
 * Project implementation: polygon clipping tests, area quadrature and weighted
 * attachment. No external mesh/solver. The coarse grid is NOT a hidden solid:
 * hole nodes have no mass/area/collision; no sheet edge or bend crosses the cut.
 * Visible released yarns become explicit low-resolution chains, not cloth faces.
 */
(function initializeTopology(root){'use strict';
const NX=25,NY=19,W=100,H=72;
const finite=(v,lo,hi,key)=>{if(!Number.isFinite(v)||v<lo||v>hi)throw Error('Invalid '+key);return v;};
const unit=a=>{const q=1/Math.max(1e-12,Math.hypot(...a));return a.map(x=>x*q);};
function rawPoint(x,y,shape,height=72){let z=0;if(shape===1){const a=(x+9+.20*y)/11,b=(x-24-.08*y)/18;z=9*Math.exp(-a*a)+3*Math.exp(-b*b)+.014*y+.5*Math.sin(y*.065+x*.032);}
 if(shape===2){const yy=y+height/2;if(yy<10){const t=(10-yy)*.302,r=10/3.02;y=-height/2+10-r*Math.sin(t);z=r*(1-Math.cos(t));}z+=.8*Math.exp(-(((x+11)/22)**2));}
 if(shape===3)z=3*Math.sin(x*.073+.20)*(.55+.45*(.5-y/height))+1.1*Math.sin(x*.137+1.1)*(.5-y/height);
 return [x,y,z];}
function point(x,y,z=0,shape=1,structure=.7,height=72){
 const field=(a,b)=>[a+structure*(.27*Math.sin(b*.213+a*.047+1.3)+.11*Math.sin(a*.713+b*.377+.71)),b+structure*(.22*Math.sin(a*.197-b*.051+2.6)+.095*Math.sin(b*.679-a*.413+1.17))];
 const f=(a,b)=>{const m=field(a,b),p=rawPoint(m[0],m[1],shape,height);p[2]+=.13*Math.sin(m[0]*.293+m[1]*.187)*Math.sin(m[1]*.117+1.31)+.07*Math.sin(m[0]*.131-m[1]*.337+.79);return p;};
 const p=f(x,y);if(!z)return p.map(v=>v*.001);const e=.001,a=f(x+e,y),b=f(x-e,y),c=f(x,y+e),d=f(x,y-e),u=a.map((v,k)=>v-b[k]),v=c.map((v,k)=>v-d[k]);
 const n=unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);return p.map((v,k)=>(v+z*n[k])*.001);
}
function inside(poly,x,y){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function clearSegment(poly,a,b){if(!poly.length)return true;if(inside(poly,a[0],a[1])||inside(poly,b[0],b[1]))return false;
 const rx=b[0]-a[0],ry=b[1]-a[1];for(let i=0;i<poly.length;i++){const c=poly[i],d=poly[(i+1)%poly.length],sx=d[0]-c[0],sy=d[1]-c[1],det=rx*sy-ry*sx;if(Math.abs(det)<1e-10)continue;const dx=c[0]-a[0],dy=c[1]-a[1],t=(dx*sy-dy*sx)/det,u=(dx*ry-dy*rx)/det;if(t>1e-7&&t<1-1e-7&&u>=0&&u<=1)return false;}return true;}
function material(o={}){const thickness=finite(o.thickness??.70,.45,1.05,'thickness'),gsm=finite(o.gsm??450,100,900,'gsm'),warp=finite(o.warpStiffness??1,.2,3,'warp stiffness'),weft=finite(o.weftStiffness??1,.2,3,'weft stiffness'),bend=finite(o.bendStiffness??1,.2,3,'bend stiffness');
 const scale=thickness/.70,areal=(o.autoMass!==false?gsm*scale:gsm)/1000;
 return {thicknessMm:thickness,arealDensityKgM2:areal,automaticMass:o.autoMass!==false,nominalGsm:gsm,warpCompliance:1e-5/(scale*warp),weftCompliance:1.4e-5/(scale*weft),shearCompliance:.005/scale,bendCompliance:.4/(scale**3*bend),bundleDensityKgM3:areal/(thickness*.001),collisionRadiusM:thickness*.0005,warpStiffness:warp,weftStiffness:weft,bendStiffness:bend,calibrated:false,model:'directional distance + two-hop bending proxy; unmeasured engineering candidate'};
}
function input(N,g,natural,state){return {schema:'kaopu.cloth_structure@1',widthMm:g.p.width,heightMm:g.p.height,shape:state.shape,structure:state.structure,damage:state.damage,material:material(state),hole:state.damage>=2?N.contour(state.damage):[],released:natural.tubes.filter(c=>c.type!=='edge').map(c=>({index:c.physicalIndex,type:c.type,kind:c.kind,id:c.id,radius:c.radius,points:c.points})),weave:state.weave};}
function compile(cfg){if(!cfg||cfg.schema!=='kaopu.cloth_structure@1')throw Error('A versioned material/structure contract is required');
 const W=cfg.widthMm??100,H=cfg.heightMm??72;const poly=cfg.hole||[],mat=cfg.material,nGrid=NX*NY,uv=[],rest=[],active=[],area=[],mass=[],pin=[],links=[],attachments=[],rods=[];let attempts=0,rejected=0;
 if(!Array.isArray(poly)||poly.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid hole polygon');
 for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){const mx=(x/(NX-1)-.5)*W,my=(y/(NY-1)-.5)*H;uv.push([mx,my]);rest.push(...point(mx,my,0,cfg.shape,cfg.structure,H));const live=!inside(poly,mx,my);active.push(live?1:0);pin.push(live&&y===NY-1?1:0);area.push(0);mass.push(0);}
 function weights(x,y){const gx=Math.max(0,Math.min(NX-1,(x/W+.5)*(NX-1))),gy=Math.max(0,Math.min(NY-1,(y/H+.5)*(NY-1))),ix=Math.min(NX-2,Math.floor(gx)),iy=Math.min(NY-2,Math.floor(gy)),u=gx-ix,v=gy-iy,ids=[iy*NX+ix,iy*NX+ix+1,(iy+1)*NX+ix,(iy+1)*NX+ix+1],ws=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v];let sum=0;
 for(let k=0;k<4;k++){if(!active[ids[k]])ws[k]=0;sum+=ws[k];}
 if(sum<1e-12){let best=Infinity,id=-1;for(let i=0;i<nGrid;i++)if(active[i]){const d=(uv[i][0]-x)**2+(uv[i][1]-y)**2;if(d<best){best=d;id=i;}}return {ids:[id],weights:[1]};}
 return {ids:ids.filter((_,k)=>ws[k]>0),weights:ws.filter(w=>w>0).map(w=>w/sum)};
 }
 // Integrate only material outside the same visible hole. Subcell quadrature is
 // area bookkeeping, not an invisible collision surface or force connection.
 const q=6,dx=W/(NX-1),dy=H/(NY-1),da=dx*dy*1e-6/(q*q);let retainedArea=0;
 for(let j=0;j<NY-1;j++)for(let i=0;i<NX-1;i++)for(let b=0;b<q;b++)for(let a=0;a<q;a++){const x=-W/2+(i+(a+.5)/q)*dx,y=-H/2+(j+(b+.5)/q)*dy;if(inside(poly,x,y))continue;const s=weights(x,y);retainedArea+=da;for(let k=0;k<s.ids.length;k++)area[s.ids[k]]+=da*s.weights[k];}
 for(let i=0;i<nGrid;i++)mass[i]=area[i]*mat.arealDensityKgM2;
 const adjacency=Array.from({length:nGrid},()=>[]),stretchLookup=new Map();
 const add=(a,b,c,type,sheet=true)=>{attempts++;if(sheet&&(!active[a]||!active[b]||!clearSegment(poly,uv[a],uv[b]))){rejected++;return;}const A=a*3,B=b*3,L=Math.hypot(rest[A]-rest[B],rest[A+1]-rest[B+1],rest[A+2]-rest[B+2]);const index=links.length/5;links.push(a,b,L,c,type);if(sheet&&type===0)stretchLookup.set(a+":"+b,index);if(sheet&&type<2){adjacency[a].push([b,L]);adjacency[b].push([a,L]);}return index;};
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const id=j*NX+i;if(i+1<NX)add(id,id+1,mat.weftCompliance,0);if(j+1<NY)add(id,id+NX,mat.warpCompliance,0);if(i+1<NX&&j+1<NY){add(id,id+NX+1,mat.shearCompliance,1);add(id+1,id+NX,mat.shearCompliance,1);}if(i+2<NX)add(id,id+2,mat.bendCompliance,2);if(j+2<NY)add(id,id+2*NX,mat.bendCompliance,2);}
 const sheetLinks=links.length/5,sheetRuns=[];
 for(let axis=0;axis<2;axis++)for(let line=0;line<(axis?NX:NY);line++){let nodes=[],stretchLinks=[];const flush=()=>{if(stretchLinks.length)sheetRuns.push({nodes,stretchLinks});nodes=[];stretchLinks=[];};for(let k=0;k<(axis?NY:NX)-1;k++){const a=axis?k*NX+line:line*NX+k,b=axis?a+NX:a+1,index=stretchLookup.get(a+':'+b);if(index===undefined){flush();continue;}if(!nodes.length)nodes.push(a);nodes.push(b);stretchLinks.push(index);}flush();}

 // Geodesic tethers follow remaining sheet connectivity, never straight across a hole.
 const distances=new Float64Array(nGrid).fill(Infinity),anchor=new Int32Array(nGrid).fill(-1),visited=new Uint8Array(nGrid);
 for(let i=0;i<nGrid;i++)if(pin[i]){distances[i]=0;anchor[i]=i;}
 for(let step=0;step<nGrid;step++){let id=-1,d=Infinity;for(let i=0;i<nGrid;i++)if(!visited[i]&&distances[i]<d){d=distances[i];id=i;}if(id<0)break;visited[id]=1;for(const [k,l] of adjacency[id])if(d+l<distances[k]){distances[k]=d+l;anchor[k]=anchor[id];}}
 let yarnArea=0,yarnMass=0;for(const curve of cfg.released||[]){if(curve.index!==rods.length+1||!['bridge','tail'].includes(curve.type))throw Error('Nonsequential physical curve identity');let authoredLength=0;for(let j=1;j<curve.points.length;j++)authoredLength+=Math.hypot(...curve.points[j].map((v,k)=>v-curve.points[j-1][k]));const steps=curve.type==='bridge'?Math.min(8,Math.max(1,Math.ceil(authoredLength/8))):Math.min(4,Math.max(1,Math.ceil(authoredLength/3))),first=active.length,positions=[];
  for(let k=0;k<=steps;k++){const v=k/steps*(curve.points.length-1),lo=Math.min(curve.points.length-2,Math.floor(v)),u=v-lo,p=curve.points[lo].map((x,c)=>x+(curve.points[lo+1][c]-x)*u);positions.push(p);rest.push(...point(...p,cfg.shape,cfg.structure,H));active.push(1);pin.push(0);mass.push(0);area.push(0);}
  const stretchLinks=[];const radius=curve.radius*.001,linearMass=Math.PI*radius*radius*mat.bundleDensityKgM3;let arc=0;
  for(let k=0;k<steps;k++){const a=first+k,b=a+1,A=a*3,B=b*3,L=Math.hypot(rest[A]-rest[B],rest[A+1]-rest[B+1],rest[A+2]-rest[B+2]);arc+=L;const m=linearMass*L,ar=2*radius*L;mass[a]+=m*.5;mass[b]+=m*.5;area[a]+=ar*.5;area[b]+=ar*.5;yarnMass+=m;yarnArea+=ar;
   stretchLinks.push(add(a,b,Math.max(1e-5,1e-4*(L/.008)/Math.max(.05,(radius/.00008)**2)),3,false));if(k+2<=steps)add(a,a+2,2/Math.max(.1,(radius/.00008)**4),4,false);}
  for(const k of (curve.type==='bridge'?[0,steps]:[0])){const p=positions[k],w=weights(p[0],p[1]),node=first+k,offset=[0,0,0];for(let c=0;c<3;c++){offset[c]=rest[node*3+c];for(let a=0;a<w.ids.length;a++)offset[c]-=w.weights[a]*rest[w.ids[a]*3+c];}attachments.push({node,...w,offset});}
  rods.push({index:curve.index,type:curve.type,first,count:steps+1,nodes:Array.from({length:steps+1},(_,i)=>first+i),stretchLinks,arcLengthM:arc,kind:curve.kind,yarnId:curve.id,radiusM:radius});
 }
 // Eliminate welded endpoint degrees of freedom. Their mass and drag area are
 // lumped into the same surviving sheet support; treating endpoints as tiny free
 // particles gives poor mass-ratio convergence and fake elastic bridges.
 const attachmentMap=new Int32Array(active.length).fill(-1);
 for(let i=0;i<attachments.length;i++){const a=attachments[i];attachmentMap[a.node]=i;for(let k=0;k<a.ids.length;k++){mass[a.ids[k]]+=mass[a.node]*a.weights[k];area[a.ids[k]]+=area[a.node]*a.weights[k];}mass[a.node]=0;area[a.node]=0;}
 const inv=new Float64Array(active.length);for(let i=0;i<inv.length;i++)inv[i]=active[i]&&!pin[i]&&attachmentMap[i]<0?1/Math.max(mass[i],1e-12):0;
 return {cfg,nGrid,n:active.length,uv,rest:new Float64Array(rest),active:new Uint8Array(active),pin:new Uint8Array(pin),area:new Float64Array(area),mass:new Float64Array(mass),inv,attachmentMap,links:new Float64Array(links),sheetRuns,attachments,rods,tether:distances,tetherAnchor:anchor,weights,
 audit:{schema:cfg.schema,gridSlots:nGrid,activeSheetNodes:active.slice(0,nGrid).reduce((a,b)=>a+b,0),inactiveHoleNodes:active.slice(0,nGrid).filter(x=>!x).length,sheetConstraints:sheetLinks,removedSheetConstraints:rejected,rodNodes:active.length-nGrid,rodConstraints:links.length/5-sheetLinks,retainedBridgeCount:rods.filter(x=>x.type==='bridge').length,tailCount:rods.filter(x=>x.type==='tail').length,weightedAttachments:attachments.length,retainedSheetAreaM2:retainedArea,widthMm:W,heightMm:H,removedAreaM2:Math.max(0,W*H*1e-6-retainedArea),projectedYarnAreaM2:yarnArea,sheetMassKg:retainedArea*mat.arealDensityKgM2,yarnMassKg:yarnMass,totalMassKg:mass.reduce((a,b)=>a+b,0),areaQuadrature:q,phantomSheetThroughHole:false,material:mat,limits:'coarse point collision, no self-collision or adaptive tear; rod chains are proxies, not individual cotton fibers'}};
}
root.KAOPUClothTopology={input,compile,material,point,inside,clearSegment,NX,NY,W,H};root.KAOPUClothTopology.workerModule='('+initializeTopology.toString()+')(globalThis);';if(typeof module!=='undefined')module.exports=root.KAOPUClothTopology;
})(globalThis);
