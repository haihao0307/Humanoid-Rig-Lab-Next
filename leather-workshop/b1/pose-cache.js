/** GPU-only cache of the accepted material-frame vertex calculation.
 * No geometry simplification, CPU readback, physics interpolation or new force law.
 * One calculation per actual nodal texture version; main and shadow passes reuse it.
 * Three.js GLBufferAttribute owns the render binding, WebGL2 owns feedback buffers.
 */
const B1PoseCache=(()=>{
 const devices=new WeakMap();
 const totals={created:0,disposed:0,live:0,bytes:0,updates:0,hits:0};
 const inputNames=['simIDs','simWeights','simDelta','simNormal','simIDsB','simWeightsB','simDeltaB','simNormalB','simBlend'];
 function device(renderer,header){
  if(devices.has(renderer))return devices.get(renderer);
  const gl=renderer.getContext();
  const source='#version 300 es\nprecision highp float;precision highp int;\n'+header.replace(/\battribute\b/g,'in').replace(/\bvarying\b/g,'out')+'\nout vec3 cachePosition;out vec3 cacheNormal;\nvoid main(){mat3 basis=productBasis();cacheNormal=normalize(basis*simNormal);if(simBlend>0.)cacheNormal=normalize(mix(cacheNormal,basisFor(simIDsB,simWeightsB)*simNormalB,simBlend));cachePosition=productPoint(basis);gl_Position=vec4(0.,0.,0.,1.);gl_PointSize=1.;}';
  function shader(type,text){const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);return s;}
  const vs=shader(gl.VERTEX_SHADER,source),fs=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 colour;void main(){colour=vec4(0.);}');
  const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.transformFeedbackVaryings(program,['cachePosition','cacheNormal'],gl.SEPARATE_ATTRIBS);gl.linkProgram(program);
  const ok=gl.getProgramParameter(program,gl.LINK_STATUS),log=ok?'':gl.getProgramInfoLog(program)+'\n'+gl.getShaderInfoLog(vs);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!ok){gl.deleteProgram(program);throw Error('B1 pose-cache shader failed: '+log);}
  const d={gl,program,locations:inputNames.map(n=>gl.getAttribLocation(program,n)),sampler:gl.getUniformLocation(program,'uProductNodes')};devices.set(renderer,d);return d;
 }
 class Cache{
  constructor(root,renderer){
   this.root=root;this.rig=root.userData.rig;this.renderer=renderer;this.device=device(renderer,this.rig.skinSource);this.entries=[];this.version=-1;this.bytes=0;this.updates=0;this.hits=0;this.disposed=false;this.registered=false;
   const gl=this.device.gl;renderer.resetState();
   try{
    this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,3,this.rig.nodeCount);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const seen=new Set();
    for(const mesh of this.rig.meshes){const g=mesh.geometry;if(seen.has(g)||!g.attributes.simIDs)continue;seen.add(g);
     const e={geometry:g,count:g.attributes.position.count,vao:gl.createVertexArray(),feedback:gl.createTransformFeedback(),inputs:[],outputs:[],constants:[]};this.entries.push(e);gl.bindVertexArray(e.vao);
     for(let i=0;i<inputNames.length;i++){const loc=this.device.locations[i];if(loc<0)continue;const a=g.attributes[inputNames[i]];
      if(a){const b=gl.createBuffer();e.inputs.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a.array,gl.STATIC_DRAW);a.isGLBufferAttribute=true;a.buffer=b;a.type=gl.FLOAT;a.elementSize=4;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,a.itemSize,gl.FLOAT,false,0,0);this.bytes+=a.array.byteLength;}
      else{gl.disableVertexAttribArray(loc);e.constants.push(loc);}
     }
     for(const name of ['b1Position','b1Normal']){const b=gl.createBuffer();e.outputs.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,e.count*12,gl.DYNAMIC_COPY);g.setAttribute(name,new T.GLBufferAttribute(b,gl.FLOAT,3,4,e.count));this.bytes+=e.count*12;}
    }
    this.bytes+=this.rig.pixels.byteLength;totals.created++;totals.live++;totals.bytes+=this.bytes;this.registered=true;
   }catch(error){this.dispose();throw error;}finally{this.restoreState();}
  }
  restoreState(){const g=this.device.gl;g.disable(g.RASTERIZER_DISCARD);g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,null);g.bindBufferBase(g.TRANSFORM_FEEDBACK_BUFFER,0,null);g.bindBufferBase(g.TRANSFORM_FEEDBACK_BUFFER,1,null);g.bindVertexArray(null);g.bindBuffer(g.ARRAY_BUFFER,null);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,null);this.renderer.resetState();}
  prepare(){
   if(this.disposed)throw Error('Disposed pose cache');if(this.version===this.rig.texture.version){this.hits++;totals.hits++;return;}
   const {gl:g,program,sampler}=this.device;this.renderer.resetState();
   try{g.useProgram(program);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.pixelStorei(g.UNPACK_ALIGNMENT,4);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);g.pixelStorei(g.UNPACK_ROW_LENGTH,0);g.pixelStorei(g.UNPACK_SKIP_PIXELS,0);g.pixelStorei(g.UNPACK_SKIP_ROWS,0);g.texSubImage2D(g.TEXTURE_2D,0,0,0,3,this.rig.nodeCount,g.RGBA,g.FLOAT,this.rig.pixels);g.uniform1i(sampler,0);g.enable(g.RASTERIZER_DISCARD);
    for(const e of this.entries){g.bindVertexArray(e.vao);for(const loc of e.constants)g.vertexAttrib4f(loc,0,0,0,0);g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,e.feedback);g.bindBufferBase(g.TRANSFORM_FEEDBACK_BUFFER,0,e.outputs[0]);g.bindBufferBase(g.TRANSFORM_FEEDBACK_BUFFER,1,e.outputs[1]);g.beginTransformFeedback(g.POINTS);g.drawArrays(g.POINTS,0,e.count);g.endTransformFeedback();}
    this.version=this.rig.texture.version;this.updates++;totals.updates++;
   }finally{this.restoreState();}
  }
  report(){return{enabled:!this.disposed,bytes:this.bytes,vertices:this.entries.reduce((n,e)=>n+e.count,0),updates:this.updates,reusedDraws:this.hits,poseVersion:this.version};}
  dispose(){if(this.disposed)return;this.disposed=true;const g=this.device.gl;for(const e of this.entries){if(!this.device.invalid){g.deleteVertexArray(e.vao);g.deleteTransformFeedback(e.feedback);for(const b of [...e.inputs,...e.outputs])g.deleteBuffer(b);}e.geometry.deleteAttribute('b1Position');e.geometry.deleteAttribute('b1Normal');}if(!this.device.invalid)g.deleteTexture(this.texture);if(this.registered){totals.disposed++;totals.live--;totals.bytes-=this.bytes;}this.entries=[];this.root=null;this.rig=null;}
 }
 function attach(root,renderer){const rig=root?.userData.rig;if(!rig||rig.staticPreview)return;rig.poseCache=new Cache(root,renderer);for(const m of rig.materialCache?.values()||[])m.needsUpdate=true;for(const mesh of rig.meshes)if(mesh.customDepthMaterial)mesh.customDepthMaterial.needsUpdate=true;return rig.poseCache;}
 function release(root){root?.userData.rig?.poseCache?.dispose();}
 function contextRestored(renderer){const old=devices.get(renderer);if(old)old.invalid=true;devices.delete(renderer);}
 return{attach,release,contextRestored,totals:()=>({...totals})};
})();
