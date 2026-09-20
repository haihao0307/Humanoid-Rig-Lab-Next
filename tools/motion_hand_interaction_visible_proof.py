#!/usr/bin/env python3
"""QA-only wrapper for real Compact functional hand-action screenshots.

Production task, motion, contact-IK and physics code remains authoritative.
The wrapper waits for the reconstructed Compact body, keeps only the active
actor plus the relevant task box visible, and rejects a state-only/blank proof.
"""
from __future__ import annotations

from typing import Any

import motion_hand_visual_proof_full_adapter as adapter
import motion_hand_visual_proof_fast as implementation


def visible_proof_scene(driver, keep: str | None = None):
    return implementation.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer,active=lab.population?.active||null;
        const keep=String(arguments[0]||'').toUpperCase();
        let hiddenSceneItems=0;
        for(const item of [...(w.scenery||[]),...(w.roofItems||[])]){
          if(item&&item.visible!==false){item.visible=false;hiddenSceneItems++;}
        }
        const taskObjects=[];
        for(const item of (w.objects||[])){
          const id=String(item?.id||'').toUpperCase();
          item.visible=!!keep&&id===keep;
          if(item.visible)taskObjects.push(id);
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
        if(!compact)throw Error('功能动作截图缺少真实 Compact 人物表面');
        compact.enabled=true;
        for(const el of document.querySelectorAll('[class*=label],.object-label,.zone-label'))el.style.visibility='hidden';
        r.studioMode=true;r.background=[.035,.045,.055];compact.prepare?.('skin');lab.render();
        if(compact.visible!==true)throw Error('功能动作截图中的真实 Compact 人物未进入绘制状态');
        return{mode:'real-compact-functional-hand-v2',keep:keep||null,taskObjects,hiddenSceneItems,hiddenOtherActors,
          activeId:active?.id||null,compact:{enabled:compact.enabled!==false,visible:compact.visible===true,
          chunks:compact.chunks?.length||0,triangles:compact.report?.triangles||0,view:compact.view||null,
          boundToActive:compact.boundHuman===lab.human}};
        """,
        keep,
    )


def load_real_compact(driver, url: str) -> dict[str, Any]:
    state = adapter._original_load(driver, url)

    def compact_ready() -> dict[str, Any] | None:
        value = implementation.body_js(
            driver,
            """
            const lab=HumanLab,c=lab.compact||lab.renderer?.compact||null;
            if(c&&!c.disposed){c.enabled=true;lab.focus('body');lab.inspectBody('front');try{c.prepare?.('skin')}catch(error){}lab.render();}
            return{ready:!!c&&!c.disposed&&c.boundHuman===lab.human&&Array.isArray(c.chunks)&&c.chunks.length>0&&c.visible===true,
              compact:c?{enabled:c.enabled!==false,visible:c.visible===true,disposed:!!c.disposed,chunks:c.chunks?.length||0,
                quality:c.quality||null,view:c.view||null,boundToActive:c.boundHuman===lab.human,triangles:c.report?.triangles||0}:null,
              activeId:lab.population?.active?.id||null,activeHumanMatches:lab.population?.active?.human===lab.human,
              visibleActorCount:lab.renderer?.compactPerformance?.stats?.visibleActorCount??null,
              compactLoading:window.__compactLoading||null};
            """,
        )
        return value if value.get('ready') else None

    compact = implementation.wait_until(compact_ready, 360, '功能动作真实重建人物未进入可见状态', .25)
    state['realCompact'] = compact
    state['proofScene'] = visible_proof_scene(driver, None)
    return state


adapter._proof_scene = visible_proof_scene
implementation.load = load_real_compact


if __name__ == "__main__":
    raise SystemExit(implementation.main())
