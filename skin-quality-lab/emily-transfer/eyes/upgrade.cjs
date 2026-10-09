const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const d=path.resolve(__dirname,'..'),r01=path.resolve(d,'../r01');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let js=fs.readFileSync(d+'/app.js','utf8'),html=fs.readFileSync(d+'/index.html','utf8');
const skinBaseHash=hash(js);if(skinBaseHash!=='a02c5de123de7f139aba072d7479062db8da1296459e0926b3130b7f03581e90')throw Error('ET01 source changed: build the preserved skin version before the eye upgrade');
function patch(a,b){if(!js.includes(a))throw Error('Missing ET01 anchor: '+a);js=js.replaceAll(a,b);}
// Canonicalize the initial parametric ring generator. The published module retains
// these corrections; subsequent builds are idempotent.
let eye=fs.readFileSync(__dirname+'/EyeSystem.js','utf8');
eye=eye.replace('indices.push(k,k+1,k+A+1,k+1,k+A+2,k+A+1);','indices.push(k,k+A+1,k+1,k+1,k+A+1,k+A+2);');
eye=eye.replace('smoothstep(.40,-.24,P.y)','(1.-smoothstep(-.24,.40,P.y))');
eye=eye.replace("const {c,lid,rim,lashes}=e,P=lid.mesh.geometry.attributes.position;","const {c,lid,rim,lashes}=e,P=lid.mesh.geometry.attributes.position;");
if(!eye.includes('e.lid.mesh.material.roughness=this.skin.roughness;'))eye=eye.replace('e.pivot.updateMatrixWorld(true);','e.lid.mesh.material.roughness=this.skin.roughness;e.lid.mesh.material.clearcoat=this.skin.clearcoat;e.lid.mesh.material.clearcoatRoughness=this.skin.clearcoatRoughness;e.lid.mesh.material.envMapIntensity=this.skin.envMapIntensity;e.pivot.updateMatrixWorld(true);');
fs.writeFileSync(__dirname+'/EyeSystem.js',eye);
patch("import * as THREE from 'three';","import * as THREE from 'three';\nimport {EyeSystem,EYE_VERSION} from './eyes/EyeSystem.js';");
patch("VERSION='emily-transfer/1.0.0'","VERSION='emily-transfer/2.0.0'");
patch('let renderer,scene,camera,controls,mesh,skin,','let eyesRig=null;let renderer,scene,camera,controls,mesh,skin,');
patch("document.title='Emily 皮肤迁移 · Lee / ET01'","document.title='皮肤与眼球 · ET02'");
patch("'ET01 · LIVE 3D'","'ET02 · EYES'");
patch("'另一张脸，同一种皮肤语言'","'皮肤与眼球 / 注视你'");
patch('makeFuzz(geo);initEntry();initPost();','makeFuzz(geo);initEntry();initializeEyes();initPost();');
patch('const moving=controls.update();','const moving=controls.update();if(eyesRig&&!window.__EYE_QA_FREEZE__){if(eyesRig.update(dt)){dirty=true;renderer.shadowMap.needsUpdate=true;}}');
patch('const bg=scene.background,cc=','const eyeVisibility=eyesRig?.group.visible;if(eyesRig)eyesRig.group.visible=false;const bg=scene.background,cc=');
patch('renderer.shadowMap.enabled=ss;entryDirty=false;','renderer.shadowMap.enabled=ss;if(eyesRig)eyesRig.group.visible=eyeVisibility;entryDirty=false;');
patch('const views={portrait:',"const views={eyes:{p:[.007,.076,narrow?.32:.25],t:[-.004,.069,.074]},iris:{p:[.043,.074,.171],t:[.0217,.069,.077]},portrait:");
patch('transfer:transferSnapshot(),calibratedBiology:false','transfer:transferSnapshot(),eyes:eyesRig?.snapshot(),calibratedBiology:false');
patch('restoreTransfer(o.transfer);','restoreEyes(o.eyes);restoreTransfer(o.transfer);');
patch('apply();init().catch(fail);',fs.readFileSync(__dirname+'/runtime.js','utf8')+'\napply();init().catch(fail);');
html=html.replace('<title>Emily 皮肤迁移 · Lee / ET01</title>','<title>皮肤与眼球 · ET02</title>').replace('<h1>皮肤迁移实验台</h1>','<h1>皮肤与眼球实验台</h1>').replaceAll('ET01 · LIVE 3D','ET02 · EYES');
html=html.replace('<button data-camera="cheek">','<button data-camera="eyes">双眼特写</button><button data-camera="iris">虹膜近景</button><button data-camera="cheek">');
function slider(id,label,min,max,step,v){return '<div class="control"><label for="eye-'+id+'">'+label+'<output id="eye-'+id+'Out"></output></label><input id="eye-'+id+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v+'"></div>';}
const panel=`<div class="section eye-section"><h2>眼球与视线 <small>ET02 / EYES</small></h2>
<div class="presets"><button data-eye-mode="camera" class="active">看向镜头</button><button data-eye-mode="pointer">跟随鼠标</button></div>
<select id="eyeMode" aria-label="注视方式" style="margin-top:9px"><option value="camera">看向镜头</option><option value="pointer">跟随鼠标 / 触点</option><option value="fixed">锁定空间目标</option><option value="relaxed">放松观察</option></select>
<div class="row" style="margin-top:8px"><button id="lockEye">锁定当前点</button><button id="blinkEye">眨眼测试</button></div>
<p id="eyeModeStatus" class="eye-status">双眼注视镜头</p>
<label class="selector-label" for="eyeIris">虹膜颜色</label><select id="eyeIris"><option value="blue">灰蓝 · 参考观感</option><option value="hazel">榛褐</option><option value="brown">深棕</option><option value="green">灰绿</option></select>
<div class="feature-grid"><label><input id="eye-enabled" type="checkbox" checked>安装新眼球</label><label><input id="eye-autoBlink" type="checkbox" checked>自然眨眼</label><label><input id="eye-autoPupil" type="checkbox" checked>瞳孔随光变化</label></div>
${slider('pupilMM','手动瞳孔直径',2,7.6,.1,3.6)}${slider('wetness','角膜湿润反射',0,1,.01,1)}${slider('opening','眼睑开合比例',.65,1.25,.01,1)}${slider('irisDepth','虹膜光学深度',.72,.91,.01,.83)}
<p class="hint">双眼朝同一个三维目标收敛；超出转眼范围时限幅。关闭“安装新眼球”可查看原始闭眼扫描。无需摄像头。</p>
</div>`;
html=html.replace('<aside class="side" aria-label="皮肤与光线参数">','<aside class="side" aria-label="皮肤与光线参数">'+panel);
html=html.replace('</style>','.eye-section{background:linear-gradient(145deg,#252e34,#1c1f25 80%)}.eye-status{margin:10px 0 0;color:#b6c9c6;font-size:11px}.top-tools{right:6px}.top-tools button{padding:6px 9px}@media(max-width:760px){.top-tools button{padding:4px 6px}#layerLabel{top:94px}.method-badge{top:118px}#splitLabels{top:139px}#splitLine{top:158px}}\n</style>');
html=html.replace('本页只验材质；不代表参数化全身人物已完成整合。','ET02：本头模新增独立光学眼球、拟合眼睑和双眼注视。眼球由参数生成，未加载原站眼球模型或贴图。并非 XG 逐像素移植；不代表全身人物已整合。');
fs.writeFileSync(d+'/app.js',js);fs.writeFileSync(d+'/index.html',html);
const bundled=esbuild.buildSync({entryPoints:[d+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}}).outputFiles[0].text;
new vm.Script(bundled);
const commit=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Immutable asset commit required');
const root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/';
let code=bundled.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/').replace(/<\/script/gi,'<\\/script');
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');
preview=preview.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/');
const scripts=[...preview.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];if(scripts.length!==1||scripts[0][1]!==code)throw Error('Final HTML script changed during packaging');new vm.Script(scripts[0][1]);fs.writeFileSync(d+'/preview.html',preview);
fs.writeFileSync(d+'/BUILD_MANIFEST.json',JSON.stringify({version:'ET02',codeVersion:'emily-transfer/2.0.0',eyeVersion:'eyes/1.0.0',assetCommit:commit,sourceCommit:commit,preservedET01SourceSHA256:skinBaseHash,eyeModuleSHA256:hash(eye),previewSHA256:hash(preview),finalHTMLSyntaxValidated:true,sourceHeadUnmodified:true,newEyeGeometry:'parametric, fitted to current scan',thirdPartyEyeAssets:0,ocularOptics:'corneal bulge + refracted iris lookup + wet specular',gaze:'shared 3D target, separate bounded binocular rotations',baselineURL:'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/a08f7fff098dad3a18fb655418660ddaae4ecb35/skin-quality-lab/emily-transfer/preview.html',fullBodyIntegration:false},null,2));
console.log('ET02_BUILD',JSON.stringify({bytes:Buffer.byteLength(preview),assetCommit:commit,base:skinBaseHash}));
