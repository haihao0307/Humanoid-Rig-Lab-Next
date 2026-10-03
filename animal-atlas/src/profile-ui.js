import {PROFILE_FIELDS} from './animal-profile.js';
import {parameterField} from './parameter-ui.js';
export const STAGES=['初生','幼年','成长中','成年','老年'];
export const STAGE_IDS=['newborn','juvenile','growing','adult','senior'];
export const STAGE_AGES=[0,.25,.65,1,2];
export function stageFromAge(age,maturity){const a=age/maturity;return a<.1?0:a<.45?1:a<1?2:a<2?3:4;}
export function profilePanel({profile,basic,controls,record,setProfile,setBasic,set,format,actions}){
 const el=document.createElement('section');el.className='section animal-profile';el.dataset.group='profile';
 const title=document.createElement('h3');title.textContent='通用形态与活动';el.append(title);
 const hint=document.createElement('p');hint.className='hint profile-hint';hint.textContent='演示规则 · 年龄 / 成长改变尺寸，胖瘦改变体形，健康改变活动速度。';el.append(hint);
 const demos=controls.filter(d=>d.section==='demo');
 for(const d of demos){const def={...d,disabled:d.key==='demoHealth'&&!actions.length};const row=parameterField(def,record[d.key]??d.value,{set,format,delay:60});row.dataset.profile=({demoAge:'ageYears',demoCondition:'bodyCondition',demoHealth:'health',demoTint:'color',demoSize:'size',demoMaturity:'maturity'})[d.key];el.append(row);
  if(d.key==='demoAge'){const stage={key:'demoStage',label:'成长阶段',type:'range',min:0,max:4,step:1};const stageRow=parameterField(stage,stageFromAge(record.demoAge,record.demoMaturity),{set:async(_,v)=>set('demoStage',v),format:v=>STAGES[v],delay:60});stageRow.dataset.profile='growthStage';el.append(stageRow);}
  if(def.disabled){const note=document.createElement('p');note.className='hint';note.textContent='当前动物没有原生动作，健康活动滑块暂不可用。';row.append(note);}
 }
 const archive=document.createElement('details');archive.className='source-details';archive.dataset.group='archive';const summary=document.createElement('summary');summary.textContent='个体档案与物理基准';archive.append(summary);
 const note=document.createElement('p');note.textContent='上方是可替换的统一演示映射，不是该物种的生长或医学模型。成熟年限是演示校准值，不自动当成物种资料。跨度与体重用于米制导出和排练比例，体重不随形体推算。';archive.append(note);
 const dl=document.createElement('dl');dl.className='profile-records';for(const d of PROFILE_FIELDS.filter(d=>!d.source)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=d.label;dd.dataset.profileRecord=d.key;dd.textContent=profile[d.key]??'未记录';if(d.key==='growthStage'&&profile[d.key])dd.textContent=STAGES[STAGE_IDS.indexOf(profile[d.key])]||profile[d.key];dl.append(dt,dd);}archive.append(dl);
 for(const d of PROFILE_FIELDS.filter(d=>d.source)){const row=document.createElement('div');row.className='field';const label=document.createElement('label');label.textContent=d.label;const input=document.createElement('input');input.type='number';input.id='basic-'+d.key;input.min=d.min;input.max=d.max;input.step='any';input.value=basic?.[d.key]??'';input.disabled=!basic;label.htmlFor=input.id;input.onchange=async()=>{try{await setBasic(d.key,input.valueAsNumber);}catch{input.value=basic?.[d.key]??'';}};row.append(label,input);archive.append(row);}
 return {element:el,archive,consumed:new Set(demos.map(d=>d.key))};
}
