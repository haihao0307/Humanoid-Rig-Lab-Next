// Read a live, user-approved A frame. Only a temporary runtime reference;
// source2D lengths for B always come from B's newly measured independent draft.
export function readAcceptedShortsReference(originalWindow, originalSHA256) {
 if(originalSHA256!=='2b9158f76cd75aef5605be86bd7092c406d333467ce116eca130f166580635da')throw Error('Unknown original shorts authority');
 if(!originalWindow.ShortStaticTest?.ready)throw Error('Original shorts are not ready');
 const garment=originalWindow.HumanLab?.compact?.skirt,simulation=garment?.simulation,human=garment?.body?.human;
 if(!garment?.pattern||simulation?.particles?.length!==553||!human?.sourceBind)throw Error('Actual original garment and body frame required');
 const source=human.sourceBind.get('hips'),world=human.byId.get('hips').world;
 const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
 const inverse=q=>[-q[0],-q[1],-q[2],q[3]],rotation=multiply(world.q,inverse(source.q)),toSource=p=>multiply(multiply(inverse(rotation),[...p.map((v,k)=>v-world.p[k]),0]),rotation).slice(0,3).map((v,k)=>v+source.p[k]);
 const positions=[],sourceUV=[],ranges=[];let offset=0;
 for(const piece of garment.pattern.pieces){
  const count=piece.materialCoordinates.length;ranges.push({pieceId:piece.id,offset,count});
  for(let local=0;local<count;local++){const particle=simulation.particles[offset+local];if(particle.pieceId!==piece.id||particle.uv.some((v,k)=>v!==piece.materialCoordinates[local][k]))throw Error('Original particle and paper order changed');positions.push(...toSource(particle.pos));sourceUV.push(...particle.uv);}
  offset+=count;
 }
 if(offset!==553||ranges.length!==9||garment.pattern.seams.length!==19||!positions.every(Number.isFinite))throw Error('Original source topology changed');
 return {positions,sourceUV,ranges,coordinateFrame:'actor-local-metres',sourceHash:originalSHA256,authority:'user-approved original A live runtime; polar fold directions only',nativeStepsInvoked:0,paperRestAuthority:false};
}
