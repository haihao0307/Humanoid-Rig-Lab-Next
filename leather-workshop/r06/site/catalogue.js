import * as T from 'three';
import {LeatherKernel,PRESETS,DEFAULT,FINISHES} from '../../r02/site/leather.js';
import {SewingAppearance} from '../../r05/site/appearance.js';
export const CATALOGUE=[
 {id:'heritage',name:'精细涂饰粒面',tag:'R05 扫描衍生',family:'inherited',source:'r05',color:'#73482e',description:'继承 R05 的真实粒面。薄颜料覆盖、细小毛孔和低对比油光；不是另一个独立测量样本。'},
 ...Object.entries(PRESETS).map(([id,p])=>({id,name:p.name,tag:'R02 原程序预设',family:'inherited',source:'r02',preset:id,description:({tan:'透明染色的细粒面，保持细小凹凸与自然色差。',wax:'深色油蜡涂饰，折转处的反光比粒面更柔和。',black:'较饱满的荔枝粒面，保持颗粒尺度而不是单纯换成黑色。',nubuck:'低涂层、柔和绒感的磨砂牛巴表面。',cross:'方向明确的细密交叉压纹，用于检查尺度与方向。',croco:'矩形鳞片压纹风格，不冒称实测鳄鱼皮。',ostrich:'毛囊珠点压纹风格，不冒称实测鸵鸟皮。',suede:'高粗糙度、方向性微纤维变化的反绒表面。'})[id]})),
 {id:'vintage',name:'原始做旧粒面',tag:'同源外观对照',family:'finish',source:'r05',color:'#68442f',raw:true,description:'同一 R05 Brown Leather 粒面保留更多天然色斑与凹凸。外观对照，不计为新材料。'},
 {id:'patent',name:'深棕漆皮',tag:'漆皮涂饰',family:'finish',source:'r02',preset:'tan',override:{color:'#34251e',finish:'patent',coat:.95,roughness:.22,depth:.045},description:'原细粒基底上的漆皮涂饰，反射强度与粒面分开控制。'},
 {id:'metallic',name:'香槟金属箔',tag:'金属箔涂饰',family:'finish',source:'r02',preset:'tan',override:{color:'#a89162',finish:'metallic',coat:.18,roughness:.39,depth:.075},description:'已有金属箔涂饰能力进入陈列。仅表面处理，不自动改变力学参数。'},
 {id:'pearl',name:'象牙珠光',tag:'珠光涂饰',family:'finish',source:'r02',preset:'tan',override:{color:'#c1b8a4',finish:'pearl',coat:.55,roughness:.37,depth:.07},description:'已有珠光涂饰能力进入陈列，保持柔和亮部与表面细纹。'}
];
export class AtelierMaterials{
 constructor(renderer,data){this.renderer=renderer;this.data=data;this.small=new Map();this.hero=null;this.appearance=new SewingAppearance();}
 async init(progress){
  await this.appearance.load(this.data);
  for(const t of Object.values(this.appearance.textures)){t.wrapS=t.wrapT=T.MirroredRepeatWrapping;t.repeat.set(96/150,96/75);t.offset.set(0,0);}
  for(let i=0;i<CATALOGUE.length;i++){const c=CATALOGUE[i];this.small.set(c.id,this.create(c,256));progress?.(i+1,CATALOGUE.length);await new Promise(r=>setTimeout(r,0));}
 }
 create(c,res){
  if(c.source==='r05'){const look={...DEFAULT,color:c.color,roughness:c.raw?.48:.50,coat:.13};const mat=this.appearance.grain(look,!!c.raw);mat.vertexColors=false;const prior=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{prior(shader);const chunk=T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;',`mapN.xy *= normalScale;
vec2 parity=mod(floor(vNormalMapUv),2.);mapN.xy*=vec2(1.)-2.*parity;
vec2 edge=min(fract(vNormalMapUv),1.-fract(vNormalMapUv));mapN.xy*=smoothstep(vec2(0.),vec2(.007),edge);`);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',chunk);};mat.customProgramCacheKey=()=>`r06-mirror-grain-${c.id}`;mat.userData.catalogueId=c.id;return{material:mat,params:look,source:c.source,dispose:()=>mat.dispose()};}
  const kernel=new LeatherKernel(this.renderer);const params={...DEFAULT,...PRESETS[c.preset],...c.override,resolution:res,seed:27};const material=kernel.bake(params);material.userData.catalogueId=c.id;return{material,params,source:c.source,dispose:()=>kernel.dispose()};
 }
 select(id){const c=CATALOGUE.find(c=>c.id===id);if(!c)throw Error('无效皮料');const next=this.create(c,innerWidth<761?1024:2048);const old=this.hero;this.hero=next;if(old)old.dispose();return next;}
 recipe(id){const c=CATALOGUE.find(c=>c.id===id);return{catalogue:c,parameters:this.hero?.params,sourceAnchor:'e86c36c8c34b1f2b57cc5462459ee2f490e556af',physicalCalibration:'NOT_MEASURED_FOR_THIS_APPEARANCE',surfaceProvenance:c.source==='r05'?'Poly Haven Brown Leather / Rob Tuytel / CC0-1.0 / preserved R05 crop, mirrored repeat with normal-vector parity correction only in R06':'Preserved R02 LeatherKernel, no Adobe asset data',tileSizeMM:c.source==='r05'?[300,150]:[96,96]};}
}
