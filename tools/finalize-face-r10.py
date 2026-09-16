from __future__ import annotations

import base64
import gzip
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Materialize the browser-validated candidate into readable source files.
payload = (ROOT / 'tools/apply-face-jaw-oral-r10-candidate.py.gz.b64').read_bytes()
script = gzip.decompress(base64.b64decode(payload)).decode('utf-8')
namespace = {'__name__': '__main__', '__file__': str(ROOT / 'tools/apply-face-jaw-oral-r10-candidate.py')}
exec(compile(script, namespace['__file__'], 'exec'), namespace)
runpy.run_path(str(ROOT / 'tools/fix-face-jaw-oral-r10-contract.py'), run_name='__main__')

(ROOT / 'docs/FACE_JAW_ORAL_R10.md').write_text(
    '''# 头部局部下颌与程序化口腔 R10

2026-09-16。本阶段在 R9 中性唇接触基础上，加入与 Core Rig 隔离的头部局部下颌表现控制，并建立程序化牙列、牙龈和舌体遮挡层。

## 已实施内容

- `body/FaceAnatomy.js` 升级为 `r14-jaw-oral-cavity`。
- 新增独立 `jawOpen` 表情通道；`lipPart` 继续只表示上下唇自由边分离。
- 下颌采用头部局部坐标中的有界旋转与平移，只影响下牙、下牙龈、舌体、下唇和中央下脸权重区。
- 上牙与上牙龈保持在头部坐标中，不随下颌移动。
- 程序化生成上、下牙列、连续牙龈弓和舌体；当前属于遮挡与运动关系候选，不是测量牙科模型。
- 闭口时口腔结构隐藏；张口达到阈值后，牙齿、牙龈和舌体进入独立材质与深度绘制。
- NPC 居民缓存、面部编辑器和渲染器均增加 `jawOpen`，身份脸与临时表情继续分层。

## 不变量

本阶段没有修改 Core Rig、父子层级、骨长、绑定姿势、人物比例、动作或任务系统。下颌仍属于 Performance Deform 高级表现层。

## 已知边界

- 当前下颌不是双侧髁突、关节盘和下颌窝组成的真实 TMJ 模型。
- 当前牙列为 24 颗程序化候选牙，未覆盖完整恒牙类别和咬合关系。
- 当前没有牙齿碰撞、唇齿接触、舌齿接触和咀嚼动力学。
- 参数与浏览器检查通过不等于视觉验收；`visualAcceptance=false`、`productionReady=false`。

## 验证

- 源码装配与生成入口一致性检查
- 面部控制、眼部结构和面部结构参数夹具
- 身份/表情分层、NPC uniform 隔离和启动测试
- 候选浏览器运行确认：自然进入 ready、WebGL 错误为 0、无页面脚本异常
''',
    encoding='utf-8',
    newline='\n',
)

readme = ROOT / 'README.md'
text = readme.read_text(encoding='utf-8')
marker = '# 重建人物 R2 · 行为与人物模块修整 R11\n'
entry = '''
2026-09-16 **头部局部下颌与程序化口腔 R10**：拆分 `jawOpen` 与 `lipPart`，在头部局部坐标中增加有界下颌表现控制，并程序化生成上、下牙列、连续牙龈弓和舌体遮挡。上颌保持静止，下颌相关结构与中央下脸按权重运动；闭口时口腔层隐藏。该阶段不修改 Core Rig，仍为候选状态。见 [头部局部下颌与程序化口腔 R10](docs/FACE_JAW_ORAL_R10.md)。
'''
if marker not in text:
    raise SystemExit('README title anchor missing')
if entry.strip() not in text:
    text = text.replace(marker, marker + entry, 1)
readme.write_text(text, encoding='utf-8', newline='\n')

qa = {
    'schema': 'jarvis/face_jaw_oral_browser_qa@1',
    'candidateCommit': '9bfb62a4bd6de4a50edea132c0f44ce99f0d81ea',
    'candidateWorkflowRun': 35049064927,
    'startupReadyNaturally': True,
    'startupOverlayBypassed': False,
    'singleActor': True,
    'eyeRevision': 'r14-procedural-iris-lid-integration',
    'faceRevision': 'r14-jaw-oral-cavity',
    'recipeRevision': 'r5-jaw-oral-cavity',
    'channels': 23,
    'oralStructures': ['upperTeeth', 'lowerTeeth', 'upperGum', 'lowerGum', 'tongue'],
    'webglError': 0,
    'contextLost': False,
    'pageErrors': [],
    'browserExecuted': True,
    'visualAcceptance': False,
    'productionReady': False,
    'userVisualAcceptance': 'pending',
}
(ROOT / 'docs/qa').mkdir(parents=True, exist_ok=True)
(ROOT / 'docs/qa/face-jaw-oral-r10-browser.json').write_text(
    json.dumps(qa, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8',
    newline='\n',
)
