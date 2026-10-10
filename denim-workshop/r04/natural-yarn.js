/* R04: continuous-parent fray guides. All dimensions are millimeters.
 * The drapes are static authored curves, not a time-integrated cloth solver.
 * Each released yarn keeps one or two exact parent-yarn endpoints. */
(function(root){'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const H=x=>{let n=(Math.imul((x|0)^0x9e3779b9,0x85ebca6b))>>>0;n^=n>>>13;n=Math.imul(n,0xc2b2ae35)>>>0;return ((n^(n>>>16))>>>0)/4294967296;};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),len=a=>Math.hypot(...a),norm=a=>mul(a,1/Math.max(1e-8,len(a))),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const sm=t=>{t=clamp(t);return t*t*(3-2*t);};
function organicPoint(C,g,kind,id,t){let p=C.point(g,kind,id,t),ph=id+kind*79,gate=Math.sin(Math.PI*(t-.5)),amp=g.p.slub;
 // Vanish at crossing centers: deformation cannot swap the draft order.
 let wander=amp*gate*(.036*Math.sin(t*.37+ph*.71)+.021*Math.sin(t*.113+ph*1.9));p[kind?1:0]+=wander;
 p[2]+=.023*amp*gate*gate*Math.sin(t*.48+ph*.67);return p;}
function windowAt(g,kind,id,damage){let full=kind?g.nx:g.ny;if(damage<2)return null;
 let m=kind?(id+.5)*g.p.weftPitch-g.p.height/2:(id+.5)*g.p.warpPitch-g.p.width/2;
 let rx=damage===4?30.5:22,ry=damage===4?14.5:9.2,v=kind?(m+1)/ry:(m-4)/rx;
 if(Math.abs(v)>.995)return null;
 let center=kind?4+1.3*Math.sin(m*.29):-1+.85*Math.sin(m*.16),grp=Math.floor(id/4)+kind*103;
 let half=(kind?rx:ry)*Math.sqrt(1-v*v)*(1+.11*Math.sin(m*.43))+.2;
 let jitter=(H(id+kind*701)-.5)*1.35+(H(grp+79)-.5)*1.3;
 let pitch=kind?g.p.warpPitch:g.p.weftPitch,origin=kind?g.p.width/2:g.p.height/2;
 return [clamp((center-half+jitter+origin)/pitch,.08,full-.08),clamp((center+half+jitter*.62+origin)/pitch,.08,full-.08)];}
function plan(C,g,damage){let spans=[[],[]],released=[],stats={bridges:0,tails:0,partialBridges:0,cutYarns:0};
 for(let kind=0;kind<2;kind++)for(let id=0;id<(kind?g.ny:g.nx);id++){
  let full=kind?g.nx:g.ny,w=windowAt(g,kind,id,damage);if(!w){spans[kind].push([0,full,id,0]);continue;}
  const [a,b]=w;spans[kind].push([0,a,id,0],[b,full,id,0]);stats.cutYarns++;
  let cluster=Math.floor((id+2)/4),seed=kind*3001+cluster*37+damage*919;
  let keepThreshold=damage===2?(kind?.89:.065):damage===3?(kind?.34:.070):(kind?.39:.115);
  let connected=H(seed)*.82+H(id*113+kind*83)*.18<keepThreshold;
  const P=organicPoint(C,g,kind,id,a),Q=organicPoint(C,g,kind,id,b),dist=len(sub(Q,P));
  if(connected){let partial=H(seed+43)>.36,radius=(kind?g.p.weftPitch*.27:g.p.warpPitch*.40)*(partial?.32+.40*H(id+71):.86);
   released.push({type:'bridge',kind,id,cluster,parents:[a,b],p:P,q:Q,radius,sag:(.8+H(seed+5)*3.8)*(damage===2?.55:1),phase:H(seed+9)*6.283,partial});stats.bridges++;if(partial)stats.partialBridges++;
  }else for(let side=0;side<2;side++){
   let s=id*157+side*461+kind*809,extent=Math.min(dist*.46,(1.3+H(s+21)**1.4*12)*(damage===2?.65:1));
   if(H(s+77)<.10)continue;
   released.push({type:'tail',kind,id,cluster,parents:[side?b:a],p:side?Q:P,dir:side?-1:1,radius:(kind?g.p.weftPitch*.25:g.p.warpPitch*.39)*(.32+.55*H(s+3)),extent,phase:H(seed+9)*6.283,seed:s});stats.tails++;
  }
 }
 return {spans,released,stats,damage};}
function guide(r){let pts=[],n=r.type==='bridge'?26:18;
 for(let j=0;j<=n;j++){let t=j/n,p;if(r.type==='bridge'){
  let a=4*t*(1-t),curl=Math.sin(t*6.283+r.phase)-Math.sin(r.phase);p=lerp(r.p,r.q,t);
  p[0]+=a*.30*Math.sin(r.phase);p[1]-=r.sag*a;p[2]+=a*(.6+r.sag*.22)+a*curl*.18;
 }else{
  let t2=t*t,ext=r.extent,sg=r.dir;
  p=add(r.p,r.kind?[sg*ext*(t-.32*t2),0,0]:[0,sg*ext*(t-.46*t2),0]);
  p[0]+=.13*ext*t2*Math.sin(r.phase);p[1]-=ext*(.20+.17*H(r.seed+8))*t2;
  p[2]+=ext*(.14*t+.14*t2)+Math.sin(t*4.1+r.phase)*.14*t;
 }
 pts.push(p);
 }
 return pts;}
function generate(C,g,damage,fray=1){const p=plan(C,g,damage),tubes=[],fibers=[],groups=[];let serial=0;
 function fiber(points,kind,radius,group,role){fibers.push({points,kind,radius,group,role});}
 function children(points,kind,baseRadius,group,count=7){let s=++serial*131,rootP=points[0],length=points.length;
  for(let k=0;k<count;k++){let stray=H(s+k*19)<.22,scale=.70+.45*H(s+k*29+3),ang=H(s+k+47)*6.283;
   let child=[];for(let j=0;j<length;j++){let t=j/(length-1),u=clamp(t*scale),f=u*(length-1),i=Math.min(length-2,Math.floor(f)),q=lerp(points[i],points[i+1],f-i);
    let spread=baseRadius*(.25+.60*Math.sin(Math.PI*t))+(stray?.40:.075)*t*t;
    q[0]+=Math.cos(ang)*spread*sm(t*4);q[1]+=Math.sin(ang)*spread*sm(t*4);q[2]+=.025+Math.sin(t*5+ang)*spread*.45*sm(t*4);child.push(q);
   }
   fiber(child,kind,.006+.007*H(s+k*7),group,stray?'stray':'clumped');
  }
 }
 // A cluster shares its guide motion, but never collapses all members to one tip.
 const releasedGroups=new Map();
 for(const r of p.released){let key=`break:${r.kind}:${r.cluster}:${r.type}:${r.dir||0}`;r.group=key;r.points=guide(r);if(!releasedGroups.has(key))releasedGroups.set(key,[]);releasedGroups.get(key).push(r);}
 for(const [key,list] of releasedGroups){
  for(let j=0;j<list[0].points.length;j++){let t=j/(list[0].points.length-1),mean=mul(list.map(r=>r.points[j]).reduce(add,[0,0,0]),1/list.length);
   for(const r of list){let weight=r.type==='bridge'?Math.sin(Math.PI*t)*.24:sm(t*2)*(.62-.16*sm((t-.78)*5));r.points[j]=lerp(r.points[j],mean,weight);}
  }
  groups.push({id:key,members:list.length,length:len(sub(list[0].points.at(-1),list[0].points[0])),root:list[0].points[0]});
  for(const r of list){tubes.push(r);children(r.points,r.kind,r.radius,key,r.partial?7:5);}
 }
 // Spatially grouped boundary guides, not independent white strokes at every end.
 for(let kind=0;kind<2;kind++)for(let side=0;side<2;side++){
  const count=kind?g.ny:g.nx,full=kind?g.nx:g.ny;
  for(let start=0;start<count;){let gid=kind*1000+side*500+start,number=3+Math.floor(H(gid+91)*5),ids=[];
   for(let id=start;id<Math.min(count,start+number);id++)ids.push(id);
   const roots=ids.map(id=>organicPoint(C,g,kind,id,side?full:0));const mean=mul(roots.reduce(add,[0,0,0]),1/roots.length),length=(.6+H(gid+14)**1.5*5.8)*fray,dir=side?1:-1,group=`edge:${gid}`;
   groups.push({id:group,members:ids.length,root:[...mean],length});
   ids.forEach((id,index)=>{
    let s=gid*71+id*11,stray=H(s+24)<.18,ln=length*(.65+.65*H(s+12)),pts=[];
    for(let j=0;j<=14;j++){let t=j/14,t2=t*t,gather=sm(t*1.8)*.80,drift=(H(gid+2)-.5)*ln*.66;
     let q=lerp(roots[index],mean,gather);q=add(q,kind?[dir*ln*t*.78,drift*t2,0]:[drift*t2,dir*ln*t*.78,0]);
     q[1]-=ln*t2*.32;q[2]+=.10+ln*(.12*t+.16*t2);if(stray)q[kind?1:0]+=(H(s+74)-.5)*1.6*t2;pts.push(q);
    }
    // Body of an unravelled yarn has finite radius; fine children open at its tip.
    if(H(s+31)>.24)tubes.push({type:'edge',kind,id,points:pts,radius:.024+.024*H(s+37),group,parents:[side?full:0]});
    children(pts,kind,.08,group,2+Math.floor(H(s+63)*3));
   });start+=number;
  }
 }
 // Loop-like surface flyaways are attached to existing spans only.
 for(let j=0;j<3100;j++){let kind=H(j+410)<.78?0:1,id=Math.floor(H(j+893)*(kind?g.ny:g.nx)),full=kind?g.nx:g.ny,t=H(j+19)*full;
  if(!p.spans[kind].some(r=>r[2]===id&&t>=r[0]&&t<=r[1]))continue;
  let rootP=organicPoint(C,g,kind,id,t),face=H(j+833)>.85?-1:1,extent=.18+H(j+13)*.74,phase=H(j+277)*6.283,pts=[];
  rootP[2]+=g.rz*(kind?.68:1)*face*.98;
  for(let k=0;k<=7;k++){let u=k/7;pts.push(add(rootP,[Math.cos(phase)*extent*u,Math.sin(phase)*extent*u,face*(.03+.12*Math.sin(Math.PI*u))]));}
  fiber(pts,kind,.005+.004*H(j+414),`surface:${Math.floor(j/5)}`,'surface');
 }
 const stats={...p.stats,edgeClumps:groups.filter(g=>g.id.startsWith('edge:')).length,breakClumps:groups.filter(g=>g.id.startsWith('break:')).length,fiberCurves:fibers.length,looseYarnCurves:tubes.length,clumpedFibers:fibers.filter(f=>f.role==='clumped').length,strayFibers:fibers.filter(f=>f.role==='stray').length};
 return {...p,tubes,fibers,groups,stats};}
function tubeMesh(curves){let vertices=[],indices=[];const sides=6;
 for(const c of curves){let off=vertices.length/12;for(let j=0;j<c.points.length;j++){let P=c.points[j],T=norm(sub(c.points[Math.min(j+1,c.points.length-1)],c.points[Math.max(0,j-1)])),B=norm(cross(T,Math.abs(T[2])<.9?[0,0,1]:[0,1,0])),N=cross(B,T),t=j/(c.points.length-1),r=c.radius*(c.type==='bridge'?.94-.12*Math.sin(t*3.14):1-.78*t*t);
  for(let k=0;k<sides;k++){let a=k/sides*6.28318530718,n=add(mul(B,Math.cos(a)),mul(N,Math.sin(a))),pos=add(P,mul(n,r));vertices.push(...pos,...n,...T,c.kind,c.id,t);}
 }
 for(let j=0;j<c.points.length-1;j++)for(let k=0;k<sides;k++){let a=off+j*sides+k,b=off+j*sides+(k+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
 }
 return {vertices,indices};}
function hairMesh(fibers){let vertices=[],indices=[];for(const c of fibers){let off=vertices.length/7;for(let j=0;j<c.points.length;j++){let t=j/(c.points.length-1);for(const side of [-1,1])vertices.push(...c.points[j],side,c.kind,t,c.radius);}for(let j=0;j<c.points.length-1;j++){let k=off+j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}return {vertices,indices};}
function audit(data){let anchored=0,maxError=0,sagged=0;for(const c of data.tubes){if(c.type==='edge')continue;maxError=Math.max(maxError,len(sub(c.points[0],c.p)));anchored++;if(c.type==='bridge'){maxError=Math.max(maxError,len(sub(c.points.at(-1),c.q)));anchored++;let mid=c.points[Math.floor(c.points.length/2)],chord=lerp(c.p,c.q,.5);if(mid[1]<chord[1]-.1)sagged++;}}
 return {...data.stats,anchoredEndpoints:anchored,maxAnchorErrorMm:maxError,saggedBridges:sagged,finite:data.tubes.every(c=>c.points.every(p=>p.every(Number.isFinite))),note:'Static anchored guides; not stress-based tear dynamics or a collision proof.'};}
root.KAOPUNaturalYarn={plan,generate,organicPoint,tubeMesh,hairMesh,audit,H};if(typeof module!=='undefined')module.exports=root.KAOPUNaturalYarn;
})(typeof globalThis==='undefined'?this:globalThis);
