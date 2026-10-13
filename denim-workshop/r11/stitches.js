/* Two-thread lockstitch visual geometry, not needle-force/contact simulation.
 * Upper thread dips through each stitch point, bottom thread returns underneath.
 * Visible thread is three compressed twisted plies, not a floating uniform pipe. */
(function(root){'use strict';
const PI=Math.PI,sm=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,k)=>a.map(v=>v*k),norm=a=>mul(a,1/Math.max(1e-9,Math.hypot(...a))),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function settings(g){const pitch=g.p.warpPitch*6;return {pitch,start:-g.p.width/2+pitch,rows:[0,1].map(l=>Math.round((12+l*2.7)/g.p.weftPitch)*g.p.weftPitch-g.p.height/2),radius:.058};}
function make(C,N,g,damage=0){const config=settings(g),vertices=[],indices=[],stitches=[],holes=[],guides=[];let arc=0;
 // Sample local upper/lower yarn envelopes; the stitch span follows cloth crowns.
 function surface(x,y,side){let hi=-Infinity;for(let kind=0;kind<2;kind++){
  const pitch=kind?g.p.weftPitch:g.p.warpPitch,v=kind?y:x,extent=kind?g.p.height:g.p.width;
  const id=Math.max(0,Math.min((kind?g.ny:g.nx)-1,Math.floor((v+extent/2)/pitch)));
  const t=kind?(x+g.p.width/2)/g.p.warpPitch:(y+g.p.height/2)/g.p.weftPitch;
  const center=N.organicPoint(C,g,kind,id,t),r=kind?g.p.weftPitch*.235:g.p.warpPitch*.49;
  const delta=(v-center[kind?1:0])/r;
  if(Math.abs(delta)<=1){const theta=side*Math.acos(Math.max(-1,Math.min(1,delta))),p=N.sectionPoint(C,g,kind,id,t,theta);hi=Math.max(hi,side*p[2]);}
 }
 return side*(Number.isFinite(hi)?hi:g.lift*.6);}
 function tubePath(points,side,stitchId){
  // Three physically separate, flattened plies, woven around one stitch guide.
  for(let ply=0;ply<3;ply++){
   const base=vertices.length/12,frames=[];let length=0;
   for(let j=0;j<points.length;j++){
    if(j)length+=Math.hypot(...sub(points[j],points[j-1]));const T=norm(sub(points[Math.min(j+1,points.length-1)],points[Math.max(0,j-1)]));
    const B=norm(cross(T,Math.abs(T[2])<.90?[0,0,1]:[0,1,0])),V=cross(B,T),a=ply*2*PI/3+length*8.5;
    const squeeze=.72+.28*Math.sin(PI*j/(points.length-1));
    const center=add(points[j],add(mul(B,Math.cos(a)*.025),mul(V,Math.sin(a)*.020*squeeze)));
    for(let k=0;k<6;k++){const th=k*2*PI/6,n=add(mul(B,Math.cos(th)),mul(V,Math.sin(th)*squeeze)),pos=add(center,mul(n,.031));vertices.push(...pos,...norm(n),...T,length,ply,stitchId);}
   }
   for(let j=0;j<points.length-1;j++)for(let k=0;k<6;k++){let a=base+j*6+k,b=base+j*6+(k+1)%6;indices.push(a,b,a+6,b,b+6,a+6);}
  }
 }
 const count=Math.floor((g.p.width-2*config.pitch)/config.pitch);
 for(let row=0;row<2;row++){
  const y=config.rows[row];for(let i=0;i<=count;i++)holes.push([config.start+i*config.pitch,y]);
  for(let i=0;i<count;i++){
   const x=config.start+i*config.pitch,id=row*count+i,ptsTop=[],ptsBottom=[];
   for(let j=0;j<=36;j++){
    const u=j/36,xm=x+config.pitch*u,edge=sm(u/.10)*sm((1-u)/.10),pucker=.025*Math.sin(PI*u)**2;
    // Neutral-layer interlock at shared puncture; upper and bobbin threads remain distinct.
    const zTop=surface(xm,y,1)+config.radius*.72+pucker,zBottom=surface(xm,y,-1)-config.radius*.72;
    const topZ=(1-edge)*(-.028)+edge*zTop,bottomZ=(1-edge)*(.028)+edge*zBottom;
    ptsTop.push([xm,y+.012*Math.sin(u*PI*2+id*.21)*Math.sin(PI*u),topZ]);
    ptsBottom.push([xm,y+.060*(1-edge),bottomZ]);
   }
   guides.push({points:ptsTop,kind:0,radius:config.radius,parentId:id,role:"stitch"},{points:ptsBottom,kind:0,radius:config.radius,parentId:id,role:"stitch"});tubePath(ptsTop,1,id);tubePath(ptsBottom,-1,id);stitches.push({id,row,entry:holes[row*(count+1)+i],exit:holes[row*(count+1)+i+1],topRoot:ptsTop[0],topEnd:ptsTop.at(-1),bottomRoot:ptsBottom[0],bottomEnd:ptsBottom.at(-1)});
  }
 }
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,z=0;for(let i=0;i<vertices.length;i+=12){x0=Math.min(x0,vertices[i]);y0=Math.min(y0,vertices[i+1]);x1=Math.max(x1,vertices[i]);y1=Math.max(y1,vertices[i+1]);z=Math.max(z,Math.abs(vertices[i+2]));}
 return {guides,bounds:[x0,y0,x1,y1,z],vertices:new Float32Array(vertices),indices:new Uint32Array(indices),settings:config,audit:{type:'301-inspired two-thread visual topology',stitches:stitches.length,holes:holes.length,plies:3,topAndBottom:true,rootDepthMm:-.028,loopOffsetMm:.060,needleForceSimulation:false,physicalFabricPiercing:false},stitches};
}
root.KAOPUStitches={make,settings};if(typeof module!=='undefined')module.exports=root.KAOPUStitches;
})(globalThis);
