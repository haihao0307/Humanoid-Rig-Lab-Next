// Compile the actual authored library and compare GPU channels with the CPU
// reference. This is a numerical check, never a facial visual-acceptance test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require(process.env.HUMAN_PLAYWRIGHT_MODULE||'playwright');
const source=fs.readFileSync(path.resolve(__dirname,'../body/SkinSurface.js'),'utf8');
const context=vm.createContext({});
new vm.Script(source+'\nglobalThis.api={shader:compactSkinSurfaceShader,evaluate:compactSkinEvaluateCPU};').runInContext(context);
const samples=[];
for(const footprint of [.000025,.0002,.001,.005])for(const detail of [0,.35,1]){
  const k=samples.length;
  samples.push({p:[.026+k*.00071,1.486+k*.00019,.174],n:[.24,.08,.967],footprint,
    seed:[31.1,71.3,19.7],surface:[.52,.25,.30],detail:[.30,detail,.13],stretch:1});
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.HUMAN_CHROME||undefined,headless:true,
   args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  const results=await page.evaluate(({shader,samples})=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
   if(!gl.getExtension('EXT_color_buffer_float'))throw Error('Float framebuffer unavailable');
   const compile=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
   const vs=compile(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}');
   const frag='#version 300 es\nprecision highp float;\n'+shader+`\n
uniform vec3 sampleP,sampleN,seed,surface,detail;
uniform float footprint,stretch,channel;out vec4 result;
void main(){CompactSkinSurface s=compactSkinEvaluate(sampleP,sampleN,footprint,seed,surface,detail,stretch);
result=channel<.5?vec4(s.pigment,s.heightM):vec4(s.roughness,s.oil,s.cavity,s.unresolvedVariance);}`;
   const fs=compile(gl.FRAGMENT_SHADER,frag),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,1,1,0,gl.RGBA,gl.FLOAT,null);
   const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete float framebuffer');
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.viewport(0,0,1,1);
   const location=name=>gl.getUniformLocation(program,name),output=[];
   for(const sample of samples){
    for(const [name,value]of Object.entries({sampleP:sample.p,sampleN:sample.n,seed:sample.seed,surface:sample.surface,detail:sample.detail}))gl.uniform3fv(location(name),value);
    gl.uniform1f(location('footprint'),sample.footprint);gl.uniform1f(location('stretch'),sample.stretch);const channels=[];
    for(const channel of [0,1]){gl.uniform1f(location('channel'),channel);gl.drawArrays(gl.TRIANGLES,0,3);const values=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,values);channels.push(...values);}
    output.push(channels);
   }
   const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('WebGL error '+error);return output;
  },{shader:context.api.shader(),samples});
  let maximumHeightErrorM=0,maximumMaterialError=0;
  for(let i=0;i<samples.length;i++){
   const s=samples[i],cpu=context.api.evaluate(s.p,s.n,s.footprint,s.seed,s.surface,s.detail,s.stretch);
   const expected=[...cpu.pigment,cpu.heightM,cpu.roughness,cpu.oil,cpu.cavity,cpu.unresolvedVariance];
   for(let c=0;c<8;c++){
    const error=Math.abs(results[i][c]-expected[c]);if(!Number.isFinite(error))throw Error('Nonfinite GPU result');
    if(c===3){maximumHeightErrorM=Math.max(maximumHeightErrorM,error);if(error>3e-7)throw Error('GPU height differs at sample '+i+': '+error);}
    else{maximumMaterialError=Math.max(maximumMaterialError,error);if(error>3e-4)throw Error('GPU material differs at sample '+i+', channel '+c+': '+error);}
   }
  }
  console.log(JSON.stringify({schema:'human/skin_shader_test@1',samples:samples.length,channels:8,
    maximumHeightErrorM,maximumMaterialError,gpuCompiled:true,gpuExecuted:true,visualAcceptance:false}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
