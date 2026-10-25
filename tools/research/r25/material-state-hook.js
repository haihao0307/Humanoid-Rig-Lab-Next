// Browser-only instrumentation. Does not change rendering state.
window.__BODY_MATERIAL_QA_PROGRAMS__=[];
window.__BODY_MATERIAL_QA_CONTEXTS__=new Set();
const materialQATextures=new WeakMap(),materialQAUnits=new WeakMap(),materialQARecords=[],materialQAUploads=[];let materialQAId=0;
const materialQAP=WebGL2RenderingContext.prototype;
const materialQAActive=materialQAP.activeTexture,materialQABind=materialQAP.bindTexture,materialQAParam=materialQAP.texParameteri,materialQAParamF=materialQAP.texParameterf,materialQATex=materialQAP.createTexture,materialQADraw=materialQAP.drawArrays;
const materialQAContext=gl=>{if(!materialQAUnits.has(gl))materialQAUnits.set(gl,{active:0,bindings:new Map()});return materialQAUnits.get(gl);};
materialQAP.createTexture=function(...args){const t=materialQATex.apply(this,args),record={id:++materialQAId,parameters:{}};materialQATextures.set(t,record);materialQARecords.push(record);return t;};
materialQAP.activeTexture=function(unit){materialQAContext(this).active=unit-this.TEXTURE0;return materialQAActive.call(this,unit);};
materialQAP.bindTexture=function(target,texture){if(target===this.TEXTURE_2D){const s=materialQAContext(this);s.bindings.set(s.active,texture);}return materialQABind.call(this,target,texture);};
for(const[name,original]of [['texParameteri',materialQAParam],['texParameterf',materialQAParamF]])materialQAP[name]=function(target,key,value){const s=materialQAContext(this),t=materialQATextures.get(s.bindings.get(s.active));if(target===this.TEXTURE_2D&&t)t.parameters[key]=value;return original.call(this,target,key,value);};
for(const name of ['texImage2D','texSubImage2D']){const original=materialQAP[name];materialQAP[name]=function(...args){const result=original.apply(this,args),data=args.at(-1);if(data instanceof Float32Array&&data.length===this.canvas.width*this.canvas.height*4){const s=materialQAContext(this),record=materialQATextures.get(s.bindings.get(s.active)),width=this.canvas.width,height=this.canvas.height;if(record)materialQAUploads.push(crypto.subtle.digest('SHA-256',data).then(hash=>{record.upload={width,height,bytes:data.byteLength,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')};}));}return result;};}
window.__BODY_MATERIAL_QA_WAIT__=()=>Promise.all(materialQAUploads);
window.__BODY_MATERIAL_QA_UPLOADS__=()=>materialQARecords.filter(r=>r.upload).map(r=>({id:r.id,...r.upload}));
materialQAP.drawArrays=function(...args){const p=this.getParameter(this.CURRENT_PROGRAM),mode=this.getUniformLocation(p,'ownQuadMode');if(mode){const pass=this.getUniform(p,this.getUniformLocation(p,'uFPass')),parity=this.getUniform(p,this.getUniformLocation(p,'ownParity'));if(pass===0&&(!parity||!parity[0]&&!parity[1])){const samplers={};for(let i=0;i<this.getProgramParameter(p,this.ACTIVE_UNIFORMS);i++){const u=this.getActiveUniform(p,i);if(u.type!==this.SAMPLER_2D)continue;const v=this.getUniform(p,this.getUniformLocation(p,u.name)),units=typeof v==='number'?[v]:Array.from(v);samplers[u.name]=units.map(unit=>({unit,texture:structuredClone(materialQATextures.get(materialQAContext(this).bindings.get(unit))||null)}));}p.__BODY_MATERIAL_DRAW__={samplers,viewport:Array.from(this.getParameter(this.VIEWPORT)),dither:this.isEnabled(this.DITHER),blend:this.isEnabled(this.BLEND),depthTest:this.isEnabled(this.DEPTH_TEST),depthFunction:this.getParameter(this.DEPTH_FUNC),colourMask:this.getParameter(this.COLOR_WRITEMASK)};}}return materialQADraw.apply(this,args);};
const materialQACreateProgram=WebGL2RenderingContext.prototype.createProgram;
WebGL2RenderingContext.prototype.createProgram=function(...args){
 const program=materialQACreateProgram.apply(this,args);
 __BODY_MATERIAL_QA_CONTEXTS__.add(this);
 __BODY_MATERIAL_QA_PROGRAMS__.push({gl:this,program});
 return program;
};
window.__BODY_MATERIAL_QA_STATE__=()=>__BODY_MATERIAL_QA_PROGRAMS__.map(({gl,program})=>{
 const uniforms={};
 for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){
  const u=gl.getActiveUniform(program,i),read=name=>{const value=gl.getUniform(program,gl.getUniformLocation(program,name));return ArrayBuffer.isView(value)?Array.from(value):value;};
  uniforms[u.name]=u.size>1?Array.from({length:u.size},(_,k)=>read(u.name.replace('[0]','['+k+']'))):read(u.name);
 }
 return{uniforms,drawState:structuredClone(program.__BODY_MATERIAL_DRAW__||null),dither:gl.isEnabled(gl.DITHER),scissor:gl.isEnabled(gl.SCISSOR_TEST),sampleCoverage:gl.isEnabled(gl.SAMPLE_COVERAGE),sampleAlphaToCoverage:gl.isEnabled(gl.SAMPLE_ALPHA_TO_COVERAGE),colourMask:gl.getParameter(gl.COLOR_WRITEMASK)};
});
