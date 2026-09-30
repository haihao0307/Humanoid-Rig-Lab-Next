import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='browser-dqs-qa';fs.mkdirSync(out,{recursive:true});
const html=`<!doctype html><canvas id="c"></canvas><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><script type="module">
import * as T from 'three';
const r=new T.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});r.setSize(512,512);r.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color(0x11191f);scene.add(new T.HemisphereLight(0xffffff,0x888888,2));const l=new T.DirectionalLight(0xffffff,2);l.position.set(1,2,3);scene.add(l);
const cam=new T.PerspectiveCamera(36,1,.01,20);cam.position.set(0,0,2);cam.lookAt(0,0,0);
const paletteData=new Float32Array(128*8);for(let i=0;i<128;i++)paletteData[i*8+3]=1;
const palette=new T.DataTexture(paletteData,2,128,T.RGBAFormat,T.FloatType);palette.needsUpdate=true;
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.4,-.5,0,.4,-.5,0,0,.5,0],3));geo.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,1],2));
for(const n of ['joints0','joints1'])geo.setAttribute(n,new T.Uint16BufferAttribute(new Uint16Array(12),4));for(const n of ['weights0','weights1'])geo.setAttribute(n,new T.Uint16BufferAttribute(new Uint16Array(12).fill(n==='weights0'?16384:0),4,true));
function tex(a){const t=new T.DataTexture(new Uint8Array(a),1,1,T.RGBAFormat);t.needsUpdate=true;return t;}
const mat=new T.MeshStandardMaterial({map:tex([180,110,80,255]),normalMap:tex([128,128,255,255]),roughnessMap:tex([160,160,160,255]),metalnessMap:tex([0,0,0,255]),roughness:1,metalness:1,side:T.DoubleSide});
mat.onBeforeCompile=s=>{s.uniforms.humanPalette={value:palette};s.vertexShader=\`uniform sampler2D humanPalette;
attribute vec4 joints0,joints1,weights0,weights1;
vec3 dqRotate(vec4 q,vec3 p){return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
void humanDq(out vec4 qr,out vec3 translation){vec4 ref=texelFetch(humanPalette,ivec2(0,int(joints0.x)),0);qr=vec4(0.);vec4 qd=vec4(0.);
for(int k=0;k<8;k++){int id=int(k<4?joints0[k]:joints1[k-4]);float w=k<4?weights0[k]:weights1[k-4];vec4 r=texelFetch(humanPalette,ivec2(0,id),0),d=texelFetch(humanPalette,ivec2(1,id),0);w*=dot(ref,r)<0.?-1.:1.;qr+=w*r;qd+=w*d;}
float L=max(length(qr),1e-8);qr/=L;qd/=L;qd-=qr*dot(qr,qd);translation=2.*(qr.w*qd.xyz-qd.w*qr.xyz+cross(qr.xyz,qd.xyz));}\n\`+s.vertexShader;
s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\\n vec4 humanQ;vec3 humanT;humanDq(humanQ,humanT);objectNormal=dqRotate(humanQ,objectNormal);').replace('#include <begin_vertex>','vec3 transformed=dqRotate(humanQ,position)+humanT;');};
let shaderError=null;r.debug.onShaderError=(g,p,v,f)=>shaderError=g.getProgramInfoLog(p)+g.getShaderInfoLog(v)+g.getShaderInfoLog(f);
scene.add(new T.Mesh(geo,mat));await r.compileAsync(scene,cam);if(shaderError)throw Error(shaderError);r.render(scene,cam);const gl=r.getContext(),pixels=new Uint8Array(512*512*4);gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let colored=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>pixels[i+2]+20)colored++;
window.result={three:T.REVISION,webgl2:gl instanceof WebGL2RenderingContext,glError:gl.getError(),triangles:r.info.render.triangles,coloredPixels:colored,shaderError,scope:'Three.js shader/material integration fixture, NOT full character browser acceptance'};
</script>`;
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const p=path.resolve('.'+req.url);if(!p.startsWith(process.cwd())){res.writeHead(403);res.end();return;}try{res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(8787,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8787');await page.waitForFunction(()=>window.result,{timeout:60000});const result=await page.evaluate(()=>window.result);result.pageErrors=errors;fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));await page.screenshot({path:out+'/fixture.png'});await browser.close();server.close();console.log(JSON.stringify(result));assert.equal(errors.length,0);assert.equal(result.glError,0);assert(result.coloredPixels>20000);assert.equal(result.triangles,1);assert.equal(result.shaderError,null);
