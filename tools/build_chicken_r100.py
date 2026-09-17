#!/usr/bin/env python3
"""Build Chicken V4.6 R10.0 single-agent centerline-sweep candidate."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MORPH_BUILDER = ROOT / 'tools' / 'build_chicken_r991.py'
SOURCE = ROOT / 'CHICKEN_V46_R9_9_1_GAMEPLAY_HEAD.html'
PATCH = ROOT / 'tools' / 'chicken_r100_motion_patch.js'
PECK_PATCH = ROOT / 'tools' / 'chicken_r100_peck_patch.js'
CENTERLINE_PATCH = ROOT / 'tools' / 'chicken_r100_centerline_patch.js'
MANUAL_PATCH = ROOT / 'tools' / 'chicken_r100_manual_step_patch.js'
OUTPUT = ROOT / 'CHICKEN_V46_R10_0_SINGLE_AGENT.html'
PARAMS = ROOT / 'data' / 'CHICKEN_R100_SINGLE_AGENT_PARAMETERS.json'
STATIC_QA = ROOT / 'qa' / 'CHICKEN_R100_STATIC_QA.json'
BROWSER_QA = ROOT / 'qa' / 'CHICKEN_R100_BROWSER_QA.json'
CENTERLINE_QA = ROOT / 'qa' / 'CHICKEN_R100_CENTERLINE_V7_QA.json'
LOCAL_TEST_QA = ROOT / 'qa' / 'CHICKEN_R100_CENTERLINE_V7_LOCAL_TESTS.json'
MANIFEST = ROOT / 'BUILD_MANIFEST_R100.json'
EVIDENCE = ROOT / 'evidence' / 'r100'
PREBROWSER_EVIDENCE = EVIDENCE / 'centerline_v7_prebrowser'
REVIEW = EVIDENCE / 'R100_BEHAVIOR_REVIEW_BOARD.html'
IMPLEMENTATION_NOTE = ROOT / 'R100_CENTERLINE_V7_IMPLEMENTATION.md'
ANCHOR = 'const scene=new T.Scene();'
MARKER = 'CHICKEN_R100_SINGLE_AGENT_MOTION_PATCH'
PECK_MARKER = 'CHICKEN_R100_PECK_ADAPTER_PATCH'
CENTERLINE_MARKER = 'CHICKEN_R100_CENTERLINE_SWEEP_PATCH'
MANUAL_MARKER = 'CHICKEN_R100_MANUAL_STEP_PATCH'
V7_WEIGHTING = 'anatomical-topology-split-and-centerline-sweep-v7'
V7_TOPOLOGY = 'anatomical-torso-neck-split-v7'
V7_CURVE = 'bone-centerline-pchip-volume-preserving-v1'


def sha(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def build() -> dict:
    if MORPH_BUILDER.exists():
        subprocess.run([sys.executable, str(MORPH_BUILDER)], cwd=ROOT, check=True)
    elif not SOURCE.exists():
        raise RuntimeError('morphology builder and frozen R9.9.1 source are both missing')

    source = SOURCE.read_text(encoding='utf-8')
    patch = PATCH.read_text(encoding='utf-8').strip()
    peck_patch = PECK_PATCH.read_text(encoding='utf-8').strip()
    centerline_patch = CENTERLINE_PATCH.read_text(encoding='utf-8').strip()
    manual_patch = MANUAL_PATCH.read_text(encoding='utf-8').strip()

    if source.count(ANCHOR) != 1:
        raise RuntimeError('scene anchor must occur once')
    for label, marker, text in [
        ('motion', MARKER, patch),
        ('peck', PECK_MARKER, peck_patch),
        ('centerline', CENTERLINE_MARKER, centerline_patch),
        ('manual step', MANUAL_MARKER, manual_patch),
    ]:
        if marker not in text:
            raise RuntimeError(f'{label} patch marker missing')

    injected = '\n'.join([patch, peck_patch, centerline_patch, manual_patch, ANCHOR])
    output = source.replace(ANCHOR, injected, 1)
    output = output.replace(
        '<title>Chicken R9.9.1 · Continuous Ring Refit Candidate</title>',
        '<title>Chicken R10.0 · Centerline Sweep V7 Single Agent Candidate</title>',
        1,
    )
    output = output.replace(
        '鸡 · R9.9.1 · 连续头颈环带候选',
        '鸡 · R10.0 · 解剖拓扑拆分与中心线扫掠 V7',
        1,
    )
    output = output.replace(
        'R9.9.1：连续环带重排 · 尚未视觉验收',
        'R10.0 V7：单只形态与基础行为候选 · 群体关闭',
        1,
    )
    OUTPUT.write_text(output, encoding='utf-8')

    return {
        'source': str(SOURCE.relative_to(ROOT)),
        'source_sha256': sha(SOURCE),
        'patch_sha256': sha(PATCH),
        'peck_patch_sha256': sha(PECK_PATCH),
        'centerline_patch_sha256': sha(CENTERLINE_PATCH),
        'manual_patch_sha256': sha(MANUAL_PATCH),
        'output_sha256': sha(OUTPUT),
        'source_bytes': SOURCE.stat().st_size,
        'patch_bytes': PATCH.stat().st_size,
        'peck_patch_bytes': PECK_PATCH.stat().st_size,
        'centerline_patch_bytes': CENTERLINE_PATCH.stat().st_size,
        'manual_patch_bytes': MANUAL_PATCH.stat().st_size,
        'output_bytes': OUTPUT.stat().st_size,
        'marker_count': output.count(MARKER),
        'peck_marker_count': output.count(PECK_MARKER),
        'centerline_marker_count': output.count(CENTERLINE_MARKER),
        'manual_marker_count': output.count(MANUAL_MARKER),
    }


def write_params() -> None:
    write_json(PARAMS, {
        'schema': 'life_ecosystem/chicken_single_agent_runtime@1.1',
        'version': 'V4.6_R10.0_CENTERLINE_SWEEP_V7_CANDIDATE',
        'morphology_source': 'V4.6_R9.9.1_CONTINUOUS_RING_REFIT_CANDIDATE',
        'active_entry': OUTPUT.name,
        'bone_order': [
            'body_root', 'pelvis', 'chest',
            'neck_base', 'neck_c0', 'neck_c1', 'neck_c2', 'neck_c3', 'head_base', 'head',
            'wing_l', 'wing_r',
            'hip_l', 'knee_l', 'ankle_l', 'toe_l',
            'hip_r', 'knee_r', 'ankle_r', 'toe_r', 'tail',
        ],
        'behavior_set': [
            'idle_stand', 'look', 'peck', 'walk', 'stop', 'turn', 'short_run', 'wing_balance'
        ],
        'runtime': {
            'controller': 'runtime/chicken_phase1_npc_controller.mjs',
            'articulated_skin': 'runtime/chicken_phase1_articulated_skin.mjs',
            'peck_adapter': 'runtime/chicken_phase1_peck_adapter.mjs',
            'sector_adapter_compatibility_layer': 'runtime/chicken_phase1_ring_coherent_adapter.mjs',
            'centerline_sweep_adapter': 'runtime/chicken_phase1_centerline_sweep_adapter.mjs',
            'centerline_patch': 'tools/chicken_r100_centerline_patch.js',
            'manual_step': 'tools/chicken_r100_manual_step_patch.js',
            'root_motion_scale': 0.42,
            'fixed_bone_lengths': True,
            'non_root_scale_forbidden': True,
            'topology_revision': V7_TOPOLOGY,
            'weighting_revision': V7_WEIGHTING,
            'centerline_curve_revision': V7_CURVE,
            'neck_deformation': 'independent_closed_shell_rigid_ring_frames_over_pchip_bone_centerline',
            'contact_diagnostics': [
                'bill_ground_error', 'left_foot_ground_error', 'right_foot_ground_error'
            ],
        },
        'gates': {
            'local_static_gate': True,
            'mathematical_topology_gate': True,
            'browser_qa_passed': False,
            'manual_motion_naturalness_acceptance': False,
            'manual_visual_acceptance': False,
            'single_agent_grounding_complete': False,
            'collision_complete': False,
            'group_test_authorized': False,
            'production_ready': False,
        },
    })


def write_static(build_info: dict) -> None:
    checks = {
        'source_exists': SOURCE.exists(),
        'motion_patch_exists': PATCH.exists(),
        'peck_patch_exists': PECK_PATCH.exists(),
        'centerline_patch_exists': CENTERLINE_PATCH.exists(),
        'manual_patch_exists': MANUAL_PATCH.exists(),
        'single_motion_patch': build_info['marker_count'] == 1,
        'single_peck_patch': build_info['peck_marker_count'] == 1,
        'single_centerline_patch': build_info['centerline_marker_count'] == 1,
        'single_manual_patch': build_info['manual_marker_count'] == 1,
        'output_created': OUTPUT.exists(),
        'output_larger_than_source': build_info['output_bytes'] > build_info['source_bytes'],
        'controller_exists': (ROOT / 'runtime' / 'chicken_phase1_npc_controller.mjs').exists(),
        'skin_runtime_exists': (ROOT / 'runtime' / 'chicken_phase1_articulated_skin.mjs').exists(),
        'peck_adapter_exists': (ROOT / 'runtime' / 'chicken_phase1_peck_adapter.mjs').exists(),
        'sector_compatibility_adapter_exists': (
            ROOT / 'runtime' / 'chicken_phase1_ring_coherent_adapter.mjs'
        ).exists(),
        'centerline_sweep_adapter_exists': (
            ROOT / 'runtime' / 'chicken_phase1_centerline_sweep_adapter.mjs'
        ).exists(),
        'centerline_unit_test_exists': (
            ROOT / 'tests' / 'chicken_phase1_centerline_sweep_adapter.test.mjs'
        ).exists(),
        'centerline_audit_exists': CENTERLINE_QA.exists(),
        'implementation_note_exists': IMPLEMENTATION_NOTE.exists(),
    }
    write_json(STATIC_QA, {
        'schema': 'life_ecosystem/chicken_r100_static_qa@1.1',
        'version': 'V4.6_R10.0_CENTERLINE_SWEEP_V7_CANDIDATE',
        'checks': checks,
        'passed': all(checks.values()),
        'build': build_info,
        'scope': 'deterministic build, source presence and local V7 topology evidence only',
        'truthBoundary': {
            'browserQAPassed': False,
            'manualVisualAcceptance': False,
            'groupTestAuthorized': False,
            'productionReady': False,
        },
    })
    if not all(checks.values()):
        raise RuntimeError(f"static checks failed: {[key for key, value in checks.items() if not value]}")


def browser_v7_ready() -> bool:
    try:
        browser = json.loads(BROWSER_QA.read_text(encoding='utf-8'))
        skin = browser.get('runtime', {}).get('motion', {}).get('skin', {})
        return bool(
            browser.get('passed')
            and skin.get('weightingRevision') == V7_WEIGHTING
            and skin.get('topologyRevision') == V7_TOPOLOGY
            and skin.get('centerlineCurveRevision') == V7_CURVE
        )
    except Exception:
        return False


def write_review() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    if browser_v7_ready():
        status = (
            'V7 浏览器技术证据已经生成；但截图通过仍不等于动作自然或外观验收，'
            '群体测试继续关闭。'
        )
        items = [
            ('站立', 'R100_IDLE.png'),
            ('观察', 'R100_LOOK.png'),
            ('啄地', 'R100_PECK.png'),
            ('啄地侧面接触', 'R100_PECK_SIDE_CONTACT.png'),
            ('中心线躯干与颈壳', 'R100_CENTERLINE_BODY_AND_NECK.png'),
            ('行走', 'R100_WALK.png'),
            ('步进转向', 'R100_TURN.png'),
            ('短跑', 'R100_RUN.png'),
            ('翼平衡', 'R100_WING_BALANCE.png'),
            ('停止', 'R100_STOP.png'),
        ]
    else:
        status = (
            'V7 已完成拓扑拆分、闭合颈头壳、骨中心线 PCHIP 与刚性环框架的本地数学候选；'
            '尚未得到新的浏览器证据，也未通过人工视觉验收。'
        )
        items = [
            ('V7 中心线闭合壳实体预检', 'centerline_v7_prebrowser/proto_centerline_v7_filled.png'),
            ('V7 中心线闭合壳线框预检', 'centerline_v7_prebrowser/proto_centerline_v7.png'),
            ('拓扑拆分中间候选', 'centerline_v7_prebrowser/proto_split_v7_solid.png'),
            ('V7 本地审查板', 'centerline_v7_prebrowser/centerline_v7_review.jpg'),
        ]
    cards = '\n'.join(
        f'<figure><img src="{src}" alt="{title}"><figcaption>{title}</figcaption></figure>'
        for title, src in items
    )
    REVIEW.write_text(
        f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chicken R10.0 V7 单只行为审查板</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#171f25;color:#eef3f2;font:14px/1.5 system-ui,-apple-system,Segoe UI,Microsoft Yahei,sans-serif}}header{{padding:24px;border-bottom:1px solid #34444b}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;padding:18px}}figure{{margin:0;background:#10181d;border:1px solid #35454c;border-radius:8px;overflow:hidden}}img{{width:100%;height:360px;object-fit:contain;background:#182127}}figcaption{{padding:10px 12px}}.gate{{margin:0 18px 22px;padding:14px;border-left:4px solid #c49b59;background:#232c31}}</style></head><body><header><h1>Chicken V4.6 R10.0 · Centerline Sweep V7</h1><p>{status}</p></header><main class="grid">{cards}</main><section class="gate">真实门槛：躯干不得随颈部折叠；颈头闭合壳不得退化为细杆；喙与双脚接触必须成立；固定骨长与环截面积必须保持；浏览器和人工视觉通过前，群体测试不启用。</section></body></html>''',
        encoding='utf-8',
    )


def write_manifest() -> None:
    paths = [
        ROOT / 'README.md',
        ROOT / '01_CURRENT_STATE.json',
        IMPLEMENTATION_NOTE,
        SOURCE,
        PATCH,
        PECK_PATCH,
        CENTERLINE_PATCH,
        MANUAL_PATCH,
        OUTPUT,
        PARAMS,
        STATIC_QA,
        BROWSER_QA,
        CENTERLINE_QA,
        LOCAL_TEST_QA,
        REVIEW,
        ROOT / 'runtime' / 'chicken_phase1_npc_controller.mjs',
        ROOT / 'runtime' / 'chicken_phase1_articulated_skin.mjs',
        ROOT / 'runtime' / 'chicken_phase1_peck_adapter.mjs',
        ROOT / 'runtime' / 'chicken_phase1_ring_coherent_adapter.mjs',
        ROOT / 'runtime' / 'chicken_phase1_centerline_sweep_adapter.mjs',
        ROOT / 'tests' / 'chicken_phase1_centerline_sweep_adapter.test.mjs',
        ROOT / 'tools' / 'verify_chicken_r100_centerline_v7.mjs',
        ROOT / '.github' / 'workflows' / 'chicken-r100-single-agent.yml',
    ]
    paths += sorted(PREBROWSER_EVIDENCE.glob('*'))
    paths += sorted(EVIDENCE.glob('*.png'))
    files = [
        {
            'path': str(path.relative_to(ROOT)),
            'bytes': path.stat().st_size,
            'sha256': sha(path),
        }
        for path in paths
        if path.exists() and path.is_file()
    ]
    write_json(MANIFEST, {
        'schema': 'life_ecosystem/build_manifest@1.1',
        'package': 'CHICKEN_V4_6_R10_0_CENTERLINE_SWEEP_V7_CANDIDATE',
        'active_entry': OUTPUT.name,
        'weighting_revision': V7_WEIGHTING,
        'topology_revision': V7_TOPOLOGY,
        'centerline_curve_revision': V7_CURVE,
        'browser_qa_passed': browser_v7_ready(),
        'manual_visual_acceptance': False,
        'group_test_authorized': False,
        'production_ready': False,
        'files': files,
    })


def main() -> int:
    info = build()
    write_params()
    write_static(info)
    write_review()
    write_manifest()
    print(json.dumps(info, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
