// GPU transport invariants on controlled radiance, separate from visual QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const source=fs.readFileSync(path.resolve(__dirname,'../body/SkinTransport.js'),'utf8');
const context=vm.createContext({});new vm.Script(source+'\nglobalThis.kernel=skinDiffusionKernel();').runInContext(context);
for(let c=0;c<3;c++){assert(Math.abs(context.kernel.reduce((s,w)=>s+w[c],0)-1)<1e-12);for(let i=0;i<13;i++)assert(Math.abs(context.kernel[i][c]-context.kernel[12-i][c])<1e-12);}
(async()=>{const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage(),result=await page.evaluate(source=>{
 const {SkinTransport,vs}=new Function(source+'\nreturn {SkinTransport,vs:SKIN_SCREEN_VERTEX};')();
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const g=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
 const transport=new SkinTransport(g);if(!transport.available)throw Error('Test requires float colour support');
 const clean=stage=>{const error=g.getError();if(error!==g.NO_ERROR)throw Error(stage+': WebGL '+error);};clean('constructor');
 const renderer={projection:'orthographic',orthoHeight:.008,background:[.05,.07,.09],drawCalls:0};
 const compile=(type,text)=>{const s=g.createShader(type);g.shaderSource(s,text);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
 const fragment=`#version 300 es
 precision highp float;in vec2 uv;uniform float mode;layout(location=0)out vec4 frag;layout(location=1)out vec4 diffuse;layout(location=2)out vec4 residual;
 vec3 display(vec3 c){c=c/(1.+.25*c);return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
 void main(){float px=gl_FragCoord.x,py=gl_FragCoord.y,mask=float(px>8.&&px<120.&&!(px>94.&&px<101.));
 float signal=mode>.5?float(px>46.&&px<50.&&py>28.&&py<36.)*.40:0.;
 vec3 d=vec3(.08+signal),spec=vec3(float(px>70.&&px<74.)*.24);
 float depth=mode>1.5&&px>=50.?.6:.3;
 frag=vec4(display(d+spec),1.);diffuse=vec4(d*mask,mask);residual=vec4(spec*mask,depth*mask);}`;
 const p=g.createProgram();g.attachShader(p,compile(g.VERTEX_SHADER,vs));g.attachShader(p,compile(g.FRAGMENT_SHADER,fragment));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));
 const vao=g.createVertexArray(),rows=[];
 for(const mode of [0,1,2]){
  const texture=g.createTexture();g.activeTexture(g.TEXTURE6);g.bindTexture(g.TEXTURE_2D,texture);
  if(!transport.begin(renderer,128,64,true))throw Error('Transport did not start');clean('begin');
  if(g.getParameter(g.ACTIVE_TEXTURE)!==g.TEXTURE6||g.getParameter(g.TEXTURE_BINDING_2D)!==texture)throw Error('Target allocation corrupted a caller texture binding');
  g.disable(g.DEPTH_TEST);g.useProgram(p);g.uniform1f(g.getUniformLocation(p,'mode'),mode);g.bindVertexArray(vao);g.drawArrays(g.TRIANGLES,0,3);clean('fixture');transport.finish(renderer);clean('finish');
  const final=new Uint8Array(128*64*4),base=new Uint8Array(final.length);g.readPixels(0,0,128,64,g.RGBA,g.UNSIGNED_BYTE,final);
  g.bindFramebuffer(g.FRAMEBUFFER,transport.targets.resolve);g.readBuffer(g.COLOR_ATTACHMENT0);g.readPixels(0,0,128,64,g.RGBA,g.UNSIGNED_BYTE,base);g.bindFramebuffer(g.FRAMEBUFFER,null);
  let constantError=0,nonSkinError=0,changed=0,redTail=0,blueTail=0;
  for(let y=0;y<64;y++)for(let x=0;x<128;x++){const at=(y*128+x)*4,skin=x>=8&&x<120&&!(x>=94&&x<101);
   for(let c=0;c<3;c++){const d=Math.abs(final[at+c]-base[at+c]);if(!mode)constantError=Math.max(constantError,d);if(!skin)nonSkinError=Math.max(nonSkinError,d);if(d)changed++;}
   if(x>=52&&x<=58&&y>=29&&y<=34){redTail+=final[at]-base[at];blueTail+=final[at+2]-base[at+2];}
  }
  if(constantError>1||nonSkinError>0)throw Error(JSON.stringify({mode,constantError,nonSkinError}));
  if(mode===1&&!(changed>0&&redTail>blueTail&&redTail>0))throw Error('Diffuse signal did not spread with the authored RGB profiles');
  if(mode===2&&(Math.abs(redTail)>1||Math.abs(blueTail)>1))throw Error('Diffuse signal leaked across a depth discontinuity');
  rows.push({mode,constantError,nonSkinError,changed,redTail,blueTail});g.deleteTexture(texture);
 }
 if(transport.begin(renderer,128,64,false)||transport.active)throw Error('Disabled path did not stay disabled');
 transport.begin(renderer,64,32,true);if(transport.targets.w!==64||transport.targets.h!==32)throw Error('Resize failed');
 const report=transport.report();clean('resized');transport.dispose();g.deleteProgram(p);g.deleteVertexArray(vao);clean('dispose');
 return {rows,report,gpuCompiled:true,gpuExecuted:true,visualAcceptance:false};
},source);console.log(JSON.stringify(result));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
