# 人物蒙皮模块 V002 交接记录

## 1. 基本信息

```text
模块：人物蒙皮
运行时版本：skin@0.5.1
绑定资产版本：skin-transitional@0.5.0
兼容 Rig：rig@0.4.0
Rig 配置：smpl24-controls28@1
工作包基线：0.5.0
补丁编号：skin-patch-v002
构建标识：skin-v002-single-surface-guard
完成日期：2026-08-19
当前状态：等待 Windows WebGPU 实机复核
```

## 2. 本轮触发原因

用户在 `127.0.0.1:4173/legacy/v8/index.html` 的实机截图中继续看到两套相互穿插的人体轮廓。截图左上状态卡使用了历史构建的文字，未出现 `skin-v001` 的“预绑定人物表皮已就绪”，也未出现本轮 `SKIN V002` 构建标识。

根目录共享启动器只检查 `4173` 端口上的首页是否包含 `Humanoid Rig Lab Next`。旧文件夹中的服务器仍占用该端口时，启动器会直接打开旧页面，不核对工作包路径、构建 ID、运行时代码或 GLB 哈希。后续压缩包虽然已经更新，浏览器仍可能持续进入旧进程。

根目录 `launcher.ps1`、`server.mjs` 和 `legacy/v8/src/main.js` 在 `MODULE_SCOPE.json` 中属于共享只读文件。本轮保持这些文件不变，并在蒙皮可写目录中建立独立的 V002 检查入口。

## 3. 本轮目标

1. 让用户能够明确确认浏览器加载的是当前 V002 工作包。
2. 避开历史服务器长期占用的 `4173` 端口。
3. 在整个 Three.js 场景范围内审计人体表面 Mesh。
4. 在加载前、加载完成、姿势刷新、显示切换、拾取和持续监控阶段清理重复人体表面。
5. 保持骨骼层级、骨骼 ID、绑定局部位置和绑定骨长只读。
6. 保留唯一预绑定 GLB、原生 `skinIndex`、`skinWeight`、`inverseBindMatrices` 和单一 `SkinnedMesh` 管线。

## 4. V002 专用构建验证入口

新增目录内入口：

```text
src/modules/skin/OPEN_SKIN_V002.bat
src/modules/skin/打开人物蒙皮V002.bat
```

启动流程如下：

1. 从 `4192` 到 `4210` 搜索专用检查端口。
2. 每次复用端口前请求 `src/modules/skin/skin-build.json`。
3. 只有实际返回 `skin-v002-single-surface-guard` 时才允许复用。
4. 其他进程或历史构建占用端口时继续寻找下一个端口。
5. 检查本地 Node.js 版本，要求 Node.js 18 或更高版本。
6. 检查锁定版本 Three.js 0.185.1。本地依赖缺失时调用 `npm install --no-audit --no-fund`。
7. 启动当前解压目录中的 `server.mjs`。
8. 先打开 `verify.html`，核对构建清单与 `smpl-skin.js` 运行时标记。
9. 只有核对通过后才启用“打开 V002 人物编辑器”按钮。

验证通过页面必须显示：

```text
已确认当前端口属于 SKIN V002
```

编辑器左上状态卡必须显示：

```text
SKIN V002 唯一预绑定表皮已就绪
```

状态详情必须包含：

```text
skin-v002-single-surface-guard
场景可见人体表皮 1 层
```

停止专用服务器使用：

```text
src/modules/skin/STOP_SKIN_V002.bat
src/modules/skin/停止人物蒙皮V002.bat
```

## 5. 全场景唯一表皮守卫

`legacy/v8/src/smpl-skin.js` 新增场景所有权和重复表皮审计。

### 5.1 唯一所有者

每次创建蒙皮层时，场景获得新的所有者令牌：

```text
__humanoidRigPrimarySurfaceOwner
__humanoidRigPrimarySurfaceGeneration
```

最新蒙皮层成为唯一有效所有者。旧蒙皮层继续执行诊断时，只能识别并保留当前所有者，无法删除新表皮，也无法重新加入渲染场景。

### 5.2 审计时机

重复表皮审计在以下阶段执行：

1. 创建主表皮容器之前。
2. 预绑定 `SkinnedMesh` 挂载以后。
3. 表皮进入 ready 状态之前。
4. 每次姿势刷新开始与完成时。
5. 显示和隐藏切换时。
6. 获取拾取目标时。
7. 读取运行时诊断时。
8. 每 160 毫秒执行一次持续审计。

持续审计用于处理异步延迟挂载的旧程序化人体、旧静态人体和隐藏拾取壳。即使人物保持静止，延迟出现的重复人体 Mesh 也会被移除。

### 5.3 保留对象

守卫不会移除以下内容：

