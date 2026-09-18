/* Versioned, parameter-only face recipe. Identity and skin are persistent;
 * expression and generated geometry are deliberately separate runtime data. */
const FACE_APPEARANCE_SCHEMA='jarvis/face_appearance@1';
function validateFaceAppearance(input){
  faceObject(input,'人物外貌');
  if(input.schema!==FACE_APPEARANCE_SCHEMA)throw Error('不支持的人物外貌版本');
  if(Object.keys(input).some(k=>!['schema','generatorRevision','seed','identity','skin'].includes(k)))throw Error('人物外貌含未知字段');
  if(typeof input.generatorRevision!=='string'||!/^[a-f0-9]{64}$/.test(input.generatorRevision))throw Error('人物外貌缺少有效生成器版本');
  skinSeed(input.seed);faceObject(input.identity,'固定身份');skinObject(input.skin,'皮肤配方');
  const identity=validateFacePose({identity:input.identity}).identity,skin=validateSkinAppearance(input.skin);
  if(input.seed!==(identity.seed??skin.seed))throw Error('外貌种子与身份配方不一致');
  return {schema:FACE_APPEARANCE_SCHEMA,generatorRevision:input.generatorRevision,seed:input.seed,identity,skin};
}
function sampleFaceAppearance(seed,palette='east-asian'){
  return validateFaceAppearance({schema:FACE_APPEARANCE_SCHEMA,generatorRevision:HUMAN_GENERATOR_REVISION,
    seed,identity:sampleFaceIdentity(seed),skin:sampleSkinAppearance(seed,palette)});
}
function installFaceAppearance(lab){
  const api={
    export(){const p=lab.character.export();return validateFaceAppearance({schema:FACE_APPEARANCE_SCHEMA,
      generatorRevision:HUMAN_GENERATOR_REVISION,seed:p.appearance.face.identity.seed??p.appearance.skin.seed,identity:p.appearance.face.identity,skin:p.appearance.skin});},
    sample:sampleFaceAppearance,
    async apply(input,{allowGeneratorUpgrade=false}={}){
      const look=validateFaceAppearance(input);
      if(look.generatorRevision!==HUMAN_GENERATOR_REVISION&&!allowGeneratorUpgrade)throw Error('生成器版本不同；需明确迁移后重新检查外貌，不能保证原样恢复');
      const p=lab.character.export();
      await lab.character.apply({...p,appearance:{...p.appearance,skin:look.skin,
        face:{...p.appearance.face,identity:look.identity}}});
      return {appearance:api.export(),upgraded:look.generatorRevision!==HUMAN_GENERATOR_REVISION};
    },
    parameters(){return {schema:FACE_APPEARANCE_SCHEMA,identity:lab.face.shapeParameters(),skin:SKIN_CONTROLS.map(c=>({...c})),
      identityUnits:'dimensionless [-1,1]; authored node residuals in millimetres',colorSpace:'sRGB hex',seedRange:[0,4294967295],
      generatorRevision:HUMAN_GENERATOR_REVISION,expressionIncluded:false,generatedGeometryIncluded:false,
      coverage:'17 controls: shared head proportions and eye spacing plus 13 regional controls; detailed eye/ear shape ranges pending',visualAcceptance:false};}
  };
  const section=document.createElement('section');section.innerHTML=`<h3>人物外貌配方</h3>
    <label>外貌种子 <input data-look="seed" type="number" min="0" max="4294967295" step="1" value="4101"></label>
    <button data-look="sample">按种子生成脸型与皮肤</button><button data-look="export">导出当前外貌</button>
    <label>导入外貌 <input data-look="import" type="file" accept=".json,application/json"></label>
    <output data-look="status" role="status"></output>`;
  document.getElementById('face-panel').append(section);const el=k=>section.querySelector('[data-look="'+k+'"]');
  el('sample').onclick=async()=>{try{await api.apply(api.sample(Number(el('seed').value)));lab.render();el('status').textContent='已更新脸型与皮肤；当前表情保留。';}catch(e){el('status').textContent=e.message;}};
  el('export').onclick=()=>hfDownload(lab.human.characterPreset.id+'.face-appearance.json',JSON.stringify(api.export(),null,2),'application/json');
  el('import').onchange=async()=>{try{const file=el('import').files[0];if(!file||file.size>65536)throw Error('外貌文件为空或过大');await api.apply(JSON.parse(await file.text()));lab.render();el('status').textContent='已恢复人物外貌。';}catch(e){el('status').textContent=e.message;}finally{el('import').value='';}};
  return api;
}
