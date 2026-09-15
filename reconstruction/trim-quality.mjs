/** Improve an in-memory trim triangulation without moving any source knot.
 * Only convex, two-face interior edges may flip. Open/constrained trim edges,
 * holes, duplicate diagonals and non-manifold edges are never crossed.
 */
const edgeKey=(a,b)=>a<b?`${a}/${b}`:`${b}/${a}`;
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const squared=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
const quality=(a,b,c)=>Math.abs(orient(a,b,c))/Math.max(1e-30,squared(a,b)+squared(b,c)+squared(c,a));

export function improveTrimQuality(uv,faces){
 let flips=0;
 // Fixed passes bound startup work; this is not a full Delaunay certificate.
 for(let pass=0;pass<3;pass++){
  const edges=new Map(),changed=new Uint8Array(faces.length);let passFlips=0;
  for(let face=0;face<faces.length;face++)for(let k=0;k<3;k++){
   const ids=faces[face],a=ids[k],b=ids[(k+1)%3],key=edgeKey(a,b),entry=edges.get(key);
   if(entry){entry.count++;entry.other=face;}
   else edges.set(key,{a,b,opposite:ids[(k+2)%3],face,other:-1,count:1});
  }
  const occupied=new Set(edges.keys());
  for(const e of edges.values()){
   if(e.count!==2||changed[e.face]||changed[e.other])continue;
   const {a,b,opposite:c}=e,d=faces[e.other].find(id=>id!==a&&id!==b);
   if(d===undefined||c===d||occupied.has(edgeKey(c,d)))continue;
   const A=uv[a],B=uv[b],C=uv[c],D=uv[d],sign=Math.sign(orient(A,B,C));
   const scale=Math.max(squared(A,B),squared(A,C),squared(A,D),squared(B,C),squared(B,D),squared(C,D)),epsilon=scale*1e-12;
   // Both old and new pairs must cover the same strictly convex quadrilateral.
   if(!sign||sign*orient(B,A,D)<=epsilon||sign*orient(C,D,B)<=epsilon||sign*orient(D,C,A)<=epsilon)continue;
   const before=Math.min(quality(A,B,C),quality(B,A,D)),after=Math.min(quality(C,D,B),quality(D,C,A));
   if(after<=before+1e-10)continue;
   faces[e.face]=[c,d,b];faces[e.other]=[d,c,a];
   occupied.add(edgeKey(c,d));changed[e.face]=changed[e.other]=1;passFlips++;flips++;
  }
  if(!passFlips)break;
 }
 return flips;
}
