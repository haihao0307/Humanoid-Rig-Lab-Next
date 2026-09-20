#!/usr/bin/env python3
"""Batched stepping adapter for the real-browser hand-action proof."""
from __future__ import annotations

import time
from typing import Any, Callable

import motion_hand_visual_proof_fast as impl


def advance_until(driver, predicate: Callable[[dict[str, Any]], bool], max_steps: int, label: str, dt: float = .04) -> dict[str, Any]:
    remaining = max_steps
    last: dict[str, Any] = {}
    while remaining > 0:
        count = min(4, remaining)
        states = impl.body_js(
            driver,
            """
            const lab=HumanLab,a=lab.agent,out=[];lab.setAuto(false);
            for(let i=0;i<arguments[1];i++){
              lab.advance(arguments[0]);let pose=null;
              try{pose=lab.human.motionDriver?.report?.()||null}catch(error){pose={error:String(error)}}
              const activity=a.activity();out.push({phase:a.phase,phaseT:Number(a.phaseT||0),error:a.error||null,
                completed:Number(a.stats?.completed||0),failed:Number(a.stats?.failed||0),readyForTask:activity.readyForTask===true,
                posture:a.basic?.posture||null,held:a.held?.id||null,pose});
              if(a.error)break;
            }
            lab.render();return out;
            """,
            dt,
            count,
        )
        for state in states:
            last = state
            if state.get("error"):
                return state
            if predicate(state):
                return state
        remaining -= count
        # Contact preflight intentionally uses wall-clock slices. Give it a
        # scheduling boundary without coupling the actual motion time to wall time.
        time.sleep(.012)
    raise TimeoutError(f"{label}未到达；最后状态={last}")


impl.advance_until = advance_until

if __name__ == "__main__":
    raise SystemExit(impl.main())
