#!/usr/bin/env python3
"""Fast deterministic real-browser proof for standing hand gestures."""
from __future__ import annotations

import argparse
import contextlib
import json
from pathlib import Path

import motion_hand_visual_proof_fast3  # live renderer readiness + batched advancement
import motion_hand_visual_proof_fast as proof


def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--source-sha',required=True)
    parser.add_argument('--interactive-url',required=True)
    parser.add_argument('--output',default='gesture-proof')
    args=parser.parse_args()
    root=Path(args.output).resolve();root.mkdir(parents=True,exist_ok=True)
    report={
        'schema':'human/motion_hand_gesture_quick_proof@2',
        'sourceSHA':args.source_sha,'testedURL':args.url,'interactiveURL':args.interactive_url,
        'startedAt':proof.now(),'status':'INCONCLUSIVE','captures':[],'scenarioFailures':[],
        'surfaceReviewScope':'motion-preview-lightweight-fallback','skinApproval':False,
        'fullDynamics':False,'visualAcceptance':False,'userVisualAcceptance':'pending'
    }
    driver=None
    try:
        driver=proof.driver_new();report['startup']=proof.load(driver,args.url)
        cases=(
            # The current parser routes 挥手 and 打招呼 through the same greet
            # action. Preserve that source fact instead of inventing a distinct
            # wave phase in the proof harness.
            ('01-wave','挥手（当前与打招呼共用动作源）','挥手',{'wave','greet'},.45,['rightUpperArm','rightForearm','rightHand','head']),
            ('02-salute','敬礼','敬礼',{'salute'},.35,['rightUpperArm','rightForearm','rightHand','head']),
            ('03-greet','打招呼（当前与挥手共用动作源）','打招呼',{'greet'},.35,['rightUpperArm','rightForearm','rightHand','leftHand','head']),
        )
        for stem,label,command,phases,min_t,names in cases:
            try:
                proof.inspect(driver,'front',False);started=proof.issue(driver,command);before=int(started['before'])
                state=proof.advance_until(driver,lambda s,ps=phases,t=min_t:s.get('phase') in ps and float(s.get('phaseT') or 0)>=t,240,label)
                report['captures'].append(proof.capture(driver,root,stem,label,names,f"实际阶段：{state.get('phase')}｜固定正面镜头"))
                proof.finish(driver,before,label,420)
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
