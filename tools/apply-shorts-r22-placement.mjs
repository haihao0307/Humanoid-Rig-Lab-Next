// Idempotent canonical-source migration for the R2.2 placement review.
// It only wires the review path; production sewing remains unchanged.
import fs from 'node:fs';
const edits=new Map();
const read=file=>edits.has(file)?edits.get(file):fs.readFileSync(file,'utf8');
function replace(file,before,after){const text=read(file);if(text.includes(after))return;if(!text.includes(before)||text.indexOf(before)!==text.lastIndexOf(before))throw Error('Ambiguous source anchor: '+file+' '+before.slice(0,80));edits.set(file,text.replace(before,after));}

const cloth='clothing/ClothShorts.js';
replace(cloth,"const SHORTS_ASSEMBLY_STEP_LIMIT=1600;",`const SHORTS_ASSEMBLY_STEP_LIMIT=1600;
const SHORTS_PANEL_REVIEW_TINTS=Object.freeze({FL:[.20,.62,.90],BL:[.12,.38,.72],FR:[.94,.48,.22],BR:[.72,.24,.14],G:[.54,.72,.24],WFL:[.43,.78,.94],WFR:[1.,.67,.34],WBR:[.82,.38,.25],WBL:[.27,.52,.82]});
function shortsReviewFragment(source){return source.replace('uniform sampler2D shadow;','uniform sampler2D shadow;uniform float uPanelReview;uniform vec3 uPanelTint;').replace('O=vec4(col,1.);}','if(uPanelReview>.5)col=mix(col,uPanelTint,.66);O=vec4(col,1.);}');}`);
replace(cloth,"  this.surface=surface;this.gl=surface.gl;this.buffers=[];this.disposed=false;",`  this.surface=surface;this.gl=surface.gl;this.buffers=[];this.disposed=false;
  const search=typeof window==='object'?(window.parent?.location?.search||window.location?.search||''):'';this.placementReview=/(?:[?&])shortsPlacement=r2(?:\\.|%2E)2(?:&|$)/i.test(search);this.placementReport=null;`);
replace(cloth,"  this.report={generator:'cut-and-sewn-shorts@1',triangles:this.count/3,panels:this.pattern.pieces.length,geometryBytes:this.geometryBytes,textureScale:3,clothDynamics:true,legSkinning:false};","  this.report={generator:'cut-and-sewn-shorts@1',triangles:this.count/3,panels:this.pattern.pieces.length,geometryBytes:this.geometryBytes,textureScale:3,clothDynamics:true,legSkinning:false,placementReview:this.placementReview};");
replace(cloth,"this.main=program(gl,SHORTS_VERTEX,LINEN_MATERIAL_FRAGMENT);","this.main=program(gl,SHORTS_VERTEX,shortsReviewFragment(LINEN_MATERIAL_FRAGMENT));");
replace(cloth,"['uCam','uMode','uMaterial','uLight','uNeutral','uCompare','uDiag','uViewport','uTime','uCoarse','uWeave','uSlub','uAge','uFarId','uSheen','uFuzz']","['uCam','uMode','uMaterial','uLight','uNeutral','uCompare','uDiag','uViewport','uTime','uCoarse','uWeave','uSlub','uAge','uFarId','uSheen','uFuzz','uPanelReview','uPanelTint']");
replace(cloth,"  if(this.disposed)throw Error('Sewing was disposed');\n  if(this.assemblyReady)return this.assemblyReport;",`  if(this.disposed)throw Error('Sewing was disposed');
  if(this.placementReview&&maxSteps!==0)throw Error('R2.2 rigid placement review cannot activate sewing');
  if(this.assemblyReady)return this.assemblyReport;`);
