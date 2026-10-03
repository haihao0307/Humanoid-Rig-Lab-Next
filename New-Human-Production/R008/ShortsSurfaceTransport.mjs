const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const l=Math.hypot(...v);if(!(Number.isFinite(l)&&l>1e-10))throw Error('HOLD: singular surface material frame');return v.map(x=>x/l);};
// Oriented Darboux coordinates, not a projected world X axis. The two source
// material basis vectors remain orthonormal independently of chart rotation.
export function sourceDarbouxFrame({sourceTangent,surfaceTangent,normal,panelSide}){
 if(!['front','back'].includes(panelSide)||sourceTangent?.length!==2||surfaceTangent?.length!==3||normal?.length!==3||[...sourceTangent,...surfaceTangent,...normal].some(v=>!Number.isFinite(v)))throw Error('HOLD: invalid source surface frame');
 const n=unit(normal),t=unit(surfaceTangent.map((v,k)=>v-dot(surfaceTangent,n)*n[k])),r=unit(panelSide==='front'?cross(n,t):cross(t,n)),[a,b]=unit(sourceTangent);
 return {u:t.map((v,k)=>a*v+b*r[k]),v:t.map((x,k)=>b*x-a*r[k]),meridian:t,crossMeridian:r,normal:n,sourceRestChanged:false};
}
export const seamBoundaryBlend=t=>{if(!Number.isFinite(t)||t<0||t>1)throw Error('HOLD: invalid source boundary fraction');return t*t*(3-2*t);};
// UV metres measure distance along a paper boundary. They are not world-Y
// heights. This monotone intrinsic coordinate maps explicit wearing endpoints
// without using fitted XYZ to define the material rest metric.
export function sourceBoundaryArcFractions(points){
 if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))throw Error('Source boundary requires finite two-dimensional ordered points');
 const prefix=[0];for(let i=1;i<points.length;i++){const length=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);if(!(length>0&&Number.isFinite(length)))throw Error('Source boundary has a zero or invalid material interval');prefix.push(prefix.at(-1)+length);}
 const total=prefix.at(-1);if(!Number.isFinite(total)||!(total>0))throw Error('Invalid source boundary arc length');const fractions=prefix.map(s=>s/total);fractions[0]=0;fractions[fractions.length-1]=1;return {lengthM:total,fractions};
}
export function initialLegContourAngles({side,front,startPoint,centerX,centerZ}){
 if(!['left','right'].includes(side)||typeof front!=='boolean'||!Array.isArray(startPoint)||startPoint.length!==3||![...startPoint,centerX,centerZ].every(Number.isFinite))throw Error('Invalid initial leg contour chart');
 const dx=startPoint[0]-centerX,dz=startPoint[2]-centerZ;if(Math.hypot(dx,dz)<1e-12)throw Error('Initial contour meridian coincides with its pole');
 // The shared inseam is medial; its Z may move across the anatomical axis
 // between heights. Front/back are complementary directed arcs, not a test
 // of the sign of Z. Clamping Z would produce two different start points.
 if(side==='left'?dx< -1e-10:dx>1e-10)throw Error('Initial contour meridian is lateral to its declared leg pole');
 let from=Math.atan2(dx,dz);if(!front&&from<0)from+=2*Math.PI;
 return {from,to:side==='left'?(front?-Math.PI/2:3*Math.PI/2):Math.PI/2,authority:'same medial ray split into complementary front/back directed arcs, allowing source axis Z drift',materialRestChanged:false};
}
// Boundary-first transfinite correction of an INITIAL curved reference row.
// The correction is continuous and exact at both seams. Its reference is not
// a material rest metric or a claim of an isometric garment embedding.
export function initialBoundaryRowPoint({point,referenceStart,referenceEnd,start,end,t}){
 const vectors=[point,referenceStart,referenceEnd,start,end];
 if(!Number.isFinite(t)||t<0||t>1||vectors.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))throw Error('Invalid initial boundary row');
 if(t===0)return start.slice();if(t===1)return end.slice();
 return point.map((v,k)=>v+(1-t)*(start[k]-referenceStart[k])+t*(end[k]-referenceEnd[k]));
}
