#!/usr/bin/env python3
"""Fast deterministic real-browser proof for standing hand gestures.

The production task and pose runtime remains authoritative. Simulation steps
are executed in browser-local batches to avoid Selenium round-trip timeouts;
this changes only the proof harness, not any character motion. World props are
hidden for the screenshot pass only so the inspected character cannot be
occluded by camp furniture between the camera and the body.
"""
from __future__ import annotations

import argparse
import contextlib
import json
from pathlib import Path

import motion_hand_visual_proof_fast3  # actual renderer readiness
import motion_hand_visual_proof_fast as proof


def isolate_character(driver) -> dict:
    return proof.body_js(
        driver,
        """
        const lab=HumanLab,w=lab.world,r=lab.renderer;
        const hidden=[];
        for(const item of [...(w.scenery||[]),...(w.roofItems||[]),...(w.objects||[])]){
          if(item&&item.visible!==false){item.visible=false;hidden.push(item.id||item.label||'item');}
        }
        const actors=lab.population?Array.from(lab.population.values()):[];
        for(const actor of actors){
          if(actor.agent===lab.agent||actor.human===lab.human)continue;
          for(const item of [...(actor.human?.bones||[]),...(actor.human?.cartilage||[]),...(actor.human?.tissue?.items||[])])item.visible=false;
        }
        r.studioMode=true;r.background=[.035,.045,.055];
        lab.inspectBody('front');lab.render();
        return{hiddenWorldItems:hidden.length,hiddenOtherActors:Math.max(0,actors.length-1)};
        """,
    )


def step_to(driver, phases: set[str], minimum_phase_time: float, maximum_steps: int = 150, dt: float = .04):
    return proof.body_js(
        driver,
        """
        const lab=HumanLab,a=lab.agent,phases=new Set(arguments[0]);
        const minT=arguments[1],maxSteps=arguments[2],dt=arguments[3];
        lab.setAuto(false);let reached=false,steps=0;
        for(;steps<maxSteps;steps++){
          lab.advance(dt);
          if(a.error)break;
          if(phases.has(a.phase)&&Number(a.phaseT||0)>=minT){reached=true;break;}
        }
        lab.render();
        return{reached,steps:steps+1,phase:a.phase,phaseT:Number(a.phaseT||0),error:a.error||null,
          completed:Number(a.stats?.completed||0),failed:Number(a.stats?.failed||0),readyForTask:a.activity().readyForTask===true};
        """,
        sorted(phases), minimum_phase_time, maximum_steps, dt,
    )


def settle(driver, before: int, maximum_steps: int = 240, dt: float = .04):
    return proof.body_js(
        driver,
        """
        const lab=HumanLab,a=lab.agent,before=arguments[0],maxSteps=arguments[1],dt=arguments[2];
        lab.setAuto(false);let settled=false,steps=0;
        for(;steps<maxSteps;steps++){
          lab.advance(dt);
          if(a.error)break;
          const activity=a.activity();
          if(Number(a.stats?.completed||0)>before&&activity.readyForTask===true){settled=true;break;}
        }
        lab.render();return{settled,steps:steps+1,phase:a.phase,phaseT:Number(a.phaseT||0),error:a.error||null,
          completed:Number(a.stats?.completed||0),failed:Number(a.stats?.failed||0),readyForTask:a.activity().readyForTask===true};
        """,
        before, maximum_steps, dt,
    )


def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--source-sha',required=True)
    parser.add_argument('--interactive-url',required=True)
    parser.add_argument('--output',default='gesture-proof')
    args=parser.parse_args()
    root=Path(args.output).resolve();root.mkdir(parents=True,exist_ok=True)
    report={
        'schema':'human/motion_hand_gesture_quick_proof@4',
        'sourceSHA':args.source_sha,'testedURL':args.url,'interactiveURL':args.interactive_url,
        'startedAt':proof.now(),'status':'INCONCLUSIVE','captures':[],'scenarioFailures':[],
        'surfaceReviewScope':'motion-preview-lightweight-fallback','skinApproval':False,
        'fullDynamics':False,'visualAcceptance':False,'userVisualAcceptance':'pending'
    }
    driver=None
    try:
        driver=proof.driver_new();driver.set_script_timeout(180);report['startup']=proof.load(driver,args.url)
        report['sceneIsolation']=isolate_character(driver)
        cases=(
            # Current parser maps 挥手 and 打招呼 to the same greet source.
            ('01-wave','挥手（当前与打招呼共用动作源）','挥手',{'wave','greet'},.45,['rightUpperArm','rightForearm','rightHand','head']),
            ('02-salute','敬礼','敬礼',{'salute'},.35,['rightUpperArm','rightForearm','rightHand','head']),
            ('03-greet','打招呼（当前与挥手共用动作源）','打招呼',{'greet'},.35,['rightUpperArm','rightForearm','rightHand','leftHand','head']),
        )
        for stem,label,command,phases,min_t,names in cases:
            try:
                proof.inspect(driver,'front',False)
                started=proof.issue(driver,command);before=int(started['before'])
                state=step_to(driver,phases,min_t)
                if state.get('error'):raise RuntimeError(state['error'])
                if not state.get('reached'):raise RuntimeError(f"未到目标阶段，实际 {state.get('phase')} t={state.get('phaseT')}")
                report['captures'].append(proof.capture(driver,root,stem,label,names,f"实际阶段：{state.get('phase')}｜固定正面镜头｜场景道具仅在截图中隐藏"))
                end=settle(driver,before)
                if end.get('error'):raise RuntimeError(end['error'])
                if not end.get('settled'):
                    report['scenarioFailures'].append(stem+'-transition-out')
            except Exception as exc:
                report['scenarioFailures'].append(stem)
                report['captures'].append(proof.capture(driver,root,stem,label,names,'',False,f'{type(exc).__name__}: {exc}'))
        report['contactSheet']=proof.sheet(root,report['captures'])
        report['status']='CAPTURED_WITH_FAILURES' if report['scenarioFailures'] else 'CAPTURED'
        report['finishedAt']=proof.now();proof.review(root,report)
        (root/'browser-run-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        (root/'browser-console.json').write_text(json.dumps(driver.get_log('browser'),ensure_ascii=False,indent=2),encoding='utf-8')
        return 0
    except Exception as exc:
        report['runnerError']={'type':type(exc).__name__,'message':str(exc)};report['finishedAt']=proof.now()
        (root/'browser-run-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        if driver:
            with contextlib.suppress(Exception):driver.save_screenshot(str(root/'runner-failure-window.png'))
        return 1
    finally:
        if driver:
            with contextlib.suppress(Exception):driver.quit()


if __name__=='__main__':
    raise SystemExit(main())
