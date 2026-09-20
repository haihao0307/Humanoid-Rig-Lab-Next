#!/usr/bin/env python3
"""Adapters for focused hand-interaction browser proof.

Scene items remain in the physics/task world but are hidden from the proof
camera. The active object is re-enabled before its command, preserving actual
navigation, contact, IK, physics and rollback while avoiding camp occlusion.
"""
from __future__ import annotations

import motion_hand_visual_proof_fast3  # live renderer readiness + batched stepping
import motion_hand_visual_proof_fast as impl

_original_load = impl.load
_original_issue = impl.issue


def _proof_scene(driver, keep: str | None = None):
    return impl.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer,keep=arguments[0];
        for(const item of [...(w.scenery||[]),...(w.roofItems||[]),...(w.objects||[])]){
          item.visible=!!keep&&String(item.id||'').toUpperCase()===String(keep).toUpperCase();
        }
        const actors=lab.population?Array.from(lab.population.values()):[];
        for(const actor of actors){
          if(actor.agent===lab.agent||actor.human===lab.human)continue;
          for(const item of [...(actor.human?.bones||[]),...(actor.human?.cartilage||[]),...(actor.human?.tissue?.items||[])])item.visible=false;
        }
        for(const el of document.querySelectorAll('[class*=label],.object-label,.zone-label'))el.style.visibility='hidden';
        r.studioMode=true;r.background=[.035,.045,.055];lab.render();
        return{keep,objects:(w.objects||[]).filter(v=>v.visible!==false).map(v=>v.id)};
        """,
        keep,
    )


def load(driver, url):
    state=_original_load(driver,url)
    state['proofScene']=_proof_scene(driver,None)
    return state


def issue(driver, text):
    upper=str(text).upper()
    keep='A' if 'A' in upper and ('搬' in text or '箱' in text) else 'B' if 'B' in upper and '推' in text else None
    _proof_scene(driver,keep)
    return _original_issue(driver,text)


impl.load=load
impl.issue=issue
