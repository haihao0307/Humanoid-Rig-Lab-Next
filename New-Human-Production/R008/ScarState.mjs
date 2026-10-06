// Authored survivor-game controls. Healing times/stages are not medical measurements.
export const SCAR_SCHEMA='human-r008/scars@2';
export const SCAR_REGIONS=Object.freeze([
 {id:'rightShoulder',label:'右肩',part:'tripo_part_14',sourceScar:true,centre:[-.218,1.436,.006],radii:[.048,.061,.055]},
 {id:'leftShoulder',label:'左肩',part:'tripo_part_12',sourceScar:false,centre:[.218,1.436,.006],radii:[.048,.061,.055]},
 {id:'rightUpperArm',label:'右上臂',part:'tripo_part_10',sourceScar:true,centre:[-.279,1.264,-.043],radii:[.043,.062,.060]},
 {id:'leftUpperArm',label:'左上臂',part:'tripo_part_11',sourceScar:false,centre:[.279,1.264,-.043],radii:[.043,.062,.060]},
 {id:'rightForearm',label:'右前臂',part:'tripo_part_6',sourceScar:true,centre:[-.297,1.091,.012],radii:[.046,.060,.049]},
 {id:'leftForearm',label:'左前臂',part:'tripo_part_8',sourceScar:false,centre:[.297,1.091,.012],radii:[.046,.060,.049]}
]);
export const SCAR_DEFAULT=Object.freeze({visibility:1,severity:1,color:'#8c3028',tint:0,redness:0,relief:1,roughness:.5,progress:0});
export const SCAR_CONTROLS=Object.freeze([
 {key:'visibility',label:'伤疤明显程度',min:0,max:1,step:.01},
 {key:'severity',label:'受伤程度',min:0,max:1,step:.01},
 {key:'tint',label:'自定义颜色强度',min:0,max:1,step:.01},
 {key:'redness',label:'局部泛红',min:0,max:1,step:.01},
 {key:'relief',label:'凹凸强度',min:0,max:2,step:.01},
 {key:'roughness',label:'伤疤粗糙度',min:0,max:1,step:.01},
 {key:'progress',label:'愈合进度',min:0,max:1,step:.01}
]);
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
function object(v,label){if(!v||typeof v!=='object'||Array.isArray(v))throw Error(label+'必须为对象');return v;}
function number(v,a,b,label){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error(label+'超出范围');return v;}
function keys(v,allowed,label){if(Object.keys(v).some(k=>!allowed.includes(k)))throw Error(label+'含未知字段');}
export function validateScar(input={}){object(input,'伤疤参数');keys(input,Object.keys(SCAR_DEFAULT),'伤疤参数');const p={...SCAR_DEFAULT,...input};for(const c of SCAR_CONTROLS)number(p[c.key],c.min,c.max,c.label);if(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))throw Error('伤疤颜色应为 #RRGGBB');p.color=p.color.toLowerCase();return p;}
export function scarEnvelope(p,region){const q=p.map((v,i)=>(v-region.centre[i])/region.radii[i]);return 1-smooth(.28,1,q.reduce((s,v)=>s+v*v,0));}
export function sourceScarConfidence(rgb){const [r,g,b]=rgb;return smooth(.36,.54,1-g/Math.max(r,.0001))*smooth(.65,.85,b/Math.max(g,.0001))*smooth(.10,.20,r);}
export function resolveScar(p,residual=.15){const age=p.progress,effective=p.visibility*p.severity*(1-age*(1-residual));return {effective,relief:p.visibility*p.severity*p.relief*(1-age),redness:p.redness*(1-age),tint:p.tint,progress:age,roughness:p.roughness};}
export class ScarState {
 constructor(){this.regions=Object.fromEntries(SCAR_REGIONS.map(r=>[r.id,{...SCAR_DEFAULT}]));this.healingHours=240;this.residual=.15;this.automaticHealing=false;this.elapsedHours=0;}
 set(id,patch){const ids=id==='all'?SCAR_REGIONS.map(r=>r.id):[id];for(const key of ids)if(!Object.hasOwn(this.regions,key))throw Error('未知伤疤区域');const next=ids.map(key=>validateScar({...this.regions[key],...object(patch,'伤疤参数')}));ids.forEach((key,i)=>this.regions[key]=next[i]);return this.export();}
 configure(patch){object(patch,'愈合设置');keys(patch,['healingHours','residual','automaticHealing'],'愈合设置');const next={healingHours:this.healingHours,residual:this.residual,automaticHealing:this.automaticHealing,...patch};number(next.healingHours,.1,100000,'愈合小时');number(next.residual,0,1,'淡疤保留');if(typeof next.automaticHealing!=='boolean')throw Error('自动愈合必须为布尔值');Object.assign(this,next);return this.export();}
 preset(id,target='all'){
  const p=id==='original'?{...SCAR_DEFAULT}:id==='clean'?{...SCAR_DEFAULT,visibility:0,progress:1}:id==='fresh'?{...SCAR_DEFAULT,tint:.8,redness:.65,relief:1.2,roughness:.35}:id==='scab'?{...SCAR_DEFAULT,progress:.35,tint:.85,redness:.20,color:'#562d25',roughness:.85}:id==='old'?{...SCAR_DEFAULT,progress:.85,tint:.55,color:'#bb9987',roughness:.65,relief:.7}:id==='healed'?{...SCAR_DEFAULT,progress:1,tint:.4,color:'#bd9f8c',roughness:.55}:null;
  if(!p)throw Error('未知伤疤阶段');return this.set(target,p);
 }
 advance(hours,force=false){number(hours,0,1e7,'经过的游戏小时');number(this.elapsedHours+hours,0,1e9,'累计愈合时间');this.elapsedHours+=hours;if(this.automaticHealing||force)for(const r of SCAR_REGIONS){const p=this.regions[r.id];if(r.sourceScar)p.progress=Math.min(1,p.progress+hours/this.healingHours);}return this.export();}
 export(){return {schema:SCAR_SCHEMA,healingHours:this.healingHours,residual:this.residual,automaticHealing:this.automaticHealing,elapsedHours:this.elapsedHours,regions:Object.fromEntries(SCAR_REGIONS.map(r=>[r.id,{...this.regions[r.id]}]))};}
 restore(recipe){object(recipe,'伤疤存档');keys(recipe,['schema','healingHours','residual','automaticHealing','elapsedHours','regions'],'伤疤存档');if(![SCAR_SCHEMA,'human-r008/scars@1'].includes(recipe.schema))throw Error('伤疤存档版本不匹配');const regions=object(recipe.regions,'伤疤分区');keys(regions,SCAR_REGIONS.map(r=>r.id),'伤疤分区');const next=Object.fromEntries(SCAR_REGIONS.map(r=>[r.id,validateScar((()=>{const row={...object(regions[r.id],r.label)};if(recipe.schema==='human-r008/scars@1'){if(row.active!==undefined&&typeof row.active!=='boolean')throw Error('旧伤疤状态无效');delete row.active;}return row;})())]));number(recipe.elapsedHours,0,1e9,'累计愈合时间');const config={healingHours:recipe.healingHours,residual:recipe.residual,automaticHealing:recipe.automaticHealing};number(config.healingHours,.1,100000,'愈合小时');number(config.residual,0,1,'淡疤保留');if(typeof config.automaticHealing!=='boolean')throw Error('自动愈合必须为布尔值');this.regions=next;Object.assign(this,config,{elapsedHours:recipe.elapsedHours});return this.export();}
}
