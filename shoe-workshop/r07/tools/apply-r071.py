"""One-shot, hash-guarded readable-source migration on the isolated R07.1 branch.
Never replay over later edits. Geometry, material donor and lace algorithms stay unchanged.
"""
from pathlib import Path
from hashlib import sha256
root=Path(__file__).resolve().parents[1]
def replace_once(text, old, new):
    if text.count(old)!=1:
        raise RuntimeError('Expected exactly one source anchor: '+old[:90])
    return text.replace(old,new,1)
p=root/'src/main.mjs';s=p.read_text()
if 'function displaySignature()' not in s:
    assert sha256(p.read_bytes()).hexdigest()=='b21562154bf1fc20a526498881d78a5566f10b043237c9226dfc4be1f7755f93', 'Unexpected main; reconcile before migration'
    s=replace_once(s,'busy=false,down=null;','busy=false,down=null,allThreadMeshes=[],displayKey=null,fastViewUpdates=0,lastUpdateCpuMs=0;')
    s=replace_once(s,'meshes=[];threadMeshes=[];lastMesh=null;}','meshes=[];threadMeshes=[];allThreadMeshes=[];lastMesh=null;displayKey=null;}')
    helper=''' function displaySignature(){return JSON.stringify([state.view==='flat'?'flat':'formed',state.thickness,state.threadDiameter,state.leatherId,state.material,state.wire,state.cutaway,state.last,state.threads,state.laces]);}
 function refreshDisplay(fit,started,fast=false){
  const flat=state.view==='flat',showDetails=state.view==='assembled'&&state.selected==='all';
  for(const mesh of meshes){const id=mesh.userData.formedPart;
   if(flat&&id!==26){const i=PARTS.findIndex(p=>p.id===id);if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const c=mesh.geometry.boundingBox.getCenter(new T.Vector3());mesh.position.set((i%3-1)*265-c.x,8-c.y,(Math.floor(i/3)-1.5)*265-c.z);}else mesh.position.copy(displacement(id));
   mesh.visible=(!flat||id!==26)&&(state.selected==='all'||String(id)===String(state.selected));
  }
  for(const mesh of allThreadMeshes)mesh.visible=showDetails&&state.threads;
  threadMeshes=allThreadMeshes.filter(mesh=>mesh.visible);
  for(const mesh of A.root.children)if(mesh.name.startsWith('LACE_')||mesh.name.startsWith('EYELET_'))mesh.visible=showDetails&&state.laces;
  const floorY=boxVisible().min.y-3;for(const o of A.scene.children)if(o.isMesh&&o.geometry?.type==='PlaneGeometry')o.position.y=floorY;
  builds++;if(fast)fastViewUpdates++;busy=false;update();if(fit)setCamera(state.camera);A.render();lastUpdateCpuMs=performance.now()-started;
 }
'''
    s=replace_once(s,' function rebuild(fit=false){busy=true;',helper+" function rebuild(fit=false){const started=performance.now(),nextKey=displaySignature();if(displayKey===nextKey&&meshes.length&&meshes.every(m=>m.parent===A.root)){busy=true;model.build(state);refreshDisplay(fit,started,true);return;}busy=true;")
    s=replace_once(s,"if(state.threads&&state.view==='assembled'&&state.selected==='all')","if(state.threads&&state.view!=='flat')")
    s=replace_once(s,"  if(state.laces&&state.view==='assembled'&&state.selected==='all'){","  allThreadMeshes=threadMeshes.slice();\n  if(state.laces&&state.view!=='flat'){")
    old="  const floorY=boxVisible().min.y-3;for(const o of A.scene.children)if(o.isMesh&&o.geometry?.type==='PlaneGeometry')o.position.y=floorY;\n  builds++;busy=false;update();if(fit)setCamera(state.camera);A.render();"
    s=replace_once(s,old,'  displayKey=nextKey;refreshDisplay(fit,started);')
    s=replace_once(s,'threadMeshes:threadMeshes.length}),','threadMeshes:threadMeshes.length,interaction:{fastViewUpdates,lastUpdateCpuMs}}),')
    s=s.replace('R07.0','R07.1').replace('R07 · 0','R07 · 1')
    p.write_text(s)
p=root/'tools/build.mjs';s=p.read_text()
if "version:'R07.1'" not in s:
    s=s.replace("version:'R07.0'","version:'R07.1'")
    s=s.replace("'src/finish-cache.mjs',","'src/finish-cache.mjs','tools/apply-r071.py',")
    p.write_text(s)
