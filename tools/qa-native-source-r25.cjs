'use strict';
// Reuse the frozen-original audit, with a separate R25 report and exact assets.
// Character polygons are used only by its isolated original reference page.
const fs=require('fs'),cp=require('child_process');let script=fs.readFileSync('tools/qa-native-profiles-r24.cjs','utf8');
function change(old,next){if(!script.includes(old))throw Error('Frozen reference audit changed: '+old.slice(0,60));script=script.replace(old,next);}
change("process.env.BODY_SOURCE_TEST_BUILD||'BUILD-SOURCE-R24.json'","process.env.BODY_SOURCE_TEST_BUILD||'BUILD-SOURCE-R25.json'");
change('(async()=>{try{','B.offlineTrial=true;(async()=>{try{');
change("if(B.offlineTrial)await candidate.route", "await candidate.route('**/assets/body-exact-r25/*.gz',r=>{const filename=new URL(r.request().url()).pathname.split('/').pop(),file='delivery/assets/body-exact-r25/'+filename;if(!B.exactDomainAssets.some(a=>a.file===file))throw Error('Unknown exact-domain asset');return r.fulfill({path:path.resolve(file),contentType:'application/octet-stream'});});if(B.offlineTrial)await candidate.route");
script=script.replaceAll('qa/fidelity-r24/active-profiles-pixels-browser.json','qa/fidelity-r25/native-source-pixels.json');
const result=cp.spawnSync(process.execPath,['-e',script],{stdio:'inherit',windowsHide:true});process.exitCode=result.status||0;
