#!/usr/bin/env python3
"""Build Chicken V4.6 R10.0 single-agent behavior workbench from R9.9.1 morphology."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MORPH_BUILDER=ROOT/'tools'/'build_chicken_r991.py'
SOURCE=ROOT/'CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html'
PATCH=ROOT/'tools'/'chicken_r100_motion_patch.js'
MANUAL_PATCH=ROOT/'tools'/'chicken_r100_manual_step_patch.js'
OUTPUT=ROOT/'CHICKEN_V46_R10_0_SINGLE_AGENT.html'
PARAMS=ROOT/'data'/'CHICKEN_R100_SINGLE_AGENT_PARAMETERS.json'
STATIC_QA=ROOT/'qa'/'CHICKEN_R100_STATIC_QA.json'
BROWSER_QA=ROOT/'qa'/'CHICKEN_R100_BROWSER_QA.json'
MANIFEST=ROOT/'BUILD_MANIFEST_R100.json'
EVIDENCE=ROOT/'evidence'/'r100'
REVIEW=EVIDENCE/'R100_BEHAVIOR_REVIEW_BOARD.html'
ANCHOR='const scene=new T.Scene();'
MARKER='CHICKEN_R100_SINGLE_AGENT_MOTION_PATCH'
MANUAL_MARKER='CHICKEN_R100_MANUAL_STEP_PATCH'


def sha(path:Path)->str:
 h=hashlib.sha256();h.update(path.read_bytes());return h.hexdigest()

def write_json(path:Path,value)->None:
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def build()->dict:
 subprocess.run([sys.executable,str(MORPH_BUILDER)],cwd=ROOT,check=True)
 source=SOURCE.read_text(encoding='utf-8')
 patch=PATCH.read_text(encoding='utf-8').strip()
 manual_patch=MANUAL_PATCH.read_text(encoding='utf-8').strip()
 if source.count(ANCHOR)!=1:raise RuntimeError('scene anchor must occur once')
 if MARKER not in patch:raise RuntimeError('motion patch marker missing')
 if MANUAL_MARKER not in manual_patch:raise RuntimeError('manual step patch marker missing')
 output=source.replace(ANCHOR,patch+'\n'+manual_patch+'\n'+ANCHOR,1)
 output=output.replace('<title>Chicken R9.9.1 · Continuous Ring Refit Candidate</title>','<title>Chicken R10.0 · Single Agent Behavior Foundation</title>',1)
 output=output.replace('鸡 · R9.9.1 · 连续头颈环带候选','鸡 · R10.0 · 单只基础行为闭环',1)
 output=output.replace('R9.9.1：连续环带重排 · 尚未视觉验收','R10.0：单只动作与骨链测试 · 群体关闭',1)
 OUTPUT.write_text(output,encoding='utf-8')
 return{
  'source':str(SOURCE.relative_to(ROOT)),
  'source_sha256':sha(SOURCE),
  'patch_sha256':sha(PATCH),
  'manual_patch_sha256':sha(MANUAL_PATCH),
  'output_sha256':sha(OUTPUT),
  'source_bytes':SOURCE.stat().st_size,
  'patch_bytes':PATCH.stat().st_size,
  'manual_patch_bytes':MANUAL_PATCH.stat().st_size,
  'output_bytes':OUTPUT.stat().st_size,
  'marker_count':output.count(MARKER),
  'manual_marker_count':output.count(MANUAL_MARKER)
 }

def write_params()->None:
 write_json(PARAMS,{
  'schema':'life_ecosystem/chicken_single_agent_runtime@1.0','version':'V4.6_R10.0_SINGLE_AGENT_BEHAVIOR_FOUNDATION',
  'morphology_source':'V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE','active_entry':OUTPUT.name,
  'bone_order':['body_root','pelvis','chest','neck_c0','neck_c1','head','wing_l','wing_r','hip_l','knee_l','ankle_l','toe_l','hip_r','knee_r','ankle_r','toe_r','tail'],
  'behavior_set':['idle_stand','look','peck','walk','stop','turn','short_run','wing_balance'],
  'runtime':{'controller':'runtime/chicken_phase1_npc_controller.mjs','articulated_skin':'runtime/chicken_phase1_articulated_skin.mjs','manual_step':'tools/chicken_r100_manual_step_patch.js','root_motion_scale':0.42,'fixed_bone_lengths':True,'non_root_scale_forbidden':True},
  'gates':{'technical_motion_gate':False,'manual_visual_acceptance':False,'single_agent_grounding_complete':False,'collision_complete':False,'group_test_authorized':False,'production_ready':False}
 })

def write_static(build_info:dict)->None:
 checks={
  'source_exists':SOURCE.exists(),
  'patch_exists':PATCH.exists(),
  'manual_patch_exists':MANUAL_PATCH.exists(),
  'single_patch':build_info['marker_count']==1,
  'single_manual_patch':build_info['manual_marker_count']==1,
  'output_created':OUTPUT.exists(),
  'output_larger_than_source':build_info['output_bytes']>build_info['source_bytes'],
  'controller_exists':(ROOT/'runtime/chicken_phase1_npc_controller.mjs').exists(),
  'skin_runtime_exists':(ROOT/'runtime/chicken_phase1_articulated_skin.mjs').exists()
 }
 write_json(STATIC_QA,{'schema':'life_ecosystem/chicken_r100_static_qa@1.0','checks':checks,'passed':all(checks.values()),'build':build_info,'scope':'deterministic build and dependency presence only'})
 if not all(checks.values()):raise RuntimeError(f'static checks failed: {[k for k,v in checks.items() if not v]}')

def write_review()->None:
 EVIDENCE.mkdir(parents=True,exist_ok=True)
 items=[('站立','R100_IDLE.png'),('观察','R100_LOOK.png'),('啄地','R100_PECK.png'),('行走','R100_WALK.png'),('步进转向','R100_TURN.png'),('短跑','R100_RUN.png'),('翼平衡','R100_WING_BALANCE.png'),('停止','R100_STOP.png')]
 cards='\n'.join(f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>' for title,src in items)
 REVIEW.write_text(f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R10.0 单只行为审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#eef3f2;font:14px/1.5 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px;border-bottom:1px solid #34444b}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;padding:18px}}figure{{margin:0;background:#10181d;border:1px solid #35454c;border-radius:8px;overflow:hidden}}img{{width:100%;height:360px;object-fit:contain;background:#182127}}figcaption{{padding:10px 12px}}.gate{{margin:0 18px 22px;padding:14px;border-left:4px solid #c49b59;background:#232c31}}</style></head><body><header><h1>Chicken V4.6 R10.0 · 单只基础行为闭环</h1><p>此审查板只验证单只鸡的骨链、固定骨长、动作状态与外观协同。群体测试未启用。</p></header><main class="grid">{cards}</main><section class="gate">门槛：脚底接触、朝向更新、头颈与腿部骨链、停止边界和循环必须稳定；截图成功不等于动作已经自然。</section></body></html>''',encoding='utf-8')

def write_manifest()->None:
 paths=[SOURCE,PATCH,MANUAL_PATCH,OUTPUT,PARAMS,STATIC_QA,BROWSER_QA,REVIEW,ROOT/'runtime/chicken_phase1_npc_controller.mjs',ROOT/'runtime/chicken_phase1_articulated_skin.mjs']+sorted(EVIDENCE.glob('*.png'))
 files=[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in paths if p.exists()]
 write_json(MANIFEST,{'schema':'life_ecosystem/build_manifest@1.0','package':'CHICKEN_V4_6_R10_0_SINGLE_AGENT_BEHAVIOR_FOUNDATION','active_entry':OUTPUT.name,'group_test_authorized':False,'files':files})

def main()->int:
 info=build();write_params();write_static(info);write_review();write_manifest();print(json.dumps(info,indent=2));return 0

if __name__=='__main__':raise SystemExit(main())
