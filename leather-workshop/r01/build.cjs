const fs=require('fs'),path=require('path'),crypto=require('crypto'),esbuild=require('esbuild'),vm=require('vm');
(async()=>{
const root=__dirname,site=path.join(root,'site'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const files=['leather.js','app.js','template.html','three.module.js'];
const texts=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(site,f),'utf8')]));
const rawSourceHashes=Object.fromEntries(files.map(f=>[f,hash(texts[f])]));
const patches=JSON.parse(fs.readFileSync(path.join(site,'lookdev.json'),'utf8'));
for(const [file,pairs] of Object.entries(patches))for(const [before,after] of pairs){if(!texts[file]?.includes(before))throw Error('Missing lookdev anchor: '+file+' '+before.slice(0,80));texts[file]=texts[file].replaceAll(before,after);}
const sourceHashes=Object.fromEntries(files.map(f=>[f,hash(texts[f])]));
const result=await esbuild.build({entryPoints:[path.join(site,'app.js')],bundle:true,write:false,minify:true,format:'iife',target:'es2022',legalComments:'inline',alias:{three:path.join(site,'three.module.js'),leather:path.join(site,'leather.js')},plugins:[{name:'checked-lookdev',setup(b){b.onLoad({filter:/\.js$/},a=>{const t=texts[path.basename(a.path)];if(t!==undefined)return {contents:t,loader:'js',resolveDir:site};});}}]});
const code=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');new vm.Script(code);
const notice=fs.readFileSync(path.join(root,'THIRD_PARTY.txt'),'utf8').replaceAll('--','—');
const html=texts['template.html'].replace('<!--IMPORTMAP-->',()=>'<\!--\n'+notice+'\n-->').replace('<!--APP-->',()=>'<script>'+code+'</script>');
const extracted=html.match(/<script>([\s\S]*?)<\/script>/)[1];if(extracted!==code)throw Error('Embedded script differs from bundle');new vm.Script(extracted);
fs.writeFileSync(path.join(root,'preview.html'),html);
const manifest={version:'R01.0',rawSourceHashes,sourceHashes,lookdev:patches,htmlSHA256:hash(html),htmlBytes:Buffer.byteLength(html),runtime:'Three.js r169',sourceBase:'fda12bf2fe0262e4d02f1b08508128d17959e0c8',visualAcceptance:'PENDING_USER',oneToOneAdobe:'NOT_VERIFIED',physics:'not implemented',externalMaterialTextures:false};
fs.writeFileSync(path.join(root,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2));console.log('Built standalone leather workshop',manifest.htmlSHA256,manifest.htmlBytes);
})().catch(e=>{console.error(e);process.exitCode=1;});
