'use strict';
// Keep this task's expensive checks sequential, including latency measurements.
const cp=require('child_process');
const commands=[['tools/qa-program-storage-r27.cjs'],['tools/qa-field-pool-r27.cjs'],...['workbench','head','roundtrip','inspection','source'].map(n=>['tools/qa-regressions-r27.cjs',n]),['tools/qa-editor-continuity-r27.cjs'],['tools/qa-field-fine-r27.cjs'],['tools/qa-native-update-r27.cjs']];
for(const args of commands){console.log('R27 check: '+args.join(' '));const r=cp.spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true});if(r.status!==0){process.exitCode=r.status||1;break;}}
