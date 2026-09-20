#!/usr/bin/env python3
"""QA-only wrapper that keeps the active character renderables visible.

The production action runtime is untouched.  This wrapper only replaces the
proof-scene isolation used by the screenshot harness; the previous harness hid
``world.objects`` wholesale, which also hid the procedural character surface.
"""
from __future__ import annotations

import motion_hand_gesture_quick_proof as gesture
import motion_hand_visual_proof_fast as proof


def isolate_visible_character(driver) -> dict:
    return proof.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer;
        const hidden=[];
        // Scenery and roof pieces may occlude the review camera.  Do not touch
        // world.objects here: it also contains active character renderables.
        for(const item of [...(w.scenery||[]),...(w.roofItems||[])]){
          if(item&&item.visible!==false){item.visible=false;hidden.push(item.id||item.label||'item');}
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
        r.studioMode=true;r.background=[.035,.045,.055];
        lab.inspectBody('front');lab.render();
        return{mode:'active-character-visible-v1',hiddenSceneItems:hidden.length,hiddenOtherActors};
        """,
    )


gesture.isolate_character = isolate_visible_character


if __name__ == "__main__":
    raise SystemExit(gesture.main())
