'use strict';
// Compare actual original renderer with itself, using the frozen body-only
// reference harness. Polygons remain offline reference inputs only.
const fs=require('fs'),cp=require('child_process');let s=fs.readFileSync('tools/qa-native-profiles-r24.cjs','utf8');
function change(a,b){if(s.split(a).length!==2)throw Error('Native control patch changed: '+a.slice(0,65));s=s.replace(a,b);}
change("process.env.BODY_SOURCE_TEST_BUILD||'BUILD-SOURCE-R24.json'","process.env.BODY_SOURCE_TEST_BUILD||'BUILD-SOURCE-R26.json'");
change("['baseline','lean','fuller','muscular','female','A-reach','A-joints','B-neutral','B-bend','calibration-soft']","['baseline']");
const read='gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);';
change(read,read+`const firstLayersR26=[0,1,2].map(k=>__BODY_QA_LAYERS__[k].slice()),nativeSelfR26=[];for(let attempt=1;attempt<=2;attempt++){v.faceDiffusion.render();const again=new Uint8Array(pixels.length);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,again);let differentBytes=0,maximum=0;for(let k=0;k<again.length;k++)if(pixels[k]!==again[k]){differentBytes++;maximum=Math.max(maximum,Math.abs(pixels[k]-again[k]));}const layers=firstLayersR26.map((a,i)=>{const b=__BODY_QA_LAYERS__[i];let differentValues=0,maximum=0;for(let k=0;k<a.length;k++)if(a[k]!==b[k]){differentValues++;maximum=Math.max(maximum,Math.abs(a[k]-b[k]));}return{differentValues,maximum};});nativeSelfR26.push({attempt,differentBytes,maximum,layers});}`);
change('bodyOnlyEnforcedAfterOriginalHooks:true,colour:btoa(s)','bodyOnlyEnforcedAfterOriginalHooks:true,nativeSelf:nativeSelfR26,colour:btoa(s)');
change('q.cases.length===30','q.cases.length===3');
change('q.artifactStable=','q.nativeSelfStable=q.cases.every(c=>c.source.nativeSelf.every(r=>r.differentBytes===0&&r.layers.every(l=>l.differentValues===0)));q.nativeSelfScope="Actual original baseline body renderer, three matched views, two explicit diagnostic self-redraws, unchanged shadow history; not a production warmup or current-function fidelity certificate";q.artifactStable=');
s=s.replaceAll('qa/fidelity-r24/active-profiles-pixels-browser.json','qa/fidelity-r26/native-original-self.json');
const r=cp.spawnSync(process.execPath,['-e',s],{stdio:'inherit',windowsHide:true});process.exitCode=r.status??1;
