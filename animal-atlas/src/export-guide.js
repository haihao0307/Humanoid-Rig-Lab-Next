// Human-readable descriptions follow the existing exporters; this module never changes file contents.
export const EXPORT_FORMATS = {
 bake:{name:'靠谱烘焙 · 形态与生命活动',extension:'.kaopu-bake.json',summary:'带走当前形态与参数，在排练台继续原生动作。',content:'当前形态网格、基础材质、参数、尺寸与体重、来源，以及匹配版本的原动物运行器。',usage:'导入排练台；其他网站通过靠谱排练运行器接入。',limits:'需要匹配的靠谱运行器；不能直接当 GLB 使用。只保留动物原有动作，静态动物不会新增生命活动。鱼群模式导出当前选中单体。'},
 glb:{name:'GLB · 当前姿态',extension:'.glb',summary:'通用三维文件，带走当前单体的静态姿态。',content:'当前姿态网格、基础材质与顶点颜色、支持的内嵌纹理和参数元数据；网格单位为米。',usage:'导入支持 glTF 2.0 的网站、引擎或三维编辑器。',limits:'不含展示环境、原动作控制器或程序化生成函数；复杂材质可能与工作台不同。鱼群模式导出当前选中单体。'},
 html:{name:'HTML · 动作与材质',extension:'.animal.html',summary:'可双击打开的独立动物网页，保留原有动作和材质。',content:'当前动物的程序、模型或生成数据、原动作与材质、当前参数及展示环境；运行资源内嵌。',usage:'离线双击运行，或作为 iframe 嵌入其他网站；鱼群展示选此格式。',limits:'这是完整网页，不是能直接加入 Three.js 场景的模型。保存参数与动作选择，不是逐帧录像。'},
 json:{name:'JSON · 参数配方',extension:'.animal.json',summary:'轻量保存当前参数，回到同一动物继续调整。',content:'动物 ID、版本与来源指纹、当前参数、尺寸与体重。',usage:'在工作台导入，恢复已存在的对应动物。',limits:'不携带网格、生成程序或完整动物知识。换浏览器时，导入对象须先安装对应动物。'},
 score:{name:'靠谱乐谱',extension:'.score.json',summary:'记录乐器身份、形体谱和参数，供匹配乐器重新演奏。',content:'乐器身份与版本、动物 ID、参数、尺寸与体重；K4/K5 还包含完整程序化形体谱。',usage:'交给已安装的匹配乐器重新生成或恢复形态。',limits:'不包含运行器代码；GLB 参数谱不包含 GLB 本体，内置动物谱也不携带原模型。纯乐谱不包含知识封套。'},
 kaopu:{name:'靠谱动物包',extension:'.kaopu.json',summary:'把动物内容与乐谱一起移交，具体内容取决于动物来源。',content:'动物名称、分类、基本数据和乐谱；程序化对象带形体谱，导入 GLB 对象带 GLB；已有知识与扩展封套随包保留。',usage:'导入同版工作台，或交给支持该乐器的仓库。',limits:'内置对象引用包需要接收平台已有同版动物。动物包不等于生命活动烘焙；要进排练台继续原生动作，请用靠谱烘焙。'}
};

export function initExportGuide({current,record}) {
 const $=id=>document.getElementById(id),select=$('export-format'),dialog=$('export-guide'),cards=new Map();
 function context(format){
  const a=current(),r=a&&record(a.id);if(!a)return '载入动物后可导出。';
  if(format==='kaopu')return '当前对象「'+a.name+'」：'+(r?.glb?'动物包内嵌该对象的 GLB 和参数。':a.adapter==='native'?'动物包携带 K4/K5 形体谱与参数，接收方需要匹配乐器。':'动物包仅携带内置动物引用和参数，接收方需要同版动物。');
  if(format==='score')return '当前对象「'+a.name+'」：'+(a.adapter==='native'?'乐谱包含 K4/K5 形体谱，匹配乐器可重建。':'乐谱不携带模型，接收方需先有匹配动物或模型。');
  if(format==='html'&&r?.bake)return '当前对象「'+a.name+'」来自烘焙快照：HTML 使用目录中的静态展示运行器；保留原生命活动请导出靠谱烘焙。';
  return '当前对象：'+a.name+'。文件保存导出时的参数；动物行为能力由原模块提供。';
 }
 function update(){
  const format=select.value,d=EXPORT_FORMATS[format];if(!d)return;
  $('export-help').textContent=d.extension+' · '+d.summary;select.title=$('export-help').textContent;
  $('export-guide-current').textContent='当前选择：'+d.name+' '+d.extension;
  $('export-guide-context').textContent=context(format);
  for(const [key,card] of cards){card.open=key===format;card.classList.toggle('selected',key===format);card.querySelector('button').setAttribute('aria-pressed',String(key===format));}
 }
 for(const [key,d]of Object.entries(EXPORT_FORMATS)){
  const card=document.createElement('details');card.className='export-format-card';card.dataset.format=key;
  const summary=document.createElement('summary');summary.textContent=d.name+' · '+d.extension;card.append(summary);
  for(const [label,text]of [['包含',d.content],['用途',d.usage],['使用条件',d.limits]]){const p=document.createElement('p'),b=document.createElement('strong');b.textContent=label+'：';p.append(b,document.createTextNode(text));card.append(p);}
  const button=document.createElement('button');button.type='button';button.textContent='选择此格式';button.onclick=()=>{select.value=key;update();};card.append(button);cards.set(key,card);$('export-guide-formats').append(card);
 }
 select.onchange=update;
 $('export-details').onclick=()=>{update();dialog.showModal();};
 $('close-export-guide').onclick=()=>dialog.close();
 update();
}
