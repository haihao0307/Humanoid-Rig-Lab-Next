"""Diagnostic-only same-quality specialization. Original release gates remain unchanged."""
from pathlib import Path
import os,json,traceback,io,runpy
# Reuse the frozen measurement harness, not its reduced-quality alternatives.
p=Path(__file__).with_name('probe-hotspots.py');s=p.read_text()
s=s.replace("O=R/'qa/b1/hotspots'", "O=R/'qa/b1/exact-shading-probe'")
s=s.replace("for label in ['current','alpha-true','no-floor','no-environment','no-shadows','basic-floor','basic-hero','no-yarn']:", "for label in ['current','exact-shading','exact-alpha']:")
s=s.replace("if label=='alpha-true':", "if label=='exact-alpha':")
s=s.replace("copy=O/(label+'.html');copy.write_text", "if label!='current':\n    code=Path('leather-workshop/b1-refinement/exact-shading.js').read_text()\n    code+='\\nconst __initOriginal=initRenderer;initRenderer=function(){__initOriginal();const native=renderer.render.bind(renderer);renderer.render=function(s,c){B1ExactShading.prepare(s);return native(s,c);};};\\n'\n    s=s.replace('boot().catch(fail);',code+'boot().catch(fail);')\n   copy=O/(label+'.html');copy.write_text")
s=s.replace("'Root-cause diagnostic variants; not publication or reduced-quality candidates'", "'Exact-shading diagnostic copies; unchanged quality and original release thresholds'")
exec(compile(s,str(p),'exec'))
