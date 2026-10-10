/* KAOPU Denim R02: metric YarnGraph. Extends the existing weave-draft compiler
   contract (stable IDs, crossing matrix, metric centerlines). No borrowed models. */
(function(root){'use strict';
const mod=(x,n)=>((x%n)+n)%n;
const smooth=t=>t*t*(3-2*t);
const defaults={width:100,height:72,warpPitch:.42,weftPitch:.64,thickness:.70,slub:.25,weave:0,seed:23};
function draft(weave=0){let n=weave===1?3:4;let cells=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++){let shift=weave===2?-x:weave===3?[0,1,3,2][x]:x;cells.push(mod(y-shift,n)!==n-1?1:0);}return {width:n,height:n,cells};}
function sample(d,kind,id,t){const n=d.width;const cell=k=>{let x=kind===0?id:k,y=kind===0?k:id;const w=d.cells[mod(y,n)*n+mod(x,n)];return (kind===0?w:1-w)*2-1;};let a=Math.floor(t-.5),f=t-.5-a;return cell(a)+(cell(a+1)-cell(a))*smooth(f);}
function compile(options={}){const p={...defaults,...options};for(const k of ['width','height','warpPitch','weftPitch','thickness'])if(!Number.isFinite(p[k])||p[k]<=0)throw Error('Invalid '+k);if(p.width>240||p.height>200||p.warpPitch<.3||p.weftPitch<.3)throw Error('Yarn budget exceeded');
if(!Number.isInteger(p.weave)||p.weave<0||p.weave>3)throw Error('Invalid weave');if(!Number.isFinite(p.slub)||p.slub<0||p.slub>1)throw Error('Invalid slub');const d=draft(p.weave),nx=Math.floor(p.width/p.warpPitch),ny=Math.floor(p.height/p.weftPitch);if(nx<4||ny<4)throw Error('Swatch smaller than one weave repeat');p.width=nx*p.warpPitch;p.height=ny*p.weftPitch;
const rz=p.thickness*.235,lift=p.thickness*.265,curves=[];for(let kind=0;kind<2;kind++){const count=kind===0?nx:ny,length=kind===0?ny:nx,pitch=kind===0?p.weftPitch:p.warpPitch;for(let id=0;id<count;id++){const pts=new Float32Array((length*4+1)*3);for(let j=0;j<=length*4;j++){let t=j/4;pts[j*3]=kind===0?(id+.5)*p.warpPitch-p.width/2:t*p.warpPitch-p.width/2;pts[j*3+1]=kind===0?t*p.weftPitch-p.height/2:(id+.5)*p.weftPitch-p.height/2;pts[j*3+2]=sample(d,kind,id,t)*lift;}curves.push({id:(kind?'weft:':'warp:')+String(id).padStart(4,'0'),family:kind?'weft':'warp',index:id,radiusZ:rz,radiusAcross:(kind?p.weftPitch:p.warpPitch)*.465,points:pts});}}
return {schema:'kaopu.denim_yarn_graph@2.0',units:'millimeter',p,d,nx,ny,rz,lift,curves,source:'draft -> metric continuous yarn centerlines -> elliptical swept surfaces'};}
function audit(g){let wrong=0,minGap=Infinity;for(let y=0;y<g.ny;y++)for(let x=0;x<g.nx;x++){let w=sample(g.d,0,x,y+.5),f=sample(g.d,1,y,x+.5),expected=g.d.cells[mod(y,g.d.height)*g.d.width+mod(x,g.d.width)];if((w>f)!==!!expected||w===f)wrong++;minGap=Math.min(minGap,Math.abs(w-f)*g.lift-2*g.rz);}
return {yarns:g.curves.length,warp:g.nx,weft:g.ny,crossings:g.nx*g.ny,wrongCrossingOrder:wrong,crossingCenterClearanceMm:+minGap.toFixed(6),nominalEnvelopeMm:2*(g.lift+g.rz),finite:g.curves.every(c=>c.points.every(Number.isFinite)),note:'Checks crossing centers, not a proof of global fiber collision-free geometry.'};}
root.KAOPUDenimCore={defaults,draft,sample,compile,audit};if(typeof module!=='undefined')module.exports=root.KAOPUDenimCore;
})(typeof globalThis!=='undefined'?globalThis:this);
