const fs=require('fs'),path=require('path'),crypto=require('crypto'),esbuild=require('esbuild'),vm=require('vm');
const d=__dirname,old=path.resolve(d,'../r01');
const baseline=fs.readFileSync(old+'/index.html','utf8');
const blob=crypto.createHash('sha1').update('blob '+Buffer.byteLength(baseline)+'\0').update(baseline).digest('hex');
if(blob!=='cc0787f3189fc60e617ef9d372abfc9da62d54ac')throw Error('R01.2 baseline differs');
const part=(a,b)=>baseline.slice(baseline.indexOf(a),baseline.indexOf(b,baseline.indexOf(a)));
const read=n=>fs.readFileSync(d+'/'+n,'utf8');
let tail=part('function target(','</script>');
function swap(a,b){if(!tail.includes(a))throw Error('Missing R01 integration anchor: '+a);tail=tail.replaceAll(a,b);}
swap('function initPost(){fullRT=target(true);','function initPost(){albedoRT=target(true);fullRT=target(true);');
swap('uniforms:{tColor:{value:null},tDepth:{value:diffRT.depthTexture},','uniforms:{tColor:{value:null},tAlbedo:{value:albedoRT.texture},firstPass:{value:1},kernel:{value:diffusionKernel()},tDepth:{value:diffRT.depthTexture},');
swap('uniforms:{tFull:{value:fullRT.texture},','uniforms:{tAlbedo:{value:albedoRT.texture},tFull:{value:fullRT.texture},');
swap('[fullRT,diffRT,blurA,blurB]','[fullRT,diffRT,blurA,blurB,albedoRT]');
swap('function lighting(){','function lighting(){entryDirty=true;');
swap('e=.38,keyI=2.05,fillI=.14,rimI=.5,env=.32;','e=.35,keyI=2.45,fillI=.10,rimI=.45,env=.22;');
swap('function apply(){','function apply(){E.uMeso.value=values.meso;E.uMicro.value=values.micro;E.uRelief.value=values.relief;E.uTranslucency.value=values.translucency;entryDirty=true;');
swap('skin.clearcoatRoughness=.4-values.oil*.2;','skin.clearcoatRoughness=.36-values.oil*.14;');
swap('if(!state.ready)return;renderer.shadowMap.autoUpdate=false;','if(!state.ready)return;renderEntry();renderer.shadowMap.autoUpdate=false;fuzz.material.uniforms.uLightDir.value.copy(E.uKeyDirection.value).transformDirection(camera.matrixWorldInverse);fuzz.material.uniforms.uLightPower.value=key.intensity;fuzz.material.uniforms.uPixelHeight.value=fullRT.height;');
swap('U.uPass.value=0;const sssActive=','U.uPass.value=2;renderer.setRenderTarget(albedoRT);renderer.clear();renderer.render(scene,camera);U.uPass.value=0;const sssActive=');
swap('quad.material=blurMaterial;blurMaterial.uniforms.tColor.value=diffRT.texture;','quad.material=blurMaterial;blurMaterial.uniforms.firstPass.value=1;blurMaterial.uniforms.tColor.value=diffRT.texture;');
swap('blurMaterial.uniforms.tColor.value=blurA.texture;','blurMaterial.uniforms.firstPass.value=0;blurMaterial.uniforms.tColor.value=blurA.texture;');
swap('const [gltf,albedo,normal,height,spec]=','const [gltf,albedo,normal,height,spec,mesoMap,microMap,surfaceMap]=');
swap("load('./assets/hires/normal-4k.png')","load('./assets/normal.jpg')");
swap("load('./assets/specular.jpg')]);","load('./assets/specular.jpg'),load('./new-assets/meso.webp'),load('./new-assets/micro.webp'),load('./new-assets/surface.webp')]);E.uMesoMap.value=mesoMap;E.uMicroMap.value=microMap;E.uSurface.value=surfaceMap;");
swap('makeFuzz(geo);initPost();','makeFuzz(geo);initEntry();initPost();');
swap('let v=Number(o.values[k]),el=$(k);','let v=Number(o.values[k]??defaults[k]),el=$(k);');
swap('window.__SKIN_LAB__.camera=()=>','window.__SKIN_LAB__.setView=(p,t)=>{camera.position.set(...p);controls.target.set(...t);controls.update();dirty=true;};window.__SKIN_LAB__.camera=()=>');
tail=tail.replaceAll('./assets/','../r01/assets/').replaceAll('./new-assets/','./assets/').replaceAll('skin-quality-lab-r01','skin-quality-lab-r02');
let js=[read('head.js'),read('surface.js'),part('function makeEnvironment()','function makeFuzz('),read('fuzz.js'),read('diffusion.js'),part('const quadVertex=','const blurFragment='),read('post.js'),tail].join('\n');
let frame=baseline.slice(0,baseline.indexOf('<script type="module">'));
frame=frame.replaceAll('./vendor/','../r01/vendor/').replaceAll('./assets/','../r01/assets/').replaceAll('R01.2 · 4K / 16-BIT','R02 · TISSUE').replaceAll('皮肤质感实验室 · R01','皮肤质感实验室 · R02').replaceAll('扫描凹凸细节','基础扫描法线').replaceAll('红通道扩散半径','组织扩散尺度').replaceAll('皮肤 / 微观观察','R02 / 看见皮肤的层次');
function control(name,label,max,value){return `<div class="control"><label for="${name}">${label}<output id="${name}Out"></output></label><input id="${name}" type="range" min="0" max="${max}" step="0.01" value="${value}"></div>`;}
frame=frame.replace('<div class="control"><label for="pores">',control('meso','细皱纹 / 中尺度',1.8,.7)+control('micro','扫描微孔 / 高频',2,.8)+control('relief','真实表面位移幅度',1.5,.7)+'<div class="control"><label for="pores">');
frame=frame.replace('<p class="hint">深度约束',control('translucency','薄部透光',1.5,.65)+'<p class="hint">深度约束');
frame=frame.replace('深度约束的屏幕空间 RGB 扩散 + 薄部透光近似。高光独立保留，不是给整张画面加模糊。','25 点 RGB 扩散核；颜色与光扩散分离。透光读取光源方向的几何厚度，替代固定红色耳部遮罩。仍是实时近似。');
frame=frame.replace('质量实验，尚非 Kyka 复刻验收。','R02：分频细节 / 保色散射 / 几何厚度透光。Kyka 等级仍待验收。').replace('原色 4K；法线由真实 8K、16 位扫描位移与原法线合成至 4K。反射参考 1K。','原色 4K；真实 8K / 16 位位移分为中频、高频与几何起伏，各自独立控制。反射参考 1K。').replace(' · <a href="https://artefactvfx.com',' · <a href="./THIRD_PARTY.txt" target="_blank">SSS 来源</a> · <a href="https://artefactvfx.com');
for(const f of fs.readdirSync(d).filter(n=>/^tune-.*\.json$/.test(n)).sort()){for(const [a,b] of JSON.parse(read(f)).replace){if(!js.includes(a))throw Error('Tuning anchor absent');js=js.replaceAll(a,b);}}
fs.writeFileSync(d+'/app.js',js);fs.writeFileSync(d+'/index.html',frame+'<script type="module" src="./app.js"></script></body></html>');
const code=esbuild.buildSync({stdin:{contents:js,resolveDir:d,loader:'js'},bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{'three':old+'/vendor/three.module.js','three/addons':old+'/vendor/addons'}}).outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
if(process.env.ASSET_COMMIT){
 const root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+process.env.ASSET_COMMIT+'/skin-quality-lab/';
 let preview=frame.replace(/<script type="importmap">[\s\S]*?<\/script>/,'')+'<script>'+code+'</script></body></html>';
 preview=preview.replaceAll('../r01/assets/',root+'r01/assets/').replaceAll('./assets/',root+'r02/assets/').replaceAll('../r01/vendor/',root+'r01/vendor/').replaceAll('./THIRD_PARTY.txt',root+'r02/THIRD_PARTY.txt');
 fs.writeFileSync(d+'/preview.html',preview);
}
console.log('R02 source built',Buffer.byteLength(js));
