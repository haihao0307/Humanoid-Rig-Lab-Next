const fs=require('fs'),path=require('path'),crypto=require('crypto'),esbuild=require('esbuild'),vm=require('vm');
const d=__dirname,r02=path.resolve(d,'../r02'),r01=path.resolve(d,'../r01');
const read=n=>fs.readFileSync(path.join(d,n),'utf8');
const source=fs.readFileSync(r02+'/app.js','utf8');
let js=source,html=fs.readFileSync(r02+'/index.html','utf8');
function patch(a,b){if(!js.includes(a))throw Error('Missing inherited renderer anchor: '+a);js=js.replaceAll(a,b);}
patch("import * as THREE from 'three';","import * as THREE from 'three';\nimport {EMILY_REFERENCE,emilyDirectDiffuse,applyTransferFeatures} from './EmilyTransferKernel.js';");
patch("VERSION='skin-quality-lab/r02.1'","VERSION='emily-transfer/1.0.0'");
patch('occlusion:.9};','occlusion:.9,wrap:1};');
patch('const values={...defaults};','const values={...defaults};\nconst transfer={method:"emily",mode:"full",split:.5,features:{diffusion:true,reflection:true,detail:true,transmission:true,fuzz:true}};');
patch("document.title='皮肤质感实验室 · R02.1'","document.title='Emily 皮肤迁移 · Lee / ET01'");
patch("'R02.1 · MICRO SKIN'","'ET01 · LIVE 3D'");patch("'皮肤 / 近景与微结构'","'另一张脸，同一种皮肤语言'");
patch('Object.assign(U,E);','Object.assign(U,E);U.uEmilyMethod={value:1};U.uWrapAmount={value:1};');
patch('uniform float uPass,uDetail,','uniform float uEmilyMethod,uWrapAmount;\nuniform float uPass,uDetail,');
const oldLight=/physical=physical\.replace\('reflectedLight\.directDiffuse \+= irradiance \* BRDF_Lambert\( material\.diffuseColor \);',`[\s\S]*?`\);/;
if(!oldLight.test(js))throw Error('Missing direct-diffuse shader anchor');
js=js.replace(oldLight,"physical=physical.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',emilyDirectDiffuse);");
patch('lighting()}for(const id of Object.keys(defaults))','lighting();syncTransfer()}for(const id of Object.keys(defaults))');
patch('U.uBaseline.value=on?1:0;','U.uBaseline.value=0;');
patch('function render(){','function renderOne(destination=null){');
patch('renderer.setRenderTarget(null);renderer.render(postScene,postCamera);state.frames++;dirty=false;','renderer.setRenderTarget(destination);renderer.render(postScene,postCamera);dirty=false;');
patch("const sssActive=values.sss>0&&!compareHeld&&['beauty','diffuse'].includes(state.layer)","const sssActive=transfer.method==='enhanced'&&transfer.features.diffusion&&values.sss>0&&!compareHeld&&['beauty','diffuse'].includes(state.layer)");
patch('state.ready=true;render();','state.ready=true;unlockTransfer();render();');
patch("source:'Lee Perry-Smith CC BY 3.0 scan; hybrid procedural shading',calibratedBiology:false","source:'Lee Perry-Smith CC BY 3.0 scan; hybrid procedural shading',transfer:transferSnapshot(),calibratedBiology:false");
patch("if(o.schema!=='kaopu/skin-lookdev@1'||!o.values)throw new Error('不是本实验台的参数文件');","if(o.schema!=='kaopu/skin-lookdev@1'||!o.values)throw new Error('不是本实验台的参数文件');restoreTransfer(o.transfer);");
patch("'skin-quality-lab-r02'","'emily-transfer-et01'");
patch('apply();init().catch(fail);',read('transfer-runtime.js')+'\napply();init().catch(fail);');
// The asset paths now refer to the two preserved sibling releases.
js=js.replaceAll('./assets/','../r02/assets/');
html=html.replace(/<title>.*?<\/title>/,'<title>Emily 皮肤迁移 · Lee / ET01</title>')
 .replace('<h1>皮肤质感实验室</h1>','<h1>皮肤迁移实验台</h1>')
 .replace('SKIN · LIGHT · MICROSTRUCTURE','EMILY METHOD → ANOTHER FACE')
 .replace('R02 · TISSUE','ET01 · LIVE 3D')
 .replace('R02 / 看见皮肤的层次','另一张脸，同一种皮肤语言')
 .replace('按住看基础材质','按住对照')
 .replace('按住时关闭程序微孔、散射和油脂层，保持相同灯光与相机','按住关闭附加材质层；保持同一模型、肤色、灯光与相机')
 .replace('基础 PBR 对照 · 同灯光 / 同相机','基础 PBR · 同形 / 同色 / 同光')
 .replace('载入扫描参考与分层皮肤','载入另一人物的扫描皮肤与实时材质')
 .replace('所有运行资源随页面固定版本提供','首次载入包含高分辨率纹理；之后旋转与调节在浏览器中运行');
