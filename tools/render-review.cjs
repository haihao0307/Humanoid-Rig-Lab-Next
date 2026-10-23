'use strict';
const path=require('path');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports=({B,version,suffix,fit,now,ray})=>{
 const image=view=>`../qa/review-${suffix}/final-${view}.png`;
 const residual=ray?Math.max(...ray.cases.map(c=>c.all.maxAbsoluteMM)).toFixed(4):'未检查';
 return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>身体函数重构 · 测试与自审</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f2eb;color:#203b32;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1240px;margin:auto;padding:36px 26px 65px}small,.muted{color:#70816c}small{letter-spacing:2px}h1{font-size:34px;font-weight:500;margin:10px 0}h2{font-size:23px;font-weight:500;margin:30px 0 12px}p{max-width:1050px}.actions,.cases,.pills{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}a{color:#315e49}a.primary{padding:12px 21px;border-radius:8px;background:#315c49;color:white;text-decoration:none}.pills span{font-size:13px;background:#e7ebdf;border:1px solid #d5ddca;border-radius:20px;padding:5px 12px}.summary{background:#e6eadf;border-left:4px solid #617d57;border-radius:6px;padding:18px 23px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;border-radius:12px;overflow:hidden;background:#e7e9df}img{display:block;width:100%;height:auto}figcaption{font-size:14px;padding:12px 16px}button{border:1px solid #bac9b0;background:#fafbf5;border-radius:7px;padding:8px 13px;color:inherit;cursor:pointer;font:inherit;font-size:14px}button[aria-pressed=true]{background:#46654f;color:white}.muted{font-size:14px}.hash{font-size:12px;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:11px 8px;border-bottom:1px solid #d5ddcc;text-align:left;vertical-align:top}td:first-child{width:160px}li{margin:7px 0}@media(max-width:720px){main{padding:24px 15px}.cards{grid-template-columns:1fr}h1{font-size:28px}td:first-child{width:90px}}</style>
<main><small>HUMAN / BODY / ${escape(version)}</small><h1>身体接合与显示：本轮实测</h1>
<p>函数定义母体，变量改变个体，噪波处理肌理。这一轮集中修接合、拟合和交点，保持原有体型、动作、肤色变量及灯光参数。</p>
<div class="pills"><span>人物三角面 0</span><span>原参数与存档保留</span><span>只做身体，头部未改</span></div>
<div class="actions"><a class="primary" href="${encodeURI(path.basename(B.file))}">进入实际三维身体测试</a><a href="../docs/CONTINUITY-AND-RAY-R15.md">本轮修改与证据</a><a href="../docs/SELF-REVIEW.md">完整自审</a><a href="../docs/SOURCE-LEDGER.md">来源记录</a></div>
<p class="muted">三维页面可旋转、调体型、调动作和保存人物。首次建立函数表面及修改形体需要等待。下方是实际运行截图对照；原R15与头部板块没有被覆盖。</p>
<div class="summary"><strong>本轮已改：</strong>局部精度沿关节方向逐渐过渡；拟合改用正则约束，不再强行截断系数；越过表面的视线会细化交点，手足采用更小步长。<br><strong>仍未完成：</strong>弯腕局部亮线/褶皱仍明显，整体肤色与皮肤层次偏平。视觉没有最终验收，校准数据仍保留旧来源，尚未迁移总平台。</div>
<h2>正常距离的当前画面</h2><div class="cards"><figure><img src="${image('full')}" alt="本版本实际全身截图"><figcaption>全身：检查比例、手足连接及整体受光。</figcaption></figure><figure><img src="${image('half')}" alt="本版本实际半身截图"><figcaption>半身：检查表面起伏、胸肩体积与仍偏弱的皮肤层次。</figcaption></figure></div>
<h2>同镜头前后对照 · 实际截图</h2><p class="muted">左侧是上次交付的R08，右侧是当前版本。镜头、姿态及灯光保持对应；可以切换弯腕、弯踝和转身，避免只看一个中性姿态。</p>
<div class="cases" role="group" aria-label="选择截图对照"><button data-shot="neutral-half" aria-pressed="true">中性 · 半身</button><button data-shot="neutral-full" aria-pressed="false">中性 · 全身</button><button data-shot="wrist-bent-half" aria-pressed="false">弯腕 · 半身</button><button data-shot="ankle-bent-full" aria-pressed="false">弯踝 · 全身</button><button data-shot="body-turned-half" aria-pressed="false">转身 · 半身</button></div>
<div class="cards"><figure><img id="before" src="../qa/joints-r08/neutral-half.png" alt="R08同姿态实测"><figcaption>R08：方盒区域切换、截断式拟合及较宽的交点停止阈值。</figcaption></figure><figure><img id="after" src="../qa/joints-${suffix}/neutral-half.png" alt="当前版本同姿态实测"><figcaption>${escape(version)}：关节方向过渡、正则化拟合、交点细化。改进主要在稳定性与接合，不能称整体肤质已经完成。</figcaption></figure></div>
<h2>核对结果与实际限制</h2><table><thead><tr><th>项目</th><th>本轮结果</th></tr></thead><tbody>
<tr><td>参数与文件</td><td>1916项参数目录保留，身体页显示965项控制。1213项原身体输入、2426个单项计算比较通过；保存、连续载入同一文件及旧档案载入已实测。完整组合仍未验收。</td></tr>
<tr><td>形状拟合</td><td>6000个独立目标点，近似投影均方根${fit.rmsMM.toFixed(3)}mm，95分位${fit.p95MM.toFixed(3)}mm，最大${fit.maxMM.toFixed(3)}mm。比R08的0.944mm均方根略高，换取受正则约束的求解；仍非严格一比一。</td></tr>
<tr><td>显示交点</td><td>实际GPU深度回读检查，最大残差约${residual}mm。这个数只表示显示点相对当前函数表面的偏差，不能当作人体还原精度。</td></tr>
<tr><td>关节与动作</td><td>中性、弯腕25°、弯踝25°和转身30°均重新截图；脚踝附近的法线变化较平顺，腕部仅略改善，局部亮线仍需处理。</td></tr>
<tr><td>噪波附着</td><td>整体平移与转身30°的40点参考坐标检查通过，噪波编辑不重建形体；大关节拉伸、接触区域仍需更多检查。</td></tr>
<tr><td>显示与来源</td><td>函数直接求交，点图元执行屏幕显示，无人物三角面和外部运行时请求。校准点、系数、权重仍从旧系统推导，不能标为全部自主。</td></tr>
</tbody></table>
<h2>自审后的下一顺序</h2><ol><li>以全身、半身改善区域肤色、粗糙度和薄油膜层次，保持固定灯光，不靠强颗粒掩盖形体问题。</li><li>继续分辨腕部残余褶皱、法线和原参照形体的问题，补足更多动作与接触检查。</li><li>与独立头部板块通过共同坐标和颈口函数连接；继续替换仍有旧来源的校准数据。</li></ol>
<p class="muted">R13的短距离阴影试验产生硬边与色块，未采用；R16延后腕部法线切换没有消除亮线，也未采用。保留全部失败和诊断记录。</p>
<p class="hash">当前三维文件：${escape(path.basename(B.file))}<br>SHA256：${escape(B.sha256)}<br>审核记录：${escape(now)}</p></main>
<script>document.querySelectorAll('[data-shot]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-shot]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));const key=button.dataset.shot;document.querySelector('#before').src='../qa/joints-r08/'+key+'.png';document.querySelector('#after').src='../qa/joints-${suffix}/'+key+'.png';}));</script></html>`;
};
