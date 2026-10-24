'use strict';const fs=require('fs');
module.exports=function(html,context){
 html=require('./body-ui-r17.cjs')(html,context);
 html=html.replace('<h2>体型快速对照</h2>','<h2>原数据响应对照</h2><p class="note">进入时保留原人物的全部默认体型与局部调整。当前函数表面仍未通过一比一复刻验收。</p><button data-calibration="original" disabled>恢复原人物身体参数</button><h2>单项参数观察</h2>');
 html=html.replace('<h2>身体统一调整</h2>','<h2>动作观察</h2><div class="pills">'+[['neutral','自然站姿'],['reach','抬臂'],['bend','屈髋屈膝'],['twist','转身'],['arms','屈肘']].map(([id,label])=>'<button data-motion="'+id+'" disabled>'+label+'</button>').join('')+'</div><label>观察光线<select id="inspection-light"><option value="original">原人物灯光</option><option value="studio">均匀工作光</option><option value="side">侧面工作光</option><option value="back">背面工作光</option></select></label><h2>身体统一调整</h2>');
 html=html.replace('<div class="line"><h2>皮肤表面</h2>','<label>结构观察<select id="diagnostic"><option value="skin">当前表面</option><option value="geometry">几何法线着色</option><option value="normals">几何法线方向</option></select></label><div class="line"><h2>皮肤表面</h2>');
 const rig=html.match(/<label>骨架<select id="rig">[\s\S]*?<\/select><\/label>/)?.[0];if(rig){html=html.replace(rig,'');html=html.replace('<h2>动作观察</h2>','<h2>动作观察</h2>'+rig.replace('骨架','动作系统'));}
 html=html.replace('同一个母体，<br>不同的个体变量。','原数据复刻<br>待验收候选').replace('身体函数重构','原数据响应 · 未验收').replace('本版精简加载与操作，形体保持上一版。','R21恢复原默认参数和原动作计算，停用R18–R20估算改形、手足替换、平滑、填充与颈口切平。现有采样隐式显示仍有偏差；不能当作已完成的原数据复刻。');
 html=html.replace('拖动旋转 · 滚轮缩放','拖动旋转 · 滚轮缩放 · Shift拖动平移');
 html=html.replace('</style>','@media(max-width:980px){main{grid-template-columns:minmax(0,1fr);height:auto;min-height:calc(100vh - 74px);padding:12px;gap:16px}.stage{height:72vh;min-height:400px}aside{overflow:visible}}@media(max-width:560px){header{padding:0 12px}.brand{font-size:15px}.stamp{left:14px;top:14px}.stamp strong{font-size:19px}.views{left:12px;bottom:12px}}</style>');
 if(html.includes('/*BODY_INTERVAL_R21*/'))html=html.replace('/*BODY_INTERVAL_R21*/',fs.readFileSync('src/research/r21/BodyRayIntervalsR21.glsl','utf8'));
 html=html.replace('<h1>','<p><a href="./身体_R21_原母体函数对照.html">查看原母体函数对照</a></p><h1>');
 return html.replace('<script>window.__BODY_FUNCTION_PACKAGE__=','<script id="body-package-r20">window.__BODY_FUNCTION_PACKAGE__=');
};
