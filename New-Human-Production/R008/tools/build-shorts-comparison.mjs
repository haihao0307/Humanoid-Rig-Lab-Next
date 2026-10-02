import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SHORTS_VERSIONS} from '../ShortsVersions.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const originalArgument=process.argv[2];
const originalFile=originalArgument?resolve(originalArgument):null;
const candidateFile=resolve(process.argv[3]||resolve(root,'qa/shorts-standalone-20261002/index.html'));
const out=resolve(process.argv[4]||resolve(root,'qa/shorts-two-versions-20261002/index.html'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let original;
if(originalFile){
 if(!existsSync(originalFile))throw Error('Original HTML file does not exist: '+originalFile);
 original=readFileSync(originalFile);
}else{
 // Build-time retrieval only. The resulting comparison still embeds both
 // exact HTML files and makes zero required network requests when opened.
 const response=await fetch(SHORTS_VERSIONS[0].publicURL);
 if(response.status!==200)throw Error('Preserved original HTTP status '+response.status);
 original=Buffer.from(await response.arrayBuffer());
}
const candidate=readFileSync(candidateFile);
if(hash(original)!==SHORTS_VERSIONS[0].htmlSHA256)throw Error('Original accepted HTML changed: refusing to replace the preserved version');
const candidateBuild=JSON.parse(readFileSync(resolve(dirname(candidateFile),'BUILD.json')));
if(hash(candidate)!==candidateBuild.htmlSHA256)throw Error('Candidate bytes do not match their build receipt');
// This preview is deliberately separate from public promotion. Build freshness
// and physical acceptance must be independently verified before publication.
const versions=SHORTS_VERSIONS.map((v,i)=>({...v,htmlSHA256:hash(i?candidate:original),htmlBase64:(i?candidate:original).toString('base64')}));
const payload=JSON.stringify(versions);
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="shorts-test-version" content="shorts-two-versions-20261002"><title>亚麻短裤 · 两个版本</title><style>html,body{margin:0;height:100%;background:#132022;color:#e4eee7;font:14px/1.5 system-ui}header{box-sizing:border-box;padding:10px 16px;height:100px;border-bottom:1px solid #516a60}nav{display:flex;gap:8px;margin:5px 0}button{padding:7px 14px;border:1px solid #657d72;border-radius:6px;background:#21372e;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#52735a}#note{font-size:12px;color:#c6d7ca}iframe{display:block;border:0;width:100%;height:calc(100% - 100px)}@media(max-width:600px){header{height:128px;padding:8px}iframe{height:calc(100% - 128px)}button{padding:7px 10px}}</style><header><strong>亚麻短裤 · 原版 / 新版</strong><nav><button data-version="original" aria-pressed="true">原版</button><button data-version="lowrise" aria-pressed="false">新版 · 低腰松紧</button></nav><div id="note"></div></header><iframe id="workbench" title="短裤三维工作台"></iframe><script>
const versions=${payload};
function selectVersion(id){const version=versions.find(v=>v.id===id);if(!version)throw Error('Unknown shorts version');const bytes=Uint8Array.from(atob(version.htmlBase64),v=>v.charCodeAt(0));document.getElementById('workbench').srcdoc=new TextDecoder('utf-8',{fatal:true}).decode(bytes);document.getElementById('note').textContent=version.note+(id==='lowrise'?' 新版为内部候选，穿着与动作仍未通过。':'');for(const button of document.querySelectorAll('[data-version]'))button.setAttribute('aria-pressed',String(button.dataset.version===id));window.ShortVersion.current=id;}
window.ShortVersion={current:null,versions:versions.map(({htmlBase64,...v})=>v),select:selectVersion};for(const button of document.querySelectorAll('[data-version]'))button.onclick=()=>selectVersion(button.dataset.version);selectVersion('original');
</script></html>`;
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,html);
const receipt={revision:'shorts-two-versions-20261002',builtAt:new Date().toISOString(),status:'INTERNAL_CANDIDATE_ONLY',versions:versions.map(({htmlBase64,...v})=>v),htmlSHA256:hash(html),originalExactBytesPreserved:true,originalSourceFile:originalFile,originalSourceURL:originalFile?null:SHORTS_VERSIONS[0].publicURL,candidateSourceFile:candidateFile,candidateBuildRevision:candidateBuild.revision,externalCoreAssets:0,productionReady:false,motionValidated:false,publicPromotionValidated:false};
writeFileSync(resolve(dirname(out),'BUILD.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({out,htmlSHA256:receipt.htmlSHA256,bytes:Buffer.byteLength(html),originalExactBytesPreserved:true,publicPromotionValidated:false}));
