// Read-only draw-time snapshots: post-processing can change uniforms after a
// draw, so inspecting them only after a frame is insufficient.
window.__BODY_DRAW_UNIFORMS_R26__=[];
const drawUniformsR26=WebGL2RenderingContext.prototype.drawArrays;
WebGL2RenderingContext.prototype.drawArrays=function(...args){
 const program=this.getParameter(this.CURRENT_PROGRAM);
 const mode=program&&this.getUniformLocation(program,'ownQuadMode');
 if(mode&&this.getUniform(program,mode)===1){
  const uniforms={};
  for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++){
   const u=this.getActiveUniform(program,i),read=name=>{const x=this.getUniform(program,this.getUniformLocation(program,name));return ArrayBuffer.isView(x)?Array.from(x):x;};
   uniforms[u.name]=u.size>1?Array.from({length:u.size},(_,k)=>read(u.name.replace('[0]','['+k+']'))):read(u.name);
  }
  __BODY_DRAW_UNIFORMS_R26__.push(uniforms);
  if(__BODY_DRAW_UNIFORMS_R26__.length>240)__BODY_DRAW_UNIFORMS_R26__.splice(0,120);
 }
 return drawUniformsR26.apply(this,args);
};
