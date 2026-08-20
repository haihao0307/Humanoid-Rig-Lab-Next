# Humanoid Rig Lab Next 四板块 V002 验证记录

验证日期：2026 年 8 月 20 日
项目版本：`0.5.0`
构建 ID：`four-module-v002-20260819`

## 验证命令

```text
npm test
```

## 全套结果

```text
PASS Humanoid Rig Lab Next 0.5.0 build four-module-v002-20260819
PASS 104 required files
PASS schema v11, Character Core, BodyShape, Face Identity, Clothing System, Appearance System, Character Generator, module state, and migration contract
PASS primary 3D proportion stage and explicit 2D fallback separation
PASS live body-profile bridge and exact 3D dimension feedback contract
PASS module-scoped synchronization and rig-rule exchange contract
PASS hidden clavicle controls and visible shoulder-joint semantics
PASS JavaScript syntax checks
PASS SMPL reference GLB 1435300 bytes
PASS pre-bound single-surface GLB 2104780 bytes
PASS GitHub Pages workflow contract
PASS module-scoped patches merge simultaneous four-window edits without overwriting unrelated modules
PASS legacy surface-source fields are forced onto the single detailed surface
PASS schema v1 project migration to schema v11
PASS Character create, save, current load, historical load, optimistic revision and write guard
PASS BodyShape parameter editing, versioning, Skin response and four-module isolation
PASS Face Identity create, parameter editing, save, load, restore and Character reference
PASS Face Runtime adapter boundary preserves Skin, Rig, Pose and Animation
PASS Clothing add, remove, save, load, and historical restore
PASS static Clothing Mesh follows real animation simulationRig transforms
PASS Character clothing attachment references and schema v8 to v11 migration
PASS independent Clothing patch and visual layer preserve Body Skin and the original four modules
PASS Hair add and short, long, ponytail switching
PASS hat, glasses, and ornament attachment management
PASS Appearance save, load, restore, revision conflict, and Character references
PASS static Appearance attachments follow simulationRig without changing existing modules
PASS image observation creates Proportion, BodyShape, Face, Clothing, and Pose data through HRL-M01/HRL-M03 adapters
PASS generated Character references existing module versions without mutating Rig, Skin, or Animation data
PASS Character Generator save, historical load, serialized reload, and schema v10 to v11 migration
PASS character.html upload, analysis, generation, and version-save entry contract
PASS integrated build four-module-v002-20260819
PASS baseline-state migration to all four V002 module versions
PASS animation local-quaternion PoseSnapshot applied through fixed-length PhysicsRig
PASS native pre-bound single-surface asset hash and binding metadata
PASS shared transient transport and scrub message infrastructure
PASS archived module scopes and build identity contract
PASS full animation and V8.5 legacy regression suites
```

自动测试失败数为 0。

## 1. 骨骼比例与绑定契约

验证内容：

```text
SMPL 24 映射完整
编辑器节点总数 28
稳定骨骼 ID 和父子层级不变
隐藏锁骨与可见肩关节语义正确
28 节点角色分类完整
隐藏测量标记与控制节点分类正确
28 项绑定轴契约能够随比例重新生成
256 个边界比例和 64 个确定性混合比例通过
参考绑定在重建过程中保持零世界漂移
身体生产版和完整表现版升级蓝图完整
```

参考体型的八项三维尺寸继续通过精确测量测试：身高、肩宽、髋宽、上臂、前臂、手部控制段、大腿和小腿。

## 2. 人物蒙皮

当前预绑定资产：

```text
legacy/v8/assets/smpl/smpl-male-surface-skinned.glb
```

验证内容：

```text
文件大小 2,104,780 字节
顶点 27,578
三角形 55,152
Mesh 1
Primitive 1
Skin 1
蒙皮关节 24
原生 JOINTS_0
原生 WEIGHTS_0
24 组 inverseBindMatrices
每顶点最多四个影响并归一化
绑定姿势保护
原生 LBS 采样
全场景单表皮所有权与持续守卫
直接三角面拾取
材质状态回归
```

资产 SHA 256：

```text
736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899
```

T 姿势过渡性权重质量记录：

```text
最大顶点位移 0.6521 m
最大边伸长 5.006x
最大肩部边伸长 1.673x
```

这些数值用于回归比较，尚未构成专业蒙皮质量认证。

