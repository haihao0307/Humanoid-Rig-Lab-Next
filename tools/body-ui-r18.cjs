'use strict';const fs=require('fs');
module.exports=function(html,context){html=require('./body-ui-r17.cjs')(html,context);
 html=html.replace('<h2>体型快速对照</h2>','<h2>校准与原人物对照</h2><p class="note">成人校准档清除身体局部增强；原人物与旧存档保留原有响应。年龄轴0.5仅为本项目校准约定。</p><div class="pills">'+[['adult','成人校准'],['lean','校准偏瘦'],['fuller','校准丰满'],['muscular','校准肌肉'],['original','R17原人物']].map(([id,label])=>'<button data-calibration="'+id+'" disabled>'+label+'</button>').join('')+'</div><h2>当前人物单项对照</h2>');
 html=html.replace('<div class="line"><h2>皮肤表面</h2>','<label>结构观察<select id="diagnostic"><option value="skin">当前表面</option><option value="geometry">仅几何法线着色</option><option value="normals">几何法线方向</option></select></label><div class="line"><h2>皮肤表面</h2>');
 html=html.replace('<script>window.__BODY_FUNCTION_PACKAGE__=', '<script>'+fs.readFileSync('src/BodyCalibrationR18.js','utf8')+'</script><script>window.__BODY_FUNCTION_PACKAGE__=');
 html=html.replace('本版精简加载与操作，形体保持上一版。','本版建立成人校准、支撑与软组织分离及局部躯干结构函数。原有校准数据仍保留来源，整个人体尚未自主重建。');
 return html;
};
