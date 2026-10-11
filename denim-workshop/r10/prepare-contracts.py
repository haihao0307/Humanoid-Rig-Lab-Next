"""Idempotent finalization after the frozen-parent migration.
No image threshold is relaxed. R10 now switches tessellation at an 8px yarn
pitch, morphing to the original dense near template over 8..12px. The earlier
4px selection still drew millions of mostly collapsed high-template triangles
and lost the software GPU context during the 4.83px UI transition test.
This changes actual production tessellation, not the user-facing watchdog.
"""
from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'test-layers.cjs';s=f.read_text()
a="ok(app.includes('Sampling.farWeight')&&app.includes('saveFarFrame'),'Continuous same-source far captures');"
b="ok(app.includes('DistanceLOD.plan(pixelsPerYarn)')&&app.includes('saveFarFrame')&&app.includes('localFootprintMask')&&require('./sampling.js').finalShader.includes('max(farBlend,f.a)'),'Continuous same-source local-footprint captures');"
if a in s:
    assert s.count(a)==1
    f.write_text(s.replace(a,b))
else:
    assert b in s,'Unknown test source; do not silently change the contract'
f=P/'app.js';s=f.read_text()
def change(old,new,alternate=None):
    global s
    if old in s:
        assert s.count(old)==1,(old,'ambiguous source')
        s=s.replace(old,new)
    elif alternate and alternate in s:
        assert s.count(alternate)==1
        s=s.replace(alternate,new)
    else:
        assert new in s,(old,'Unknown source; explicit review required')
change('if(pixels>4&&!mainMeshes[2])','if((pixels>8||state.qaAudit)&&!mainMeshes[2])','if((pixels>4||state.qaAudit)&&!mainMeshes[2])')
change('if(pixels<2.7&&!detail.store&&mainMeshes[2])','if(!state.qaAudit&&pixels<2.7&&!detail.store&&mainMeshes[2])')
change('geometryOnly:far===0,','geometryOnly:far===0&&!wantFiltered,')
change('longMorph=1.-Sampling.smooth(4,6,pixelsPerYarn);sideMorph=pixelsPerYarn>4?1.-Sampling.smooth(4,8,pixelsPerYarn):0.;geomLevel=pixelsPerYarn>4?1:0;',
       'longMorph=1.-Sampling.smooth(8,12,pixelsPerYarn);sideMorph=1.-Sampling.smooth(8,12,pixelsPerYarn);geomLevel=pixelsPerYarn>8?1:0;')
change('if(state.qaAudit){longMorph=0;geomLevel=1;}','if(state.qaAudit){longMorph=0;sideMorph=0;geomLevel=1;}')
f.write_text(s)
f=P/'qa-distance.py';s=f.read_text()
old=" b=pw.chromium.launch(**kw);r['browserVersion']=b.version"
new=""" # Only the paired image experiment disables the GPU watchdog for the unmodified
 # heavy R09 reference. UI/public validation keep the default watchdog enabled.
 # https://chromium.googlesource.com/angle/angle/+/HEAD/doc/DebuggingTips.md
 if args.scope=='motion':kw['args'].append('--disable-gpu-watchdog')
 r['softwareComparisonWatchdogDisabled']=args.scope=='motion'
 b=pw.chromium.launch(**kw);r['browserVersion']=b.version"""
if "r['softwareComparisonWatchdogDisabled']" not in s:
    assert s.count(old)==1,'Unknown browser launch source'
    f.write_text(s.replace(old,new))
print('R10 transition tessellation, source API, audit and software-reference environment finalized; image gates and public watchdog retained')
