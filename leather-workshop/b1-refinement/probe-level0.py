"""Same PMREM atlas, bilinear filter, roughness interpolation and samples.
Only compare sampler instructions after checking a single-level, anisotropy-one
atlas with identical min/mag filters. This file is diagnostic, never release code.
"""
from pathlib import Path
p=Path(__file__).with_name('probe-hotspots.py');s=p.read_text()
s=s.replace("O=R/'qa/b1/hotspots'", "O=R/'qa/b1/level0-probe'")
s=s.replace("for label in ['current','alpha-true','no-floor','no-environment','no-shadows','basic-floor','basic-hero','no-yarn']:", "for label in ['current','level-zero','implicit-single-level']:")
inject='''if label!='current':
    code=Path('leather-workshop/b1-refinement/exact-shading.js').read_text()
    replacement='textureLod( envMap, uv, 0.0 )' if label=='level-zero' else 'texture2D( envMap, uv )'
    marker=" let lights=T.ShaderChunk.lights_physical_pars_fragment;"
    assert code.count(marker)==1
    code=code.replace(marker," cube=once(cube,'texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) )','"+replacement+"');\\n"+marker)
    code+='\\nconst __initOriginal=initRenderer;initRenderer=function(){__initOriginal();const t=environment.texture;if(t.minFilter!==T.LinearFilter||t.magFilter!==T.LinearFilter||t.generateMipmaps||t.anisotropy!==1)throw Error("PMREM sampler contract");const native=renderer.render.bind(renderer);renderer.render=function(s,c){B1ExactShading.prepare(s);return native(s,c);};};\\n'
    s=s.replace('boot().catch(fail);',code+'boot().catch(fail);')
   copy=O/(label+'.html');copy.write_text'''
s=s.replace("copy=O/(label+'.html');copy.write_text",inject)
s=s.replace("'Root-cause diagnostic variants; not publication or reduced-quality candidates'", "'Same-quality PMREM single-level sampling instruction comparison'")
exec(compile(s,str(p),'exec'))