1. `HumanoidSkeletonHierarchy` 中的关节球。
2. `HumanoidBoneVisuals` 中的骨杆。
3. `TranslationGizmo` 中的操作轴。
4. Grid、Axes、Light 和 Camera 等非 Mesh 场景对象。
5. 名称明确属于地面、网格、辅助对象、环境或碰撞调试的 Mesh。
6. 具有受支持 `humanoidAttachmentRole` 的衣服、头发、眼睛、配件、环境或碰撞调试 Mesh。
7. 明确设置 `userData.allowAlongsideHumanoidSurface = true` 的合法附属对象。

当前允许的附属角色：

```text
clothing
hair
eyes
accessory
collision-debug
environment
```

人体基础表面仍然只允许一个。

### 5.4 拾取安全

拾取目标只在以下条件全部满足时返回：

1. 当前蒙皮层拥有场景表皮所有权。
2. 唯一 `SkinnedMesh` 已挂载并可见。
3. 场景审计没有发现重复人体表面。
4. 场景中可见人体表皮数量不超过一层。

任何重复人体表面未能清理时，拾取目标返回空数组，避免用户点击到错误模型。

## 6. 当前运行管线

当前正式渲染路径保持如下：

```text
预绑定 GLB
→ POSITION / NORMAL / COLOR_0
→ JOINTS_0 / WEIGHTS_0
→ 24 组 inverseBindMatrices
→ Three.js Skeleton
→ 单一 SkinnedMesh
→ GPU 线性混合蒙皮
→ 同一网格直接三角面拾取
```

当前 GLB 结构：

```text
Mesh：1
Primitive：1
Material：1
Skin：1
蒙皮关节：24
顶点：27,578
三角形：55,152
每顶点最大影响：4
Morph Target：0
动画：0
纹理：0
```

当前代码不创建程序化人体表皮、黄色选择人体、隐藏拾取人体、基础回退人体或第二个 `SkinnedMesh`。

## 7. 运行时诊断字段

V002 在原有诊断上增加：

```text
buildId
patchId
moduleVersion
compatibleRigVersion
sceneSurfaceMeshCount
duplicateSurfaceCount
visibleDuplicateSurfaceCount
legacySurfaceRemovalCount
removedLegacySurfaces
duplicateSurfaceDetectedAfterGuard
ownsPrimarySurfaceSlot
surfaceOwnerToken
continuousSceneGuard
sceneAuditIntervalMs
sceneAuditCount
sceneAudit
assetSha256
```

诊断中的 `renderableSurfaceCount` 现在统计整个 Three.js 场景中的人体表面，不再只统计蒙皮模块自己保存的 `this.mesh`。

## 8. 骨架只读边界

本轮没有修改：

```text
骨骼父子层级
骨骼稳定 ID
绑定局部位置
绑定骨长
关节活动范围
28 控制节点配置
SMPL 24 映射顺序
比例模块
动作物理模块
动画模块
共享项目 schema
共享状态中心
```

蒙皮内部 24 Bone 继续作为 GLB skin 的 GPU 驱动骨架。可编辑 28 节点骨架继续由共享骨架板块管理。

## 9. 资产许可与归属

源资产：

```text
legacy/v8/assets/smpl/smpl-male-surface.glb
```

来源组织：Meshcapade 与 Max Planck Institute for Intelligent Systems。

许可：Creative Commons Attribution 4.0 International，CC BY 4.0。

预绑定派生资产：

```text
legacy/v8/assets/smpl/smpl-male-surface-skinned.glb
```

派生内容保留源表面的 27,578 个顶点和 55,152 个三角形，并加入 24 关节层级、`JOINTS_0`、`WEIGHTS_0` 和逆绑定矩阵。重新分发时必须保留 `ATTRIBUTION.md` 并遵守 CC BY 4.0。

当前包不包含完整 SMPL 参数模型、学习形状基底、原始学习权重、关节回归器或姿势修正 Blend Shape。

资产 SHA 256：

```text
736cb39c828203eae72f5e5d094f1623c0a4465a31b484737a6e8df02a7ec899
```

## 10. 兼容关系

```text
运行时模块：skin@0.5.1
绑定资产：skin-transitional@0.5.0
兼容 Rig：rig@0.4.0
Rig 配置：smpl24-controls28@1
蒙皮根骨：hips
生产状态：false
权重状态：experimental-transitional
```

比例模块产生新绑定尺寸后，当前参考表皮会报告 `referenceBindingMismatch`。正式流程需要为目标 `rigVersion` 重新生成 `SkinBinding` 和逆绑定矩阵。

## 11. 测试结果

### 11.1 未修改 V001 参考副本

执行：

```text
npm test
```

结果：全部通过，失败数 0。

### 11.2 V002 最终工作目录

执行：

```text
npm test
```

结果：全部通过，失败数 0。

重点回归内容：

