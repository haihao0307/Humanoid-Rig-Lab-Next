"""Idempotent finalization after the frozen-parent source migration.
Adapt the old source-name assertion; numeric/image thresholds remain unchanged.
Also preserve the internal depth-audit API when high templates are lazy: an audit
must create and retain its required template even at the default camera distance.
Normal user rendering is unchanged by that guard; geometryOnly now correctly
reports false when the local-footprint scene contributes at a zero global weight.
"""
from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'test-layers.cjs'
s=f.read_text()
a="ok(app.includes('Sampling.farWeight')&&app.includes('saveFarFrame'),'Continuous same-source far captures');"
b="ok(app.includes('DistanceLOD.plan(pixelsPerYarn)')&&app.includes('saveFarFrame')&&app.includes('localFootprintMask')&&require('./sampling.js').finalShader.includes('max(farBlend,f.a)'),'Continuous same-source local-footprint captures');"
if a in s:
    assert s.count(a)==1
    f.write_text(s.replace(a,b))
else:
    assert b in s,'Unknown test source; do not silently change the contract'
f=P/'app.js';s=f.read_text()
for a,b in [
    ('if(pixels>4&&!mainMeshes[2])','if((pixels>4||state.qaAudit)&&!mainMeshes[2])'),
    ('if(pixels<2.7&&!detail.store&&mainMeshes[2])','if(!state.qaAudit&&pixels<2.7&&!detail.store&&mainMeshes[2])'),
    ('geometryOnly:far===0,','geometryOnly:far===0&&!wantFiltered,')
]:
    if a in s:
        assert s.count(a)==1,(a,'ambiguous source')
        s=s.replace(a,b)
    else:
        assert b in s,(a,'Unknown source; explicit review required')
f.write_text(s)
print('R10 source API, truthful diagnostics and lazy audit templates finalized; numeric/image gates retained')
