#!/usr/bin/env python3
"""Fast real-browser proof for standing hand gestures only."""
from __future__ import annotations

import contextlib
import json
from pathlib import Path

from motion_hand_visual_proof import (
    capture,
    load_ready,
    make_driver,
    make_sheet,
    phase_wait,
    reset,
    send,
    set_view,
    snapshot,
    utc_now,
    write_review,
)


def main() -> int:
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--source-sha',required=True)
    parser.add_argument('--interactive-url',required=True)
    parser.add_argument('--output',default='gesture-proof')
    args=parser.parse_args()
    root=Path(args.output).resolve();root.mkdir(parents=True,exist_ok=True)
    report={
        'schema':'human/motion_hand_gesture_quick_proof@1',
        'sourceSHA':args.source_sha,'testedURL':args.url,'interactiveURL':args.interactive_url,
        'startedAt':utc_now(),'status':'INCONCLUSIVE','captures':[],'scenarioFailures':[],
        'surfaceReviewScope':'motion-preview-lightweight-fallback','skinApproval':False,
        'fullDynamics':False,'visualAcceptance':False,'userVisualAcceptance':'pending'
    }
    driver=None
    try:
        driver=make_driver();initial=load_ready(driver,args.url);report['bodyMode']=initial.get('bodyMode')
        cases=(
            ('01-wave','挥手（当前与打招呼同源）','挥手',{'greet','wave'},.65,['rightUpperArm','rightForearm','rightHand','head']),
            ('02-salute','敬礼','敬礼',{'salute'},.55,['rightUpperArm','rightForearm','rightHand','head']),
            ('03-greet','打招呼（当前与挥手同源）','打招呼',{'greet'},.65,['rightUpperArm','rightForearm','rightHand','leftHand','head']),
        )
        for stem,label,command,phases,delay,names in cases:
            try:
                reset(driver);set_view(driver,'front',False);send(driver,command)
                state=phase_wait(driver,phases,delay,15,f'没有观察到{label}阶段')
                item=capture(driver,root,stem,label,names,f"实际阶段 {state.get('phase')}｜固定正面镜头")
                item['completed']=True;report['captures'].append(item)
            except Exception as exc:
                report['scenarioFailures'].append(stem)
                item=capture(driver,root,stem,label,names,f'未完成：{type(exc).__name__}: {exc}')
                item['completed']=False;item['error']=f'{type(exc).__name__}: {exc}';report['captures'].append(item)
        report['contactSheet']=make_sheet(root,report['captures'])
        report['status']='CAPTURED_WITH_FAILURES' if report['scenarioFailures'] else 'CAPTURED'
        report['finishedAt']=utc_now();write_review(root,report)
        (root/'browser-run-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        (root/'browser-console.json').write_text(json.dumps(driver.get_log('browser'),ensure_ascii=False,indent=2),encoding='utf-8')
        return 0
    except Exception as exc:
        report['runnerError']={'type':type(exc).__name__,'message':str(exc)};report['finishedAt']=utc_now()
        (root/'browser-run-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        return 1
    finally:
        if driver:
            with contextlib.suppress(Exception):driver.quit()


if __name__=='__main__':raise SystemExit(main())
