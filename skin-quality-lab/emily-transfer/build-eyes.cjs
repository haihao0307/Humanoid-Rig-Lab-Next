const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild'),cp=require('child_process');
const d=__dirname,read=n=>fs.readFileSync(d+'/'+n,'utf8');
cp.execFileSync(process.execPath,[d+'/build.cjs'],{env:process.env,stdio:'inherit'});
const originalApp=read('app.js'),originalHTML=read('index.html');
let js=originalApp,html=originalHTML;
function swap(a,b){if(!js.includes(a))throw Error('Missing ET01 anchor: '+a);js=js.replaceAll(a,b);}
swap("import * as THREE from 'three';","import * as THREE from 'three';\nimport {EyeRig,FIT,EYE_VERSION} from './eyes/EyeRig.js';\nlet eyes=null;");
swap("VERSION='emily-transfer/1.0.0'","VERSION='emily-transfer/2.0.0'");
swap("'ET01 · LIVE 3D'","'ET02 · EYES'");swap("'Emily 皮肤迁移 · Lee / ET01'","'Emily 皮肤与双眼 · ET02'");swap("'另一张脸，同一种皮肤语言'","'皮肤与双眼 / 视线锁定'");
swap('Object.assign(U,E);','U.uHeadToWorld={value:new THREE.Matrix4()};Object.assign(U,E);');
swap('uniform mat4 uKeyVP;','uniform mat4 uHeadToWorld;uniform mat4 uKeyVP;');
swap('float thickness=skinThickness(vSkinPosition-worldN*.00012);','float thickness=skinThickness((uHeadToWorld*vec4(vSkinPosition,1.)).xyz-worldN*.00012);');
swap('unlockTransfer();render();','unlockTransfer();eyeUI();render();');
swap('makeFuzz(geo);initEntry();initPost();','makeFuzz(geo);initEntry();initEyes();initPost();');
swap("controls.minDistance=.10;","controls.minDistance=.035;");
swap("const views={portrait:","const views={eyes:{p:[.003,.071,narrow?.34:.235],t:[-.001,.068,.070]},eye:{p:[.035,.070,.135],t:[.028,.068,.070]},portrait:");
swap("if(q.y<-.105||q.y>.155||q.z<-.055)continue;","if(q.y<-.105||q.y>.155||q.z<-.055)continue;if(q.z>.025&&q.y>.054&&q.y<.085&&Math.abs(q.x)>.010&&Math.abs(q.x)<.053)continue;");
swap('const moving=controls.update();','const moving=controls.update();if(eyes?.update(dt))dirty=true;');
// Use head-specific depth shaders on head and eyelid patches. Eyeballs never enter
// the skin diffusion/depth passes, so their highlights are not blurred like skin.
const a=js.indexOf('function renderEntry(){'),b=js.indexOf('\nconst quadVertex=',a);
if(a<0||b<0)throw Error('No depth pass boundary');
js=js.slice(0,a)+`function renderEntry(){
 if(!entryDirty)return;
 entryCamera.position.copy(key.position);entryCamera.lookAt(key.target.position);entryCamera.updateMatrixWorld();entryCamera.updateProjectionMatrix();E.uKeyVP.value.multiplyMatrices(entryCamera.projectionMatrix,entryCamera.matrixWorldInverse);E.uKeyDirection.value.copy(key.position).sub(key.target.position).normalize();E.uKeyEnergy.value.copy(key.color).multiplyScalar(key.intensity);
 const cc=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha(),fv=fuzz.visible,ss=renderer.shadowMap.enabled,old=mesh.material;
 fuzz.visible=false;mesh.material=entryMaterial;renderer.shadowMap.enabled=false;
 if(eyes){for(const e of eyes.eyes){e.group.visible=false;if(e.rim)e.rim.visible=false;e.lid.mesh.material=eyes.lidDepth;}}
 renderer.setClearColor(0xffffff,1);renderer.setRenderTarget(entryRT);renderer.clear();renderer.render(scene,entryCamera);
 mesh.material=old;if(eyes){for(const e of eyes.eyes){e.group.visible=eyes.config.enabled;if(e.rim)e.rim.visible=eyes.config.enabled;e.lid.mesh.material=eyes.patchMaterial;}}
 fuzz.visible=fv;renderer.setClearColor(cc,alpha);renderer.shadowMap.enabled=ss;entryDirty=false;
}
`+js.slice(b);
// A reference-only frame has no skin diffusion to compute. Preserve inspection
// passes when requested, but do not run five off-screen passes on every eye motion.
swap('renderer.shadowMap.needsUpdate=false;U.uPass.value=1;',`renderer.shadowMap.needsUpdate=false;
 if((transfer.method!=='enhanced'||!transfer.features.diffusion||compareHeld||values.sss<=0)&&!['specular','diffuse'].includes(state.layer)){
  quad.material=composeMaterial;composeMaterial.uniforms.strength.value=0;renderer.setRenderTarget(destination);renderer.render(postScene,postCamera);U.uPass.value=0;dirty=false;return;
 }
 U.uPass.value=1;`);
