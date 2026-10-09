const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const license=fs.readFileSync(path.join(__dirname,'vendor/LICENSE'),'utf8');
assert(license.includes('Mika Suominen')&&license.includes('Permission is hereby granted'));
assert(!license.includes('-->'));
const marker='TalkingHead complete MIT notice';
const notice='\n<!-- '+marker+'\n'+license+'\n-->\n';
for(const name of ['index.html','preview.html']){
 const file=path.join(root,name),before=fs.readFileSync(file,'utf8');
 if(before.includes(marker))continue;
 assert(before.includes('</head>'));
 const after=before.replace('</head>',()=>notice+'</head>');
 const scripts=s=>[...s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.deepEqual(scripts(after),scripts(before),'License insertion must not change executable code');
 fs.writeFileSync(file,after);
}
const manifestPath=path.join(root,'BUILD_MANIFEST.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const preview=fs.readFileSync(path.join(root,'preview.html'));
manifest.reviewedPreviewBeforeLicense=manifest.reviewedPreviewBeforeLicense||manifest.previewSHA256;
manifest.previewSHA256=hash(preview);manifest.previewBytes=preview.length;
manifest.standaloneHTMLIncludesUpstreamLicense=true;
manifest.licenseInsertionChangedExecutableCode=false;
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
console.log('ET04_LICENSE_PRESERVED',JSON.stringify({bytes:preview.length,sha256:manifest.previewSHA256,executableCodeUnchanged:true}));