replace(cloth,`   // This one rigid placement belongs to dressing setup. It keeps the flat
   // original pieces at the actor's actual world location and orientation.
   const h=this.surface.boundHuman,source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));
   this.body.update();
   for(const piece of this.pattern.pieces){const p=piece.placement;p.origin=add(current.p,rotate(q,sub(p.origin,source.p)));p.basisU=rotate(q,p.basisU);p.basisV=rotate(q,p.basisV);}
   this.simulation=new ShortsCloth(this.pattern,this.body,SHORTS_WEARING_OPTIONS);this.placed=true;
`,`   // Production keeps the original rigid dressing transform. R2.2 review uses
   // a final-pose pelvis frame and a horizontal independent gusset workspace;
   // neither path alters paper UVs, topology, mass, seams or the Human rig.
   const h=this.surface.boundHuman;
   this.body.update();
   if(this.placementReview)this.placementReport=applyShortsRigidPlacementR2(this.pattern,this.body,h);
   else{const source=h.sourceBind.get('hips'),current=h.byId.get('hips').world,q=qnorm(qm(current.q,inv(source.q)));
    for(const piece of this.pattern.pieces){const p=piece.placement;p.origin=add(current.p,rotate(q,sub(p.origin,source.p)));p.basisU=rotate(q,p.basisU);p.basisV=rotate(q,p.basisV);}}
   this.simulation=new ShortsCloth(this.pattern,this.body,SHORTS_WEARING_OPTIONS);this.placed=true;
`);
replace(cloth,`  const report=this.simulation.report();this.assemblyReady=this.acceptsAssembly(report);
  this.assemblyState=this.assemblyReady?'ready':this.failedAssembly(report)?'failed':'incomplete';
  this.assemblyReport={...report,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs};return this.assemblyReport;
`,`  const report=this.simulation.report();
  if(this.placementReview){this.assemblyReady=false;this.assemblyState=this.placementReport?.valid?'placement-ready':'placement-failed';
   this.assemblyReport={...report,placement:this.placementReport,assemblyState:this.assemblyState,assemblySteps:0,wallTimeMs:this.assemblyWallTimeMs,visualAcceptance:false};return this.assemblyReport;}
  this.assemblyReady=this.acceptsAssembly(report);
  this.assemblyState=this.assemblyReady?'ready':this.failedAssembly(report)?'failed':'incomplete';
  this.assemblyReport={...report,assemblyState:this.assemblyState,assemblySteps:this.simulation.stepIndex,wallTimeMs:this.assemblyWallTimeMs};return this.assemblyReport;
`);
replace(cloth,"diagnostics(){return {...this.report,pattern:","diagnostics(){return {...this.report,placement:this.placementReport,pattern:");
replace(cloth,`  if(!depth){const u=this.materialUniforms;gl.uniform3fv(u.uCam,r.eye);gl.uniform2f(u.uViewport,gl.drawingBufferWidth,gl.drawingBufferHeight);for(const [key,value]of Object.entries({uMode:2,uMaterial:0,uLight:0,uNeutral:0,uCompare:0,uDiag:0}))gl.uniform1i(u[key],value);for(const [key,value]of Object.entries({uCoarse:1,uWeave:1,uSlub:1,uAge:.35,uFarId:1,uSheen:1,uFuzz:1,uTime:0}))gl.uniform1f(u[key],value);gl.uniformMatrix4fv(p.u.lightVP,false,r.lightVP);gl.uniform1i(p.u.shadow,1);gl.uniform1f(p.u.shadowsEnabled,r.quality==='shadow'&&r.shadowAvailable?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,r.shadow);}
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.frontFace(gl.CCW);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);if(depth)r.shadowDrawCalls++;else r.drawCalls++;gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);
`,`  if(!depth){const u=this.materialUniforms;gl.uniform3fv(u.uCam,r.eye);gl.uniform2f(u.uViewport,gl.drawingBufferWidth,gl.drawingBufferHeight);for(const [key,value]of Object.entries({uMode:2,uMaterial:0,uLight:0,uNeutral:0,uCompare:0,uDiag:0}))gl.uniform1i(u[key],value);for(const [key,value]of Object.entries({uCoarse:1,uWeave:1,uSlub:1,uAge:.35,uFarId:1,uSheen:1,uFuzz:1,uTime:0,uPanelReview:this.placementReview?1:0}))gl.uniform1f(u[key],value);gl.uniform3fv(u.uPanelTint,[1,1,1]);gl.uniformMatrix4fv(p.u.lightVP,false,r.lightVP);gl.uniform1i(p.u.shadow,1);gl.uniform1f(p.u.shadowsEnabled,r.quality==='shadow'&&r.shadowAvailable?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,r.shadow);}
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.frontFace(gl.CCW);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.vao);
  if(!depth&&this.placementReview){for(const range of this.simulation.pieceRanges){gl.uniform3fv(this.materialUniforms.uPanelTint,SHORTS_PANEL_REVIEW_TINTS[range.id]||[.65,.65,.65]);gl.drawElements(gl.TRIANGLES,range.triangleCount*3,gl.UNSIGNED_INT,range.triangleOffset*3*4);r.drawCalls++;}}
  else{gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_INT,0);if(depth)r.shadowDrawCalls++;else r.drawCalls++;}
  gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);
`);

