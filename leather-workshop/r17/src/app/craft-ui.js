const craftNames={plain:'原皮',diamond:'菱形绗缝',grid:'方格绗缝',channels:'条形绗缝',perforated:'贯穿孔',woven:'皮条编织'};
let ribbon,craftNote;
function initCraftControls(){
 ribbon=$('craftRibbon');
for(const[id,label]of Object.entries(craftNames)){const b=document.createElement('button');b.dataset.craft=id;b.textContent=label;b.onclick=()=>{craftConfig.craft=id;rebuildCraft();};ribbon.append(b);}
craftNote=document.createElement('span');craftNote.className='craft-note';ribbon.append(craftNote);
}
let measuredAt=0;
function refreshLiveMeasurements(force=false){if(!hero||!force&&performance.now()-measuredAt<200)return;measuredAt=performance.now();const rows=measureShell();if(!rows.length)return;const min=Math.min(...rows.map(r=>r.minMM)),max=Math.max(...rows.map(r=>r.maxMM));$('shellReadout').textContent=rows.map(r=>`${r.part}: ${r.minMM.toFixed(2)}–${r.maxMM.toFixed(2)} mm`).join('\n');$('liveThicknessNote').textContent=`当前变形后的单片皮厚：${min.toFixed(2)}–${max.toFixed(2)} mm\n${rows.reduce((s,r)=>s+r.sampleCount,0)} 组内外表面测点 · 世界坐标\n不把绗缝隆起高度冒充皮革厚度。`;}
function updateCraftDetails(){if(!hero)return;const enabled=!['belt','cowboy','pirate'].includes(product);ribbon.hidden=mode!=='products';for(const b of ribbon.querySelectorAll('button')){b.disabled=!enabled&&b.dataset.craft!=='plain';b.classList.toggle('active',b.dataset.craft===craftConfig.craft);}craftNote.textContent=enabled?((product==='jacket'?'夹克当前作用区域：贴袋；衣身工艺未扩展。':'当前成品的工艺裁片已接入。')+'绗缝填芯压缩、微孔应力集中未独立求解。'):'此款保留原有结构：绗缝 / 编织尚未适配，未用平面贴图冒充。';refreshLiveMeasurements(true);};
function appendCraftRecipe(base){return{...base,version:VERSION,liveThickness:measureShell(),craftScope:{integratedProducts:['wallet','bag','swatch'],paddingCompressionSolved:false,regions:{wallet:'front pocket panel',bag:'front panel',swatch:'whole sample'},microPerforationStress:'homogenized coarse shell; visual cut holes are not resolved in the mechanical mesh'},threadCarrier:'wallet outer saddle seam uses explicit front/rear material frames',visualAcceptance:'PENDING_USER',productionReady:false};};
function updateSlowPhysicsNote(){if(!productSolver)return;const q=productSolver.report();if(q.integrationThread&&q.calculationSpeed>0&&q.calculationSpeed<.5)$('grabStats').textContent+='\n慢速物理验证：不将计算耗时伪装成实时。';};
