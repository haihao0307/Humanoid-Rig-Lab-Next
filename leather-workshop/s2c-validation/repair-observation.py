"""Correct an observation boundary, not rendering behavior or visual tolerances.
The first extended run proved no idle polling, then inspected one queued first
thumbnail frame before it had completed in the software GPU. Wait for actual
callback/draw events within a bounded deadlock timeout and record elapsed time.
This is a functional isolation gate, not an800ms/50ms performance assertion.
"""
from pathlib import Path
R=Path(__file__).resolve().parents[1]/'r16';p=R/'qa-render-batch.py';s=p.read_text()
a="   p.locator('[data-product=\"wallet\"]').hover();p.wait_for_timeout(300);before=p.evaluate('LEATHER_ATELIER.presentation()');p.wait_for_timeout(800);after=p.evaluate('LEATHER_ATELIER.presentation()');check('Thumbnail animation does not redraw unchanged hero',after['sceneDraws']==before['sceneDraws'] and after['thumbnailDraws']>before['thumbnailDraws'],{'before':before,'after':after})"
b="""   before=p.evaluate('LEATHER_ATELIER.presentation()');observed_at=time.perf_counter();p.locator('[data-product="wallet"]').hover();p.wait_for_function('(n)=>LEATHER_ATELIER.presentation().thumbnailDraws>=n+2',arg=before['thumbnailDraws'],timeout=10000);after=p.evaluate('LEATHER_ATELIER.presentation()');check('Thumbnail animation does not redraw unchanged hero',after['sceneDraws']==before['sceneDraws'] and after['thumbnailDraws']>=before['thumbnailDraws']+2,{'before':before,'after':after,'twoDrawObservationMS':(time.perf_counter()-observed_at)*1000,'notAFPSGate':True})"""
assert s.count(a)==1,'Test correction source drift';p.write_text(s.replace(a,b));print('Only extended test observation corrected; no production input changed')
