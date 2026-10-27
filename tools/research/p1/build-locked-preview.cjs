'use strict';
// P1.3 is an isolated, visibly labelled study. It never becomes the selected
// person, exports an archive, or changes the R29/R30 source shape.
const fs=require('fs'),crypto=require('crypto');
const H=b=>crypto.createHash('sha256').update(b).digest('hex');
const old=fs.readFileSync('src/research/r29/BodyPoseAppR29.js','utf8');
let app=old;
function once(a,b){if(app.split(a).length!==2)throw Error('Support study anchor changed: '+a.slice(0,100));app=app.replace(a,()=>b);}
once("for(const id of ['pose-functions-r29','original-person-r29','boundaries-r29','pose-state-identity-r29'])document.querySelector('#'+id).remove();",
 "for(const id of ['pose-functions-r29','original-person-r29','boundaries-r29','pose-state-identity-r29'])document.querySelector('#'+id).remove();let lockMode=new URL(location.href).searchParams.get('support')==='fixed';let lockedRef=null;metadata.profiles=metadata.profiles.filter(p=>['baseline','lean','fuller','muscular'].includes(p.id));");
once('function shapeState(state){',"async function loadLockedRef(){const d=metadata.profiles.find(p=>p.id==='baseline'),[core,head]=await Promise.all([data(d),data(d.headBoundaryFunctions)]);core.rig=head.poseProgram.rig;core.allowedJoints=head.poseProgram.allowedJoints;return core;}function shapeState(state){");
once("loading.textContent='正在载入原轮廓函数…';try{const [next,", "loading.textContent='正在载入原轮廓函数…';try{if(lockMode&&!lockedRef)lockedRef=await loadLockedRef();const [next,");
once('nextFrame=BodyPoseFunctionsR29.evaluate(next,nextPose)','nextFrame=lockMode?BodyPoseFunctionsP1.evaluate(next,nextPose,{reference:lockedRef}):BodyPoseFunctionsR29.evaluate(next,nextPose)');
once('const candidate=BodyPoseFunctionsR29.evaluate(program,value);','const candidate=lockMode?BodyPoseFunctionsP1.evaluate(program,value,{reference:lockedRef}):BodyPoseFunctionsR29.evaluate(program,value);');
once('const next=BodyPoseFunctionsR29.evaluate(program,reference?pose:{});','const next=lockMode?BodyPoseFunctionsP1.evaluate(program,reference?pose:{},{reference:lockedRef}):BodyPoseFunctionsR29.evaluate(program,reference?pose:{});');
once("function sync(){const isB=program?.rig.kind==='mhr-no-correctives';profileInput.value=current;","function sync(){const isB=program?.rig.kind==='mhr-no-correctives';profileInput.value=current;document.querySelector('#support-mode').textContent=lockMode?'切回原始支撑':'切换参考支撑';document.querySelector('#support-mode').setAttribute('aria-pressed',String(lockMode));document.querySelector('#support-status').textContent=lockMode?'当前：参考人物的支撑动作':'当前：各体型自己的原始支撑动作';");
once("template:current,pose:structuredClone(pose),functions:","template:current,supportMode:lockMode?'fixed':'original',experimentalSupport:frame?.lockedSupport||null,pose:structuredClone(pose),functions:");
once(" for(const d of metadata.profiles){",` async function setSupport(mode){
  if(mode!=='fixed'&&mode!=='original')throw Error('未知支撑对照模式');
  if(busy||!program)throw Error('人物正在载入');
  const wanted=mode==='fixed';if(wanted===lockMode)return report();
  busy=true;lastError=null;sync();
  try{if(wanted&&!lockedRef)lockedRef=await loadLockedRef();
   const candidate=wanted?BodyPoseFunctionsP1.evaluate(program,reference?{}:pose,{reference:lockedRef}):BodyPoseFunctionsR29.evaluate(program,reference?{}:pose);
   renderer.setFrame(candidate);frame=candidate;lockMode=wanted;updates++;
   status.textContent='支撑对照已切换；人物、动作与观察角度保留。该研究尚未通过原数据及视觉验收。';
  }catch(error){lastError=error.message;status.textContent=error.message;throw error;}finally{busy=false;sync();}return report();
 }
 window.bodyPoseFunctionsR29.setSupport=setSupport;
 document.querySelector('#support-mode').addEventListener('click',()=>setSupport(lockMode?'original':'fixed').catch(()=>{}));
 for(const d of metadata.profiles){`);
