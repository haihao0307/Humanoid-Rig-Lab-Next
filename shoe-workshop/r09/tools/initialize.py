"""One-time R08-to-R09 migration. Already-written R09 source is never overwritten.
The release commits every generated readable source; this is not a runtime loader.
"""
from pathlib import Path
root=Path('shoe-workshop/r09'); base=Path('shoe-workshop/r08')
for src in [*base.joinpath('src').glob('*.mjs'),*base.joinpath('tests').glob('*.mjs'),base/'style.css',base/'tools/build.mjs']:
    dst=root/src.relative_to(base)
    if dst.exists(): continue
    s=src.read_text().replace('R08','R09').replace('r08','r09')
    if src.name=='model.mjs':
        s="import {refineCutBoundaries} from './pattern-finish.mjs';\nimport {applyEdgeFinish,createHardware,createSoleTread} from './finishing.mjs';\n"+s
        s=s.replace("rebuildSeams(){const old=", "rebuildSeams(){refineCutBoundaries(this);const old=")
        s=s.replace("t*.42", "t*.55")
        s=s.replace("'contactReport'];", "'contactReport','treadGeometry'];")
        s=s.replace("  this.samplers=new Map", "  for(const p of parts)applyEdgeFinish(this,p,s);\n  this.treadGeometry=s.view==='flat'?null:createSoleTread(this.fittedSole);\n  this.samplers=new Map")
        s=s.replace(" sample(id,q,s)", " hardware(s){return createHardware(this,s);}\n sample(id,q,s)")
        s=s.replace("version:VERSION,joinPlan:", "version:VERSION,craftCuts:this.craftCutReport,edgeFinish:parts.map(p=>({id:p.id,...p.geometry.userData.craftEdgeFinish})),joinPlan:")
    elif src.name=='join-plan.mjs':
        s=s.replace('pitchMm:2.8','pitchMm:3.0').replace('skiveWidthMm:4.5','skiveWidthMm:3.2').replace('skiveEdgeMm:.32','skiveEdgeMm:.62').replace('threadDiameterMm:.26','threadDiameterMm:.38')
        s=s.replace('run.slice(2,-2)','run.slice(1,-1)')
        s=s.replace("(_,p)=>a===27?p[1]>40:p[1]<91", "(_,p)=>p[1]>m.craftLipAt(p)-2")
        s=s.replace("(_,p)=>p[2]>-43&&p[2]<45&&p[1]<76&&p[1]>35", "(_,p)=>p[2]>-48&&p[2]<45&&p[1]<76&&p[1]>m.craftLipAt(p)-.5")
        s=s.replace("(_,p)=>p[1]>34", "(_,p)=>p[1]>m.craftLipAt(p)-1")
    elif src.name=='sewing.mjs':
        s=s.replace('diameter=.26','diameter=.38').replace('diameter*.25','diameter*.075').replace('diameter*.175','diameter*.27').replace('path.diameter||.26','path.diameter||.38').replace('1+.015*Math.sin','1+.024*Math.sin')
    elif src.name=='main.mjs':
        s=s.replace('<b>08</b>','<b>09</b>').replace('鞋头／侧缝／底口精修','完整针路／切边／鞋眼／底纹')
        s=s.replace('分清叠层，<br>再缝合每一针。','从裁切到封边，<br>让结构完整。')
        s=s.replace('原鞋楦与原裁片继续保留。叠层、削薄、针孔与针路共用一套连接关系；鞋头、鞋帮与后片分别配皮。鞋带暂停显示。','在原鞋楦上修正鞋头与后跟下沿；牛皮切边蜡封，穿孔加中空古铜包边，鞋底增加成形防滑肋。针脚加宽但保持贴皮扁截面；鞋带仍暂停。')
        s=s.replace('打开未改动的 R07.1 对照','打开未改动的 R08 对照').replace('2434eb78d5c07db84dcecdee7bd08b8d866ea8e4/shoe-workshop/r07/','131ae1eb8a3fa6110ee3fe5ad64ed22ef87ff33c/shoe-workshop/r08/')
        s=s.replace("if(mesh.name.startsWith('LACE_')||mesh.name.startsWith('EYELET_'))", "if(mesh.name.startsWith('LACE_'))")
        s=s.replace('allThreadMeshes=threadMeshes.slice();',"""allThreadMeshes=threadMeshes.slice();
  if(state.view!=='flat'){
   for(const e of model.hardware(state)){const m=new T.Mesh(e.geometry,materials.hardware(state,plane));m.name='EYELET_'+e.id+'_'+e.index;m.userData.formedPart=e.id;m.userData.hardware=true;m.castShadow=true;m.receiveShadow=true;meshes.find(p=>p.userData.formedPart===e.id).add(m);}
   if(model.treadGeometry){const tread=new T.Mesh(model.treadGeometry.clone(),materials.sole(state,plane));tread.name='R09_MOULDED_TREAD';tread.userData.formedPart=26;tread.castShadow=true;tread.receiveShadow=true;sole.add(tread);}
  }""")
        s='\n'.join(line for line in s.split('\n') if 'for(const e of model.eyeletGeometries(state))' not in line)
        s=s.replace('08 / LAYERED LEATHER · OWNED SEAMS','09 / FINISHED CUTS · HOLLOW HARDWARE').replace('皮革整鞋 · 结构与接缝','皮革整鞋 · 封边与精工')
        s=s.replace('threadMeshes:threadMeshes.length,interaction:', 'threadMeshes:threadMeshes.length,hardwareCount:meshes.reduce((n,m)=>n+m.children.filter(c=>c.userData.hardware).length,0),tread:model.treadGeometry?.userData||null,interaction:')
        s=s.replace('ray.intersectObjects(meshes.filter(m=>m.visible))', 'ray.intersectObjects(meshes.filter(m=>m.visible),true)')
        s=s.replace('分片牛皮 · 叠层与单排车缝','分片牛皮 · 完整车缝与切边蜡封').replace(' · 10片厚皮壳 · 单排针线／底线结构',' · 10片厚皮壳 · 0.38mm扁线／中空鞋眼／实体底纹')
        s=s.replace('目标针距 2.8mm / 距边 2mm / 削薄宽 4.5mm','目标针距 3.0mm / 距边 2mm / 削薄宽 3.2mm').replace('针距2.8mm、距边2mm、削薄过渡4.5mm','针距3.0mm、距边2mm、削薄过渡3.2mm')
    elif src.name=='browser.mjs':
        s=s.replace("chromium.launch({headless:true,args:","chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:")
        s=s.replace("['--use-angle=swiftshader','--enable-unsafe-swiftshader']", "['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']")
        s=s.replace("assert.equal(await page.evaluate(()=>SHOE_R02.root.children.filter(o=>o.name.startsWith('LACE_')||o.name.startsWith('EYELET_')).length),0);", "assert.equal(await page.evaluate(()=>SHOE_R02.root.children.filter(o=>o.name.startsWith('LACE_')).length),0);assert.equal(r.hardwareCount,4);assert.ok(r.tread.gripRibCount>=20);")
        s=s.replace("['hero','back','side','front']", "['hero','back','side','front','bottom','top']")
        s=s.replace('page.locator(selector).click()', 'page.locator(selector).click({timeout:120000})')
        s=s.replace('if(early){save();}', 'if(early){assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);save();}')
    elif src.name=='build.mjs':
        s=s.replace("'tools/initialize.py',",'').replace('5889ebd871aa34baad5e6094d4ccf29bc29f40f7','131ae1eb8a3fa6110ee3fe5ad64ed22ef87ff33c')
    dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
print('R09 readable sources initialized; existing files preserved')
