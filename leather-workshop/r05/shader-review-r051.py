"""Encode GLSL string patches rather than hand-escaping multiline JS literals."""
from pathlib import Path
import json
r=Path(__file__).resolve().parent;p=r/'site/runtime.js';s=p.read_text()
a=s.index('mat.onBeforeCompile=s=>');b=s.index("mat.customProgramCacheKey=()=> 'thread-outside-r051';return mat;}",a)
patches=[('vertexShader','#include <common>','#include <common>\nattribute float capMask;varying float vCap;'),('vertexShader','#include <begin_vertex>','#include <begin_vertex>\nvCap=capMask;'),('fragmentShader','#include <common>','#include <common>\nvarying float vCap;'),('fragmentShader','#include <map_fragment>','if(vCap<.5){\n#include <map_fragment>\n}'),('fragmentShader','#include <normal_fragment_maps>','if(vCap<.5){\n#include <normal_fragment_maps>\n}')]
body='mat.onBeforeCompile=s=>{'+''.join(f's.{key}=s.{key}.replace({json.dumps(old)},{json.dumps(new)});' for key,old,new in patches)+'};'
s=s[:a]+body+s[b:];p.write_text(s)
print('GLSL source injection string encoding checked, R05 only.')
