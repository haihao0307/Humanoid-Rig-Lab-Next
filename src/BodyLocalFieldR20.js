/* Conservative scalar-field conditioning for the four small extremity
 * domains. It never generates surface connectivity or polygon faces. */
(()=>{'use strict';
function condition(region){const g=region.dimensions,n=g[0]*g[1]*g[2],field=region.field,copy=new Float32Array(n);let smoothingMax=0;
 // A sub-voxel separable Gaussian attenuates fitted isolated oscillations.
 // Material coordinates are not averaged: their original transport survives.
 for(const stride of[1,g[0],g[0]*g[1]]){for(let i=0;i<n;i++)copy[i]=field[i*4];for(let i=0;i<n;i++){const coordinate=stride===1?i%g[0]:stride===g[0]?Math.floor(i/g[0])%g[1]:Math.floor(i/(g[0]*g[1])),limit=stride===1?g[0]:stride===g[0]?g[1]:g[2];if(coordinate<1||coordinate>=limit-1)continue;const value=.12*copy[i-stride]+.76*copy[i]+.12*copy[i+stride];smoothingMax=Math.max(smoothingMax,Math.abs(value-copy[i]));field[i*4]=value;}}
 const visited=new Uint8Array(n),queue=new Int32Array(n),components=[];let largest=0;
 for(let start=0;start<n;start++){if(visited[start]||field[start*4]>=0)continue;let read=0,end=1;queue[0]=start;visited[start]=1;while(read<end){const i=queue[read++],x=i%g[0],y=Math.floor(i/g[0])%g[1],z=Math.floor(i/(g[0]*g[1]));for(const j of[x?i-1:-1,x+1<g[0]?i+1:-1,y?i-g[0]:-1,y+1<g[1]?i+g[0]:-1,z?i-g[0]*g[1]:-1,z+1<g[2]?i+g[0]*g[1]:-1])if(j>=0&&!visited[j]&&field[j*4]<0){visited[j]=1;queue[end++]=j;}}largest=Math.max(largest,end);components.push({count:end,ids:end<=40?Array.from(queue.subarray(0,end)):null});}
 let removed=0,cells=0;for(const c of components)if(c.ids&&c.count<largest*.005){for(const i of c.ids)field[i*4]=Math.abs(field[i*4])+.0004;removed++;cells+=c.count;}
 region.conditioning={method:'sub-voxel scalar Gaussian and conservative removal of tiny disconnected negative pockets',smoothingMaxMM:smoothingMax*1000,negativeComponents:components.length,largestComponentVoxels:largest,removedTinyPockets:removed,removedVoxels:cells,maximumRemovedPocketVoxels:40,globalTopologyProof:false};return region;
}
globalThis.BodyLocalFieldR20={condition};
})();
