// Shared verbatim with the assembled character UI. No DOM or surface evaluation.
export function hairSeed(key){
 let h=2166136261;for(const c of String(key))h=Math.imul(h^c.charCodeAt(0),16777619);
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return (h^h>>>16)>>>0;
}
export function validateHairProfile(input={},characterSeed=0,catalog){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('毛发配方必须为对象');
 if(input.schema!=null&&input.schema!=='human-hair-profile/v1')throw Error('不支持的毛发配方版本');
 const allowed=['schema','preset','seed','color','density','lengthScale','quality'];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('毛发配方包含未知字段');
 const choices=catalog.presets.filter(p=>p.id!=='bald'&&p.autoSelect!==false);
 const preset=input.preset??(characterSeed===0?catalog.defaultPreset:choices[hairSeed(characterSeed+'/style')%choices.length].id),p=catalog.presets.find(p=>p.id===preset);
 if(!p)throw Error('未知发型预设：'+preset);
 const seed=input.seed??hairSeed(characterSeed+'/'+p.seed),color=input.color??p.color;
 const density=input.density??1,lengthScale=input.lengthScale??1,quality=input.quality??catalog.defaultQuality;
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('毛发种子须为 0 至 4294967295 的整数');
 if(typeof color!=='string'||!/^#[a-f\d]{6}$/i.test(color))throw Error('发色须为六位十六进制颜色');
 if(!Number.isFinite(density)||density<.45||density>1.3||!Number.isFinite(lengthScale)||lengthScale<.65||lengthScale>1.35)throw Error('毛发密度或长度超出发型配方范围');
 if(!Object.hasOwn(catalog.qualities,quality))throw Error('未知毛发开销档');
 return {schema:'human-hair-profile/v1',preset,seed,color:color.toLowerCase(),density,lengthScale,quality};
}
export function resolveHairProfile(input,characterSeed,catalog,baseRules){
 const profile=validateHairProfile(input,characterSeed,catalog),p=catalog.presets.find(p=>p.id===profile.preset),budget=catalog.qualities[profile.quality];
 const variation=.94+.12*(hairSeed(profile.seed+'/length')/4294967296),scale=profile.lengthScale*variation;
 return {profile,budget,design:p.design||null,styleScale:scale,rules:{...baseRules,seed:profile.seed,style:profile.preset,
  topLengthMetres:p.topLength*scale,sideLengthMetres:p.sideLength*scale,frontLengthAdditionMetres:p.topLength*.08*scale,
  topLiftMetres:p.lift*scale,sideLiftMetres:Math.min(p.lift*.35,.0018)*scale,
  waveAmplitudeMetres:p.wave*scale,waveCycles:p.waveCycles,sweep:p.sweep,part:p.part,hairlineInset:p.hairline,
  clumpStrength:.22,maximumCandidates:catalog.maximumCandidates},
  maximumStrands:profile.preset==='bald'?0:Math.floor(budget.maximumStrands*Math.min(1,profile.density)),
  widthScale:Math.sqrt(6000/budget.maximumStrands)*Math.max(1,profile.density)};
}
