/** Lighting continuity across already sewn, coincident material vertices.
 * Does not weld topology, move a vertex, close a gap or change a quality record.
 * Hard folds (>60 degrees), inactive seams and >0.001 mm gaps stay untouched.
 */
export function smoothSewnNormals(geometry,spec,activeSeams=[]){
 const p=geometry.attributes.position,n=geometry.attributes.normal;
 if(!p||!n)return{joined:0};
 const active=new Set(activeSeams),offsets=new Map();let count=0;
 for(const panel of spec.panels){offsets.set(panel.id,count);count+=panel.uvMm.length;}
 if(count!==p.count)throw Error('SEAM_NORMAL_VERTEX_COUNT');
 const parent=Int32Array.from({length:count},(_,i)=>i),base=Float32Array.from(n.array);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 let joined=0,rejectedGap=0,rejectedFold=0;
 for(const seam of spec.seams){if(!active.has(seam.id))continue;const oa=offsets.get(seam.a.panelId),ob=offsets.get(seam.b.panelId);if(oa===undefined||ob===undefined)throw Error('SEAM_NORMAL_PANEL_ID');
  for(const [a,b]of seam.stitchVertexPairs||[]){const i=oa+a,j=ob+b;if(i>=count||j>=count||i<0||j<0)throw Error('SEAM_NORMAL_INDEX');
   let distance=0,dot=0;for(let k=0;k<3;k++){distance+=(p.array[3*i+k]-p.array[3*j+k])**2;dot+=base[3*i+k]*base[3*j+k];}
   if(distance>1e-12){rejectedGap++;continue;}if(dot<.5){rejectedFold++;continue;}
   const r=root(i),s=root(j);if(r!==s){parent[s]=r;joined++;}
  }
 }
 const groups=new Map();for(let i=0;i<count;i++){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
 let smoothedVertices=0;
 for(const ids of groups.values()){if(ids.length<2)continue;let compatible=true;
  for(const i of ids)for(const j of ids){let dot=0;for(let k=0;k<3;k++)dot+=base[3*i+k]*base[3*j+k];if(dot<.5)compatible=false;}
  if(!compatible)continue;const sum=[0,0,0];for(const i of ids)for(let k=0;k<3;k++)sum[k]+=base[3*i+k];const length=Math.hypot(...sum);if(length<1e-8)continue;
  for(const i of ids)for(let k=0;k<3;k++)n.array[3*i+k]=sum[k]/length;smoothedVertices+=ids.length;
 }
 n.needsUpdate=true;return{joined,smoothedVertices,rejectedGap,rejectedFold,positionsChanged:false,indicesChanged:false,maxGapMm:.001,maximumNormalAngleDeg:60};
}
