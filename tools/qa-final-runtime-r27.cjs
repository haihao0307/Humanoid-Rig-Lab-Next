'use strict';
// Avoid concurrent pressure from this task when measuring native update latency.
const cp=require('child_process'),commands=[['tools/qa-lazy-fields-r27.cjs'],['tools/qa-field-pool-r27.cjs'],...['workbench','head','roundtrip','inspection','history'].map(n=>['tools/qa-regressions-r27.cjs',n]),['tools/qa-field-fine-r27.cjs'],['tools/qa-native-update-r27.cjs']];
for(const args of commands){console.log('R27 final check: '+args.join(' '));const r=cp.spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});if(r.status!==0){process.exitCode=r.status||1;break;}}
