#!/usr/bin/env python3
"""QA-only wrapper that captures the real reconstructed Compact character.

The production action runtime is untouched.  The source proof previously hid
``world.objects`` and the first QA shortcut then cancelled Compact reconstruction;
both paths could leave valid joint state with no rendered person.  This wrapper
waits for the actual CompactSurfaceRenderer, keeps the active surface enabled,
and hides only scenery plus non-active actors.
"""
from __future__ import annotations

from typing import Any

import motion_hand_gesture_quick_proof as gesture
import motion_hand_visual_proof_fast as proof


_base_load = proof.load


def load_visible_compact(driver, url: str) -> dict[str, Any]:
    state = _base_load(driver, url)

    def compact_ready() -> dict[str, Any] | None:
        value = proof.body_js(
            driver,
            """
            const lab=HumanLab,c=lab.compact||lab.renderer?.compact||null;
            if(c&&!c.disposed){
              c.enabled=true;
              lab.focus('body');
              lab.inspectBody('front');
              try{c.prepare?.('skin')}catch(error){}
              lab.render();
            }
            const active=lab.population?.active||null;
            return {
              ready:!!c&&!c.disposed&&c.boundHuman===lab.human&&Array.isArray(c.chunks)&&c.chunks.length>0&&c.visible===true,
              compact: c?{enabled:c.enabled!==false,visible:c.visible===true,disposed:!!c.disposed,
                chunks:c.chunks?.length||0,quality:c.quality||null,view:c.view||null,
                boundToActive:c.boundHuman===lab.human,triangles:c.report?.triangles||0}:null,
              activeId:active?.id||null,
              activeHumanMatches:active?.human===lab.human,
              visibleActorCount:lab.renderer?.compactPerformance?.stats?.visibleActorCount??null,
              compactLoading:window.__compactLoading||null
            };
            """,
        )
        return value if value.get("ready") else None

    compact = proof.wait_until(compact_ready, 360, "真实重建人物未进入可见状态", .25)
    return {**state, "realCompact": compact}


def isolate_visible_character(driver) -> dict:
    return proof.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer,active=lab.population?.active||null;
        const hidden=[];
        for(const item of [...(w.scenery||[]),...(w.roofItems||[])]){
          if(item&&item.visible!==false){item.visible=false;hidden.push(item.id||item.label||'item');}
        }
        const actors=lab.population?Array.from(lab.population.values()):[];
        let hiddenOtherActors=0;
        for(const actor of actors){
          const primary=actor===active||actor?.agent===lab.agent||actor?.human===lab.human;
          if(primary)continue;
          if(actor?.compact){actor.compact.enabled=false;actor.compact.visible=false;}
          for(const item of [...(actor?.human?.bones||[]),...(actor?.human?.cartilage||[]),...(actor?.human?.tissue?.items||[])]){
            if(item)item.visible=false;
          }
          hiddenOtherActors++;
        }
        const compact=active?.compact||lab.compact||r.compact;
        if(!compact)throw Error('截图时缺少真实 Compact 人物表面');
        compact.enabled=true;
        for(const el of document.querySelectorAll('[class*=label],.object-label,.zone-label'))el.style.visibility='hidden';
        r.studioMode=true;r.background=[.035,.045,.055];
        lab.focus('body');lab.inspectBody('front');compact.prepare?.('skin');lab.render();
        if(compact.visible!==true)throw Error('真实 Compact 人物表面未进入可见绘制状态');
        return{mode:'real-compact-active-character-v2',hiddenSceneItems:hidden.length,hiddenOtherActors,
          activeId:active?.id||null,compact:{enabled:compact.enabled!==false,visible:compact.visible===true,
          chunks:compact.chunks?.length||0,triangles:compact.report?.triangles||0,view:compact.view||null,
          boundToActive:compact.boundHuman===lab.human}};
        """,
    )


proof.load = load_visible_compact
gesture.isolate_character = isolate_visible_character


if __name__ == "__main__":
    raise SystemExit(gesture.main())