const files=['src/research/p1/BodyLockedSupportP1.js','src/research/p1/BodySourceHeadP1.js','src/research/p1/BodyPoseFunctionsP1.js'];
const extra=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const base=JSON.parse(fs.readFileSync('BUILD-POSE-R29.json'));
let html=fs.readFileSync(base.file,'utf8');
function htmlOnce(a,b){if(html.split(a).length!==2)throw Error('Support study HTML anchor changed: '+a.slice(0,100));html=html.replace(a,()=>b);}
htmlOnce(old,extra+'\n'+app);
htmlOnce('</style>','#save,#open,#file{display:none!important}</style>');
htmlOnce('<title>身体 R29','<title>隔离研究 P1');
htmlOnce('人物身体 · 连续关节与原轮廓','人物身体 · 支撑关系隔离研究');
htmlOnce('./人物身体_R29_连续关节与原形体.html','./人物身体_R30_可回退体量校准.html');
htmlOnce('./身体_R29_原形体与参数衔接.html','./身体_R30_原形体与校准.html');
htmlOnce('CONTINUOUS SOURCE FORM / R29','P1 / SUPPORT STUDY');
htmlOnce('保留轮廓，<br>继续打通动作。','同一人物，<br>比较支撑动作。');
htmlOnce('这是独立的连续关节候选。六种原体型，以及驱动 B 关闭姿态修正的原状态下，四肢动作直接作用于原分区表面函数；六种 Anny 模板接入根关节与五段躯干主链，B 明确关闭修正时也接入根关节与脊柱，头颈边界随原绑定响应。原法线和完整外观仍待验收。','这是与工作页隔离的研究候选：可在同一人物的四个原体型之间，比较原支撑动作与参考人物的支撑动作。静止形体保持各自原始数据；参考人物是当前原人物，并非已验收的中性成人。原数据一致性、极端动作和视觉效果仍待验收。');
htmlOnce('<h2>原体型模板</h2>','<h2>支撑动作对照</h2><p id="support-status" class="small">准备中</p><button id="support-mode" disabled>切换参考支撑</button><p class="small">切换保留当前体型、动作和视角；该研究不会写入完整人物档案。</p><h2>原体型模板</h2>');
htmlOnce('这里选择的是原版体型。任意连续体型滑杆尚未接入这条原轮廓函数路线。','仅提供同一原人物的四种严格体型；任意连续体型与驱动 B 尚未接入这项研究。');
htmlOnce('任意连续体型、驱动 B 开启姿态修正的连续动作、任意颈头参数、原法线和皮肤、完整来源验收、自主母体。当前仍保留原分区和来源系数，没有宣称完成函数母体转换。','原形体完整对照、支撑与软组织的连续分离、多体型及极端动作、原皮肤与自主母体仍未完成。当前保留来源分区和系数，不能视为完成重构。');
const file='delivery/身体_P1_参考支撑隔离研究.html';fs.writeFileSync(file,html);
const sources=[...files,'tools/research/p1/build-locked-preview.cjs'].map(file=>({file,sha256:H(fs.readFileSync(file))}));
const build={schema:'body-p1-support-study/1',file,sha256:H(Buffer.from(html)),bytes:Buffer.byteLength(html),builtUTC:new Date().toISOString(),sources,baseBuild:'BUILD-POSE-R29.json',baseArtifactSHA256:base.sha256,selectedByDefault:false,archiveExportEnabled:false,referenceProfile:'baseline',supportedProfiles:['baseline','lean','fuller','muscular'],arbitraryContinuousBodyShapeImplemented:false,driverBImplemented:false,sourceFidelityAccepted:false,visualAccepted:false,completedMotherConversion:false,acceptanceTolerance:null};
fs.writeFileSync('BUILD-SUPPORT-P1.json',JSON.stringify(build,null,2)+'\n');
console.log(JSON.stringify({file,sha256:build.sha256,selected:false}));
