import {createExperimentalHeadEyeGroup} from './head-eye-forward-group-api-20261107-adaptive.mjs';
import {createExperimentalHeadForwardResident} from './head-forward-resident-api-20261107-adaptive.mjs';
// All fixed-shape components are considered. Empirical GPU margins and the
// head/eye group are not certified, and eye optical rays are not included.
export async function createExperimentalFullGroup(gl,options={}){
 let {size=768}=options;
 const front=await createExperimentalHeadEyeGroup(gl,options),oral=[];for(const component of [5,6,7])oral.push({component,api:await createExperimentalHeadForwardResident(gl,{size,component})});const vao=gl.createVertexArray();
 const vs=`#version 300 es
 void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
 const fs=`#version 300 es
 precision highp float;precision highp int;uniform highp usampler2D front,o5,o5u,o6,o6u,o7,o7u;out highp uvec4 result;
 void consider(uvec4 v,int c,inout bool has,inout bool bad,inout float t,inout float upper,inout uint comp,inout uint owner){if(v.x==0u)return;float x=uintBitsToFloat(v.y);if(isnan(x)||isinf(x)){bad=true;return;}if(has&&abs(x-t)<.005)bad=true;if(!has||x<t){has=true;t=x;upper=x+.005;comp=uint(c);owner=v.x-1u;}}
 void check(uvec4 v,bool has,float upper,inout bool bad){if(v.x==0u)return;float lo=uintBitsToFloat(v.y);if(!has||isnan(lo)||isinf(lo)||lo<=upper)bad=true;}
 void main(){ivec2 p=ivec2(gl_FragCoord.xy);uvec4 f=texelFetch(front,p,0);bool has=f.x==1u,bad=f.x==2u;float t=has?uintBitsToFloat(f.w):0.,upper=t+.005;uint comp=has?f.z:0u,owner=has?f.y:0u;
 consider(texelFetch(o5,p,0),5,has,bad,t,upper,comp,owner);consider(texelFetch(o6,p,0),6,has,bad,t,upper,comp,owner);consider(texelFetch(o7,p,0),7,has,bad,t,upper,comp,owner);
 check(texelFetch(o5u,p,0),has,upper,bad);check(texelFetch(o6u,p,0),has,upper,bad);check(texelFetch(o7u,p,0),has,upper,bad);result=uvec4(bad?2u:has?1u:0u,owner,comp,floatBitsToUint(t));}`;
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));
 const initialSize=size,banks=new Map();function makeBank(n){size=n; const fbo=gl.createFramebuffer(),tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32UI,size,size);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('full group framebuffer');
return {fbo,tex};}for(const n of [384,768])banks.set(n,makeBank(n));size=initialSize;let {fbo,tex}=banks.get(size);
 function selectOutputBank(n){if(!banks.has(n))throw Error('Output bank was not preallocated: '+n);size=n;({fbo,tex}=banks.get(n));front.selectOutputBank(n);for(const o of oral)o.api.selectOutputBank(n);}

 return{selectOutputBank,outputBanks:[384,768],eyeTables:()=>front.eyeTables(),render(camera){const start=performance.now(),f=front.render(camera),o=oral.map(x=>({component:x.component,...x.api.render(camera)})),previous=gl.getParameter(gl.VERTEX_ARRAY_BINDING);gl.bindVertexArray(vao);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,size,size);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.DITHER);gl.useProgram(prog);const entries=[['front',f.texture],...o.flatMap(x=>[['o'+x.component,x.winner],['o'+x.component+'u',x.uncertain]])];for(let i=0;i<entries.length;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,entries[i][1]);gl.uniform1i(gl.getUniformLocation(prog,entries[i][0]),i);}gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(previous);return{texture:tex,headSource:f.headSource,headJacobian0:f.headJacobian0,headJacobian1:f.headJacobian1,headWinner:f.headWinner,oralSources:o.map(x=>x.source),oralJacobian0:o.map(x=>x.jacobian0),oralJacobian1:o.map(x=>x.jacobian1),frontMS:f.totalMS,oralMS:o.map(x=>x.wallMS),totalMS:performance.now()-start};},read(){gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);const data=new Uint32Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA_INTEGER,gl.UNSIGNED_INT,data);return data;}};
}
