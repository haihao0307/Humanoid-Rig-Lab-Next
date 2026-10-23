'use strict';const fs=require('fs');
module.exports=function(html,context){html=require('./body-ui-r18.cjs')(html,context);html=html.replace('<h2>当前人物单项对照</h2>','<div class="pills"><button data-calibration="r18" disabled>R18成人校准对照</button></div><h2>当前人物单项对照</h2>');
 html=html.replace('<script>window.__BODY_FUNCTION_PACKAGE__=','<script>'+fs.readFileSync('src/BodyStructureR19.js','utf8')+'</script><script>window.__BODY_FUNCTION_PACKAGE__=');
 // The main page uses only the profile function. Math/driver globals are
 // resolved inside the worker when evaluation is requested.
 return html.replace('本版建立成人校准、支撑与软组织分离及局部躯干结构函数。','本版继续检查胸廓、肩带、腰腹和骨盆的大形与过渡，保留R18对照。');
};