// Every render refreshes world/camera optical matrices; no motion advances in A/B passes.
swap('function render(){\n  if(!state.ready)return;','function render(){\n  if(!state.ready)return;\n  if(eyes)eyes.update(0);');
swap('function transferSnapshot(){return {method:', 'function transferSnapshot(){return {eyes:eyes?{...eyes.config,target:eyes.target.toArray()}:null,method:');
swap('function restoreTransfer(o){','function restoreTransfer(o){\n  if(eyes&&o?.eyes){eyes.set(o.eyes);if(o.eyes.mode===\'locked\'&&o.eyes.target)eyes.setTarget(o.eyes.target);eyeUI();}');
swap('apply();init().catch(fail);',read('eyes/ui-runtime.js')+'\napply();init().catch(fail);');
// Only explicit debug builds expose raw objects; never relied on in acceptance tests.
if(process.env.EYE_DEBUG)swap('state.ready=true;unlockTransfer();','window.__DEV__={THREE,mesh,skin,camera,controls,scene,renderer,U,E,eyes};state.ready=true;unlockTransfer();');
html=html.replaceAll('ET01 · LIVE 3D','ET02 · EYES').replace('Emily 皮肤迁移 · Lee / ET01','Emily 皮肤与双眼 · ET02').replace('另一张脸，同一种皮肤语言','皮肤与双眼 / 视线锁定');
html=html.replace('<button data-camera="ear">','<button data-camera="eyes">双眼近景</button><button data-camera="eye">眼球特写</button><button data-camera="ear">');
const ctrl=(id,label,min,max,step,value)=>`<div class="control"><label for="eye-${id}">${label}<output id="eye-${id}Out"></output></label><input id="eye-${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
const panel=`<div class="section eye-section"><h2>双眼与视线 <small>ET02 / EYES</small></h2><div class="gaze-buttons"><button data-gaze="camera" class="active">看向镜头</button><button data-gaze="pointer">跟随鼠标</button><button data-gaze="locked">锁定目标</button></div><p id="eyeStatus" class="eye-status">双眼看向镜头</p><p class="hint">跟随鼠标后，点“锁定目标”固定注视点；拖动头部观察，双眼仍看同一位置。无需摄像头。</p><div class="row"><button id="eye-blink">眨眼一次</button><button id="eye-reset">重置双眼</button></div><div class="eye-checks"><label><input id="eye-autoBlink" type="checkbox">自动眨眼</label><label><input id="eye-autoPupil" type="checkbox" checked>瞳孔响应灯光</label><label><input id="eye-headFollow" type="checkbox">头模轻微跟随</label><label><input id="eye-original" type="checkbox">对照原闭眼扫描</label></div><label class="selector-label" for="eye-iris">虹膜颜色</label><select id="eye-iris"><option value="blue">灰蓝 / Emily 参考</option><option value="hazel">榛绿</option><option value="brown">深棕</option><option value="gray">冷灰</option></select>
${ctrl('headYaw','头模左右转动',-22,22,1,0)}${ctrl('headPitch','头模俯仰',-12,12,1,0)}${ctrl('openness','眼睑开合',0,1.1,.01,1)}${ctrl('pupil','手动瞳孔半径',.16,.65,.01,.32)}${ctrl('wet','角膜湿润反光',0,1,.01,.92)}${ctrl('refraction','角膜折射',0,1,.01,1)}${ctrl('caustic','虹膜聚光',0,1.5,.01,.7)}<p class="hint">双眼独立转心，共用注视目标；凹入虹膜、凸出角膜与眼睑遮挡分别计算。极端侧视会限制转角，不会强行翻眼。</p></div>`;
html=html.replace('<aside class="side" aria-label="皮肤与光线参数">','<aside class="side" aria-label="皮肤与光线参数">'+panel);
html=html.replace('</style>',`\n.eye-section{background:linear-gradient(140deg,#242d33,#1c1f25 65%)}.gaze-buttons{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px}.gaze-buttons button{padding:6px 3px;font-size:10px}.eye-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px 5px;font-size:10px;margin-top:12px}.eye-checks label{display:flex;align-items:center;gap:3px}.eye-checks input{margin:0}.eye-status{font-size:11px;color:#e4cda9;margin:10px 0 0}.top-tools{max-width:calc(100% - 30px)}@media(max-width:760px){#layerLabel{top:92px}.method-badge{top:116px}#splitLabels{top:141px}#splitLine{top:166px}}
</style>`);
fs.writeFileSync(d+'/app.js',js);fs.writeFileSync(d+'/index.html',html);
const old=path.resolve(d,'../r01'),code=esbuild.buildSync({entryPoints:[d+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:old+'/vendor/three.module.js','three/addons':old+'/vendor/addons'}}).outputFiles[0].text;
new vm.Script(code);const commit=process.env.ASSET_COMMIT,root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/';
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>');preview=preview.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/');const scripts=[...preview.matchAll(/<script>([\s\S]*?)<\/script>/g)];if(scripts.length!==1)throw Error('Invalid inline script count');new vm.Script(scripts[0][1]);fs.writeFileSync(d+'/preview.html',preview);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');fs.writeFileSync(d+'/EYES_BUILD_MANIFEST.json',JSON.stringify({version:'ET02.0',codeVersion:'emily-transfer/2.0.0',parentRelease:'a08f7fff098dad3a18fb655418660ddaae4ecb35',assetCommit:commit,baseAppSHA256:sha(originalApp),appSHA256:sha(js),previewSHA256:sha(preview),originalHeadMeshChanged:false,originalSkinTexturesChanged:false,eyeMethod:'independent procedural cornea/iris and binocular target solver',originalEmilyEyeAssetsCopied:false,rawEyeRuntimeBytes:Buffer.byteLength(read('eyes/EyeRig.js')),requiresWebcam:false},null,2));console.log('ET02 eyes built',Buffer.byteLength(preview));
