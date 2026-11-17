// Isolated WebGL2 normal-computation experiment for the original topology.
// Face order and incidence are retained. GPU float arithmetic must be checked
// against the source before this can be used for display.
export function createGrayGpuNormals(gl,index,vertexCount){
 if(!gl.getExtension('EXT_color_buffer_float'))throw Error('当前显卡不能写入浮点纹理');
 if(!ArrayBuffer.isView(index)||index.length%3||!Number.isInteger(vertexCount)||vertexCount<1)throw Error('表面拓扑无效');
 const faces=index.length/3,counts=new Uint32Array(vertexCount),indices=Uint32Array.from(index);
 for(const i of indices){if(i>=vertexCount)throw Error('表面顶点索引无效');counts[i]++;}
 const ranges=new Uint32Array(vertexCount*2);let size=0;for(let i=0;i<vertexCount;i++){ranges[i*2]=size;size+=counts[i];ranges[i*2+1]=size;}
 const adjacency=new Uint32Array(size),cursor=new Uint32Array(vertexCount);for(let f=0;f<faces;f++)for(let k=0;k<3;k++){const i=indices[f*3+k];adjacency[ranges[i*2]+cursor[i]++]=f;}
 const W=Math.min(1024,gl.getParameter(gl.MAX_TEXTURE_SIZE)),H=n=>Math.ceil(n/W),max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
 if([vertexCount,faces,adjacency.length].some(n=>H(n)>max))throw Error('表面拓扑超出纹理容量');
 function tex(unit,internal,format,type,components,count,data){const x=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,x);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texStorage2D(gl.TEXTURE_2D,1,internal,W,H(count));if(data)write(unit,x,format,type,components,count,data);return x;}
 function write(unit,t,format,type,components,count,data){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);let rows=Math.floor(count/W),tail=count-rows*W;if(rows)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,rows,format,type,data.subarray(0,rows*W*components));if(tail)gl.texSubImage2D(gl.TEXTURE_2D,0,0,rows,tail,1,format,type,data.subarray(rows*W*components));}
 const pos=tex(0,gl.RGB32F,gl.RGB,gl.FLOAT,3,vertexCount),range=tex(1,gl.RG32UI,gl.RG_INTEGER,gl.UNSIGNED_INT,2,vertexCount,ranges),adj=tex(2,gl.R32UI,gl.RED_INTEGER,gl.UNSIGNED_INT,1,adjacency.length,adjacency),tri=tex(3,gl.RGB32UI,gl.RGB_INTEGER,gl.UNSIGNED_INT,3,faces,indices),out=tex(4,gl.RGBA32F,gl.RGBA,gl.FLOAT,4,vertexCount);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,out,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('无法建立法线计算缓冲');
 function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,`#version 300 es
 const vec2 xy[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));void main(){gl_Position=vec4(xy[gl_VertexID],0.,1.);}`));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;precision highp int;uniform highp sampler2D p;uniform highp usampler2D r;uniform highp usampler2D a;uniform highp usampler2D t;uniform int w,n;out vec4 color;
 ivec2 at(uint i){return ivec2(int(i)%w,int(i)/w);}void main(){uint v=uint(int(gl_FragCoord.y)*w+int(gl_FragCoord.x));if(v>=uint(n)){color=vec4(0.);return;}uvec2 limits=texelFetch(r,at(v),0).xy;vec3 sum=vec3(0.);for(uint i=limits.x;i<limits.y;i++){uint face=texelFetch(a,at(i),0).x;uvec3 ids=texelFetch(t,at(face),0).xyz;vec3 pa=texelFetch(p,at(ids.x),0).xyz,pb=texelFetch(p,at(ids.y),0).xyz,pc=texelFetch(p,at(ids.z),0).xyz;sum+=cross(pc-pb,pa-pb);}float len=length(sum);color=vec4(len>0.?sum/len:vec3(0.),0.);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);for(const [name,unit]of [['p',0],['r',1],['a',2],['t',3]])gl.uniform1i(gl.getUniformLocation(program,name),unit);gl.uniform1i(gl.getUniformLocation(program,'w'),W);gl.uniform1i(gl.getUniformLocation(program,'n'),vertexCount);
 const scratch=new Float32Array(W*H(vertexCount)*4),vao=gl.createVertexArray();
 function compute(positions,normals){if(positions.length!==vertexCount*3||normals.length!==vertexCount*3)throw Error('法线计算输入不匹配');const start=performance.now();write(0,pos,gl.RGB,gl.FLOAT,3,vertexCount,positions);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,W,H(vertexCount));gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.useProgram(program);for(const [i,x]of [[0,pos],[1,range],[2,adj],[3,tri]]){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,x)}gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,3);gl.readPixels(0,0,W,H(vertexCount),gl.RGBA,gl.FLOAT,scratch);const read=performance.now();for(let i=0;i<vertexCount;i++){normals[i*3]=scratch[i*4];normals[i*3+1]=scratch[i*4+1];normals[i*3+2]=scratch[i*4+2];}return{completedMS:performance.now()-start,gpuAndReadMS:read-start,error:gl.getError()};}
 function dispose(){for(const t of [pos,range,adj,tri,out])gl.deleteTexture(t);gl.deleteProgram(program);gl.deleteFramebuffer(fb);gl.deleteVertexArray(vao);}
 return Object.freeze({compute,dispose,vertexCount,faces,maxValence:counts.reduce((a,b)=>Math.max(a,b),0)});
}
