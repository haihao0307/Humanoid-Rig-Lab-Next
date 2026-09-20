/* Authored skin appearance, independent of anatomy, identity and physiology.
 * Hex colours are sRGB; renderer colours are linear-sRGB. No image assets.
 * These are art controls, not measured melanin or haemoglobin concentrations. */
const SKIN_SCHEMA='jarvis/skin_appearance@2';
const SKIN_LEGACY_SCHEMA='jarvis/skin_appearance@1';
const SKIN_DEFAULT=Object.freeze({schema:SKIN_SCHEMA,baseColor:'#d0ac91',undertone:.02,redness:0,roughness:.52,oil:.25,scatter:.30,variation:.30,pores:.35,sunExposure:.32,weathering:.16,seed:0});
const SKIN_CONTROLS=Object.freeze([
 {key:'undertone',label:'冷暖底调',min:-1,max:1,step:.01,hint:'负值偏冷，正值偏暖'},
 {key:'redness',label:'红润',min:0,max:1,step:.01,hint:'面颊与耳部更明显的柔和血色'},
 {key:'roughness',label:'粗糙度',min:.30,max:.85,step:.01,hint:'越高越哑光'},
 {key:'oil',label:'油光',min:0,max:1,step:.01,hint:'额鼻略亮，面颊与身体更柔和'},
 {key:'scatter',label:'散射柔和度',min:0,max:1,step:.01,hint:'受光边缘的暖色柔化'},
 {key:'variation',label:'肤色细微变化',min:0,max:1,step:.01,hint:'避免全身颜色过于均匀'},
 {key:'pores',label:'微表面细节',min:0,max:1,step:.01,hint:'浅毛孔与细微起伏，远处融入粗糙度'},
 {key:'sunExposure',label:'日晒加深',min:0,max:1,step:.01,hint:'全身日晒深浅与领口、袖口、裤脚的柔和晒痕；0 为无日晒'},
 {key:'weathering',label:'户外粗糙感',min:0,max:1,step:.01,hint:'日晒部位更哑光、纹理略明显，可独立调整'}
]);
// Kunming scene art profiles: relative appearance, not UV dose, occupation,
// ancestry, age or a measured distribution of local residents.
const SKIN_EXPOSURE_PRESETS=Object.freeze([
 {id:'protected',label:'较少日晒',sunExposure:.08,weathering:.04},
 {id:'everyday',label:'日常户外',sunExposure:.32,weathering:.16},
 {id:'outdoors',label:'经常户外',sunExposure:.60,weathering:.28},
 {id:'weathered',label:'长期户外痕迹',sunExposure:.78,weathering:.52}
]);
// Designed colour swatches, not ethnic categories or measured reflectance data.
const SKIN_PRESETS=Object.freeze([
 {id:'reference',label:'参考肤色',baseColor:'#bba894',undertone:0},
 {id:'porcelain',label:'浅色 · 冷调',baseColor:'#ead0c4',undertone:-.35},
 {id:'light-warm',label:'浅色 · 暖调',baseColor:'#dfbd9f',undertone:.30},
 {id:'medium-neutral',label:'中间色 · 中性',baseColor:'#c49777',undertone:0},
 {id:'medium-warm',label:'中间色 · 暖调',baseColor:'#ad7956',undertone:.25},
 {id:'brown-neutral',label:'棕色 · 中性',baseColor:'#875b43',undertone:0},
 {id:'deep-warm',label:'深色 · 暖调',baseColor:'#624230',undertone:.20},
 {id:'deep-neutral',label:'深色 · 中性',baseColor:'#422e27',undertone:-.10}
]);
// Scene art palette, not an ethnicity classifier or a measured population
// distribution. Rows: light / medium / deeper; columns: cool / neutral /
// golden / muted olive. Surface roughness and oil remain independent.
const EAST_ASIAN_SKIN_PRESETS=Object.freeze([
 {id:'ea-light-cool',label:'浅肤 · 柔冷',baseColor:'#e2c4b6',undertone:-.10,redness:0},
 {id:'ea-light-neutral',label:'浅肤 · 中性',baseColor:'#e2c3aa',undertone:.02,redness:0},
 {id:'ea-light-golden',label:'浅肤 · 暖金',baseColor:'#e1be9a',undertone:.12,redness:0},
 {id:'ea-light-olive',label:'浅肤 · 橄榄',baseColor:'#d6bea5',undertone:-.01,redness:0},
 {id:'ea-medium-cool',label:'中等 · 柔冷',baseColor:'#cfaa96',undertone:-.10,redness:0},
 {id:'ea-medium-neutral',label:'中等 · 中性',baseColor:'#d0ac91',undertone:.02,redness:0},
 {id:'ea-medium-golden',label:'中等 · 暖金',baseColor:'#d0a57f',undertone:.12,redness:0},
 {id:'ea-medium-olive',label:'中等 · 橄榄',baseColor:'#c3a88c',undertone:-.01,redness:0},
 {id:'ea-deeper-cool',label:'较深 · 柔冷',baseColor:'#b78c76',undertone:-.08,redness:0},
 {id:'ea-deeper-neutral',label:'较深 · 中性',baseColor:'#b58e70',undertone:.03,redness:0},
 {id:'ea-deeper-golden',label:'较深 · 暖金',baseColor:'#b58a65',undertone:.10,redness:0},
 {id:'ea-deeper-olive',label:'较深 · 橄榄',baseColor:'#aa8b6b',undertone:0,redness:0}
]);
function skinPresetCatalog(palette='east-asian'){
 if(palette==='east-asian')return EAST_ASIAN_SKIN_PRESETS;
 if(palette==='general')return SKIN_PRESETS;
 throw Error('未知肤色范围');
}
function skinObject(input,label){if(!input||typeof input!=='object'||Array.isArray(input))throw Error(label+'必须为对象');return input;}
function skinSeed(seed){if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('皮肤种子应为 0 至 4294967295 的整数');return seed;}
function skinSRGBToLinear(value){return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);}
function skinLinearToSRGB(value){return value<=.0031308?value*12.92:1.055*Math.pow(value,1/2.4)-.055;}
function skinHexToLinear(hex){return [1,3,5].map(at=>skinSRGBToLinear(parseInt(hex.slice(at,at+2),16)/255));}
function skinLinearToHex(rgb){
 if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw Error('旧版 skinColor 必须是三个 0 至 1 的线性颜色值');
 return '#'+rgb.map(v=>Math.round(skinLinearToSRGB(v)*255).toString(16).padStart(2,'0')).join('');
}
function validateSkinAppearance(input={}){
 skinObject(input,'皮肤配方');
 if(Object.keys(input).some(k=>!Object.hasOwn(SKIN_DEFAULT,k)))throw Error('皮肤配方含未知字段');
 const legacy=input.schema===SKIN_LEGACY_SCHEMA;
 if(input.schema!==undefined&&input.schema!==SKIN_SCHEMA&&!legacy)throw Error('不支持的皮肤配方版本');
 if(legacy&&(Object.hasOwn(input,'sunExposure')||Object.hasOwn(input,'weathering')))throw Error('旧版皮肤配方不支持日晒参数');
 // Explicit v1 imports keep their original shading; only new recipes receive
 // the scene's moderate outdoor default. Export always writes the new schema.
 const p={...SKIN_DEFAULT,...input,...(legacy?{sunExposure:0,weathering:0}:{}),schema:SKIN_SCHEMA};
 if(typeof p.baseColor!=='string'||!/^#[a-fA-F0-9]{6}$/.test(p.baseColor))throw Error('皮肤底色应为 #RRGGBB');
 p.baseColor=p.baseColor.toLowerCase();
 for(const c of SKIN_CONTROLS)if(typeof p[c.key]!=='number'||!Number.isFinite(p[c.key])||p[c.key]<c.min||p[c.key]>c.max)throw Error(c.label+'超出范围 '+c.min+' 至 '+c.max);
 skinSeed(p.seed);return p;
}
function skinPreset(id,seed=0){
 const p=EAST_ASIAN_SKIN_PRESETS.find(p=>p.id===id)||SKIN_PRESETS.find(p=>p.id===id);if(!p)throw Error('未知皮肤预设');
 return validateSkinAppearance({...SKIN_DEFAULT,baseColor:p.baseColor,undertone:p.undertone,redness:p.redness??0,seed});
}
function sampleSkinAppearance(seed,palette='east-asian'){
 skinSeed(seed);const catalog=skinPresetCatalog(palette);let state=(seed^0x6d2b79f5)>>>0;
 const random=()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
 // Interpolate depth within one undertone family, in linear light. The middle
 // depths are more common in this scene's art distribution; weights are not
 // demographic claims. General mode retains the previous full-range sampler.
 let ramp,position;
 if(palette==='east-asian'){
  const tone=random(),family=tone<.20?0:tone<.60?1:tone<.85?2:3;
  ramp=[catalog[family],catalog[4+family],catalog[8+family]];position=random()+random();
 }else{ramp=catalog.slice(1);position=random()*(ramp.length-1);}
 const index=Math.min(Math.floor(position),ramp.length-2),weight=position-index;
 const a=skinHexToLinear(ramp[index].baseColor),b=skinHexToLinear(ramp[index+1].baseColor),round=v=>Math.round(v*1000)/1000;
 const blend=key=>ramp[index][key]+(ramp[index+1][key]-ramp[index][key])*weight;
 const undertone=palette==='east-asian'?blend('undertone')+(random()-.5)*.12:(random()-.5)*.8;
 const redness=0;
 return validateSkinAppearance({...SKIN_DEFAULT,baseColor:skinLinearToHex(a.map((v,i)=>v+(b[i]-v)*weight)),
  undertone:round(undertone),redness:round(redness),roughness:round(.46+random()*.20),oil:round(.12+random()*.30),
  scatter:round(.20+random()*.25),variation:round(.15+random()*.35),pores:round(.20+random()*.35),
  sunExposure:palette==='east-asian'?round(.08+(random()+random())*.32):0,
  weathering:palette==='east-asian'?round(.03+random()*.32):0,seed});
}
function characterSkinAppearance(appearance){
 skinObject(appearance,'角色外观');
 // The explicit recipe owns colour. skinColor remains a derived legacy alias.
 if(appearance.skin!==undefined)return validateSkinAppearance(appearance.skin);
 return validateSkinAppearance(appearance.skinColor===undefined?{}:{baseColor:skinLinearToHex(appearance.skinColor),undertone:0,redness:0,sunExposure:0,weathering:0});
}
function resolveSkinMaterial(input){
 const p=validateSkinAppearance(input),linear=skinHexToLinear(p.baseColor);
 const color=linear.map((v,i)=>clamp(v*(1+p.undertone*[.055,.012,-.075][i]),0,1));
 return {color,lipColor:color.map((v,i)=>clamp(v*[.79,.48,.49][i],0,1)),
  surface:[p.roughness,p.oil,p.scatter],detail:[p.variation,p.pores,p.redness],exposure:[p.sunExposure,p.weathering],
  seedOffset:[(p.seed&1023)*.137,((p.seed>>>10)&1023)*.173,((p.seed>>>20)&4095)*.071]};
}
function installSkinAppearance(lab){
 const panel=document.createElement('section');panel.id='skin-panel';panel.hidden=true;
 panel.innerHTML=`<p>昆明场景采用东亚基础肤色，并单独调整高原日晒形成的肤色深浅和表面状态。导出角色可保存。</p>
  <label class="skin-palette-row">肤色范围 <select id="skin-palette"><option value="east-asian">东亚场景 · 12 种细分</option><option value="general">通用 · 宽范围肤色</option></select></label>
  <div class="skin-swatches" aria-label="肤色预设"></div>
  <p class="settings-hint">日晒经历：先选基础肤色，再按人物的户外生活调整。</p>
  <div class="skin-exposure-presets" aria-label="日晒经历"></div>
  <label class="skin-color-row">基础肤色 <input id="skin-color" type="color" aria-label="基础肤色"><input id="skin-hex" type="text" maxlength="7" spellcheck="false" aria-label="肤色十六进制值"></label>
  <div id="skin-sliders"></div>
  <label class="skin-seed-row">生成种子 <input id="skin-seed" type="number" min="0" max="4294967295" step="1"></label>
  <button id="skin-sample" type="button">在所选范围内生成</button><button id="skin-reset" type="button">恢复场景默认</button>
  <button id="skin-show" type="button">显示皮肤视图</button><button id="skin-export" type="button">导出皮肤配方</button>
  <label class="skin-import">导入皮肤配方 <input id="skin-import" type="file" accept=".json,application/json"></label>
  <p class="settings-hint">肤色色块代表基础颜色；人物受光后会有明暗变化。灰模和关节分区视图保留各自的颜色。</p>
  <output id="skin-status" role="status" aria-live="polite"></output>`;
 document.body.append(panel);const el=id=>panel.querySelector('#skin-'+id);
 const api={
  export:()=>validateSkinAppearance(lab.human.characterPreset.appearance.skin),
  apply(input){const p=validateSkinAppearance(input),material=resolveSkinMaterial(p),appearance={...lab.human.characterPreset.appearance,skin:p,skinColor:skinHexToLinear(p.baseColor)};
   lab.human.characterPreset={...lab.human.characterPreset,appearance};lab.human.tissue.setSkinAppearance(p,material);api.refresh();needsRedraw=true;return api.export();},
  set(patch){skinObject(patch,'皮肤调整');return api.apply({...api.export(),...patch});},
  sample:sampleSkinAppearance,
  presets:(palette='east-asian')=>skinPresetCatalog(palette).map(p=>({...p})),
  exposurePresets:()=>SKIN_EXPOSURE_PRESETS.map(p=>({...p})),
  applyExposure(id){const p=SKIN_EXPOSURE_PRESETS.find(p=>p.id===id);if(!p)throw Error('未知日晒经历');return api.set({sunExposure:p.sunExposure,weathering:p.weathering});},
  report:()=>({schema:SKIN_SCHEMA,parameters:api.export(),surfaceModel:COMPACT_SKIN_SURFACE.revision,surfaceStorage:'authored functions and parameters',surfaceFrame:'canonical metres',surfaceChannels:['pigment','microrelief','roughness','oil','cavity'],colorInput:'srgb-hex',colorWorkingSpace:'linear-srgb',scattering:lab.renderer?.skinTransport?.active?'bounded screen-space diffuse transport; local fallback outside face':'local wrapped-light approximation',transport:lab.renderer?.skinTransport?.report()||null,measuredPhysiology:false,generatedImageMaps:0,geometryRebuilt:false,runtimeVerified:false,visualAcceptance:false}),
  refresh(){const p=api.export();el('color').value=p.baseColor;el('hex').value=p.baseColor;el('seed').value=p.seed;
   for(const c of SKIN_CONTROLS){el(c.key).value=p[c.key];el(c.key+'-value').textContent=p[c.key].toFixed(2);}
   for(const button of panel.querySelectorAll('[data-skin-preset]')){const swatch=skinPreset(button.dataset.skinPreset);button.setAttribute('aria-pressed',String(p.baseColor===swatch.baseColor&&p.undertone===swatch.undertone&&p.redness===swatch.redness));}
   for(const button of panel.querySelectorAll('[data-skin-exposure]')){const profile=SKIN_EXPOSURE_PRESETS.find(v=>v.id===button.dataset.skinExposure);button.setAttribute('aria-pressed',String(p.sunExposure===profile.sunExposure&&p.weathering===profile.weathering));}
  }
 };
 const edit=operation=>{try{operation();el('status').textContent='皮肤参数已更新；导出角色可保存。';}catch(error){el('status').textContent=error.message;api.refresh();}};
 const renderSwatches=()=>{const list=panel.querySelector('.skin-swatches');list.replaceChildren();
  for(const preset of skinPresetCatalog(el('palette').value)){const button=document.createElement('button');button.type='button';button.className='skin-swatch';button.title=preset.label;button.dataset.skinPreset=preset.id;button.setAttribute('aria-label',preset.label);
   const chip=document.createElement('span');chip.style.background=preset.baseColor;chip.setAttribute('aria-hidden','true');button.append(chip,document.createTextNode(preset.label));
   button.onclick=()=>edit(()=>{const p=skinPreset(preset.id);api.set({baseColor:p.baseColor,undertone:p.undertone,redness:p.redness});});list.append(button);
  }api.refresh();
 };
 el('palette').onchange=renderSwatches;
 for(const profile of SKIN_EXPOSURE_PRESETS){const button=document.createElement('button');button.type='button';button.dataset.skinExposure=profile.id;button.textContent=profile.label;button.onclick=()=>edit(()=>api.applyExposure(profile.id));panel.querySelector('.skin-exposure-presets').append(button);}
 for(const c of SKIN_CONTROLS){const row=document.createElement('label');row.className='skin-slider';row.htmlFor='skin-'+c.key;
  row.innerHTML=`<span>${c.label}</span><output id="skin-${c.key}-value" for="skin-${c.key}"></output><input id="skin-${c.key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}"><small>${c.hint}</small>`;
  el('sliders').append(row);el(c.key).oninput=e=>edit(()=>api.set({[c.key]:Number(e.target.value)}));
 }
 el('color').oninput=e=>edit(()=>api.set({baseColor:e.target.value}));el('hex').onchange=e=>edit(()=>api.set({baseColor:e.target.value.trim()}));
 el('seed').onchange=e=>edit(()=>{if(!e.target.value.trim())throw Error('请输入生成种子');api.set({seed:Number(e.target.value)});});
 el('sample').onclick=()=>edit(()=>{if(!el('seed').value.trim())throw Error('请输入生成种子');api.apply(api.sample(Number(el('seed').value),el('palette').value));});
 el('reset').onclick=()=>edit(()=>{el('palette').value='east-asian';api.apply(SKIN_DEFAULT);renderSwatches();});
 el('show').onclick=()=>{lab.human.tissue.setView('skin');const view=document.getElementById('r2-view');if(view)view.value='skin';needsRedraw=true;el('status').textContent='已切换到皮肤视图';};
 el('export').onclick=()=>hfDownload(lab.human.characterPreset.id+'.skin.json',JSON.stringify(api.export(),null,2),'application/json');
 el('import').onchange=async()=>{try{const file=el('import').files[0];if(!file||file.size>16384)throw Error('皮肤文件为空或超过 16 KB');const p=JSON.parse(await file.text());if(p?.schema!==SKIN_SCHEMA&&p?.schema!==SKIN_LEGACY_SCHEMA)throw Error('请选择受支持版本的皮肤配方文件');edit(()=>api.apply(p));}catch(error){el('status').textContent=error.message;}finally{el('import').value='';}};
 renderSwatches();return api;
}
