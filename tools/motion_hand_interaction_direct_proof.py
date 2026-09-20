#!/usr/bin/env python3
"""Functional hand-action proof using real tasks, real Compact body and direct Renderer."""
from __future__ import annotations

from typing import Any

import motion_hand_visual_proof_full_adapter as adapter
import motion_hand_visual_proof_fast as implementation
from motion_hand_direct_capture import capture_direct


def direct_proof_scene(driver, keep: str | None = None) -> dict[str, Any]:
    return implementation.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer,active=lab.population?.active||null;
        const keep=String(arguments[0]||'').toUpperCase();
        let hiddenSceneItems=0,hiddenOtherActors=0;
        for(const item of [...(w?.scenery||[]),...(w?.roofItems||[])]){
          if(item&&item.visible!==false){item.visible=false;hiddenSceneItems++;}
        }
        const taskObjects=[];
        for(const item of (w?.objects||[])){
          const id=String(item?.id||'').toUpperCase();
          item.visible=!!keep&&id===keep;
          if(item.visible)taskObjects.push(id);
        }
        for(const actor of (lab.population?Array.from(lab.population.values()):[])){
          const primary=actor===active||actor?.human===lab.human||actor?.agent===lab.agent;
          if(primary)continue;
          if(actor?.compact){actor.compact.enabled=false;actor.compact.visible=false;}
          for(const item of [...(actor?.human?.bones||[]),...(actor?.human?.cartilage||[]),...(actor?.human?.tissue?.items||[])])if(item)item.visible=false;
          hiddenOtherActors++;
        }
        const compact=active?.compact||lab.compact||r.compact;
        if(!compact)throw Error('功能动作缺少当前人物 Compact 表面');
        compact.enabled=true;r.compacts=r.compacts||[];if(!r.compacts.includes(compact))r.compacts.push(compact);
        r.studioMode=true;r.background=[.035,.045,.055];
        for(const el of document.querySelectorAll('[class*=label],.object-label,.zone-label'))el.style.visibility='hidden';
        return{mode:'direct-render-real-compact-functional-v1',keep:keep||null,taskObjects,
          hiddenSceneItems,hiddenOtherActors,activeId:active?.id||null,
          compact:{enabled:compact.enabled!==false,chunks:compact.chunks?.length||0,
            triangles:compact.report?.triangles||0,boundToActive:compact.boundHuman===lab.human}};
        """,
        keep,
    )


def load_real_compact(driver, url: str) -> dict[str, Any]:
    state = adapter._original_load(driver, url)

    def ready() -> dict[str, Any] | None:
        value = implementation.body_js(
            driver,
            """
            const lab=HumanLab,r=lab.renderer,active=lab.population?.active||null;
            const c=active?.compact||lab.compact||r?.compact||null;
            if(c&&!c.disposed){c.enabled=true;r.compacts=r.compacts||[];if(!r.compacts.includes(c))r.compacts.push(c);try{c.prepare?.('skin')}catch(error){}}
            return{ready:!!c&&!c.disposed&&c.boundHuman===lab.human&&Array.isArray(c.chunks)&&c.chunks.length>0,
              activeId:active?.id||null,activeHumanMatches:active?.human===lab.human,
              compact:c?{enabled:c.enabled!==false,visible:c.visible===true,disposed:!!c.disposed,
                chunks:c.chunks?.length||0,triangles:c.report?.triangles||0,quality:c.quality||null,
                boundToActive:c.boundHuman===lab.human}:null,
              activeCompacts:r?.activeCompacts?.().length??null,compactLoading:window.__compactLoading||null};
            """,
        )
        return value if value.get("ready") else None

    real = implementation.wait_until(ready, 360, "功能动作真实 Compact 人物没有完成重建", .25)
    state["realCompact"] = real
    state["proofScene"] = direct_proof_scene(driver, None)
    return state


adapter._proof_scene = direct_proof_scene
implementation.load = load_real_compact
implementation.capture = lambda driver, out_dir, stem, label, names, subtitle, completed=True, error=None: capture_direct(
    implementation, driver, out_dir, stem, label, names, subtitle, completed, error
)


if __name__ == "__main__":
    raise SystemExit(implementation.main())
