'use strict';
const fs=require('fs'),zlib=require('zlib');
module.exports=function(html,context){
 html=require('./body-ui-r23.cjs')(html,context);
 html=html.replace('<button data-calibration="original" disabled>恢复原人物身体参数</button>','<button data-calibration="original" disabled>恢复原人物身体参数</button> <button data-calibration="calibration-soft" disabled>体量校准档</button><p class="note">校准档使用原版肌肉、脂肪中值并清零颈围等身体局部增强；沿用原人物身高与比例，保留当前头部专属参数。它仍待验收，未解除原绑定与软组织之间的耦合。</p>');
 html=html.replace('<script', '<script>window.__BODY_CALIBRATION_R24__='+JSON.stringify(JSON.parse(fs.readFileSync('data/body-calibration-r24.json'))).replace(/<\//g,'<\\/')+';</script><script');
 if(!html.includes('window.__BODY_CALIBRATION_R24__='))throw Error('Calibration source insertion changed');
 const support=JSON.parse(fs.readFileSync('data/body-support-reference-r24.json')),live={A:support.profiles.baseline.points,B:support.profiles['B-neutral'].points};
 html=html.replace('<h2>单项参数观察</h2>','<details><summary>绑定支撑观察</summary><label><input style="width:auto" type="checkbox" id="show-live-support-r24"> 显示当前支撑参照（穿透显示）</label><div id="live-support-readout-r24" hidden></div><p class="note">数值随当前体型与动作更新，百分比相对同套原人物绑定。它们不是实测骨长；原骨架与软组织响应仍未分离。</p></details><h2>单项参数观察</h2>');
 html=html.replace('<script', '<style>.views{z-index:4}</style><script id="body-live-support-data-r24" type="application/json">'+JSON.stringify(live)+'</script><script>'+fs.readFileSync('src/BodyLiveSupportR24.js','utf8')+'</script><script');
 html=html.replaceAll('身体_R23_原貌与按需细节.html','身体_R24_原貌与原函数皮纹.html');
 const encoded=zlib.gzipSync(fs.readFileSync('data/body-neck-operator-r24.json'),{level:9}).toString('base64');let replaced=false;
 html=html.replace(/window\.__BODY_NECK_DATA_R22__="[A-Za-z0-9+/=]+"/,()=>{replaced=true;return'window.__BODY_NECK_DATA_R22__='+JSON.stringify(encoded);});if(!replaced)throw Error('Original neck data insertion changed');
 html=html.replace(/(<select id="neck-profile"[^>]*>[\s\S]*?)(<\/select>)/,(_,a,b)=>a+'<option value="calibration-soft">校准档 · 肌肉/脂肪中值</option>'+b);
 return html.replace('R23保留原颈部流程和完整参数，接通当前人物的页面切换；载入时直接建立当前状态，表面仍待验收。','R24保留完整参数和原颈部流程，加入原参数校准档及对应边界。原貌页与连续参数页的完整人物可往返；连续表面迁移仍待验收。');
};
