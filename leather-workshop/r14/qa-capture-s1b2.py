"""Stable-frame capture helper, not an application override.

Pinned Three r169 rounds setViewport but floors its viewport when restoring the
default render target after a shadow pass. Fractional DOM rectangles therefore
produce a one-pixel transient. Finish the pending worker initialization and two
ordinary render calls in BOTH reference and candidate. Do not move or resample an
image, modify camera/material/geometry, hide surfaces, or relax the pixel gate.
"""
def prepare_capture(page, name):
    page.bring_to_front()
    if name != 'live-lift':
        page.wait_for_function("()=>{const r=LEATHER_ATELIER.productPhysics;return r.version.startsWith('R09') && r.receivedPoses>0 && r.receivedPoses===r.appliedPoses;}", timeout=90000)
    page.evaluate('LEATHER_ATELIER.render();LEATHER_ATELIER.render();')
    page.wait_for_timeout(120)

def gpu_viewport(page):
    return page.evaluate("()=>{const c=document.getElementById('sceneCanvas'),g=c.getContext('webgl2');return g?{viewport:Array.from(g.getParameter(g.VIEWPORT)),scissor:Array.from(g.getParameter(g.SCISSOR_BOX))}:null;}")
