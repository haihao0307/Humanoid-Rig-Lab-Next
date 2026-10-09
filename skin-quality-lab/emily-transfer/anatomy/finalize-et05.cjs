const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
function edit(rel,fn){const p=path.join(root,rel),s=fs.readFileSync(p,'utf8'),n=fn(s);if(n===s)throw Error('No ET05 finalization change for '+rel);fs.writeFileSync(p,n);}
function one(s,a,b){if(!s.includes(a))throw Error('Missing ET05 finalization anchor: '+a.slice(0,80));return s.replace(a,b);}
edit('app.js',s=>{
 s=one(s,"irisDepth:.83,opening:1,fixedTarget:[0,.069,.65]","irisDepth:.83,opening:.92,fixedTarget:[0,.069,.65]");
 s=one(s,"window.__TALKINGHEAD__={version:'ET04'","window.__TALKINGHEAD__={version:'ET05'");
 return s;
});
edit('index.html',s=>{
 s=one(s,'<div class="section eye-section"><h2>眼球与视线 <small>ET03 / CONTACT</small></h2>','<div class="section eye-section"><h2>眼球与视线 <small>ET05 / ANATOMY</small></h2>');
 s=one(s,'<input id="eye-opening" type="range" min="0.65" max="1.25" step="0.01" value="1">','<input id="eye-opening" type="range" min="0.56" max="1.15" step="0.01" value="0.92">');
 s=one(s,'成人眼球尺度与眼睑开口已重新拟合；双眼朝同一个三维目标收敛','上眼睑与下眼睑均有独立自由睑缘厚度；眼角渐进收束，眼皮包覆眼球并保留极薄后侧间隙。双眼朝同一个三维目标收敛');
 s=one(s,'ET03：重建睑缘、内外眼睑曲面与接触约束，增加独立眯眼及慢闭眼测试。','ET05：缩小静息眼裂与眼球暴露，重建更厚的上睑自由缘、较薄的下睑自由缘、渐进式内外眼角与后侧接触间隙。');
 return s;
});
console.log('ET05_DEFAULTS_AND_LABELS_FINALIZED');