const panel=`<div class="section transfer-section">
<h2>皮肤方法迁移 <small>00 / TRANSFER</small></h2>
<p class="target-label">目标：LEE PERRY-SMITH <span>非 Emily 模型</span></p>
<div class="presets"><button data-method="emily" class="active" aria-pressed="true">Emily 参考思路</button><button data-method="enhanced" aria-pressed="false">增强皮肤</button></div>
<p id="methodNote" class="hint"></p>
<label class="selector-label" for="transferMode">对照方式</label>
<select id="transferMode"><option value="full">完整皮肤</option><option value="split">左右划线对照</option><option value="base">基础 PBR 材质</option></select>
<div id="wipeControl" class="control" hidden><label for="wipe">拖动对照分界 <output id="wipeOut">50%</output></label><input id="wipe" type="range" min="2" max="98" step="1" value="50"></div>
<div class="feature-grid">
<label><input id="feature-diffusion" type="checkbox" checked>包裹光 / 扩散</label>
<label><input id="feature-detail" type="checkbox" checked>微孔与细纹</label>
<label><input id="feature-reflection" type="checkbox" checked>皮脂反射层</label>
<label data-advanced><input id="feature-transmission" type="checkbox" checked>薄部透光</label>
<label data-advanced><input id="feature-fuzz" type="checkbox" checked>微绒毛</label>
</div>
<div class="control"><label for="wrap">Emily 包裹光强度<output id="wrapOut"></output></label><input id="wrap" type="range" min="0" max="1" step="0.01" value="1"></div>
<p class="hint">对照不改变模型、肤色或灯光。增强版才启用额外的屏幕空间扩散与透光；灰字功能在参考模式下不启用。</p>
</div>`;
html=html.replace('<aside class="side" aria-label="皮肤与光线参数">','<aside class="side" aria-label="皮肤与光线参数">'+panel);
html=html.replace('<div id="layerLabel">','<div id="currentMethod" class="method-badge">EMILY 思路 / 迁移到 LEE</div><div id="splitLine" role="separator" aria-label="对照分界" hidden></div><div id="splitLabels" hidden><span>基础 PBR</span><span>完整皮肤</span></div><div id="layerLabel">');
html=html.replace(/<div class="credits">[\s\S]*?<\/div>/,`<div class="credits"><strong>不同模型，独立运行。</strong><br>扫描：Lee Perry-Smith / Infinite，CC BY 3.0。<br>参考：<a href="https://alteredqualia.com/xg/examples/emily.html" target="_blank" rel="noopener">alteredqualia · Digital Emily</a>。未加载原站模型、纹理或引擎。<br>渲染继承本库 R02，参考方法是 GGX 重实现，不是 XG 原码移植。<br><a href="../r02/THIRD_PARTY.txt" target="_blank" rel="noopener">资产与 SSS 许可</a> · <a href="https://threejs.org/" target="_blank" rel="noopener">Three.js</a><br>本页只验材质；不代表参数化全身人物已完成整合。</div>`);
html=html.replace('</style>',`\n[hidden]{display:none!important}.transfer-section{background:linear-gradient(150deg,#2a2825,#1c1f25 75%)}.target-label{font-size:10px;color:#ddd0bd;letter-spacing:.5px;margin:0 0 12px}.target-label span{display:block;color:#9099a3;font-size:10px;margin-top:3px}.selector-label{display:block;color:#bfc3c9;font-size:11px;margin:12px 0 6px}.feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 4px;margin-top:13px;font-size:10px;color:#c3c6ca}.feature-grid label{display:flex;align-items:center;gap:3px}.feature-grid input{margin:0;width:13px;height:13px}.inactive{opacity:.43}.method-badge{position:absolute;top:104px;left:25px;font-size:10px;letter-spacing:1px;color:#818b97;pointer-events:none}#splitLine{position:absolute;top:140px;bottom:85px;width:14px;transform:translateX(-50%);z-index:3;cursor:ew-resize;touch-action:none}#splitLine:before{content:"";position:absolute;left:6px;top:0;bottom:0;width:1px;background:#e3c59c99}#splitLine:after{content:"↔";position:absolute;left:-7px;top:50%;padding:5px 7px;color:#ebd4b2;background:#22272bd9;border:1px solid #ac9877;border-radius:50%}#splitLabels{position:absolute;top:132px;left:25px;right:25px;display:flex;justify-content:space-between;color:#c5b395;font-size:10px;pointer-events:none}button:disabled,select:disabled,input:disabled{opacity:.48;cursor:wait}body.clean .method-badge,body.clean #splitLabels{display:none}@media(max-width:760px){.method-badge{top:91px;left:15px}#splitLabels{top:116px;left:15px;right:15px}#splitLine{top:138px}h1{font-size:13px}.subtitle{letter-spacing:1px}}
</style>`);
fs.writeFileSync(d+'/app.js',js);fs.writeFileSync(d+'/index.html',html);
const bundled=esbuild.buildSync({entryPoints:[d+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}}).outputFiles[0].text;
new vm.Script(bundled);
const commit=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('ASSET_COMMIT must be an immutable Git commit');
const root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/';
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>','<script>'+bundled.replace(/<\/script/gi,'<\\/script')+'</script>');
preview=preview.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/');
fs.writeFileSync(d+'/preview.html',preview);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
fs.writeFileSync(d+'/BUILD_MANIFEST.json',JSON.stringify({version:'ET01',codeVersion:'emily-transfer/1.0.0',sourceCommit:commit,assetCommit:commit,inheritedRenderer:'skin-quality-lab/r02/app.js',inheritedRendererSHA256:sha(source),generatedSHA256:sha(js),previewSHA256:sha(preview),target:'Lee Perry-Smith',originalEmilyAssetsIncluded:false,originalXGEngineIncluded:false,referenceMaterial:'XG.PhongMaterial',reimplementationSpecular:'Three.js GGX',defaultMethod:'emily',liveComparison:true,validation:'see qa-report.json',fullBodyIntegration:false},null,2));
console.log('TRANSFER_BUILD',JSON.stringify({bytes:Buffer.byteLength(preview),assetCommit:commit}));
