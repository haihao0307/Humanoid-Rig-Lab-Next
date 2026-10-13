const R=(id,name,body,cap,quarter,heel,trim,length,width,instep)=>({id,name,body,cap,quarter,heel,trim,fit:{length,width,instep}});
export const PRESETS=[
 R('P01','栗棕粒面 · 标准',['heritage','#78533a'],['heritage','#5d3d2d'],['wax','#725039'],['nubuck','#514733'],'#c1aa88',278,1,0),
 R('P02','深咖牛巴 · 宽脚',['nubuck','#544336'],['heritage','#342923'],['wax','#49382c'],['suede','#42372b'],'#ae9275',282,1.09,2),
 R('P03','黑革正装 · 窄脚',['black','#29292c'],['heritage','#252326'],['black','#333039'],['nubuck','#353139'],'#8b8684',274,.94,-2),
 R('P04','酒红油蜡 · 高脚背',['wax','#5e2e2b'],['heritage','#452624'],['wax','#683c37'],['nubuck','#473029'],'#b19271',286,1.03,8),
 R('P05','砂色帆布 · 小楦',['canvas','#b79e7c'],['tan','#715139'],['canvas','#bbaa8d'],['suede','#765d43'],'#63513e',256,.99,0),
 R('P06','靛蓝牛仔 · 加长',['denim','#344660'],['heritage','#493d35'],['denim','#40546b'],['nubuck','#333b49'],'#b39c7a',292,1.02,2),
 R('P07','军绿帆布 · 宽楦',['canvas','#656b4c'],['wax','#4e4230'],['canvas','#727354'],['suede','#4e4b37'],'#ae9a72',286,1.11,3),
 R('P08','烟灰反绒 · 窄楦',['suede','#65615c'],['nubuck','#44423f'],['suede','#77726a'],['heritage','#474038'],'#b6ada0',268,.96,-2),
 R('P09','米白拼棕 · 小码',['canvas','#dbd4c4'],['heritage','#855c3f'],['canvas','#d9cbbb'],['nubuck','#7f6752'],'#8d6f52',252,1,0),
 R('P10','炭黑牛巴 · 超宽',['nubuck','#343638'],['black','#25272a'],['nubuck','#45464a'],['suede','#303235'],'#a6a098',296,1.15,4),
 R('P11','烟草格织 · 高容量',['twill','#84715a'],['wax','#593d2a'],['twill','#9b886b'],['suede','#68513b'],'#c5ae89',288,1.07,10),
 R('P12','海军毛呢 · 大楦',['twill','#323d50'],['black','#222c3a'],['twill','#45556e'],['suede','#303c4c'],'#b4b9bc',306,1.05,5)
];
export const getPreset=id=>{const p=PRESETS.find(p=>p.id===id);if(!p)throw Error('未知成鞋预设');return p;};
export function panelRecipe(p,id){return id===27?p.cap:[22,23].includes(id)?p.quarter:[24,25].includes(id)?p.heel:p.body;}
export function validate(s){getPreset(s.preset);for(const [k,lo,hi]of [['length',240,340],['width',.85,1.25],['instep',-10,16]])if(!Number.isFinite(s.fit?.[k])||s.fit[k]<lo||s.fit[k]>hi)throw Error('鞋楦参数越界：'+k);if(s.schema!=='kaopu-shoe-r10@1')throw Error('鞋配方版本不匹配');if(typeof s.bindings!=='boolean'||typeof s.shoes!=='boolean'||typeof s.transparent!=='boolean')throw Error('开关不是布尔值');return structuredClone(s);}
export const defaults=()=>({schema:'kaopu-shoe-r10@1',preset:'P01',fit:{...getPreset('P01').fit},bindings:true,shoes:true,transparent:false});
