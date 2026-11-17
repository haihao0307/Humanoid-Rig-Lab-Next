// Research display for the existing function-derived gray person. The gray
// corners and their source correspondence stay resident on the GPU. Only the
// evolving original source positions/normals are uploaded; no surface layers
// are removed and no new geometry is fabricated. Not a production binding.
export function createGrayGpuDisplay(canvas,meshBuffer,mapBuffer){
 const gl=canvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw Error('当前浏览器不支持 WebGL2 人物显示');
 const mesh=new Float32Array(meshBuffer),ids=new Uint32Array(mapBuffer),vertices=ids.length;
 if(mesh.length!==vertices*7||!vertices)throw Error('人物表面与来源对应不匹配');
 let max=0;for(const id of ids){if(id===0xffffffff)throw Error('人物表面对应不完整');max=Math.max(max,id);}
 const sourceCount=max+1,width=Math.min(1024,gl.getParameter(gl.MAX_TEXTURE_SIZE)),height=Math.ceil(sourceCount/width);
 if(height>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('人物表面超出当前显卡纹理容量');
 function shader(type,code){const x=gl.createShader(type);gl.shaderSource(x,code);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;}
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,`#version 300 es
 precision highp float;precision highp int;layout(location=0)in vec3 p;layout(location=1)in uint sourceId;
 uniform highp sampler2D positions;uniform highp sampler2D normals;uniform highp sampler2D baseline;
 uniform int texWidth;uniform float yaw,pitch,distance,aspect,targetY;out vec3 N;
 void main(){ivec2 at=ivec2(int(sourceId)%texWidth,int(sourceId)/texWidth);
 vec3 now=texelFetch(positions,at,0).xyz,base=texelFetch(baseline,at,0).xyz;
 vec3 q=now+(p-base)-vec3(0.,targetY,0.);float c=cos(yaw),s=sin(yaw);
 q=vec3(c*q.x-s*q.z,q.y,s*q.x+c*q.z);float cp=cos(pitch),sp=sin(pitch);
 q=vec3(q.x,cp*q.y-sp*q.z,sp*q.y+cp*q.z);float z=distance-q.z;
 gl_Position=vec4(q.x*2.35*aspect,q.y*2.35,1.001*z-.02,z);N=texelFetch(normals,at,0).xyz;}`));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;in vec3 N;out vec4 c;void main(){vec3 n=normalize(N),l=normalize(vec3(-.4,.8,.7));float x=.35+.65*max(dot(n,l),0.);c=vec4(vec3(.65)*x,1.);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const meshBufferGPU=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,meshBufferGPU);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);
 const idBufferGPU=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,idBufferGPU);gl.bufferData(gl.ARRAY_BUFFER,ids,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribIPointer(1,1,gl.UNSIGNED_INT,0,0);gl.bindVertexArray(null);
 function texture(unit){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGB32F,width,height);return t;}
 const textures=[texture(0),texture(1),texture(2)];
 function upload(unit,array){if(Object.prototype.toString.call(array)!=='[object Float32Array]'||array.length!==sourceCount*3)throw Error('人物表面来源层级发生变化');gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,textures[unit]);const rows=Math.floor(sourceCount/width),remain=sourceCount-rows*width;if(rows)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,rows,gl.RGB,gl.FLOAT,array.subarray(0,rows*width*3));if(remain)gl.texSubImage2D(gl.TEXTURE_2D,0,0,rows,remain,1,gl.RGB,gl.FLOAT,array.subarray(rows*width*3));}
 const uniforms=Object.fromEntries(['positions','normals','baseline','texWidth','yaw','pitch','distance','aspect','targetY'].map(n=>[n,gl.getUniformLocation(program,n)]));
 gl.useProgram(program);gl.uniform1i(uniforms.positions,0);gl.uniform1i(uniforms.normals,1);gl.uniform1i(uniforms.baseline,2);gl.uniform1i(uniforms.texWidth,width);
 let yaw=.35,pitch=.04,distance=3.1,targetY=-.04,hasFrame=false;
 function draw(){if(!hasFrame)return;const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.08,.11,.10,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.pitch,pitch);gl.uniform1f(uniforms.distance,distance);gl.uniform1f(uniforms.aspect,h/w);gl.uniform1f(uniforms.targetY,targetY);for(let i=0;i<textures.length;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);}gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,vertices);}
 let baselineReady=false;
 function update(source,normals,base){const begin=performance.now();if(source.length!==base.length||normals.length!==source.length)throw Error('人物表面层级发生变化');if(!baselineReady){upload(2,base);baselineReady=true;}upload(0,source);upload(1,normals);const uploaded=performance.now();hasFrame=true;draw();return{gatherMS:0,uploadAndDrawMS:performance.now()-begin,uploadMS:uploaded-begin};}
 function complete(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)return Promise.reject(Error('显卡画面同步失败'));gl.flush();return new Promise((resolve,reject)=>{const poll=()=>{if(gl.isContextLost()){gl.deleteSync(sync);reject(Error('显卡连接已中断'));return;}const status=gl.clientWaitSync(sync,0,0);if(status===gl.TIMEOUT_EXPIRED){setTimeout(poll,0);return;}gl.deleteSync(sync);if(status===gl.WAIT_FAILED)reject(Error('显卡画面同步失败'));else resolve();};poll();});}
 return Object.freeze({update,draw,complete,finish:()=>gl.finish(),setView(y,p,d,t=-.04){yaw=y;pitch=p;distance=d;targetY=t;},getView:()=>({yaw,pitch,distance,targetY}),sourceCount,vertices,gl});
}
