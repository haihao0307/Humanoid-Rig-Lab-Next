from pathlib import Path
import runpy

# Apply the visually reviewed R6 optical candidate and the R7 nasal-subunit
# candidate to the readable production sources. The staging helper is removed
# by the promotion workflow after all checks and browser evidence are complete.
runpy.run_path('tools/apply-face-nose-midface-r7-candidate.py', run_name='__main__')

Path('docs/FACE_EYE_OPTICS_R6.md').write_text(
    '''# 程序化眼球光学与眼睑整合 R6

2026-09-15。本阶段在 R4 眼裂与眼眶连续结构的基础上，将旧低分辨率虹膜替换为同一眼球局部坐标系中的程序化虹膜环与独立瞳孔，并进一步收敛上下睑、眼球和眼眶之间的空间关系。

## 已实施内容

- `body/EyeAnatomy.js` 使用 `r14-procedural-iris-lid-integration`。
- 眼白、程序化虹膜、瞳孔和眼睑使用同一眼球坐标框架、同一眨眼侧别和同一深度校正。
- 虹膜由有界环带生成，外半径 5.85 mm、瞳孔半径 2.10 mm；这些数值是当前 R2 头部的候选参数，不代表统计学平均值或个体扫描数据。
- 旧虹膜绘制片从生产显示中移除，避免新旧虹膜叠加。
- 眼球整体后移、上下睑开口和外缘过渡同时校正，避免只移动眼球而不移动眼睑造成的分离。
- `body/FaceAnatomy.js` 的宽范围眼眶凹陷继续减弱，保留局部上睑沟、下睑过渡和颧部体积。

## 架构边界

本阶段仅属于 Performance Deform / 高级表现层。它不修改 Core Rig、父子层级、骨长、绑定姿势或人物比例。虹膜、瞳孔、眼睑和眼眶仍然是程序化近似，不是扫描眼组织，也没有真实折射、泪膜动力学或眼外肌仿真。

## 验证

- `node tools/build-pure.mjs`
- `node tools/check-pure.mjs`
- `node tools/check-eye-anatomy.mjs --parameter-fixtures`
- 面部身份/表情分层、NPC uniform 隔离与启动测试
- 独立浏览器中完成单人物面部入口、正面、侧面和嘴鼻近景截图

程序与参数检查通过不等于视觉完成。当前仍保持 `visualAcceptance=false`、`productionReady=false`。
''',
    encoding='utf-8',
    newline='\n',
)

Path('docs/FACE_NOSE_MIDFACE_R7.md').write_text(
    '''# 鼻部亚单位与中面部连续结构 R7

2026-09-15。本阶段针对前一版正面和侧面近景中鼻尖偏块状、鼻翼与面颊连接不清、鼻孔像水平狭缝的问题，将单一鼻梁轮廓扩展为可检查的鼻部亚单位组合。

## 已实施内容

- `body/FaceAnatomy.js` 使用 `r11-nasal-subunit-continuity`。
- 鼻背主轮廓改为 11 个有序纵向控制结点，继续与中面部表面共享同一连续高度场。
- 新增有界鼻尖中央体积、成对鼻尖穹隆、鼻翼小叶、鼻翼沟、鼻侧壁和鼻小柱体积。
- 鼻翼沟采用局部负位移，仅用于分开鼻翼与面颊，不能形成一圈硬切槽。
- 鼻孔开口由横向狭缝调整为倾斜椭圆，并继续使用真实三维边界和向内的程序化鼻腔；鼻孔不是贴在表面的黑色图案。
- 鼻底回转和鼻小柱下移幅度重新收敛，减轻侧面鼻底突然折断。
- 所有新增体积继续由函数、参数与关系生成，没有引入扫描网格、预制鼻模型或图片贴图。

## 视觉判断边界

本轮正面近景中，左右鼻孔分离和鼻翼边界比 R6 更明确；侧面轮廓没有发生新的大幅突变。但当前鼻尖、鼻翼、上唇和面颊仍受原始 R2 头部低频形态限制，不能称为真人级最终鼻部。下一阶段应处理人中、唇珠、口角、颏唇沟和下巴连续体，而不是继续单独增加鼻尖锐度。

## 验证

- 鼻孔椭圆比例、鼻部控制结点排序和亚单位幅度边界检查
- 面部网格有限值、索引、法线方向、三维鼻腔边界与头部绑定检查
- 完整装配、面部身份/表情分层、NPC uniform 隔离和启动测试
- 独立浏览器正面、侧面和嘴鼻近景截图；WebGL 错误为 0，页面脚本错误为空

当前状态继续为 Candidate，`visualAcceptance=false`、`productionReady=false`，等待用户画面验收。
''',
    encoding='utf-8',
    newline='\n',
)

readme = Path('README.md')
text = readme.read_text(encoding='utf-8')
marker = '# 重建人物 R2 · 行为与人物模块修整 R11\n'
entry = '''
2026-09-15 **程序化眼球与鼻部连续结构 R6/R7**：旧低分辨率虹膜替换为同眼球坐标系中的程序化虹膜环与独立瞳孔；眼球、上下睑和眼眶过渡共同收敛。鼻部从单一轮廓扩展为鼻尖穹隆、鼻翼、鼻翼沟、侧壁、鼻小柱和倾斜椭圆鼻孔组成的有界亚单位。源码、参数和独立浏览器检查通过，但整体人脸仍未视觉验收。见 [程序化眼球光学与眼睑整合 R6](docs/FACE_EYE_OPTICS_R6.md) 与 [鼻部亚单位与中面部连续结构 R7](docs/FACE_NOSE_MIDFACE_R7.md)。
'''
if marker not in text:
    raise SystemExit('README title anchor missing')
if entry.strip() not in text:
    text = text.replace(marker, marker + entry, 1)
readme.write_text(text, encoding='utf-8', newline='\n')
