/* Adult body presets. Relationship references: docs/BACK_BODY_R6.md.
 * Same stature, different authored skeleton and soft-tissue proportions.
 * These are two examples, not population means or diagnostic categories. */
const BODY_PRESET_CONFIG=Object.freeze({
 male:{label:'男性',...BODY_ARCHETYPES.male.morphs,breastM:0,gluteM:0},
 female:{label:'女性',...BODY_ARCHETYPES.female.morphs,breastM:BODY_ARCHETYPES.female.morphs.breastProjectionM,gluteM:BODY_ARCHETYPES.female.fat.gluteM}
});
function selectedBodySex(){
 if(typeof window==='undefined')return 'male';
 if(!window.__BODY_PRESET_STATE__){try{const token=new URLSearchParams(window.location.search).get('presetState'),saved=JSON.parse(sessionStorage.getItem('jarvis.pendingBodyPreset')||'null');if(token&&saved?.token===token)window.__BODY_PRESET_STATE__=saved.state;}catch{}}
 const explicit=window.__BODY_PRESET_STATE__?.sex;
 if(Object.hasOwn(BODY_PRESET_CONFIG,explicit))return explicit;
 const query=new URLSearchParams(window.location.search).get('bodySex');
 if(Object.hasOwn(BODY_PRESET_CONFIG,query))return query;
 const initial=window.__NPC_DEFINITION__?.character?.bodySex??window.__CHARACTER_PRESET__?.bodySex;if(Object.hasOwn(BODY_PRESET_CONFIG,initial))return initial;
 try{const saved=localStorage.getItem('jarvis.bodySex');if(Object.hasOwn(BODY_PRESET_CONFIG,saved))return saved;}catch{}
 return 'male';
}
const BODY_SEX=selectedBodySex(),BODY_PRESET=BODY_PRESET_CONFIG[BODY_SEX];
function adultPresetSpec(base){
 const spec=JSON.parse(JSON.stringify(base));spec.sex=BODY_SEX;
 spec.baseline='authored adult '+BODY_SEX+' preset; same comparison stature; not a population mean';
 const archetype=BODY_ARCHETYPES[BODY_SEX],m=initialBodyRigShape();
 Object.assign(spec.rig,archetype.rig);
 spec.rig.clavicleVectorM[0]=(base.rig.scOffsetM[0]+base.rig.clavicleVectorM[0])*m.shoulderWidth-base.rig.scOffsetM[0];
 spec.rig.hipSpacingM=base.rig.hipSpacingM*m.hipWidth;
 spec.rig.pelvisHalfBreadthM=base.rig.pelvisHalfBreadthM*m.hipWidth;
 spec.stance.footHalfSpacingM=base.stance.footHalfSpacingM*m.hipWidth;
 spec.rigShapeSignature=JSON.stringify([BODY_SEX,m]);spec.archetype=archetype.id;
 spec.profiles.torso=base.profiles.torso.map(row=>{const r=[...row],hip=Math.exp(-(((r[0]-.03)/.12)**2)),chest=Math.exp(-(((r[0]-.41)/.13)**2));r[1]*=1+(m.hipWidth-1)*hip+(m.shoulderWidth-1)*chest;r[2]*=1+(archetype.ribDepth-1)*chest;return r;});
 const reach=(f,t)=>Math.sqrt(f*f+t*t+2*f*t*Math.cos(spec.stance.kneeFlexionDeg*Math.PI/180));
 const hipHeight=(f,t)=>spec.stance.ankleHeightM+Math.sqrt(reach(f,t)**2-(spec.stance.footHalfSpacingM-spec.rig.hipSpacingM/2)**2-spec.stance.ankleForwardM**2);
 const plan=spec.bodyPlan;
 spec.axialExtensionM=hipHeight(plan.referenceFemurLengthM,plan.referenceTibiaLengthM)-hipHeight(spec.rig.femurLengthM,spec.rig.tibiaLengthM);
 const mapY=y=>{const u=Math.max(0,Math.min(1,(y-.065)/.425));return y+spec.axialExtensionM*u*u*(3-2*u);};
 spec.authorTorsoProfile=spec.profiles.torso.map(r=>[...r]);
 spec.rig.lumbarY=spec.rig.lumbarY.map(mapY);spec.rig.thoracicY=spec.rig.thoracicY.map(mapY);spec.rig.cervicalStartY=mapY(spec.rig.cervicalStartY);
 spec.profiles.torso=spec.profiles.torso.map(r=>[mapY(r[0]),...r.slice(1)]);
 spec.baseline='authored 175 cm adult '+BODY_SEX+' design; AIST relationships are references, not a population mean';
 return Object.freeze(spec);
}
function switchBodyPreset(sex,character=null,npc=null,forceRebuild=false){
 if(!Object.hasOwn(BODY_PRESET_CONFIG,sex))throw Error('未知人体预设');
 if(sex===BODY_SEX&&!forceRebuild)return;
 const lab=window.HumanLab;
 if(lab?.agent?.held||lab?.agent?.skill||lab?.agent?.basic?.busy||lab?.agent?.plan){throw Error('请先完成当前身体动作再切换预设');}
 if(['torso','headNeck','shoulders','hands','character'].some(k=>lab?.[k]?.busy))throw Error('请等待形体重建完成');
 const local=lab?.lowerLimb?.active?lab.lowerLimb:lab?.torso;
 const state={sex,lowerLimb:!!lab?.lowerLimb?.active,torso:!!lab?.torso?.active,view:local?.lastView||'side',mode:local?.mode||'clay'};
 state.lowerScope=lab?.lowerLimb?.scope||'lower';
 state.studio=['lowerLimb','headNeck','torso','shoulders','hands'].find(k=>lab?.[k]?.active)||null;
 if(state.studio){state.view=lab[state.studio].lastView||'threequarter';state.mode=lab[state.studio].mode||'skin';}
 if(character)state.character=validateCharacterPreset({...character,bodySex:sex,bodyArchetype:BODY_ARCHETYPES[sex].id});
 else if(lab?.character){const current=lab.character.export();state.character=validateCharacterPreset({...current,bodySex:sex,bodyArchetype:BODY_ARCHETYPES[sex].id,strength:new StrengthModel(makeCharacterStrengthProfile(sex)).export(),appearance:{...current.appearance,morphs:defaultCharacterMorphs(sex)}});}
 if(npc)state.npc=validateNPCDefinition({...npc,character:state.character});
 else if(lab?.npc)state.npc=validateNPCDefinition({...lab.npc.export(),character:state.character});
 // A new document releases the old GPU/context and all preset-specific caches.
 // The embedded body uses its own original srcdoc, preserving the outer app.
 const frame=window.frameElement;
 if(frame?.srcdoc){
  const parsed=new DOMParser().parseFromString(frame.srcdoc,'text/html');
  parsed.getElementById('body-preset-state')?.remove();
  const config=parsed.createElement('script');config.id='body-preset-state';
  config.textContent='window.__BODY_PRESET_STATE__='+JSON.stringify(state).replace(/</g,'\\u003c')+';';
  parsed.head.append(config);
  frame.srcdoc='<!doctype html>'+parsed.documentElement.outerHTML;
 }else{
  const url=new URL(window.location.href);url.searchParams.set('bodySex',sex);
  const token=crypto.randomUUID();sessionStorage.setItem('jarvis.pendingBodyPreset',JSON.stringify({token,state}));url.searchParams.set('presetState',token);
  if(state.lowerLimb||state.torso){url.searchParams.set('bodyStudio',state.lowerLimb?'lowerLimb':'torso');url.searchParams.set('bodyView',state.view);url.searchParams.set('bodyLayer',state.mode);}
  else for(const key of ['bodyStudio','bodyView','bodyLayer'])url.searchParams.delete(key);
  window.location.assign(url.href);
 }
 try{localStorage.setItem('jarvis.bodySex',sex);}catch{}
}
function installBodyPresetControls(){
 const root=document.createElement('div');root.id='body-preset-control';
 root.innerHTML='<label>人体预设 <select aria-label="人体性别预设"><option value="male">男性</option><option value="female">女性</option></select></label><span role="status"></span>';
 const select=root.querySelector('select');select.value=BODY_SEX;
 select.onchange=()=>{try{select.disabled=true;root.querySelector('span').textContent='正在重建人体…';switchBodyPreset(select.value);}catch(e){select.value=BODY_SEX;select.disabled=false;root.querySelector('span').textContent=e.message;}};
 document.body.append(root);
}
