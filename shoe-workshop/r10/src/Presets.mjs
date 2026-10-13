// Artist-authored material/fit combinations. Millimetres are model dimensions,
// not ISO shoe sizes, medical fitting or independently measured hide mechanics.
export const PRESETS=[
 {id:'P01',name:'栗棕经典',note:'标准 · 粒面 / 油蜡 / 牛巴',toe:['heritage','#684332'],vamp:['heritage','#805638'],quarter:['wax','#745039'],heel:['nubuck','#584633'],trim:'#bda27d',thread:'#c3aa80',fit:{length:1,width:1,heel:1,instep:0}},
 {id:'P02',name:'深咖宽楦',note:'宽前掌 · 油蜡 / 牛巴',toe:['wax','#443027'],vamp:['nubuck','#5c4636'],quarter:['heritage','#49372b'],heel:['suede','#493b30'],trim:'#b09e89',thread:'#ae9070',fit:{length:1,width:1.10,heel:1.01,instep:1.5}},
 {id:'P03',name:'酒红修长',note:'窄前掌 · 粒面 / 油蜡',toe:['heritage','#522829'],vamp:['wax','#653333'],quarter:['heritage','#743737'],heel:['wax','#45282b'],trim:'#b59b79',thread:'#bfa68a',fit:{length:1.035,width:.95,heel:.98,instep:0}},
 {id:'P04',name:'砂岩帆布',note:'较短 · 粗帆布 / 反绒',toe:['suede','#b29a7f'],vamp:['canvas','#bfaf96'],quarter:['canvas','#c4b49c'],heel:['nubuck','#8c7660'],trim:'#685643',thread:'#9f8669',fit:{length:.955,width:1,heel:.99,instep:-1}},
 {id:'P05',name:'靛蓝牛仔',note:'标准 · 斜纹布 / 棕皮',toe:['heritage','#5b4330'],vamp:['denim','#354965'],quarter:['denim','#3c5372'],heel:['wax','#59412e'],trim:'#b39c7c',thread:'#c5a270',fit:{length:1,width:1.03,heel:1,instep:0}},
 {id:'P06',name:'森林高背',note:'局部高脚背 · 油蜡 / 帆布',toe:['wax','#43392b'],vamp:['canvas','#566047'],quarter:['wax','#535c41'],heel:['suede','#48452f'],trim:'#c0ac84',thread:'#c0aa80',fit:{length:1.015,width:1.04,heel:1,instep:6}},
 {id:'P07',name:'石墨人字纹',note:'较长 · 人字纹布 / 黑革',toe:['black','#343231'],vamp:['herringbone','#625e56'],quarter:['herringbone','#746e61'],heel:['wax','#37332e'],trim:'#aea99e',thread:'#b7b1a3',fit:{length:1.07,width:1.04,heel:1.02,instep:1}},
 {id:'P08',name:'奶油撞棕',note:'窄脚 · 帆布 / 细粒面',toe:['heritage','#6b4b34'],vamp:['canvas','#cfc6b4'],quarter:['canvas','#d5cdbd'],heel:['nubuck','#7b654e'],trim:'#614d3a',thread:'#bcaa89',fit:{length:.99,width:.96,heel:.98,instep:-1.5}},
 {id:'P09',name:'胡桃舒适',note:'宽前掌 / 高容量 · 牛巴',toe:['heritage','#6e4b34'],vamp:['nubuck','#836247'],quarter:['suede','#8d7054'],heel:['wax','#593e2d'],trim:'#cfb28a',thread:'#ceb48d',fit:{length:1.035,width:1.11,heel:1.025,instep:4.5}},
 {id:'P10',name:'午夜低背',note:'局部低脚背 · 深蓝粒面',toe:['black','#252c37'],vamp:['heritage','#2c3546'],quarter:['wax','#364152'],heel:['nubuck','#282f3b'],trim:'#9fa8af',thread:'#a2a5a7',fit:{length:1.02,width:.99,heel:1,instep:-3.5}},
 {id:'P11',name:'烟草大楦',note:'较长 / 宽前掌 · 蜡皮 / 帆布',toe:['wax','#895f3b'],vamp:['canvas','#8f7653'],quarter:['wax','#996c45'],heel:['suede','#65503b'],trim:'#d6bd91',thread:'#d2b17b',fit:{length:1.085,width:1.09,heel:1.035,instep:3}},
 {id:'P12',name:'灰沙轻装',note:'较短 / 标准宽 · 人字纹 / 牛巴',toe:['nubuck','#807768'],vamp:['herringbone','#aaa18e'],quarter:['canvas','#b5ad9c'],heel:['suede','#756b5a'],trim:'#514c43',thread:'#b3aa94',fit:{length:.97,width:1.025,heel:1,instep:1}}
];
export const defaultState=()=>({schema:'kaopu/shoe-pair@1',preset:'P01',fit:{...PRESETS[0].fit},bindings:true,threads:true,wire:false,mode:'pair',view:'hero'});
export function validate(state){const p=PRESETS.find(p=>p.id===state?.preset);if(!p)throw Error('未知鞋款');const fit={...p.fit,...state.fit};for(const [k,lo,hi]of [['length',.92,1.12],['width',.92,1.16],['heel',.95,1.08],['instep',-4,7]])if(!Number.isFinite(fit[k])||fit[k]<lo||fit[k]>hi)throw Error('鞋楦参数越界：'+k);return {...defaultState(),...state,fit};}
export const recipe=(part,p)=>[27].includes(part)?p.toe:part===28?p.vamp:[22,23].includes(part)?p.quarter:[24,25].includes(part)?p.heel:['heritage','#604731'];
