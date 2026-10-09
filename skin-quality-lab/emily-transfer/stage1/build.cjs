require('./closure-install.cjs');
// Reproducible ET08 stage-one build. Always patches the USER-SPECIFIED source,
// never a stale ET01/ET04 installer or the branch's previous generated bundle.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'..'),BASE='5be35195ad40d57507f7ab1785e4eecda6c648de',PREFIX='skin-quality-lab/emily-transfer/';
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function baseFile(name){
 if(process.env.ET08_LOCAL_BASE)return fs.readFileSync(path.join(process.env.ET08_LOCAL_BASE,name),'utf8');
 try{return cp.execFileSync('git',['show',BASE+':'+PREFIX+name],{encoding:'utf8',maxBuffer:12e6});}
 catch(e){cp.execFileSync('git',['fetch','--depth=1','origin',BASE],{stdio:'inherit'});return cp.execFileSync('git',['show',BASE+':'+PREFIX+name],{encoding:'utf8',maxBuffer:12e6});}
}
const original=baseFile('app.js');assert.equal(hash(original),'98e90e9d3633b03362c8ca5a9593a836d4f03b3b810b88d1f42741fda49e92fb','Wrong takeover source');
let app=original,html=baseFile('index.html');
function replace(a,b){assert.equal(app.split(a).length,2,'Expected one integration anchor: '+a);app=app.replace(a,()=>b);}
replace("import {EYE_VERSION,IntegratedEyes as EyeSystem} from './talkinghead/IntegratedEyes.js';","import {EYE_VERSION,ContourEyes as EyeSystem} from './stage1/ContourEyes.js';\nimport {createGrayReview} from './stage1/GrayReview.js';\nlet stage1View=null;");
replace("VERSION='emily-transfer/7.3.0'","VERSION='emily-transfer/8.0.1-s1'");
replace('function render(){\n  if(!state.ready)return;','function render(){\n  if(!state.ready)return;\n  if(stage1View){stage1View.render();state.frames++;dirty=false;return;}');
replace('syncEyeUI();eyesRig.update(0,true);render();','syncEyeUI();eyesRig.update(0,true);stage1View=createGrayReview({rig:eyesRig,mesh,skin,fuzz,renderer,scene,camera,controls,key,fill,rim,state,requestRender:()=>{dirty=true;renderer.shadowMap.needsUpdate=true;},setCamera});render();');
html=html.replace(/<title>[^<]*<\/title>/,'<title>闭眼表面修复 · ET08-S1.1</title>');
fs.writeFileSync(ROOT+'/app.js',app);fs.writeFileSync(ROOT+'/index.html',html);
const r01=path.resolve(ROOT,'../r01');
const result=esbuild.buildSync({entryPoints:[ROOT+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}});
const inputs=Object.keys(result.metafile.inputs);assert.equal(inputs.filter(p=>/three\.core\.js$/.test(p)).length,1);
assert(!inputs.some(p=>/(^|\/)talkinghead\.mjs$|playback-worklet|dynamicbones|retargeter/.test(p)),'Full unrelated upstream runtime imported');
const assetRoot='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+BASE+'/skin-quality-lab/';
const code=result.outputFiles[0].text.replaceAll('../r01/',assetRoot+'r01/').replaceAll('../r02/',assetRoot+'r02/').replace(/<\/script/gi,'<\\/script');
new vm.Script(code);
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');
preview=preview.replaceAll('../r01/',assetRoot+'r01/').replaceAll('../r02/',assetRoot+'r02/');
const upstream=fs.readFileSync(ROOT+'/talkinghead/vendor/TalkingHeadBehavior.mjs','utf8');
const notice=upstream.match(/^\/\*\*[\s\S]*?\*\//)?.[0];assert(notice&&notice.includes('MIT License'));
preview=preview.replace('</head>',()=>'<!--\n'+notice.replaceAll('-->','-- >')+'\n-->\n</head>');
const scripts=[...preview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];assert.equal(scripts.length,1);assert.equal(scripts[0][1],code);new vm.Script(scripts[0][1]);
fs.writeFileSync(ROOT+'/preview.html',preview);
const manifest={schema:'kaopu/eye-contour-stage1-build@1',version:'ET08-S1.1',codeVersion:'emily-transfer/8.0.1-s1',eyeVersion:'eyes/8.0.1-s1',baseline:BASE,assetCommit:BASE,baselineAppSHA256:hash(original),appSHA256:hash(app),previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),finalEmbeddedScriptSHA256:hash(code),finalHTMLSyntaxValidated:true,oneThreeCore:true,oneRenderer:true,hostAnimationLoopOnly:true,sourceHeadMeshChanged:false,sourceSkinTexturesChanged:false,globeRadiusChanged:false,globeDepthFitChanged:false,irisRadiusChanged:false,defaultView:'gray contour / no skin maps or ocular optics',independentLeftRightContourSplines:true,closedOuterSurfaceAnchoredToCapturedScan:true,canthalDepthAnchoredToCapturedScan:true,closureSurfaceRegression:true,sharedClosureCurvePerEye:true,existingCanthalAndSectionalGeometryPreserved:true,stage2AnatomyRebuilt:false,stage3MaterialCoordinatesRebuilt:false,stage4DynamicsRebuilt:false,stage5OpticsRebuilt:false,personSpecificOpenScanAvailable:false,sourceLicenseNoticeIncluded:true,realMobileDeviceTested:false,qualityClaim:'Stage-one closed-surface correction; non-physical rest-surface blend; visual approval remains with the user. Not a person-specific anatomical reconstruction.',verification:'stage1/qa-report.json and current Actions artifact/public-report.json'};
fs.writeFileSync(ROOT+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));fs.writeFileSync(__dirname+'/bundle-inputs.json',JSON.stringify(inputs,null,2));
console.log('ET08_STAGE1_BUILD',JSON.stringify(manifest));
