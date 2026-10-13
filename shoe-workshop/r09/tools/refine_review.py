"""Idempotent R09-only migration from the first actual render review.
Preserve original sources, fixed baseline and all other workbenches.
"""
from pathlib import Path
root=Path('shoe-workshop/r09')
p=root/'src/pattern-finish.mjs';s=p.read_text()
if "from './underlay.mjs'" not in s:
    s="import {extendTransitionUnderlay} from './underlay.mjs';\n"+s
    assert 'const state={thickness:defaults}' in s
    s=s.replace('const state={thickness:defaults}', 'extendTransitionUnderlay(m);\n const state={thickness:defaults}')
    p.write_text(s)
p=root/'src/main.mjs';s=p.read_text()
if 'soleInspectLight' not in s:
    s=s.replace('const depthReport=installShoeDepthRange(A,()=>active);', "const soleInspectLight=new T.DirectionalLight('#fff9ef',3.4);soleInspectLight.visible=false;A.scene.add(soleInspectLight,soleInspectLight.target);\n const depthReport=installShoeDepthRange(A,()=>active);")
    s=s.replace("function setCamera(name){if(!active)return;state.camera=name;", "function setCamera(name){if(!active)return;state.camera=name;soleInspectLight.visible=name==='bottom';")
    s=s.replace('A.control.target.copy(center);A.camera.position.copy(center)', 'soleInspectLight.position.copy(center).add(new T.Vector3(160,-280,120));soleInspectLight.target.position.copy(center);soleInspectLight.target.updateMatrixWorld();A.control.target.copy(center);A.camera.position.copy(center)')
    s=s.replace('function deactivate(){active=false;', 'function deactivate(){active=false;soleInspectLight.visible=false;')
    s=s.replace('tread:model.treadGeometry?.userData||null,interaction:', 'tread:model.treadGeometry?.userData||null,soleInspectionLighting:soleInspectLight.visible,interaction:')
    p.write_text(s)
p=root/'src/model.mjs';s=p.read_text()
if 'supportAllowance:this.craftSupportReport' not in s:
    s=s.replace('craftCuts:this.craftCutReport,', 'craftCuts:this.craftCutReport,supportAllowance:this.craftSupportReport,')
    s=s.replace('s.fittedSole]));', 's.fittedSole,s.treadGeometry]));').replace('old.fittedSole])', 'old.fittedSole,old.treadGeometry])')
    p.write_text(s)
p=root/'tests/craft.mjs';s=p.read_text()
if 'facing turns have a continuous supported row' not in s:
    s=s.replace(" check('cap and both heel", " check('facing turns have a continuous supported row, not disconnected accepted fragments',()=>{for(const id of [22,23]){const rows=m.seams.filter(s=>s.a===id&&s.b===28);assert.equal(rows.length,1,'P'+id+' interrupted facing seam');assert.ok(rows[0].qa.length>=30);}assert.ok(m.craftSupportReport.count>10);assert.ok(m.craftSupportReport.maxMoveMm<=3.51);report.supportAllowance=m.craftSupportReport;});\n check('cap and both heel")
    p.write_text(s)
print('R09 actual-review corrections applied idempotently')
