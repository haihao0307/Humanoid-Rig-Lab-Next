// Direct, non-destructive rebuild after the accepted ET03 source is published.
// Unlike the historical replay scripts, this never replaces the active eye rig.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),r01=path.resolve(root,'../r01');
const sha=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(sha||''))throw Error('ASSET_COMMIT must be an immutable 40-character Git commit');
const app=fs.readFileSync(root+'/app.js','utf8'),html=fs.readFileSync(root+'/index.html','utf8');
if(!app.includes("VERSION='emily-transfer/3.0.0'"))throw Error('Active source is not ET03');
const bundled=esbuild.buildSync({entryPoints:[root+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}}).outputFiles[0].text;
const prefix='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/skin-quality-lab/';
const code=bundled.replaceAll('../r01/',prefix+'r01/').replaceAll('../r02/',prefix+'r02/').replaceAll('</script','<\\/script');new vm.Script(code);
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');
const scripts=[...preview.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];if(scripts.length!==1||scripts[0][1]!==code)throw Error('Final HTML altered the embedded JavaScript');new vm.Script(scripts[0][1]);
fs.writeFileSync(root+'/preview.html',preview);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),manifest=JSON.parse(fs.readFileSync(root+'/BUILD_MANIFEST.json','utf8'));
Object.assign(manifest,{assetCommit:sha,sourceCommit:sha,appSHA256:hash(app),previewSHA256:hash(preview),researchModuleSHA256:hash(fs.readFileSync(__dirname+'/ResearchEyes.js')),finalHTMLSyntaxValidated:true});
fs.writeFileSync(root+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));console.log('ET03_BUNDLE',JSON.stringify({bytes:Buffer.byteLength(preview),assetCommit:sha,sha256:manifest.previewSHA256}));
