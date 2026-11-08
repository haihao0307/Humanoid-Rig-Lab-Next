import {createExperimentalHeadForwardResident} from './head-forward-resident-api-20261107-adaptive.mjs';
import {createExperimentalEyeCompensatedResident as createExperimentalEyeResident} from './eye-compensated-resident-api-20261107-adaptive.mjs';
// Experimental fixed-shape head + eye first-hit merge. It retains empirical
// GPU margins, omits the oral components, and is not a visibility certificate.
export async function createExperimentalHeadEyeGroup(gl,{size=768,headFactory=createExperimentalHeadForwardResident}={}){
 const head=await headFactory(gl,{size}),eyes=await createExperimentalEyeResident(gl,{size}),vao=gl.createVertexArray();
 const vs=`#version 300 es
 void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
 const fs=`#version 300 es
 precision highp float;precision highp int;uniform highp usampler2D h,hu,e1,e1u,e2,e2u,e3,e3u,e4,e4u;out highp uvec4 result;
 void consider(uvec4 v,int c,inout bool has,inout bool bad,inout float t,inout float upper,inout uint component,inout uint owner){if(v.x!=2u)return;float x=uintBitsToFloat(v.y),up=uintBitsToFloat(v.z);if(isnan(x)||isinf(x)||isnan(up)||isinf(up)){bad=true;return;}if(has&&abs(x-t)<.005)bad=true;if(!has||x<t){has=true;t=x;upper=up;component=uint(c);owner=v.w-1u;}}
 void check(uvec4 v,bool has,float upper,inout bool bad){if(v.x==0u)return;float lo=uintBitsToFloat(v.y);if(!has||isnan(lo)||isinf(lo)||lo<=upper)bad=true;}
 void main(){ivec2 p=ivec2(gl_FragCoord.xy);uvec4 hv=texelFetch(h,p,0),uh=texelFetch(hu,p,0);bool has=hv.x!=0u,bad=false;float t=has?uintBitsToFloat(hv.y):0.,upper=t+.005;uint component=0u,owner=has?hv.x-1u:0u;if(has&&(isnan(t)||isinf(t)))bad=true;
 consider(texelFetch(e1,p,0),1,has,bad,t,upper,component,owner);consider(texelFetch(e2,p,0),2,has,bad,t,upper,component,owner);consider(texelFetch(e3,p,0),3,has,bad,t,upper,component,owner);consider(texelFetch(e4,p,0),4,has,bad,t,upper,component,owner);
 check(uh,has,upper,bad);check(texelFetch(e1u,p,0),has,upper,bad);check(texelFetch(e2u,p,0),has,upper,bad);check(texelFetch(e3u,p,0),has,upper,bad);check(texelFetch(e4u,p,0),has,upper,bad);
 result=uvec4(bad?2u:has?1u:0u,owner,component,floatBitsToUint(t));}`;
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
 const initialSize=size,banks=new Map();function makeBank(n){size=n; const fbo=gl.createFramebuffer(),tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32UI,size,size);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('group framebuffer incomplete');
return {fbo,tex};}for(const n of [384,768])banks.set(n,makeBank(n));size=initialSize;let {fbo,tex}=banks.get(size);
 function selectOutputBank(n){if(!banks.has(n))throw Error('Output bank was not preallocated: '+n);size=n;({fbo,tex}=banks.get(n));head.selectOutputBank(n);eyes.selectOutputBank(n);}

 return{selectOutputBank,outputBanks:[384,768],eyeTables:()=>eyes.residentTables(),render(camera){const start=performance.now(),h=head.render(camera),e=eyes.render(camera),old=gl.getParameter(gl.VERTEX_ARRAY_BINDING);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,size,size);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.DITHER);gl.useProgram(prog);const inputs=[['h',h.winner],['hu',h.uncertain],...e.components.flatMap((x,i)=>[['e'+(i+1),x.winner],['e'+(i+1)+'u',x.uncertain]])];for(let i=0;i<inputs.length;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,inputs[i][1]);gl.uniform1i(gl.getUniformLocation(prog,inputs[i][0]),i);}gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(old);return{texture:tex,headSource:h.source,headJacobian0:h.jacobian0,headJacobian1:h.jacobian1,headWinner:h.winner,headMS:h.wallMS,eyesMS:e.times,totalMS:performance.now()-start};},read(){gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);const pixels=new Uint32Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA_INTEGER,gl.UNSIGNED_INT,pixels);return pixels;}};
}
