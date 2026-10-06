import {SHAPE_REGIONS,normalizeFaceShape} from './FacePartition.mjs';
const STORAGE='human.r008.face-shape.v1';
export function createFacePartitionWorkbench({getSubject,selectRegion,display}){
 const panel=document.createElement('section');panel.id='faceShapeEditor';panel.innerHTML=`
 <p>脸型塑形 · 57 个区域<br><small>左 / 右以人物自身为准。形状参数独立于临时表情。眼睑和眼角可查权重，塑形暂时锁定。</small></p>
 <details id="faceCapabilityAudit"><summary>局部分区能力与身份层</summary><p>当前是局部表面微调。57 个区域、147 项位移不等于 147 项独立五官比例；区域之间存在重叠与限幅。</p><div class="shape-table-wrap"><table class="capability-table"><thead><tr><th>比例 / 特征</th><th>当前能力</th></tr></thead><tbody>
<tr><td>额头、鼻梁、鼻尖、鼻翼、颧颊、唇部、下巴局部</td><td>有区域位移，可局部近似；每轴请求 ±3 mm</td></tr>
<tr><td>眼距、眼位、眼裂宽高、内外眼角倾斜、眼皮形态</td><td>此 57 区保持眼周保护；五官数据模式已加入眼区联动身份参数。眨眼 / 视线仍属于表情</td></tr>
<tr><td>三庭、五眼、上下脸长度、整体宽高比</td><td>局部分区缺少独立比例控制；五官数据模式已有标志点测量、比例参数与误差反馈</td></tr>
<tr><td>鼻宽 / 鼻高、口宽 / 唇厚、颧宽 / 下颌宽</td><td>局部位移可近似；比例目标与误差反馈请用五官数据模式</td></tr>
<tr><td>眉形、眉密度、发际线、耳形、后脑与完整头颅</td><td>当前脸型区未提供完整独立控制</td></tr>
<tr><td>下颌骨位置、牙列、口腔、张口结构</td><td>未完成独立结构，不能靠表皮区代替</td></tr>
<tr><td>毛孔、肤色、皱纹和色素细节</td><td>走独立皮肤材质；不是脸型位移数据</td></tr>
<tr><td>任意脸 / 单张图片的全部三维数据</td><td>不能保证；有限区域基底和单视角信息不足</td></tr>
</tbody></table></div><p id="faceEyeCalibration"></p><p>R27 已增加五官数据模式：共享标志点、全局及局部身份参数、眼区同步映射与正面参考误差。完整内部结构与任意脸型覆盖仍未完成。彩色图显示最大权重归属，不是独立切开的组织或硬边界。</p></details>
 <div id="shapeLegend" class="shape-legend"></div>
 <div class="row"><button id="shapeAll">全部分区</button><button id="shapeSkin">原有表皮</button></div>
 <p id="shapeSelected"></p><div class="shape-axes">
 <label>横向 / 向外 mm<input id="shapeX" aria-label="分区横向位移毫米" type="number" min="-3" max="3" step=".1" value="0"></label>
 <label>向上 mm<input id="shapeY" aria-label="分区向上位移毫米" type="number" min="-3" max="3" step=".1" value="0"></label>
 <label>向前 mm<input id="shapeZ" aria-label="分区向前位移毫米" type="number" min="-3" max="3" step=".1" value="0"></label></div>
 <label><input id="shapeMirror" type="checkbox" checked> 同步对侧分区（横向镜像）</label>
 <div class="row"><button id="shapeApply">应用数值</button><button id="shapeZero">清零当前区</button></div><p id="shapeResult" role="status"></p>
 <label>筛选分区<input id="shapeFilter" type="search" placeholder="例如：鼻、下巴、左" aria-label="筛选面部分区"></label>
 <div class="shape-table-wrap"><table id="shapeTable"><thead><tr><th>分区</th><th>峰值</th><th>均值</th><th>&gt;1% 点数</th><th>请求位移 mm<br>X / Y / Z</th></tr></thead><tbody></tbody></table></div>
 <small>峰值和均值来自当前重建表面的函数采样。权重 0–1；同一点的脸型权重之和不超过面部遮罩；剩余权重保留中性支撑，边缘平滑衰减。表情权重可重叠，不使用此归一规则。位移＝权重 × 区域毫米值 × 安全缩放。中线横向正值朝人物左侧。</small>
 <div class="row"><button id="shapeExport">导出脸型数值</button><button id="shapeReset">全部恢复原脸</button></div>
 <details><summary>导入脸型 JSON / 数值报告</summary><textarea id="shapeJSON" aria-label="脸型JSON配方" rows="6" placeholder="粘贴已导出的脸型 JSON"></textarea><button id="shapeImport">导入并应用</button><button id="shapeReport">下载完整分区报告</button></details>`;
 document.getElementById('faceControls').append(panel);
 const numeric=document.createElement('section');numeric.id='shapeNumericPanel';numeric.hidden=true;numeric.innerHTML='<h2>当前面部分区数值</h2><small>点击分区查看权重场 · 左右按人物自身</small>';numeric.append(panel.querySelector('#shapeFilter').parentElement,panel.querySelector('#shapeTable').parentElement);document.body.append(numeric);
 const $=id=>document.getElementById(id);let selected='all',recipe=normalizeFaceShape();
 const groups=[...new Set(SHAPE_REGIONS.map(r=>r.group))];$('shapeLegend').innerHTML=groups.map(g=>`<button type="button" data-group="${g}">${g}</button>`).join('');
 for(const b of $('shapeLegend').querySelectorAll('button'))b.onclick=()=>{$('shapeFilter').value=b.dataset.group;table();};
 function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function save(){try{localStorage.setItem(STORAGE,JSON.stringify(recipe));}catch{$('shapeResult').textContent+='；浏览器保存失败，请导出配方。';}}
 function table(){const atlas=getSubject()?.face.partition;if(!atlas)return;const filter=$('shapeFilter').value.trim().toLowerCase();const body=$('shapeTable').tBodies[0];body.replaceChildren();
  for(const [index,r]of SHAPE_REGIONS.entries()){if(filter&&!(r.id+' '+r.label+' '+r.group).toLowerCase().includes(filter))continue;const s=atlas.stats[index],v=recipe.regions[r.id]||[0,0,0],row=document.createElement('tr');row.dataset.region=r.id;row.classList.toggle('selected',r.id===selected);const swatch=`hsl(${(index*.618034)%1*360} 73% 46%)`;row.innerHTML=`<td><button type="button" title="${r.id}"><i style="background:${swatch}"></i>${r.label}${r.locked?' 🔒':''}</button><small>${r.id}</small></td><td>${s.peak.toFixed(3)}</td><td>${s.mean.toFixed(4)}</td><td>${s.samples.toLocaleString()}</td><td>${v.map(x=>x.toFixed(1)).join(' / ')}</td>`;row.querySelector('button').onclick=()=>selectRegion(r.id);body.append(row);}
 }
 function selection(id){selected=id;const r=SHAPE_REGIONS.find(r=>r.id===id),v=recipe.regions[id]||[0,0,0],stat=getSubject()?.face.partition.stats.find(s=>s.id===id);$('shapeSelected').textContent=r?`${r.label} · ${r.id} · 中心 [${r.centre.map(x=>(x*1000).toFixed(1)).join(', ')}] mm · 支持半径 [${r.radii.map(x=>(x*1000).toFixed(1)).join(', ')}] mm${!stat?.samples?' · 当前表面覆盖不足':''}`:'选择色块对应的表格行，或使用上方区域下拉框查看单区权重。';
  ['shapeX','shapeY','shapeZ'].forEach((id,j)=>{$(id).value=v[j];$(id).disabled=!r||r.locked;});$('shapeApply').disabled=$('shapeZero').disabled=!r||r.locked;table();
 }
 function apply(input){const normalized=normalizeFaceShape(input),report=getSubject().face.setShape(normalized);recipe=normalized;save();selection(selected);display();$('shapeResult').textContent=`已应用并保存 · 最大实际位移 ${report.maxDisplacementMM.toFixed(3)} mm · 安全缩放 ${report.safeScale.toFixed(3)}${report.safeScale<.999?'（请求值保留，实际位移已限幅）':''}`;return report;}
 function edit(zero=false){try{const v=zero?[0,0,0]:['shapeX','shapeY','shapeZ'].map(id=>Number($(id).value)),next=normalizeFaceShape(recipe);next.regions[selected]=v;const r=SHAPE_REGIONS.find(r=>r.id===selected);if($('shapeMirror').checked&&r&&/(Left|Right)$/.test(selected))next.regions[selected.replace(/(Left|Right)$/,r.sign===1?'Right':'Left')]=[...v];apply(next);}catch(e){$('shapeResult').textContent=e.message;}}
 $('shapeApply').onclick=()=>edit();$('shapeZero').onclick=()=>edit(true);$('shapeFilter').oninput=table;
 $('shapeAll').onclick=()=>selectRegion('all');$('shapeSkin').onclick=()=>{$('faceView').value='skin';display();};
 $('shapeReset').onclick=()=>apply(normalizeFaceShape());$('shapeExport').onclick=()=>download(recipe,'R008-face-shape.json');$('shapeImport').onclick=()=>{try{apply(JSON.parse($('shapeJSON').value));}catch(e){$('shapeResult').textContent=e.message;}};
 $('shapeReport').onclick=()=>download({schema:'human-r008/face-partition-report@1',source:recipe.source,units:'mm',recipe,partition:getSubject().face.partition.report,expressions:getSubject().face.report,eyeIdentityCalibration:getSubject().eyes.identityCalibration,capability:{arbitraryFaceSupported:false,editableShapeAxes:147,protectedRegions:8,identityLayer:getSubject().identity?.report.coverage,missing:['complete-eye-anatomy','jaw-and-oral-structure','hair-density-and-style','unobserved-photo-depth']},notes:'外表面造型分区，不是内部肌肉测量；报告不含网格或顶点数组。'},'R008-face-partitions-report.json');
 function refresh(){const c=getSubject()?.eyes.identityCalibration;if(c)$('faceEyeCalibration').textContent=`当前中性眼部构造值（不是图片测量）：眼中心间距 ${(c.centreDistanceMetres*1000).toFixed(1)} mm，眼裂宽 / 高 ${(c.apertureWidthMetres*1000).toFixed(1)} / ${(c.apertureHeightMetres*1000).toFixed(1)} mm，眼球半径 ${(c.globeRadiusMetres*1000).toFixed(1)} mm；${c.identityEditable?'五官数据模式已接入身份联动。':'身份调整未开放。'}`;try{const saved=localStorage.getItem(STORAGE);recipe=saved?normalizeFaceShape(JSON.parse(saved)):normalizeFaceShape();const r=getSubject().face.setShape(recipe);$('shapeResult').textContent=`当前脸型配方 · ${Object.keys(recipe.regions).length} 个调整区 · 安全缩放 ${r.safeScale.toFixed(3)}`;}catch(e){recipe=normalizeFaceShape();getSubject().face.setShape(recipe);$('shapeResult').textContent='保存配方未应用：'+e.message;}selection(selected);}
 refresh();return {setVisible:v=>{numeric.hidden=!v;},selection,refresh,set:apply,export:()=>normalizeFaceShape(recipe),get report(){return getSubject().face.partition.report;}};
}