1. 预绑定 GLB 拓扑与校验和。
2. 原生 `JOINTS_0` 与 `WEIGHTS_0`。
3. 24 组 inverse bind matrices。
4. 四影响权重归一化。
5. 绑定姿势保护。
6. 单一原生 `SkinnedMesh`。
7. 同一网格直接拾取。
8. 加载前清理历史程序化人体。
9. 持续监控自动清理延迟挂载的重复人体。
10. 重新创建蒙皮层时新所有者替换旧所有者。
11. 旧蒙皮层诊断不会删除当前新表皮。
12. 关节球、骨杆、操作轴和合法衣服附属 Mesh 保持存在。
13. 实体、半透明与线框模式保持透明度设置。
14. 比例不兼容警告。

关键数值：

```text
预绑定 GLB 大小：2,104,780 bytes
顶点数量：27,578
三角形数量：55,152
关节数量：24
最大关节索引：23
最大权重和误差：小于 0.000001
绑定姿势最大顶点误差：小于 0.00001 m
T 姿势最大顶点位移：0.6521 m
T 姿势最大三角边伸长：5.006x
T 姿势肩部最大边伸长：1.673x
非有限变形数值：0
持续表皮审计间隔：160 ms
场景允许基础人体表面：1 层
```

### 11.3 本地 HTTP 检查

使用当前工作目录在专用端口启动服务器后，以下资源全部返回 HTTP 200：

```text
/src/modules/skin/skin-build.json
/src/modules/skin/verify.html
/legacy/v8/src/smpl-skin.js
/legacy/v8/assets/smpl/smpl-male-surface-skinned.glb
```

运行时代码中确认存在：

```text
skin-v002-single-surface-guard
SKIN V002 唯一预绑定表皮已就绪
```

## 12. 剩余变形问题

1. 当前权重属于过渡实验权重，仍需许可明确的专业蒙皮权重。
2. 肩、腋下、胯部、肘部和膝部没有姿势修正 Morph Target。
3. T 姿势局部最大边伸长达到 5.006 倍，少量细小三角形仍存在明显拉伸风险。
4. 肩部局部最大边伸长为 1.673 倍，需要在 Windows WebGPU 实机中检查肩峰、锁骨和腋下轮廓。
5. 当前姿势桥接主要读取关节世界位置，可以恢复骨链方向，绕骨轴的纯扭转信息仍然有限。
6. 比例变化后需要生成新 `rigVersion` 对应的绑定资产和逆绑定矩阵。
7. 当前 Linux 无头环境无法完成目标 Windows GPU 的最终视觉审批。
8. 衣服、头发、眼睛和配件接入时需要设置受支持的 `humanoidAttachmentRole`，避免被唯一人体表面守卫识别为历史重复人体。

## 13. 共享总控仍需处理的事项

根目录共享启动器仍可能复用 `4173` 上的历史项目。总控板块合并时建议增加：

1. 当前工作包绝对路径校验。
2. `BUILD_MANIFEST` 或模块构建 ID 校验。
3. 关键运行时代码哈希校验。
4. 预绑定 GLB 哈希校验。
5. 端口对应进程命令行和工作目录校验。
6. 发现历史构建时自动选择新端口。
7. 页面固定显示当前构建 ID。
8. 真实浏览器端场景表皮数量自动测试。

共享文件中的部分历史文字仍提到基础加载占位和隐藏拾取代理。总控在统一协议时应更新为“任意渲染帧最多一层基础人体表面，精细表皮挂载采用原子替换”。

## 14. 实机验收步骤

1. 将完整 V002 工作包解压到新文件夹。
2. 进入 `src/modules/skin`。
3. 双击 `OPEN_SKIN_V002.bat` 或 `打开人物蒙皮V002.bat`。
4. 等待构建验证页显示绿色通过状态。
5. 点击“打开 V002 人物编辑器”。
6. 确认左上状态卡显示 `SKIN V002 唯一预绑定表皮已就绪`。
7. 确认状态详情显示 `场景可见人体表皮 1 层`。
8. 选择“表皮”模式，依次检查正面、侧面、背面和透视。
9. 选择“同时”模式，确认一套表皮与一套骨架同步。
10. 切换 A 姿势与 T 姿势。
11. 检查头部、面部、肩部、腋下、胸腹、胯部、肘部、膝部、腕部和踝部。
12. 点击人物不同区域，确认不会出现黄色人体壳或额外人体轮廓。
13. 切换实体、半透明和线框模式。
14. 点击“重建表皮”，确认重建前后都只显示一层人体表面。
15. 截取正面、侧面、背面、A 姿势和 T 姿势画面用于下一轮权重精修。

## 15. 回滚方法

1. 恢复 V001 的 `legacy/v8/src/smpl-skin.js`。
2. 恢复 V001 的 `legacy/v8/tests/surface-layer-integration.mjs`。
3. 恢复 V001 的 `src/modules/skin/index.js`。
4. 删除 `src/modules/skin` 中全部 V002 启动、验证和说明文件。
5. 恢复 `control/active-tasks/skin.md` 与 `control/module-status/skin.json`。
6. 执行 `npm test`。

预绑定 GLB、资产许可、权重数据和逆绑定矩阵在 V002 中没有重新生成，回滚运行时不会改变绑定资产内容。