const controls='clothing/ShortsControls.js';
replace(controls," const query=new URLSearchParams(window.parent.location.search),single=query.has('shorts')||query.has('linen');"," const query=new URLSearchParams(window.parent.location.search),single=query.has('shorts')||query.has('linen'),placementReview=query.get('shortsPlacement')==='r2.2';");
replace(controls," const api={studio:single,focus(view='angle'){"," const api={studio:single,placementReview,focus(view='angle'){");
replace(controls,` const panel=document.createElement('section');panel.id='shorts-controls';panel.innerHTML='<b>布片短裤</b><span data-status style="margin-left:12px"></span><div><button data-view="angle">全身</button><button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="back">背面</button><button data-view="cloth">近看</button><button data-action="sew">继续缝制</button><button data-command="向前走0.6米">走路</button><button data-command="坐在地上">坐下</button><button data-command="站起来">站起</button><button data-action="pause">暂停</button></div>';
 const style=document.createElement('style');style.textContent='#shorts-controls{position:fixed;z-index:50;left:18px;bottom:18px;max-width:calc(100% - 36px);padding:12px 16px;background:#152022ee;border:1px solid #52615b;border-radius:10px;color:#e1e6d8;font:13px/1.5 system-ui}#shorts-controls b{font-size:17px}#shorts-controls div{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#shorts-controls button{background:#263632;color:#e1e6d8;border:1px solid #53655c;border-radius:5px;padding:6px 10px;cursor:pointer}.compact-panel,.hud,.worldLabel,.npc-population{display:none!important}';document.head.append(style);document.body.append(panel);
`,` const panel=document.createElement('section');panel.id='shorts-controls';
 const reviewLegend='<div class="shorts-legend"><span><i style="background:#339ee6"></i>FL 左前</span><span><i style="background:#1f61b8"></i>BL 左后</span><span><i style="background:#f07838"></i>FR 右前</span><span><i style="background:#b83d24"></i>BR 右后</span><span><i style="background:#8ab83d"></i>G 裆补片</span><span><i style="background:#74c7ef"></i>左腰头</span><span><i style="background:#ffa955"></i>右腰头</span></div>';
 panel.innerHTML=(placementReview?'<b>R2.2 九片原布刚性初摆</b>':'<b>布片短裤</b>')+'<span data-status style="margin-left:12px"></span><div><button data-view="angle">全身</button><button data-view="front">正面</button><button data-view="side">侧面</button><button data-view="back">背面</button><button data-view="cloth">近看</button>'+(placementReview?'':'<button data-action="sew">继续缝制</button><button data-command="向前走0.6米">走路</button><button data-command="坐在地上">坐下</button><button data-command="站起来">站起</button><button data-action="pause">暂停</button>')+'</div>'+(placementReview?reviewLegend:'');
 const style=document.createElement('style');style.textContent='#shorts-controls{position:fixed;z-index:50;left:18px;bottom:18px;max-width:calc(100% - 36px);padding:12px 16px;background:#152022ee;border:1px solid #52615b;border-radius:10px;color:#e1e6d8;font:13px/1.5 system-ui}#shorts-controls b{font-size:17px}#shorts-controls div{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}#shorts-controls button{background:#263632;color:#e1e6d8;border:1px solid #53655c;border-radius:5px;padding:6px 10px;cursor:pointer}.shorts-legend span{display:inline-flex;align-items:center;gap:5px;margin-right:8px}.shorts-legend i{width:11px;height:11px;border-radius:2px;display:inline-block}.compact-panel,.hud,.worldLabel,.npc-population{display:none!important}';document.head.append(style);document.body.append(panel);
`);
replace(controls,`  const garment=lab.compact?.skirt,ready=garment?.assemblyReady===true,busy=garment?.assemblyState==='sewing',failed=garment?.assemblyState==='failed',sewn=garment?.assemblyReport?.sewn===true;
  panel.querySelector('[data-status]').textContent=ready?'已缝合 · 待试穿检查':sewn?'接缝已闭合 · 物理检查未通过':failed?'布片检查未通过':busy?'正在缝合短裤':'尚未缝完';
  for(const b of panel.querySelectorAll('[data-command],[data-action="pause"]'))b.disabled=!ready;
  const sew=panel.querySelector('[data-action="sew"]');sew.hidden=ready||failed;sew.disabled=busy;
`,`  const garment=lab.compact?.skirt,ready=garment?.assemblyReady===true,busy=garment?.assemblyState==='sewing',failed=garment?.assemblyState==='failed',sewn=garment?.assemblyReport?.sewn===true;
  if(placementReview){const report=garment?.placementReport;panel.querySelector('[data-status]').textContent=report?.valid?'左右与前后归属通过 · G 已水平展开 · 未缝合':'初摆检查未通过';return;}
  panel.querySelector('[data-status]').textContent=ready?'已缝合 · 待试穿检查':sewn?'接缝已闭合 · 物理检查未通过':failed?'布片检查未通过':busy?'正在缝合短裤':'尚未缝完';
  for(const b of panel.querySelectorAll('[data-command],[data-action="pause"]'))b.disabled=!ready;
  const sew=panel.querySelector('[data-action="sew"]');if(sew){sew.hidden=ready||failed;sew.disabled=busy;}
`);

const manifest='source/assembly.json',m=JSON.parse(read(manifest)),module='clothing/ShortsPlacementR2.js';
if(!m.modules.includes(module)){const index=m.modules.indexOf('clothing/ShortsLegAssembly.js');if(index<0)throw Error('Missing ShortsLegAssembly source anchor');m.modules.splice(index,0,module);edits.set(manifest,JSON.stringify(m,null,2)+'\n');}
replace('source/runtime.template.js','/*__SOURCE:clothing/ShortsLegAssembly.js__*/','/*__SOURCE:clothing/ShortsPlacementR2.js__*/\n/*__SOURCE:clothing/ShortsLegAssembly.js__*/');
for(const [file,text]of edits)fs.writeFileSync(file,text);
console.log('R2.2 placement migration:',[...edits.keys()].join(', ')||'already applied');
