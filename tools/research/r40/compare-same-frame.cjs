'use strict';
// Compare the legacy and MRT materials on the very same ray hits, textures,
// camera and shadows. The diagnostic hooks exist only in this intercepted page.
const fs=require('fs'),{replace}=require('../r32/render-integration.cjs'),{patch}=require('./patch-skin-mrt.cjs');
const {chromium}=require(process.env.BODY_PLAYWRIGHT_PATH||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ready=p=>p.waitForFunction(()=>bodyImplicitR02?.report().ready&&!bodyImplicitR02.report().busy,null,{timeout:300000});
let dynamic=patch(fs.readFileSync(JSON.parse(fs.readFileSync('BUILD-STUDY-R39.json','utf8')).file,'utf8'));
let hook=`testMaterialsR40(){
 if(!mrtEnabled||!surface||!lastCamera)throw Error('皮肤对照尚未就绪');
 const keep=skin,legacy=program(vertex,makeFragment(pack.fragment)),savedPrecise=lastPrecise;
 function capture(){gl.finish();gl.bindFramebuffer(gl.FRAMEBUFFER,null);const pixels=new Uint8Array(size[0]*size[1]*4);gl.readPixels(0,0,...size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const layers=targets.slice(0,3).map(t=>{gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);const p=new Float32Array(size[0]*size[1]*4);gl.readPixels(0,0,...size,gl.RGBA,gl.FLOAT,p);return p;});gl.bindFramebuffer(gl.FRAMEBUFFER,null);return{pixels,layers};}
 function uniforms(program){const result={};for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i),v=gl.getUniform(program,gl.getUniformLocation(program,u.name));result[u.name]=ArrayBuffer.isView(v)?Array.from(v):v;}delete result.uFPass;return result;}
 function compare(a,b){let pixels=0,above1=0,max=0;for(let i=0;i<a.pixels.length;i+=4){const d=Math.max(Math.abs(a.pixels[i]-b.pixels[i]),Math.abs(a.pixels[i+1]-b.pixels[i+1]),Math.abs(a.pixels[i+2]-b.pixels[i+2]));if(d)pixels++;if(d>1)above1++;max=Math.max(max,d);}const layers=a.layers.map((x,n)=>{let diff=0,max=0;for(let i=0;i<x.length;i++){const d=Math.abs(x[i]-b.layers[n][i]);if(!Number.isFinite(d))throw Error('非有限皮肤数值');if(d)diff++;max=Math.max(max,d);}return{diff,max};});return{pixels,above1,max,layers};}
 try{render(surface,lastCamera,savedPrecise);const a=capture();render(surface,lastCamera,savedPrecise);const a2=capture(),ua=uniforms(keep);skin=legacy;mrtEnabled=false;refreshSkinUniforms();render(surface,lastCamera,savedPrecise);const b=capture();render(surface,lastCamera,savedPrecise);const b2=capture(),ub=uniforms(legacy),uniformDifferences=Object.keys({...ua,...ub}).filter(k=>JSON.stringify(ua[k])!==JSON.stringify(ub[k])).map(k=>({name:k,mrt:ua[k],legacy:ub[k]}));skin=keep;mrtEnabled=true;refreshSkinUniforms();render(surface,lastCamera,savedPrecise);const c=capture();return{legacy:compare(a2,b),repeatBefore:compare(a,a2),repeatLegacy:compare(b,b2),repeat:compare(a2,c),uniformDifferences,error:gl.getError()};}finally{skin=keep;mrtEnabled=true;refreshSkinUniforms();gl.deleteProgram(legacy);}
},`;
// Diagnostic control: compare two separately compiled copies of the previous
// shader on exactly the same inputs, to distinguish baseline instability.
if(process.env.BODY_COMPARE_LEGACY_CLONES==='1'){
 hook=replace(hook,'try{render(surface,lastCamera,savedPrecise);const a=capture();','let clone=null;try{clone=program(vertex,makeFragment(pack.fragment));skin=clone;mrtEnabled=false;refreshSkinUniforms();render(surface,lastCamera,savedPrecise);const a=capture();');
 hook=replace(hook,'const a2=capture(),ua=uniforms(keep);','const a2=capture(),ua=uniforms(clone);');
 hook=replace(hook,'skin=keep;mrtEnabled=true;refreshSkinUniforms();render(surface,lastCamera,savedPrecise);const c=capture();','skin=clone;mrtEnabled=false;refreshSkinUniforms();render(surface,lastCamera,savedPrecise);const c=capture();');
 hook=replace(hook,'gl.deleteProgram(legacy);}','gl.deleteProgram(legacy);if(clone)gl.deleteProgram(clone);}');
}
dynamic=replace(dynamic,'return{setDynamicShadowsR35(value){','return{'+hook+'setDynamicShadowsR35(value){');
dynamic=replace(dynamic,'):null;shadowRenderer=originalRenderer?BodyDynamicShadowsR35.create(gl','):null;globalThis.__BODY_TEST_SKIN_R40__=originalRenderer;shadowRenderer=originalRenderer?BodyDynamicShadowsR35.create(gl');
const scenarios=[
 {rig:'anny',shape:{'shape.weight':.45,'shape.muscle':.65,'shape.age':.55,'shape.sex':.4},motion:'neutral',skin:null,cameras:[['front',0,1.8,[0,0,0]],['side',1.57,1.8,[0,0,0]],['close',.12,.5,[0,.22,.04]]]},
 {rig:'anny',shape:{'shape.weight':1,'shape.muscle':.12,'shape.age':.75,'shape.sex':.7},motion:'bend',skin:{originalRoughness:.7,originalOil:.2,originalGraphPores:2.2,originalWrinkles:2.1},cameras:[['front',.1,1.25,[0,-.16,0]],['side',1.57,1.25,[0,-.16,0]]]},
 {rig:'mhr',shape:{'shape.weight':.04,'shape.muscle':.9,'shape.age':1,'shape.sex':.8},motion:'bend',skin:{originalRoughness:.38,originalOil:.6,originalTone:.48,originalScatter:.8},cameras:[['front',.1,1.35,[0,-.1,0]],['back',3.14,1.6,[0,0,0]]]}
];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BODY_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--enable-unsafe-swiftshader']});const checks=[],errors=[];
 try{const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{let p;try{p=decodeURIComponent(new URL(route.request().url()).pathname);}catch{return route.continue();}return p==='/身体_R40_皮肤候选.html'?route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:dynamic}):route.continue();});
  await page.goto('http://127.0.0.1:8917/workbench',{waitUntil:'domcontentloaded'});await ready(page);
  for(const group of scenarios){if(group.rig==='mhr'){await page.evaluate(()=>bodyImplicitR02.setOwner('mhr'));await ready(page);}await page.evaluate(shape=>bodyControlR17.apply({set:shape,label:'同帧皮肤对照'}),group.shape);await ready(page);await page.evaluate(m=>bodyImplicitR02.motion(m),group.motion);await ready(page);if(group.skin)await page.evaluate(s=>bodyImplicitR02.renderer.appearance(s),group.skin);
   for(const [name,yaw,distance,target] of group.cameras){await page.evaluate(c=>bodyImplicitR02.setCamera(c),{yaw,pitch:0,distance,target});await page.waitForFunction(()=>!!document.querySelector('#body-dynamic-embedded-p1')?.contentWindow?.torsoStudyP1?.renderer.precisionFrame(),null,{timeout:300000});
    const x=await page.evaluate(()=>{const w=document.querySelector('#body-dynamic-embedded-p1').contentWindow,r=w.torsoStudyP1.renderer;return{comparison:w.__BODY_TEST_SKIN_R40__.testMaterialsR40(),shadowUnknown:r.report().dynamicShadow.unknownPixels};});
    const q=x.comparison,passed=q.error===0&&x.shadowUnknown===0&&q.legacy.max<=1&&q.repeat.max<=1&&q.repeatBefore.max<=1&&q.repeatLegacy.max<=1;checks.push({id:group.rig+'-'+group.motion+'-'+name,passed,...x});process.stderr.write(JSON.stringify(checks.at(-1))+'\n');
    if(process.env.BODY_COMPARE_LIMIT&&checks.length>=Number(process.env.BODY_COMPARE_LIMIT))break;
   }
   if(process.env.BODY_COMPARE_LIMIT&&checks.length>=Number(process.env.BODY_COMPARE_LIMIT))break;
  }
 }catch(e){errors.push(e.stack);}finally{await browser.close();const expected=process.env.BODY_COMPARE_LIMIT?Number(process.env.BODY_COMPARE_LIMIT):7,clones=process.env.BODY_COMPARE_LEGACY_CLONES==='1',out={passed:errors.length===0&&checks.length===expected&&checks.every(c=>c.passed),checks,errors,note:clones?'Two separately compiled copies of the prior shader on identical inputs in one context.':'Isolated experimental MRT and three-pass skin were rendered sequentially using identical geometry, materials, lights and shadows in the same context. Pixel differences are 8-bit RGB levels; layers are float outputs. The experimental shader is not selected for delivery.'};fs.mkdirSync('qa/skin-r40',{recursive:true});fs.writeFileSync('qa/skin-r40/'+(clones?'diagnostic-legacy-clones.json':process.env.BODY_COMPARE_LIMIT?'experiment-mrt-diagnostic.json':'experiment-mrt-same-frame.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));if(!out.passed)process.exitCode=1;}
})();
