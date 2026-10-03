// All common and species-specific definitions pass through this single renderer.
export function parameterField(d,value,{set,delay=45,format}){
 const row=document.createElement('div');row.className=d.type==='checkbox'?'checkfield':'field';row.dataset.control=d.key;if(d.commonId)row.dataset.common=d.commonId;
 const label=document.createElement('label');label.textContent=d.uiLabel||d.label;label.htmlFor='param-'+d.key;
 const input=document.createElement(d.type==='select'?'select':'input');input.id='param-'+d.key;input.setAttribute('aria-label',d.uiLabel||d.label);
 if(d.type==='checkbox'){input.type='checkbox';input.checked=!!value;input.onchange=()=>set(d.key,input.checked).catch(()=>{});row.append(label,input);}
 else if(d.type==='select'){for(const o of d.options){const option=document.createElement('option');option.value=o.value;option.textContent=o.label;input.append(option);}input.value=String(value);input.onchange=()=>set(d.key,input.value).catch(()=>{});row.append(label,input);}
 else if(d.type==='color'){input.type='color';input.value=value;input.onchange=()=>set(d.key,input.value).catch(()=>{});row.classList.add('colorfield');row.append(label,input);}
 else {const top=document.createElement('div'),out=document.createElement('output');top.className='field-top';out.value=format(value,d);input.type='range';input.min=d.min;input.max=d.max;input.step=d.step;const power=d.uiScale==='power4',toUI=v=>power?Math.pow(v/d.max,.25):v,fromUI=v=>power?Math.round(d.max*v**4*100)/100:v;if(power){input.min=0;input.max=1;input.step=.001;}input.value=toUI(value);input.disabled=!!d.disabled;let timer;input.oninput=()=>{const next=fromUI(+input.value);out.value=format(next,d);clearTimeout(timer);timer=setTimeout(()=>set(d.key,next).catch(()=>{}),delay);};top.append(label,out);row.append(top,input);}
 return row;
}
export function commonDescription(animal,controls,actions,record,basicData,profile){
 return {schema:'kaopu/common@1',parameterSchema:'kaopu/parameters@1',animalId:animal.id,basicData,profile,
  lifecycle:{supported:!!actions.length,playing:!!actions.length&&record.playing!==false,action:record.action||null,actions},
  controls:controls.filter(d=>d.commonId).map(d=>({...d,value:record[d.key]??d.value})),
  extensions:controls.filter(d=>!d.commonId).map(d=>({...d,value:record[d.key]??d.value}))};
}
