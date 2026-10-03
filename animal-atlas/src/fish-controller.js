// After the visible GPU representation has been adopted by the stage, retain only
// the original mathematical life controller. No second render loop or GPU surface.
export function adoptFishController(host,renderer,inputs){
 const w=host.window,r=renderer,gl=r.gl;
 w.cancelAnimationFrame(r.raf);r.observer.disconnect();r.frame=()=>{};
 for(const b of [...r.buffers,...r.eyeBuffers,r.index,r.edge,r.eyeIndex,r.lineBuffer])gl.deleteBuffer(b);
 for(const vao of [r.vao,r.wireVao,r.eyeVao,r.lineVao])gl.deleteVertexArray(vao);
 for(const p of [r.program,r.wireProgram,r.eyeProgram,r.lineProgram])gl.deleteProgram(p);
 for(const t of [...Object.values(r.textures),r.fieldTexture,r.instanceTexture])gl.deleteTexture(t);
 r.poseAtlas=null;r.instanceData=null;
 // Preserve the instrument's current-pose API after releasing its private GL buffers.
 // The immutable inputs are the same arrays already owned by the visible stage geometry.
 w.__ATLAS_FISH_CPU_SNAPSHOT__=()=>{
  const {positions,weights,part,partRoot,uvRaw,indices}=inputs,A=w.__KAOPU_R13__.instrument,count=positions.length/3,variant=r.school.fish[r.state.selected].variant,out=new Float32Array(positions.length),uv=new Float32Array(uvRaw.length);
  for(let i=0;i<count;i++){const p=A.deformMaterial(r.h,positions.subarray(i*3,i*3+3),[0,1,0],null,weights.subarray(i*12,i*12+12),part.subarray(i*2,i*2+2),partRoot.subarray(i*3,i*3+3),true).position;for(let k=0;k<3;k++)out[i*3+k]=p[k]*variant.scale[k];}
  for(let i=0;i<uv.length;i++)uv[i]=i%2?1-uvRaw[i]/65535:uvRaw[i]/65535;
  return [{name:host.api.describe().name,positions:out,uv,indices:new Uint32Array(indices),texture:new Uint8Array(w.__ATLAS_FISH_TEXTURE_BYTES__),textureMime:'image/jpeg',material:{color:variant.tint.map(v=>v*variant.brightness),roughness:.6,metalness:0,doubleSided:true}}];
 };
 let previous=w.performance.now();
 return {reset(){previous=w.performance.now();},step(){const now=w.performance.now(),dt=Math.max(0,Math.min(.08,(now-previous)/1000));previous=now;if(r.state.playing)r.advance(dt);}};
}
