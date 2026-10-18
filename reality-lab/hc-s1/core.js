/* KAOPU Reality HC S1. Pure functions: never mutates a host or submitted document. */
(function(root){
'use strict';
const VERSION='0.1.0', SCHEMA='kaopu/reality-observation@1';
const DOMAINS=Object.freeze(['human','garment','pattern','fabric','footwear']);
const LENGTH=Object.freeze({m:1,cm:.01,mm:.001,in:.0254,ft:.3048});
const BASIS=Object.freeze(['source_declared','runtime_computed','physical_measured','artistic','unknown','test_fixture']);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const array=(x,n)=>Array.isArray(x)&&x.length===n&&x.every(finite);
const clone=x=>JSON.parse(JSON.stringify(x));
function length(value,from,to='m'){
 if(!finite(value))throw Error('长度必须为有限数值');
 if(!Object.hasOwn(LENGTH,from)||!Object.hasOwn(LENGTH,to))throw Error('未知长度单位；Tex、比例和像素不能当作长度');
 return value*LENGTH[from]/LENGTH[to];
}
function det(m){return m[0]*(m[4]*m[8]-m[7]*m[5])-m[3]*(m[1]*m[8]-m[7]*m[2])+m[6]*(m[1]*m[5]-m[4]*m[2]);}
function checkBasis(m,handedness='right'){
 if(!array(m,9)||!['left','right'].includes(handedness))return false;
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  let dot=0;for(let k=0;k<3;k++)dot+=m[i*3+k]*m[j*3+k];
  if(Math.abs(dot-(i===j?1:0))>1e-8)return false;
 }
 return Math.abs(det(m)-(handedness==='left'?-1:1))<1e-8;
}
function pointToMeters(point,unit,basis){
 if(!array(point,3)||!array(basis,9))throw Error('坐标数据无效');
 if(!checkBasis(basis,'right')&&!checkBasis(basis,'left'))throw Error('轴变换必须正交；缩放只能在单位转换中出现一次');
 const p=point.map(x=>length(x,unit));
 return [0,1,2].map(i=>basis[i]*p[0]+basis[3+i]*p[1]+basis[6+i]*p[2]);
}
function basisMapsAxes(f){
 if(!f||!checkBasis(f.toCanonicalBasis,f.handedness))return false;
 for(const [axis,expected]of [[f.up,[0,1,0]],[f.forward,[0,0,1]]]){
  if(typeof axis!=='string'||!/^[-+][XYZ]$/.test(axis))return false;
  const p=[0,0,0];p['XYZ'.indexOf(axis[1])]=axis[0]==='-'?-1:1;
  const actual=pointToMeters(p,'m',f.toCanonicalBasis);
  if(actual.some((v,i)=>Math.abs(v-expected[i])>1e-8))return false;
 }
 return true;
}
function pixelFootprint({distanceM,fovYDeg,zoom=1,heightPx},featureMm){
 if(![distanceM,fovYDeg,zoom,heightPx,featureMm].every(finite)||distanceM<=0||zoom<=0||heightPx<=0||featureMm<0||fovYDeg<=0||fovYDeg>=180)throw Error('相机或尺度数据无效');
 const mmPerPixel=2000*distanceM*Math.tan(fovYDeg*Math.PI/360)/(zoom*heightPx);
 return {mmPerPixel,featurePixels:featureMm/mmPerPixel,assumption:'透视相机；样本平面垂直视轴；distanceM 是视轴深度。非斜角表面、镜头模糊或人眼可见性保证。'};
}
function validate(doc){
 const rows=[];
 const add=(id,status,message,detail=null)=>rows.push({id,status,message,detail});
 const unknown=(id,msg)=>add(id,'unknown',msg);
 if(!doc||typeof doc!=='object'||Array.isArray(doc))return {schema:'kaopu/reality-validation@1',version:VERSION,status:'rejected',rows:[{id:'document',status:'fail',message:'必须输入一个 JSON 对象'}],physicalCertification:false,visualAcceptance:false,hostModified:false};
 add('schema',doc.schema===SCHEMA?'pass':'fail','观察协议必须为 '+SCHEMA);
 add('scope',DOMAINS.includes(doc.domain)?'pass':'fail','仅允许人物、成衣、裁片、布料、鞋履',doc.domain??null);
 add('identity',typeof doc.assetId==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(doc.assetId)?'pass':'fail','对象需要稳定标识');
 const s=doc.source;
 if(!s)unknown('source','未提供源版本；不得当成当前项目真实读数');
 else {
  add('source.commit',typeof s.commit==='string'&&/^[0-9a-f]{40}$/.test(s.commit)?'pass':'fail','源文件绑定完整不可变提交',s.commit??null);
  add('source.path',typeof s.path==='string'&&s.path.length>0&&!s.path.startsWith('/')&&!s.path.split('/').includes('..')?'pass':'fail','源文件路径必须明确且不越界');
  add('source.repo',typeof s.repository==='string'&&/^[\w.-]+\/[\w.-]+$/.test(s.repository)?'pass':'fail','源仓库声明');
  if(s.sha256===null||s.sha256===undefined)unknown('source.digest','未提供已核对的文件摘要');
  else add('source.digest',typeof s.sha256==='string'&&/^[0-9a-f]{64}$/.test(s.sha256)?'pass':'fail','文件 SHA-256 格式',s.sha256);
 }
 const u=doc.units;
 if(!u)unknown('units','长度单位未声明；不会按大小自动猜米或毫米');
 else {
  for(const k of ['geometry','scene']){
   if(u[k]===null||u[k]===undefined)unknown('units.'+k,'尚未确认'+(k==='geometry'?'源几何':'场景')+'长度单位');
   else add('units.'+k,Object.hasOwn(LENGTH,u[k])?'pass':'fail',k+' 长度单位',u[k]);
  }
  if(u.geometryToScene!==null&&u.geometryToScene!==undefined){
   const expected=Object.hasOwn(LENGTH,u.geometry)&&Object.hasOwn(LENGTH,u.scene)?LENGTH[u.geometry]/LENGTH[u.scene]:null;
   add('units.transform',expected!==null&&finite(u.geometryToScene)&&Math.abs(u.geometryToScene-expected)<=1e-10*Math.max(1,expected)?'pass':'fail','只换算一次：源几何单位 → 场景单位',{declared:u.geometryToScene,expected});
  }
 }
 const f=doc.frame;
 if(!f)unknown('frame','坐标轴或手性尚未声明');
 else {
  const axes=['+X','-X','+Y','-Y','+Z','-Z'];
  add('frame.axes',axes.includes(f.up)&&axes.includes(f.forward)&&f.up.slice(1)!==f.forward.slice(1)?'pass':'fail','向上与正面轴必须明确且不平行');
  add('frame.handedness',['right','left'].includes(f.handedness)?'pass':'fail','坐标手性');
  if(f.toCanonicalBasis==null)unknown('frame.transform','尚未审核到基准坐标系的轴转换');
  else {
   add('frame.transform',checkBasis(f.toCanonicalBasis,f.handedness)?'pass':'fail','列主序轴转换必须正交，不能夹带第二次长度缩放');
   add('frame.mapping',basisMapsAxes(f)?'pass':'fail','声明的向上 / 正面轴必须映射到基准 +Y / +Z，不能只看矩阵行列式');
  }
  if(!f.lateralMeaning)unknown('frame.lateral','对象解剖学左右未审核；不能仅凭 X 正负猜左脚或右脚');
 }
 const d=doc.dimensions;
 if(!d)unknown('dimensions','尚无尺寸观测；不从类别名称生成尺寸');
 else {
  add('dimensions.values',array(d.xyz,3)&&d.xyz.every(x=>x>0)?'pass':'fail','包围范围 X / Y / Z 必须为正有限数值');
  add('dimensions.unit',Object.hasOwn(LENGTH,d.unit)?'pass':'fail','尺寸结果单独声明单位');
  add('dimensions.basis',BASIS.includes(d.basis)?'pass':'fail','区分源声明、运行计算、实物测量与艺术设定',d.basis??null);
  if(!d.method)unknown('dimensions.method','缺少测量或计算方法');
  if(d.basis!=='physical_measured')unknown('reality.measurement','数字几何尺寸不是实物测量，也不证明符合人体或制造规格');
  else {
   const e=doc.evidence||{};
   add('reality.protocol',typeof e.specimen==='string'&&!!e.specimen&&typeof e.protocol==='string'&&!!e.protocol&&finite(e.uncertaintyM)&&e.uncertaintyM>=0?'pass':'fail','实物测量必须提供样本、方法及量纲明确的不确定度');
  }
 }
 if(doc.evidence?.confidence!=null){
  const e=doc.evidence;
  add('evidence.confidence',finite(e.confidence)&&e.confidence>=0&&e.confidence<=1&&typeof e.confidenceMethod==='string'&&!!e.confidenceMethod?'pass':'fail','数值置信度必须附校准或生成方法；不填装饰性 0.82');
 }
 const c=doc.camera;
 if(!c)unknown('camera','尚未读取原生相机；不能认为已经采用标准镜头');
 else if(c.projection==='perspective'){
  add('camera.perspective',finite(c.fovYDeg)&&c.fovYDeg>0&&c.fovYDeg<180&&finite(c.aspect)&&c.aspect>0&&finite(c.zoom)&&c.zoom>0&&finite(c.near)&&finite(c.far)&&c.near>0&&c.far>c.near?'pass':'fail','透视相机的垂直视场、缩放、宽高比和裁剪面');
  add('camera.position',array(c.position,3)?'pass':'fail','相机位置为三个有限值');
  add('camera.buffer',array(c.bufferPx,2)&&c.bufferPx.every(x=>Number.isInteger(x)&&x>0)?'pass':'fail','记录真正 drawing buffer 像素，而非只记录 CSS 宽度');
  if(array(c.bufferPx,2)&&finite(c.aspect))add('camera.aspect',Math.abs(c.aspect-c.bufferPx[0]/c.bufferPx[1])<.02?'pass':'fail','投影宽高比与实际画布比例相符');
  if(c.calibrated!==true)unknown('camera.calibration','记录的是原台数字镜头，不是实物摄影标定；S1 不强改镜头');
 }else unknown('camera.projection','S1 暂不审核此投影类型：'+String(c.projection));
 const col=doc.color;
 if(!col)unknown('color','颜色工作空间与输出未声明');
 else {
  add('color.output',['srgb','srgb-linear','display-p3'].includes(col.output)?'pass':'unknown','原生输出颜色空间',col.output??null);
  unknown('color.calibration','本阶段只读记录曝光与色调映射，未更换灯光、未实施 ACES/OCIO 标定');
 }
 if(doc.preservation){for(const k of ['geometry','camera','settings'])add('preservation.'+k,doc.preservation[k]===true?'pass':'fail','本次同步读取前后 '+k+' 未改变');}
 else unknown('preservation','没有本次原生对象的读取前后保护证据');
 const failed=rows.filter(r=>r.status==='fail').length,unresolved=rows.filter(r=>r.status==='unknown').length;
 return {schema:'kaopu/reality-validation@1',version:VERSION,assetId:doc.assetId??null,domain:doc.domain??null,status:failed?'rejected':unresolved?'partial':'declaration-valid',counts:{pass:rows.filter(r=>r.status==='pass').length,fail:failed,unknown:unresolved},rows,hostModified:false,physicalCertification:false,visualAcceptance:false,productionReady:false};
}
const api=Object.freeze({VERSION,SCHEMA,DOMAINS,LENGTH,BASIS,length,det,checkBasis,basisMapsAxes,pointToMeters,pixelFootprint,validate,clone});
root.RealityCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
