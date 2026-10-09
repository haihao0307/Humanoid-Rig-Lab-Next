const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),r01=path.resolve(root,'../r01'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const commit=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Immutable ASSET_COMMIT required');
let app=fs.readFileSync(root+'/app.js','utf8'),html=fs.readFileSync(root+'/index.html','utf8'),bridge=fs.readFileSync(root+'/talkinghead/IntegratedEyes.js','utf8');
if(!app.includes("VERSION='emily-transfer/5.0.0'")){
 if(hash(app)!=='2b33952c1df6f7de77f60df36df0c5e472e659446ce29e9ffabf301e63dd541b')throw Error('Unreviewed source application: refuse historical overwrite');
 app=app.replaceAll('emily-transfer/4.0.0','emily-transfer/5.0.0').replaceAll('emily-transfer-et04','emily-transfer-et05').replaceAll('skin-eyes-talkinghead-et04.json','skin-eyes-et05.json');
 app=app.replaceAll('ET04 · TALKINGHEAD','ET05 · EYELID VOLUME').replace("document.title='TalkingHead × 原人头 · ET04'","document.title='眼睑结构修正 · ET05'");
 app=app.replace('const views={eyes:',"const views={upperlid:{p:[.078,.052,.153],t:[.0217,.069,.074]},eyes:");
 bridge=bridge.replace("import {ResearchEyes} from '../research/ResearchEyes.js';","import {UpperLidEyes as ResearchEyes} from '../anatomy/UpperLidEyes.js';").replaceAll("'eyes/4.0.0'","'eyes/5.0.0'");
 html=html.replace('<button data-camera="iris">','<button data-camera="upperlid" title="从斜下方观察上眼睑的真实厚度">上睑厚度</button><button data-camera="iris">');
 html=html.replace('ET04 · TALKINGHEAD','ET05 · EYELID VOLUME');
 html=html.replace('<aside class="side" aria-label="皮肤与光线参数">','<aside class="side" aria-label="皮肤与光线参数"><div class="section"><h2>ET05 / 上眼睑结构</h2><p class="hint">先观察双眼，再点「上睑厚度」。新上睑由外侧皮肤、实体睑缘和内侧接触面连续连接；收紧眼角，降低上睑开口。原 TalkingHead 行为、下睑主体和皮肤继续保留。</p><p class="hint">结构比例是当前头模的拟合，不是这个人物的医学测量。眼睑贴近眼球的湿接触层，不是刻意挖出的空气黑缝。</p></div>');
 fs.writeFileSync(root+'/app.js',app);fs.writeFileSync(root+'/index.html',html);fs.writeFileSync(root+'/talkinghead/IntegratedEyes.js',bridge);
}
const result=esbuild.buildSync({entryPoints:[root+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}});
const inputs=Object.keys(result.metafile.inputs);if(inputs.filter(p=>/three\.core\.js$/.test(p)).length!==1)throw Error('Multiple Three.js cores');if(!inputs.some(p=>p.endsWith('anatomy/UpperLidEyes.js')))throw Error('New structure not in runtime');
const prefix='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/';
const code=result.outputFiles[0].text.replaceAll('../r01/',prefix+'r01/').replaceAll('../r02/',prefix+'r02/').replaceAll('</script','<\\/script');new vm.Script(code);
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');preview=preview.replaceAll('../r01/',prefix+'r01/').replaceAll('../r02/',prefix+'r02/');
const license=fs.readFileSync(root+'/talkinghead/vendor/LICENSE','utf8');preview=preview.replace('</body>','<!-- TalkingHead upstream license:\n'+license.replaceAll('--','—')+'\n-->\n</body>');
const scripts=[...preview.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];if(scripts.length!==1||scripts[0][1]!==code)throw Error('HTML payload modified');new vm.Script(scripts[0][1]);
fs.writeFileSync(root+'/preview.html',preview);
const manifest=JSON.parse(fs.readFileSync(root+'/BUILD_MANIFEST.json','utf8'));
Object.assign(manifest,{version:'ET05',codeVersion:'emily-transfer/5.0.0',eyeVersion:'eyes/5.0.0',baseline:'6cb08771e868daedbc9ab9f477e0f2da1b67f4fa',sourceCommit:commit,assetCommit:commit,appSHA256:hash(app),previewSHA256:hash(preview),previewBytes:Buffer.byteLength(preview),integrationModuleSHA256:hash(bridge),upperLidModuleSHA256:hash(fs.readFileSync(__dirname+'/UpperLidEyes.js')),oneThreeCore:true,oneRenderer:true,hostAnimationLoopOnly:true,sourceHeadMeshChanged:false,sourceSkinTexturesChanged:false,geometryQualityClaim:'ET05 anterior/posterior margin connection and fitted aperture; not a subject-specific neural reconstruction',standaloneHTMLIncludesUpstreamLicense:true,nominalGlobeDiameterMM:24,nominalIrisSurfaceDiameterMM:10.512,innerWetContactAllowanceMM:.035,upperMarginBridge:true,neuralReconstructionPerformed:false,realMobileDeviceTested:false});
fs.writeFileSync(root+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));console.log('ET05_BUILD',JSON.stringify(manifest));
