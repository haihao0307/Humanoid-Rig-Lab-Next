#!/usr/bin/env python3
"""QA-only wrapper for visible functional hand-action screenshots.

It preserves the production task, motion, contact-IK and physics code.  Only
the proof-camera isolation is replaced so the procedural character surface is
not hidden together with ``world.objects``.
"""
from __future__ import annotations

import motion_hand_visual_proof_full_adapter as adapter
import motion_hand_visual_proof_fast as implementation


def visible_proof_scene(driver, keep: str | None = None):
    return implementation.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer;
        const keep=String(arguments[0]||'').toUpperCase();
        let hiddenSceneItems=0;
        for(const item of [...(w.scenery||[]),...(w.roofItems||[])]){
          if(item&&item.visible!==false){item.visible=false;hiddenSceneItems++;}
        }
        // Only switch the two task boxes.  Other world.objects remain untouched
        // because the active character render surface is registered there too.
        const taskObjects=[];
        for(const item of (w.objects||[])){
          const id=String(item?.id||'').toUpperCase();
          if(id==='A'||id==='B'){
            item.visible=!!keep&&id===keep;
            if(item.visible)taskObjects.push(id);
          }
        }
        const actors=lab.population?Array.from(lab.population.values()):[];
        let hiddenOtherActors=0;
        for(const actor of actors){
          const human=actor?.human||actor?.agent?.human||null;
          const primary=actor===lab.agent||actor?.agent===lab.agent||human===lab.human||human===lab.agent?.human;
          if(primary)continue;
          for(const item of [...(human?.bones||[]),...(human?.cartilage||[]),...(human?.tissue?.items||[])]){
            if(item)item.visible=false;
          }
          hiddenOtherActors++;
        }
        for(const el of document.querySelectorAll('[class*=label],.object-label,.zone-label'))el.style.visibility='hidden';
        r.studioMode=true;r.background=[.035,.045,.055];lab.render();
        return{mode:'active-character-visible-v1',keep:keep||null,taskObjects,hiddenSceneItems,hiddenOtherActors};
        """,
        keep,
    )


# adapter.load / adapter.issue already reference adapter._proof_scene at runtime.
adapter._proof_scene = visible_proof_scene


if __name__ == "__main__":
    raise SystemExit(implementation.main())
