import {PROFILE_FIELDS} from './animal-profile.js';
import {parameterField} from './parameter-ui.js';
// One profile layout for every animal. Unsupported biology remains explicit archive data.
export function profilePanel({profile,basic,controls,record,setProfile,setBasic,set,format}){
 const el=document.createElement('section');el.className='section animal-profile';el.dataset.group='profile';
 const title=document.createElement('h3');title.textContent='动物档案与状态';el.append(title);
 const hint=document.createElement('p');hint.className='hint profile-hint';hint.textContent='档案记录随文件保存；“模型”项实时改变外观。';el.append(hint);
 const grid=document.createElement('div');grid.className='profile-grid';el.append(grid);
 const color=controls.find(d=>d.type==='color'&&d.commonId==='surface.color');
 for(const d of PROFILE_FIELDS){
  if(d.key==='color'&&color){const row=parameterField(color,record[color.key]??color.value,{set,format});row.dataset.profile=d.key;row.classList.add('profile-model');const badge=document.createElement('small');badge.className='profile-badge';badge.textContent='模型';row.querySelector('label').append(badge);grid.append(row);continue;}
  const row=document.createElement('div');row.className='field profile-field';row.dataset.profile=d.key;if(d.type==='range'||d.type==='color')row.classList.add('profile-wide');
  const top=document.createElement('div');top.className='field-top';const label=document.createElement('label');label.textContent=d.label;label.htmlFor=(d.source?'basic-':'profile-')+d.key;
  const badge=document.createElement('small');badge.className='profile-badge';badge.textContent=d.source?'基准':'档案';label.append(badge);top.append(label);row.append(top);
  const input=document.createElement(d.type==='select'?'select':'input');input.id=label.htmlFor;input.setAttribute('aria-label',d.label);let value=d.source?basic?.[d.key]:profile[d.key];
  const commit=async next=>{try{await (d.source?setBasic(d.key,next):setProfile(d.key,next));value=next;sync();}catch{sync();}};
  const sync=()=>{if(d.type==='select')input.value=value??'';else if(d.type==='range'){input.value=value??50;out.value=value===null?'未记录':String(value);input.setAttribute('aria-valuetext',value===null?'未记录':String(value));}else if(d.type==='color'){input.value=value??'#888888';out.value=value??'未记录';}else input.value=value??'';if(clear)clear.hidden=value===null;};
  let out,clear;
  if(d.type==='select'){for(const o of d.options){const option=document.createElement('option');option.value=o.value;option.textContent=o.label;input.append(option);}input.onchange=()=>commit(input.value||null);}
  else{input.type=d.type;input.min=d.min??'';input.max=d.max??'';input.step=d.step??'any';
   if(d.type==='number'){input.placeholder='未记录';input.disabled=d.source&&!basic;input.onchange=()=>commit(input.value===''?null:input.valueAsNumber);}
   else{out=document.createElement('output');top.append(out);input.onchange=()=>commit(d.type==='color'?input.value:input.valueAsNumber);if(d.type==='range')input.oninput=()=>{out.value=input.value;input.setAttribute('aria-valuetext',input.value);};}
  }
  if(d.nullable&&d.type!=='select'){clear=document.createElement('button');clear.className='profile-clear';clear.type='button';clear.textContent='×';clear.title='清除'+d.label+'记录';clear.setAttribute('aria-label',clear.title);clear.onclick=()=>commit(null);top.append(clear);}
  row.append(input);if(d.ends){const ends=document.createElement('div');ends.className='profile-ends';for(const text of d.ends){const span=document.createElement('span');span.textContent=text;ends.append(span);}row.append(ends);}sync();grid.append(row);
 }
 // Actual source morphology parameters retain their units and ranges.
 const modelControls=controls.filter(d=>d.commonId==='object.scale'||d.key==='bulk');
 for(const d of modelControls){const row=parameterField(d,record[d.key]??d.value,{set,format,delay:220});row.classList.add('profile-model');const badge=document.createElement('small');badge.className='profile-badge';badge.textContent='模型';row.querySelector('label').append(badge);el.append(row);}
 return {element:el,consumed:new Set([...(color?[color.key]:[]),...modelControls.map(d=>d.key)])};
}
