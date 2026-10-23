'use strict';
const fs=require('fs'),crypto=require('crypto');
module.exports=function(html,{packageFile}){
 const start='<h2>身体参数与动作</h2>',end='<div class="line"><h2>皮肤表面</h2>',at=html.indexOf(start),to=html.indexOf(end,at);
 if(at<0||to<0)throw Error('Body UI template changed');
 const fields=[['height','身高'],['weight','胖瘦'],['muscle','肌肉'],['proportions','身体比例'],['gender','性别形态'],['age','年龄形态'],['cupsize','胸部体积'],['firmness','胸部紧实度']];
 const compact='<h2>身体统一调整</h2><p class="note">修改数值后统一应用，保留局部与动作的完整调整能力。</p><div class="body-primary-grid">'+fields.map(([key,name])=>'<label>'+name+'<input data-body-variable="'+key+'" type="number" step=".01" aria-label="'+name+'"></label>').join('')+'</div><button id="apply-body-variables" disabled>应用身体调整</button><p class="small" id="body-operation-status" aria-live="polite">一次提交，统一计算。</p>';
 const advanced='<details id="advanced-controls"><summary>局部与动作调整</summary><p class="small">按当前身体驱动显示有效项，切换时保留另一套参数。</p>'+html.slice(at+start.length,to)+'</details>';
 html=html.slice(0,at)+compact+advanced+html.slice(to);
 html=html.replace('</style>', '.body-primary-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}.body-primary-grid label{margin:4px 0 9px}.body-primary-grid input{padding:6px}details{margin-top:20px}summary{cursor:pointer;font-size:13px}#apply-body-variables{margin-top:8px;background:#345f4d;color:#fff;width:100%}</style>');
 const control=fs.readFileSync('src/BodyControlR17.js','utf8'),hash=crypto.createHash('sha256').update(fs.readFileSync(packageFile)).digest('hex');
 html=html.replace('<script>window.__BODY_FUNCTION_PACKAGE__=', '<script>'+control+'\nwindow.__BODY_PACKAGE_SHA256__='+JSON.stringify(hash)+';</script><script>window.__BODY_FUNCTION_PACKAGE__=');
 html=html.replace('完整参数记录','完整参数兼容').replace('当前为无网格身体试验。形体由数学表面求交显示，头部由独立板块继续处理。源于旧模型的校准系数仍保留来源，尚未达到完整自主与视觉验收。','身体由函数、变量和噪波构成；只处理身体，头部接入口保留。本版精简加载与操作，形体保持上一版。');
 return html.replace('身体独立重构','身体函数重构');
};
