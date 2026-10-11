"""Adapt only the inherited renderer wiring assertion to the new source API.
The first R10 CI stopped because it still required the obsolete Sampling.farWeight
call by name. Preserve all optical/geometry numeric assertions and image gates.
This is not a runtime change or a suppression of an image-test failure.
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
print('R10 source-wiring assertion updated; all numeric and browser gates retained')
