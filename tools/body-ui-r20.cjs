'use strict';const fs=require('fs');
module.exports=function(html,context){html=require('./body-ui-r19.cjs')(html,context);html=html.replace('<h2>当前人物单项对照</h2>','<div class="pills"><button data-calibration="r19" disabled>上一版结构对照</button></div><h2>当前人物单项对照</h2>');
 html=html.replace('<script>window.__BODY_FUNCTION_PACKAGE__=','<script>'+fs.readFileSync('src/BodyAnatomyR20.js','utf8')+'</script><script>window.__BODY_FUNCTION_PACKAGE__=');
 html=html.replace('<h2>身体统一调整</h2>','<h2>观察与动作</h2><p class="small">保留当前体型，切换动作观察肩腋、髋部和关节连接。</p><div class="pills">'+[['neutral','自然站姿'],['reach','抬臂'],['bend','屈髋屈膝'],['twist','转身'],['arms','屈肘']].map(([id,label])=>'<button data-motion="'+id+'" disabled>'+label+'</button>').join('')+'</div><label>观察光线<select id="inspection-light"><option value="studio">均匀工作光</option><option value="side">侧面工作光</option><option value="back">背面工作光</option><option value="original">人物原灯光</option></select></label><h2>身体统一调整</h2>');
 html=html.replace('拖动旋转 · 滚轮缩放','拖动旋转 · 滚轮缩放 · Shift拖动平移');
 // The main page uses only the profile function. Math/driver globals are
 // resolved inside the worker when evaluation is requested.
 html=html.replace('<script>window.__BODY_FUNCTION_PACKAGE__=','<script id="body-package-r20">window.__BODY_FUNCTION_PACKAGE__=');
 html=html.replace('同一个母体，<br>不同的个体变量。','身体形态<br>与动作调整');
 const rig=html.match(/<label>骨架<select id="rig">[\s\S]*?<\/select><\/label>/)?.[0];
 if(rig){html=html.replace(rig,'');html=html.replace('<h2>观察与动作</h2>','<h2>观察与动作</h2>'+rig.replace('骨架','动作系统'));}
 return html.replace('本版继续检查胸廓、肩带、腰腹和骨盆的大形与过渡，保留R18对照。','持续调整躯干与四肢结构、肩髋连接及动作变形。拖动旋转，滚轮缩放；可随时保存完整人物。');
};
