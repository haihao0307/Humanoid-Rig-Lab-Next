const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const d=path.resolve(__dirname,'..'),r01=path.resolve(d,'../r01'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let eye=fs.readFileSync(__dirname+'/EyeSystem.js','utf8');
if(!eye.includes('// ET02 fitted calibration R2')){
 function edit(a,b){if(!eye.includes(a))throw Error('Missing eye calibration anchor '+a);eye=eye.replaceAll(a,b);}
 edit("EYE_VERSION='eyes/1.0.0'","EYE_VERSION='eyes/1.1.0'");edit('y:.0690,z:.0630','y:.0690,z:.0615');edit('y:.0690,z:.0628','y:.0690,z:.0613');edit('(ny>=0?.0067:-.0036)','(ny>=0?.0053:-.0031)');
 eye+='\n// ET02 fitted calibration R2\n';fs.writeFileSync(__dirname+'/EyeSystem.js',eye);
}
let upgrade=fs.readFileSync(__dirname+'/upgrade.cjs','utf8');
if(!upgrade.includes("if(!eye.includes('e.lid.mesh.material.roughness=this.skin.roughness;'))")){
 upgrade=upgrade.replace("eye=eye.replace('e.pivot.updateMatrixWorld(true);'","if(!eye.includes('e.lid.mesh.material.roughness=this.skin.roughness;'))eye=eye.replace('e.pivot.updateMatrixWorld(true);'");fs.writeFileSync(__dirname+'/upgrade.cjs',upgrade);
}
require('./upgrade.cjs');
let js=fs.readFileSync(d+'/app.js','utf8'),html=fs.readFileSync(d+'/index.html','utf8');
function patch(a,b){if(!js.includes(a))throw Error('Missing fitted-eye integration anchor: '+a);js=js.replaceAll(a,b);}
patch("import {EyeSystem,EYE_VERSION} from './eyes/EyeSystem.js';","import {EYE_VERSION} from './eyes/EyeSystem.js';\nimport {FittedEyes as EyeSystem} from './eyes/FittedEyes.js';");
patch('function initializeEyes(){','async function initializeEyes(){');patch('eyesRig.installDepth(entryMaterial,fuzz);','await eyesRig.ready;eyesRig.installDepth(entryMaterial,fuzz);mesh.customDepthMaterial=entryMaterial;');patch('initEntry();initializeEyes();initPost();','initEntry();await initializeEyes();initPost();');
patch('state.ready=true;unlockTransfer();render();','state.ready=true;unlockTransfer();syncEyeUI();eyesRig.update(0,true);render();');
patch('if(!state.ready)return;renderEntry();','if(!state.ready)return;if(eyesRig)for(const e of eyesRig.eyes){e.lid.mesh.material.roughness=skin.roughness;e.lid.mesh.material.clearcoat=skin.clearcoat;e.lid.mesh.material.clearcoatRoughness=skin.clearcoatRoughness;e.lid.mesh.material.envMapIntensity=skin.envMapIntensity;}renderEntry();');
html=html.replace('眼球由参数生成，未加载原站眼球模型或贴图。','眼球由参数生成；虹膜/巩膜细节使用 MakeHuman CC0 眼部色图，未加载 Emily 原站眼球模型或贴图。').replace('并非 XG 逐像素移植；','<a href="https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html" target="_blank" rel="noopener">眼图来源与 CC0</a>。并非 XG 逐像素移植；');
fs.writeFileSync(d+'/app.js',js);fs.writeFileSync(d+'/index.html',html);
const bundled=esbuild.buildSync({entryPoints:[d+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}}).outputFiles[0].text;
const commit=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Immutable asset commit required');
const root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/';
const code=bundled.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/').replace(/<\/script/gi,'<\\/script');new vm.Script(code);
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');preview=preview.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/');
const scripts=[...preview.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];if(scripts.length!==1||scripts[0][1]!==code)throw Error('Final embedded script mismatch');new vm.Script(scripts[0][1]);fs.writeFileSync(d+'/preview.html',preview);
const manifest=JSON.parse(fs.readFileSync(d+'/BUILD_MANIFEST.json','utf8'));Object.assign(manifest,{eyeVersion:'eyes/1.1.0',eyeModuleSHA256:hash(fs.readFileSync(__dirname+'/EyeSystem.js')),fittedEyeModuleSHA256:hash(fs.readFileSync(__dirname+'/FittedEyes.js')),generatedSHA256:hash(js),previewSHA256:hash(preview),thirdPartyEyeAssets:1,eyeTexture:'MakeHuman system grey_eye.png, CC0',eyeTextureSHA256:'ecb05613126036a3d017880fabbd570501c5f14032c186462d8f6e2d719f6c4f',cornealEnvelopeFit:true,eyeTopologyPreservesHeadVertices:true});fs.writeFileSync(d+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));
console.log('ET02_FITTED_BUILD',JSON.stringify({bytes:Buffer.byteLength(preview),sourceCommit:commit}));
