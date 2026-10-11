"""Idempotent finalization after the frozen-parent source migration.
Adapt the old source-name assertion; numeric/image thresholds remain unchanged.
Preserve the internal depth-audit API with lazy high-detail templates and report
local filtering truthfully. The paired software-renderer experiment may exceed
Chromium's GPU timeout while drawing the unmodified R09 baseline; only that
experiment disables the GPU watchdog. UI and public browsers keep it enabled.
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
f=P/'qa-distance.py';s=f.read_text()
old=" b=pw.chromium.launch(**kw);r['browserVersion']=b.version"
new=""" # The image comparison draws the unmodified heavy R09 reference as well.
 # ANGLE documents this debugging option for software/debug draws that run long.
 # Never apply it to the user-facing UI/public verification, or suppress GL loss.
 # https://chromium.googlesource.com/angle/angle/+/HEAD/doc/DebuggingTips.md
 if args.scope=='motion':kw['args'].append('--disable-gpu-watchdog')
 r['softwareComparisonWatchdogDisabled']=args.scope=='motion'
 b=pw.chromium.launch(**kw);r['browserVersion']=b.version"""
if "r['softwareComparisonWatchdogDisabled']" not in s:
    assert s.count(old)==1,'Unknown browser launch source'
    f.write_text(s.replace(old,new))
print('R10 source, audit and software-reference test environment finalized; thresholds and public watchdog retained')
