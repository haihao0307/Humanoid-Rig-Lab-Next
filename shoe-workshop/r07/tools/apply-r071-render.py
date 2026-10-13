"""Add completion-aware coalesced drawing to the already verified R07.1 cache source.
This changes production scheduling, never mesh/material quality or test timeouts.
"""
from pathlib import Path
from hashlib import sha256
root=Path(__file__).resolve().parents[1]
def once(s,a,b):
    if s.count(a)!=1: raise RuntimeError('Expected one render migration anchor: '+a[:100])
    return s.replace(a,b,1)
p=root/'src/main.mjs';s=p.read_text()
if 'installRenderGate' not in s:
    assert sha256(p.read_bytes()).hexdigest()=='32e043345f13cee130dcd7427ccb7d7a73d6d2a1fd96c50a1bc02d078c439b08', 'Unexpected pre-render source'
    s=once(s,"import {yarnGeometry} from './sewing.mjs';", "import {yarnGeometry} from './sewing.mjs';\nimport {installRenderGate} from './render-gate.mjs';")
    s=once(s," const nav=document.createElement('button');", " const presenter=installRenderGate(A,info=>{$('#render-stats').textContent=f(info.triangles/1000,1)+'k 三角形 · 合并按需重绘';});\n const nav=document.createElement('button');")
    s=once(s,"if(b){state.selected=b.dataset.formedPart;state.camera='hero';", "if(b){if(b.dataset.formedPart==='26'&&state.view==='flat')state.view='assembled';state.selected=b.dataset.formedPart;state.camera='hero';")
    s=once(s,'window.SHOE_R07={ready:true,','window.SHOE_R07={ready:true,renderIdle:presenter.idle,renderStats:presenter.stats,')
    p.write_text(s)
p=root/'tools/build.mjs';s=p.read_text()
if "'src/render-gate.mjs'" not in s:
    s=once(s,"'tools/apply-r071.py',","'tools/apply-r071.py','src/render-gate.mjs','tools/apply-r071-render.py','tests/render-gate.mjs',")
    p.write_text(s)
p=root/'tests/kernel.mjs';s=p.read_text()
if "import './render-gate.mjs';" not in s:p.write_text("import './render-gate.mjs';\n"+s)
p=root/'tests/contact-regression.mjs';s=p.read_text().replace("version:'R07.0'","version:'R07.1'");p.write_text(s)
p=root/'tests/early-render.mjs';s=p.read_text()
if 'renderIdle' not in s:
    s=once(s,"await page.screenshot({path:path.join(out,camera+'.png'),timeout:90000});", "await page.evaluate(()=>SHOE_R07.renderIdle(30000));await page.screenshot({path:path.join(out,camera+'.png'),timeout:90000});")
    p.write_text(s)
p=root/'tests/browser.mjs';s=p.read_text()
if 'coalesced main-canvas draw queue' not in s:
    s=once(s,"const test=async(name,fn)=>{await fn();checks.push({name,passed:true});},shot=async(name)=>{await page.screenshot({path:path.join(out,name+'.png')});};", "const test=async(name,fn)=>{await fn();await page.evaluate(()=>SHOE_R07.renderIdle(30000));checks.push({name,passed:true});},shot=async(name)=>{await page.evaluate(()=>SHOE_R07.renderIdle(30000));await page.screenshot({path:path.join(out,name+'.png')});};")
    extra="""
 await test('coalesced main-canvas draw queue submits actual work and drains its GPU fence',async()=>{
  const r=await page.evaluate(async()=>{await SHOE_R07.renderIdle();const before=SHOE_R07.renderStats();for(let i=0;i<12;i++)SHOE_R02.render();const queued=SHOE_R07.renderStats();await SHOE_R07.renderIdle();return {before,queued,after:SHOE_R07.renderStats()};});
  assert.ok(r.after.gpuFence);assert.equal(r.after.maxInFlight,1);assert.equal(r.after.inFlight,0);assert.equal(r.after.pending,false);assert.equal(r.after.completed,r.after.requested);assert.ok(r.after.draws-r.before.draws>=1&&r.after.draws-r.before.draws<=2);assert.ok(r.after.coalesced-r.before.coalesced>=11);
  fs.writeFileSync(path.join(out,'RENDER_QUEUE.json'),JSON.stringify({sourceBuild:manifest.sourceBuild,url,...r,scope:'Actual main-canvas GPU completion; unchanged geometry, materials, shadow and pixel settings'},null,2));
 });
"""
    s=once(s,"await shot('01-assembled');", "await shot('01-assembled');"+extra)
    extra="""
 await test('sole selection from flat view restores a finite visible formed sole',async()=>{
  await page.locator('[data-formed-view="flat"]').click();await page.locator('[data-formed-part="26"]').click();
  const r=await page.evaluate(()=>({r:SHOE_R07.report(),position:SHOE_R02.camera.position.toArray()}));assert.equal(r.r.view,'assembled');assert.deepEqual(r.r.visibleParts,[26]);assert.ok(r.position.every(Number.isFinite));await page.locator('[data-formed-part="all"]').click();
 });
"""
    s=once(s," await test('real pointer selects an actual visible triangle'",extra+" await test('real pointer selects an actual visible triangle'")
    s=once(s,"await mobile.screenshot({path:path.join(out,'mobile-viewport.png'),fullPage:true});", "await mobile.evaluate(()=>SHOE_R07.renderIdle(30000));await mobile.screenshot({path:path.join(out,'mobile-viewport.png'),fullPage:true});")
    p.write_text(s)
print('Production render coalescing, finite sole inspection and current completion-aware browser checks ready.')