## 3. 动作、图片姿势与 PoseSnapshot

验证内容：

```text
固定骨长
刚性骨盆
双脚固定
人体关节活动范围
全身联动
33 点图片观测标准化
镜像与单图深度处理
图片关键点到稳定关节 ID 映射
固定骨长目标重建
图片动作资产和动作库
IndexedDB 不可用时的内存回退
PoseSnapshot 四元数有效性与归一化
PoseSnapshot 不包含绑定尺寸字段
局部四元数 PoseSnapshot 能够直接应用到 V8.4 PhysicsRig
应用前后绑定签名不变
最大骨长误差低于 1e-7 m
旧世界坐标载荷继续作为兼容回退
```

标准协议：

```text
humanoid_rig/pose_snapshot@1.0
```

## 4. 动画系统

七套专项测试全部通过：

```text
animation-assets.mjs
animation-bake.mjs
animation-editing.mjs
animation-model.mjs
animation-performance.mjs
animation-runtime.mjs
animation-workspace.mjs
```

验证范围：

```text
六个可复用 MotionClip 和一个 AnimationSession
局部四元数轨道、根节点通道和插值
关键帧创建、更新、复制、移动、删除、镜像和压缩
循环、往返循环、反向速度和事件检测
脚底接触区间、支撑脚锁定和腿部 IK
基础层、上半身覆盖层和呼吸加法层
AnimationGraph 状态、条件、触发器和交叉淡化
精确动画、物理跟随和全身物理交接模式
三种人物比例的重定向
固定骨长与根运动身高缩放
finalPose 与 desiredPose 烘焙
MotionClip JSON 往返
标准 glTF 2.0 骨架动画 GLB 生成
动画工作台与三维宿主桥接契约
```

性能记录：

```text
20,000 次片段采样的单次平均耗时约 0.02 ms
1,000 个完整运行时帧的单帧平均耗时约 3 ms
```

性能数据来自当前自动测试环境，只用于版本回归。

## 5. 多窗口共享与构建身份

验证内容：

```text
ProjectState schema 11
旧 schema 1 至 10 自动迁移
四个原模块与 Clothing 最低 moduleRevision 自动升级
不同模块的并行 Patch 保留各自切片
过期 Patch 拒绝
SharedWorker、BroadcastChannel 和 localStorage 回退契约
humanoid_rig/transient_bus@1.0
动画播放锚点和时间轴预览不增加 ProjectState revision
BUILD_MANIFEST.json 构建身份
launcher.ps1 构建 ID 核验
四个 MODULE_SCOPE 归档路径
```

## 6. 本地 HTTP 冒烟检查

以下资源在合并工程本地服务器中均返回 HTTP 200：

```text
/
/studio.html?module=proportion
/studio.html?module=skin
/studio.html?module=pose
/studio.html?module=animation
/studio.html?module=clothing
/character.html
/apps/character-generator/page.js
/legacy/v8/index.html?embed=1&build=four-module-v002-20260819&skinBuild=skin-v002-single-surface-guard
/legacy/v8/assets/smpl/smpl-male-surface-skinned.glb
/legacy/v8/assets/smpl/SKIN_BINDING_METADATA.json
/assets/animations/basic-animation-session.json
/src/modules/pose/image-pose-estimator.js
/src/modules/animation/runtime.js
/src/modules/skin/verify.html
```

## 7. 发布前人工验收

当前自动化环境无法提供可信的 Windows WebGPU 画面和鼠标操作结论。发布前仍需在桌面 Chrome 或 Edge 检查：

```text
场景中是否始终只有一层人体表皮
骨架和表皮是否读取同一最终姿势
肩、腋下、髋、膝和腕部的可见变形
点击表皮后是否选择正确关节
图片动作首次联网加载与错误回退
镜像、深度翻转和脚底接触校准
动画播放、拖动覆盖、循环和跨比例切换
四个窗口长期同步、刷新恢复和后台降频
浏览器内存、GPU 占用和十分钟连续运行
最终 SkinnedMesh 加动画 GLB 的独立回放
```

## 8. 当前结论

四个 V002 模块已经在同一母项目中通过代码、数据、边界、自动测试和 HTTP 资源回归。过渡性蒙皮质量、第三方图片模型发布审查、外部全身物理解算、最终人物动画 GLB 合并导出和桌面浏览器视觉验收继续保留为下一轮工作。
