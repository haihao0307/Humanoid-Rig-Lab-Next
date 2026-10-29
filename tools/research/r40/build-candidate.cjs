'use strict';
// R40 candidates are isolated from the active R39 page until validated.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{replace}=require('../r32/render-integration.cjs'),{patch}=require('./patch-skin-mrt.cjs'),boot=require('./patch-boot-handoff.cjs'),read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f)),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceBase=json('BUILD-SOURCE-R39.json'),skinFields=read('src/BodySkinFieldsR24.js'),sharedSkinFields=read('src/research/r40/BodySkinFieldsR40.js');
let source=replace(read(sourceBase.file),skinFields,sharedSkinFields);source=replace(source,'<title>身体 R35','<title>身体 R40');const sourceFile='delivery/身体_R40_固定皮肤候选.html';fs.writeFileSync(sourceFile,source);
let dynamic=read(json('BUILD-STUDY-R39.json').file);
// This shader experiment is kept isolated: it currently differs from the
// retained material in some same-frame pixel and layer comparisons.
if(process.env.BODY_R40_EXPERIMENTAL_MRT==='1')dynamic=patch(dynamic);
dynamic=boot.dynamic(dynamic);
dynamic=replace(dynamic,skinFields,sharedSkinFields);
dynamic=replace(dynamic,read('src/research/r37/BodyShadowValidationR37.js'),read('src/research/r40/BodyShadowValidationR40.js'));
// Reuse the existing exact unresolved-ray reduction for static updates too;
// devices that cannot create its integer target retain the full readback.
dynamic=replace(dynamic,"let motionValidation=null;if(kind==='motion-r37')try{motionValidation=BodyShadowValidationR37.create(gl);","let motionValidation=null;try{motionValidation=BodyShadowValidationR37.create(gl);");
dynamic=replace(dynamic,"validationMethod:motionValidation?'gpu-reduction':'full-readback',dimensions","validationMethod:motionValidation?'gpu-reduction':'full-readback',validationReadbacks:motionValidation?.report?.().lastReadbacks??null,dimensions");
dynamic=replace(dynamic,'<title>身体 R39','<title>身体 R40');const dynamicFile='delivery/身体_R40_皮肤候选.html';fs.writeFileSync(dynamicFile,dynamic);
let work=read(json('BUILD-R39.json').file);work=replace(work,'身体_R39_动作与连续变形.html','身体_R40_皮肤候选.html',2);work=replace(work,path.basename(sourceBase.file),path.basename(sourceFile),3);work=replace(work,sourceBase.sha256,hash(source));work=replace(work,'<title>人物身体 R39','<title>人物身体 R40');work=work.replace('BODY STUDY / R39','BODY STUDY / R40');
work=boot.workbench(work);
work=replace(work,'body.body-motion-active-r37 aside>*:not(#body-motion-player),body.body-motion-active-r37 header .top-actions','.body-skin-value-r40{float:right;color:#536d59;font-variant-numeric:tabular-nums}body.body-motion-active-r37:not(.body-motion-skin-ready-r40) #body-skin-panel-r40{pointer-events:none;opacity:.55}body.body-motion-active-r37 aside>*:not(#body-motion-player):not(#body-skin-panel-r40),body.body-motion-active-r37 header .top-actions');
work=replace(work,'else e.value=a[e.dataset.appearance];});}','else e.value=a[e.dataset.appearance];});window.__BODY_SKIN_REFRESH_VALUES_R40__?.();}');
work=replace(work,"function lock(value){document.body.classList.toggle('body-motion-active-r37',value);","function lock(value){document.body.classList.remove('body-motion-skin-ready-r40');document.body.classList.toggle('body-motion-active-r37',value);");
work=replace(work,"mode='playing';progress.disabled=false;","mode='playing';document.body.classList.add('body-motion-skin-ready-r40');progress.disabled=false;");
work=replace(work,"mode='finishing';cancelAnimationFrame(raf);","mode='finishing';document.body.classList.remove('body-motion-skin-ready-r40');cancelAnimationFrame(raf);");
const skinPanel='<div class="line" id="body-skin-panel-r40"><h2>皮肤表面</h2><p class="small">动作播放时也可以调整皮肤；暂停后可保存完整人物。</p><div class="pills"><button type="button" data-skin-preset-r40="matte">哑光</button><button type="button" data-skin-preset-r40="balanced">自然</button><button type="button" data-skin-preset-r40="dewy">润泽</button></div><p class="small">质感选项只调整粗糙度和油光，肤色及其他细节保持不变。</p><div class="pills"><button type="button" id="body-skin-style-export-r40">导出皮肤样式</button><button type="button" id="body-skin-style-import-r40">导入皮肤样式</button><button type="button" id="body-skin-style-undo-r40" disabled>恢复套用前</button></div><input type="file" id="body-skin-style-file-r40" accept=".json,application/json" hidden><p class="small" id="body-skin-style-status-r40" aria-live="polite">皮肤样式文件只包含身体皮肤参数。</p>';
work=replace(work,'<div class="line"><h2>皮肤表面</h2>',skinPanel);
work=replace(work,'</html>','<script>'+read('src/research/r40/BodySkinStylesR40.js')+'</script></html>');
const workFile='delivery/人物身体_R40_皮肤候选.html';fs.writeFileSync(workFile,work);console.log(JSON.stringify({workbench:{file:workFile,sha256:hash(work)},source:{file:sourceFile,sha256:hash(source)},dynamic:{file:dynamicFile,sha256:hash(dynamic)}}));
