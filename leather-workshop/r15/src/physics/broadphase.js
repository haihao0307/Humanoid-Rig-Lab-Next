/** Reusable native spatial-hash storage replaces per-query Maps, Sets and hash-cell closures.
 * Bounds include each surface's finite half-thickness and every swept endpoint.
 * Exact narrow phase, exclusion semantics, barrier/CCD tolerances are unchanged.
 * Pair objects are reused; no candidate is dropped. Cache eviction only affects
 * allocation cost. In-cell ordering exactly matches the inherited spatial-hash traversal.
 */
const oldCandidates=SurfaceContact.prototype.candidates;
const oldSewn=SurfaceContact.prototype.sewnNeighbour;
class NativeBroadphase {
 constructor(contact,capacity=250000){this.c=contact;this.native=ContactReference.createNative();const n=contact.shell.inv.length,f=contact.faces.length,e=contact.edges.length,stride=Math.ceil(n/32);this.capacity=capacity;
  if(!this.native.bp_layout(n,f,e,capacity))throw Error('R10 broadphase memory limit; no contacts discarded');
  const sizes=[3*n,3*n,3*f,2*e,n,n*stride,6*f,6*e,12*f,12*e,n,f,e,3*capacity];this.a=sizes.map((s,i)=>new ([5,6,7,13].includes(i)?Uint32Array:Float64Array)(this.native.memory.buffer,this.native.bp_section(i),s));
  this.a[2].set(contact.faces.flatMap(q=>q.ids));this.a[3].set(contact.edges.flatMap(q=>q.ids));for(let i=0;i<n;i++){this.a[4][i]=contact.nodeParts[i]??-1;for(const j of contact.adj[i])this.a[5][i*stride+(j>>>5)]|=1<<(j&31);}
  this.a[10].set(contact.shell.contactThickness);this.a[11].set(contact.faces.map(f=>f.h));this.a[12].set(contact.edges.map(e=>e.h));
 }
 run(a,b,pad){this.a[0].set(a);this.a[1].set(b);return this.native.bp_candidates(pad,this.c.cell);}
}
SurfaceContact.prototype.referenceCandidates=oldCandidates;
SurfaceContact.prototype.candidates=function(a,b,pad=0){
 if(!this._broadphase){this._broadphase=new NativeBroadphase(this);this._pairPools=[new Map(),new Map()];}
 let count=this._broadphase.run(a,b,pad);while(count<0){if(count===-3)throw Error('Contact broadphase domain invalid; no pose accepted');const capacity=this._broadphase.capacity*2;if(capacity>2000000)throw Error('R10 broadphase pair capacity; no contact discarded');this._broadphase=new NativeBroadphase(this,capacity);count=this._broadphase.run(a,b,pad);}
 const out=[],[pp,ep]=this._pairPools,hit=this._broadphase.a[13];if(pp.size+ep.size>250000){pp.clear();ep.clear();}
 for(let k=0;k<count;k++){const pt=hit[3*k]===1,i=hit[3*k+1],j=hit[3*k+2],pool=pt?pp:ep,key=i*(pt?this.faces.length:this.edges.length)+j;let p=pool.get(key);if(!p){if(pt){const f=this.faces[j];p={ids:[i,...f.ids],gap:this.shell.contactThickness[i]+f.h,pt:true,key:'p'+i+':'+j};}else{const A=this.edges[i],B=this.edges[j];p={ids:[...A.ids,...B.ids],gap:A.h+B.h,pt:false,key:'e'+j+':'+i};}pool.set(key,p);}out.push(p);}
 return out;
};
SurfaceContact.prototype.sewnNeighbour=function(p,q){if(p._sewn!==undefined)return p._sewn;return p._sewn=oldSewn.call(this,p,q);};
