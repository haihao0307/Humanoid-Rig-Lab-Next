"""Isolated trial: preserve microscopic original domains without expansion."""
from pathlib import Path
import sys,json
root=Path(__file__).resolve().parents[3]
sys.argv=[str(__file__),'full',sys.argv[1] if len(sys.argv)>1 else 'baseline']
source=(root/'tools/compile-source-atlas-r21.py').read_text(encoding='utf8')
source=source.replace('root=Path(__file__).resolve().parent.parent','root=Path('+repr(str(root))+')')
source=source.replace('EPS=2e-14','EPS=0.0')
source=source.replace('qa/fidelity-r21/offline/atlas-','qa/fidelity-r24/offline/zero-atlas-').replace('qa/fidelity-r21/atlas-','qa/fidelity-r24/zero-atlas-')
exec(compile(source,str(root/'tools/compile-source-atlas-r21.py'),'exec'))
