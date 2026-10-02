import references from './basic-references.json' with {type:'json'};
export const BASIC_SCHEMA='kaopu/basic@1';
export function validateBasic(b){
 if(b?.schema!==BASIC_SCHEMA||b.units?.length!=='m'||b.units?.mass!=='kg')throw Error('基本数据需要 kaopu/basic@1，单位为 m / kg');
 for(const [key,min,max]of [['referenceSpanM',.001,100],['massKg',.000001,200000],['sourceSpan',1e-8,1e6],['metersPerUnit',1e-9,1e8]])if(typeof b[key]!=='number'||!Number.isFinite(b[key])||b[key]<min||b[key]>max)throw Error('基本数据 '+key+' 无效');
 if(Math.abs(b.metersPerUnit-b.referenceSpanM/b.sourceSpan)>1e-8*Math.max(b.referenceSpanM/b.sourceSpan,b.metersPerUnit))throw Error('基本数据尺度换算不一致');
 if(!['planning-estimate','user-declared'].includes(b.basis)||typeof b.stage!=='string'||b.stage.length>80||b.measure!=='reference-pose-maximum-span')throw Error('基本数据需要声明基准姿态、阶段和数值依据');return b;
}
export function factoryBasic(id){return references[id]?structuredClone(references[id]):null;}
export function sourceBasic(bake){const b=bake.source?.basicData;if(b)return validateBasic(b);const r=factoryBasic(bake.source?.animalId);return r&&r.calibration.sourceSha256===bake.source?.sourceSha256?r:null;}
export function meshBounds(items){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const m of items)for(let i=0;i<m.positions.length;i++){const k=i%3;min[k]=Math.min(min[k],m.positions[i]);max[k]=Math.max(max[k],m.positions[i]);}return {min,max,size:max.map((v,k)=>v-min[k])};}
export function declaredBasic(span,mass,sourceSpan,base){return validateBasic({...base,schema:BASIC_SCHEMA,units:{length:'m',mass:'kg'},referenceSpanM:span,massKg:mass,sourceSpan,metersPerUnit:span/sourceSpan,basis:'user-declared',stage:base?.stage||'用户指定个体',measure:'reference-pose-maximum-span'});}
export function basicSummary(b){return b?'基准跨度 '+b.referenceSpanM+' m · 体重 '+b.massKg+' kg · '+(b.basis==='planning-estimate'?'规划估算':'用户声明'):'基本数据待补全';}