p=root/'tests/browser.mjs';s=p.read_text()
if 'custom-thickness return reuses' not in s:
    s=s.replace('R07.0','R07.1')
    extra=''' await test('custom-thickness return reuses the exact formed geometry without rebuilding it',async()=>{
  const old=await page.evaluate(()=>({builds:SHOE_R07.model.geometryBuilds,restores:SHOE_R07.model.geometryRestores||0}));const start=Date.now();
  await page.locator('[data-formed-view="assembled"]').click();
  const current=await page.evaluate(()=>SHOE_R07.report());assert.equal(current.finish.geometryBuilds,old.builds);assert.ok(current.finish.geometryRestores>old.restores);assert.ok(current.finish.cacheEntries<=3);assert.equal(current.view,'assembled');
  fs.writeFileSync(path.join(out,'RETURN_TIMING.json'),JSON.stringify({sourceBuild:manifest.sourceBuild,url,elapsedMs:Date.now()-start,geometryBuilds:current.finish.geometryBuilds,restores:current.finish.geometryRestores,environment:'Headless Chromium SwiftShader; not hardware FPS'},null,2));
 });
 await test('selection and exploded inspection retain mesh, geometry and material identities',async()=>{
  const before=await page.evaluate(()=>({ids:SHOE_R07.meshes().map(m=>[m.uuid,m.geometry.uuid,Array.isArray(m.material)?m.material.map(v=>v.uuid):m.material.uuid]),builds:SHOE_R07.model.geometryBuilds,memory:SHOE_R02.renderer.info.memory}));
  const timings=[];
  for(let i=0;i<3;i++)for(const selector of ['[data-formed-part="22"]','[data-formed-part="all"]','[data-formed-view="exploded"]','[data-formed-view="assembled"]']){const start=Date.now();await page.locator(selector).click();timings.push({selector,elapsedMs:Date.now()-start});}
  const after=await page.evaluate(()=>({ids:SHOE_R07.meshes().map(m=>[m.uuid,m.geometry.uuid,Array.isArray(m.material)?m.material.map(v=>v.uuid):m.material.uuid]),builds:SHOE_R07.model.geometryBuilds,memory:SHOE_R02.renderer.info.memory}));
  assert.deepEqual(after.ids,before.ids);assert.equal(after.builds,before.builds);assert.equal(after.memory.geometries,before.memory.geometries);assert.equal(after.memory.textures,before.memory.textures);
  fs.writeFileSync(path.join(out,'VIEW_TIMINGS.json'),JSON.stringify({sourceBuild:manifest.sourceBuild,url,timings,before,after,scope:'Real click wall time on CI, not device FPS'},null,2));
 });
 await page.locator('#reset').click();'''
    s=replace_once(s," await page.locator('[data-formed-view=\"assembled\"]').click();await page.locator('#reset').click();",extra)
    p.write_text(s)
p=root/'tests/cache-regression.mjs';s=p.read_text()
if 'changedFrames' not in s:
    old="after.build(changed);after.build({...changed,view:'flat'});const t=performance.now(),restored=after.build(state),elapsed=performance.now()-t;"
    new="""const changedParts=after.build(changed),changedFrames=after.seatRays,changedThreads=after.threadPaths(changed);const changedPositions=changedParts.map(p=>new Float32Array(p.geometry.attributes.position.array));
const flatParts=after.build({...changed,view:'flat'}),buildCount=after.geometryBuilds;
assert.strictEqual(after.build(changed),changedParts);assert.strictEqual(after.seatRays,changedFrames);assert.strictEqual(after.threadPaths(changed),changedThreads);assert.equal(after.geometryBuilds,buildCount);
for(let i=0;i<changedParts.length;i++)assert.deepEqual(changedParts[i].geometry.attributes.position.array,changedPositions[i]);
const t=performance.now(),restored=after.build(state),elapsed=performance.now()-t;
assert.ok(after.snapshots.size<=3);assert.strictEqual(after.build({...changed,view:'flat'}),flatParts);after.build(state);"""
    s=replace_once(s,old,new).replace('cacheSlots:2','cacheSlots:3').replace('Session-only generated default + current geometry.','Session-only generated default + two recent states; custom formed/flat identity and contact frames checked.')
    s=s.replace("const checks=[","const checks=[{name:'custom formed and flat states retain exact buffers, contact frames and thread routes without recomputation',passed:true},")
    p.write_text(s)
print('R07.1 readable UI, build and regression sources ready; shape/material/lace algorithms unchanged.')
