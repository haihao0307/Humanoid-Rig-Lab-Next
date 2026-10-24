'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyImplicitAppR21.js','utf8');
function replace(a,b){if(!s.includes(a))throw Error('Atomic archive marker missing: '+a.slice(0,90));s=s.replace(a,b);}
replace('let control,iterations=[],pendingIteration=null;','let control,iterations=[],pendingIteration=null,transaction=null;');
replace('function preserveHead(current,next){',`function beginTransaction(){if(transaction)return;transaction={state:structuredClone(state),baselineArchive:structuredClone(baselineArchive),iterations:structuredClone(iterations),originalState:structuredClone(window.__BODY_ORIGINAL_STATE_R18__),originalLighting:structuredClone(originalLighting),quality,inspectionLight,appearance:renderer.report().appearance,lighting:renderer.report().lighting};}\nfunction preserveHead(current,next){`);
replace('commit:p=>{pendingIteration=','commit:p=>{beginTransaction();pendingIteration=');
replace('function switchCalibration(name){if(busy)',"function switchCalibration(name){if(name!=='original')throw Error('本页仅提供原人物参数恢复');if(busy)");
replace("if(!changes.length)return{changed:false};pendingIteration=","if(!changes.length)return{changed:false};beginTransaction();pendingIteration=");
replace('function rollbackIteration(){if(pendingIteration){state=pendingIteration.previousState;pendingIteration=null;}}',`function rollbackIteration(){if(transaction){const t=transaction;state=t.state;baselineArchive=t.baselineArchive;iterations=t.iterations;window.__BODY_ORIGINAL_STATE_R18__=t.originalState;originalLighting=t.originalLighting;quality=t.quality;inspectionLight=t.inspectionLight;renderer.appearance(t.appearance);renderer.lighting(t.lighting);document.querySelector('#quality').value=String(quality);document.querySelector('#inspection-light').value=inspectionLight;syncAppearance();transaction=null;}else if(pendingIteration)state=pendingIteration.previousState;pendingIteration=null;}`);
replace('recordIteration();if(!window.__BODY_IMPLICIT_R02_READY__)','recordIteration();transaction=null;if(!window.__BODY_IMPLICIT_R02_READY__)');
replace('rig.disabled=busy;if(state)',"document.querySelector('#quality').disabled=busy;rig.disabled=busy;if(state)");
replace("if(id==='initial')state=structuredClone(initialState);","if(id==='initial'){beginTransaction();state=preserveHead(state,structuredClone(initialState));}");
replace("e=>{quality=+e.target.value;if(!busy)rebuild();}","e=>{if(busy){e.target.value=String(quality);return;}beginTransaction();quality=+e.target.value;rebuild();}");
replace('function archive(){const a=',"function archive(){if(busy)throw Error('身体更新完成后才能保存人物');const a=");
replace("throw Error('人物档案格式不匹配');const own=","throw Error('人物档案格式不匹配');beginTransaction();try{const own=");
replace("syncAppearance();rebuild();}\nfunction download", "syncAppearance();rebuild();}catch(error){rollbackIteration();busy=false;filter();throw error;}}\nfunction download");
replace("worker.onerror=e=>{rollbackIteration();lastError=", "worker.onerror=e=>{rollbackIteration();busy=false;sync();lastError=");
fs.writeFileSync('src/BodyImplicitAppR21.js',s);
