// Read-only access to linked program uniforms in headless verification.
window.__R26_PROGRAMS__=[];
const r26CreateProgram=WebGL2RenderingContext.prototype.createProgram;
WebGL2RenderingContext.prototype.createProgram=function(...args){const program=r26CreateProgram.apply(this,args);__R26_PROGRAMS__.push({gl:this,program});return program;};
window.__R26_ORIGINAL_UNIFORM__=name=>{for(const{gl,program}of __R26_PROGRAMS__)if(gl.getProgramParameter(program,gl.LINK_STATUS)&&gl.getUniformLocation(program,'ownQuadMode')){const value=gl.getUniform(program,gl.getUniformLocation(program,name));return ArrayBuffer.isView(value)?Array.from(value):value;}throw Error('Original material program not found');};
