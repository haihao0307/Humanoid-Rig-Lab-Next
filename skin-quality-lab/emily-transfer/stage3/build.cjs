const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'..'),BASE='cc5f13450e0618e371306183671838f2910bd96a',P='skin-quality-lab/emily-transfer/',hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function base(name){try{return cp.execFileSync('git',['show',BASE+':'+P+name],{encoding:'utf8',maxBuffer:12e6});}catch(e){cp.execFileSync('git',['fetch','--depth=1','origin',BASE],{stdio:'inherit'});return cp.execFileSync('git',['show',BASE+':'+P+name],{encoding:'utf8',maxBuffer:12e6});}}
const source=base('app.js');assert.equal(hash(source),'aea418c2e4bfb6a01fa0e215e8a4a116a39a23ade6ec33361ad344e0b3d56190');let app=source,html=base('index.html');
function patch(a,b){assert.equal(app.split(a).length,2,'Missing unique stage-two anchor: '+a);app=app.replace(a,()=>b);}
patch("import {EYE_VERSION,SectionEyes as EyeSystem} from './stage2/SectionEyes.js';","import {EYE_VERSION,ChartEyes as EyeSystem} from './stage3/ChartEyes.js';\nimport {createTissueReview} from './stage3/TissueReview.js';");
patch("VERSION='emily-transfer/9.0.0-s2'","VERSION='emily-transfer/10.0.0-s3'");
patch('stage1View);render();','stage1View);stage1View=createTissueReview({rig:eyesRig,mesh,skin,fuzz,renderer,scene,camera,controls,key,fill,rim,state,surface:E.uSurface.value,requestRender:()=>{dirty=true;renderer.shadowMap.needsUpdate=true;},setCamera},stage1View);render();');
html=html.replace(/<title>[^<]*<\/title>/,'<title>眉弓与静息材质坐标 · ET10 第三阶段</title>');
// Keep the generated review wording in sync with the numerical metric: these
// are millimetre-scaled chart units, not a globally isometric surface ruler.
const reviewPath=__dirname+'/TissueReview.js';let review=fs.readFileSync(reviewPath,'utf8');
review=review.replace('s.fragmentShader=declarations+s.fragmentShader;',"s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\\n'+declarations);")
 .replace('1 mm 静息网格','毫米标尺坐标网格')
 .replace('网格间隔是在静息表面上的 1 mm。运动后变长或变窄是实际几何应变，不通过滑动 UV 假装消失。','网格使用毫米标尺的静息坐标；曲面展开并非处处等距。运动后的变化反映实际几何应变，不通过滑动 UV 假装消失。');
fs.writeFileSync(reviewPath,review);
const verifierPath=__dirname+'/verify.cjs';let verifier=fs.readFileSync(verifierPath,'utf8');
if(!verifier.includes('neutral chart has no added foldovers')){
 const anchor="await capture('01-gray-brow-medial');";assert.equal(verifier.split(anchor).length,2);
 verifier=verifier.replace(anchor,()=>"for(const e of report.neutral.coordinates.entries.filter(e=>e.chartQuality)){check(e.name+' neutral chart has no added foldovers',e.chartQuality.foldovers===0&&e.chartQuality.testedTriangles>20000&&e.chartQuality.minSignedAreaRatio>=.02,e.chartQuality);}\n "+anchor);
}
fs.writeFileSync(verifierPath,verifier);
fs.writeFileSync(ROOT+'/app.js',app);fs.writeFileSync(ROOT+'/index.html',html);
const vendor=path.resolve(ROOT,'../r01/vendor'),result=esbuild.buildSync({entryPoints:[ROOT+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:vendor+'/three.module.js','three/addons':vendor+'/addons'}});
const inputs=Object.keys(result.metafile.inputs);assert.equal(inputs.filter(p=>/three\.core\.js$/.test(p)).length,1);
const assetCommit='5be35195ad40d57507f7ab1785e4eecda6c648de',root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+assetCommit+'/skin-quality-lab/';
const code=result.outputFiles[0].text.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/').replace(/<\/script/gi,'<\\/script');new vm.Script(code);
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');preview=preview.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/');
const notice=fs.readFileSync(ROOT+'/talkinghead/vendor/TalkingHeadBehavior.mjs','utf8').match(/^\/\*\*[\s\S]*?\*\//)?.[0];assert(notice?.includes('MIT License'));preview=preview.replace('</head>',()=>'<!--\n'+notice.replaceAll('-->','-- >')+'\n-->\n</head>');
const scripts=[...preview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)];assert.equal(scripts.length,1);assert.equal(scripts[0][1],code);new vm.Script(scripts[0][1]);fs.writeFileSync(ROOT+'/preview.html',preview);
const manifest={schema:'kaopu/eye-rest-chart-build@1',version:'ET10-S3',codeVersion:'emily-transfer/10.0.0-s3',eyeVersion:'eyes/10.0.0-s3',baseline:BASE,assetCommit,baselineAppSHA256:hash(source),appSHA256:hash(app),previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),finalHTMLSyntaxValidated:true,oneThreeCore:true,oneRenderer:true,originalHeadAssetChanged:false,runtimeBrowHeadVerticesChanged:true,separateBrowMesh:false,originalTextureFilesChanged:false,globeRadiusCentreDepthChanged:false,stage1AndStage2SourceChanged:false,closedMobileMarginChanged:false,supraorbitalGeometryAdded:true,medialGeometryRefined:true,neutralTissueChartRebuilt:true,neutralChartTriangleOrientationTested:true,globallyIsometricChart:false,staticCoordinatesWithMeasuredStrain:true,singleMaskForColorNormalRoughness:true,finalSkinAndOptics:false,stage4PhysicalFoldingImplemented:false,constantPoreDensityClaim:false,defaultView:'gray geometry',realMobileDeviceTested:false,limitations:'Fitted surface, not a scanned skull or individual hidden ocular anatomy. Fixed coordinates do not remove stretching in the inherited geometric animation; strain is exposed for stage four.',verification:'stage3/qa-report.json and current Actions public report'};
fs.writeFileSync(ROOT+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));fs.writeFileSync(__dirname+'/bundle-inputs.json',JSON.stringify(inputs,null,2));console.log('ET10_BUILD',JSON.stringify(manifest));
