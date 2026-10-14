from pathlib import Path
P=Path(__file__).resolve().parent
p=P/'app.js';s=p.read_text()
old='float edge=1.-smoothstep(.45,1.,abs(vAcross)),alpha=edge*vCover;if(alpha<.035)discard;'
new='''float edge=1.-smoothstep(.45,1.,abs(vAcross)),coverage=edge*vCover;
 // Stable root/arc-coordinate stochastic rounding prevents <1/MSAA fibers vanishing.
 // Expected covered samples equal 4*coverage; this is a raster approximation, not new geometry.
 float jitter=fract(vRnd*61.6180339+floor(vT*37.)*.7548776);
 float coveredSamples=floor(4.*coverage+jitter);
 if(coveredSamples<.5)discard;float alpha=min(1.,(coveredSamples+.02)*.25);'''
assert old in s or 'coveredSamples' in s
s=s.replace(old,new)
# In-context diagnostics on the actual mesh, not a secondary render scene.
s=s.replace('depthResolving:true','depthResolving:true,coverageRounding:true')
p.write_text(s)
print('R02 subpixel coverage rounding applied; geometry/root count unchanged.')
