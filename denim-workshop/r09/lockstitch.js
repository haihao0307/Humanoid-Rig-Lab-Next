/* Two continuous threads interlock within the fabric at each needle site.
   Geometric 301-style demonstrator, not a sewing/cloth mechanics solver. */
(function(root){'use strict';
const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function settings(g,state){const pitch=g.p.warpPitch*(state.stitchCells||7),start=-g.p.width*.5+g.p.warpPitch*7,rows=[-g.p.height*.5+Math.round(12/g.p.weftPitch)*g.p.weftPitch,-g.p.height*.5+Math.round(14.7/g.p.weftPitch)*g.p.weftPitch];return {pitch,start,rows,count:Math.floor((g.p.width-14*g.p.warpPitch)/pitch),radius:(state.threadDiameter||.14)*.5,top:g.p.thickness*.51};}
function generate(g,state,Natural){const q=settings(g,state),curves=[],needles=[];
 for(const [row,y] of q.rows.entries()){
  for(let i=0;i<=q.count;i++)needles.push([q.start+i*q.pitch,y]);
  for(let lower=0;lower<2;lower++){
   const points=[];
   for(let i=0;i<=q.count;i++){const x=q.start+i*q.pitch;
    if(!lower){points.push([x-.26,y-.028,q.top],[x-.15,y-.055,q.top*.32],[x-.025,y-.18,.035],[x,y,-.235],[x+.025,y+.18,.035],[x+.15,y+.055,q.top*.32],[x+.26,y+.028,q.top]);if(i<q.count)points.push([x+q.pitch*.5,y+.007*Math.sin(i*.73),q.top-.012]);}
    else{points.push([x-.28,y,-q.top],[x-.16,y,-q.top*.35],[x-.075,y,-.06],[x,y,-.022],[x+.075,y,-.06],[x+.16,y,-q.top*.35],[x+.28,y,-q.top]);if(i<q.count)points.push([x+q.pitch*.5,y,-q.top+.012]);}
   }
   curves.push({row,lower,points:Natural.smoothCurve(points,3)});
  }
 }
 const vertices=[],indices=[],sides=8;
 for(const c of curves){let arc=0,off=vertices.length/11;for(let j=0;j<c.points.length;j++){const P=c.points[j];if(j)arc+=Math.hypot(...sub(P,c.points[j-1]));let T=norm(sub(c.points[Math.min(j+1,c.points.length-1)],c.points[Math.max(0,j-1)])),B=norm(cross(T,Math.abs(T[2])<.9?[0,0,1]:[0,1,0])),N=cross(B,T);
   for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,twist=a-arc*8.4,rr=q.radius*(1+.075*Math.cos(twist*3)),n=B.map((v,i)=>v*Math.cos(a)+N[i]*Math.sin(a)),pos=P.map((v,i)=>v+n[i]*rr*(i===2?.78:1));vertices.push(...pos,...n,...T,arc,a);}
  }
  for(let j=0;j<c.points.length-1;j++)for(let k=0;k<sides;k++){const n=off+j*(sides+1)+k;indices.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}
 }
 return {guides:curves,vertices:new Float32Array(vertices),indices:new Uint32Array(indices),settings:q,stats:{rows:2,continuousThreads:curves.length,stitches:q.count*2,needleSites:needles.length,threadDiameterMm:q.radius*2,stitchPitchMm:q.pitch,topAndBobbinThreads:true,interlockDepthMm:-.022,triangles:indices.length/3,mechanicsSolver:false,needleHoles:'local fragment coverage; not remeshed yarn damage'}};
}
const glsl=`uniform int uSeam;uniform float uStitchPitch,uThreadRadius;
vec2 nearestNeedle(vec2 p){float start=-uSize.x*.5+uSize.z*7.;float count=floor((uSize.x-14.*uSize.z)/uStitchPitch);float site=clamp(floor((p.x-start)/uStitchPitch+.5),0.,count);float row0=-uSize.y*.5+floor(12./uSize.w+.5)*uSize.w,row1=-uSize.y*.5+floor(14.7/uSize.w+.5)*uSize.w;return vec2(start+site*uStitchPitch,abs(p.y-row0)<abs(p.y-row1)?row0:row1);}
float needleDistance(vec2 p){vec2 n=nearestNeedle(p);return length((p-n)/vec2(.105,.12));}
float seamContact(vec2 p){if(uSeam==0)return 1.;vec2 q=p-nearestNeedle(p);return 1.-.22*exp(-dot(q,q)/.028);}
`;
root.KAOPULockstitch={generate,settings,glsl};if(typeof module!=='undefined')module.exports=root.KAOPULockstitch;
})(globalThis);
