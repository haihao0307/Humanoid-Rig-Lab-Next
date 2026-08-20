# Humanoid Rig Lab Next 动作与物理模块交接说明

## 1. 交付标识

```text
工作包基线：Humanoid Rig Lab Next 0.5.0
补丁版本：pose-patch-v002
动作模块版本：pose@0.4.0
兼容绑定版本：rig@0.4.0
PoseSnapshot：humanoid_rig/pose_snapshot@1.0
图片观测：humanoid_rig/pose_observation@1.0
图片姿势候选：humanoid_rig/image_pose_candidate@1.0
图片动作资产：humanoid_rig/image_pose_asset@1.0
图片动作库：humanoid_rig/image_pose_library@1.0
完成日期：2026-08-19
```

本轮在 `pose-patch-v001` 的固定骨长、刚性骨盆、脚部固定、人体活动范围、全身联动和局部四元数协议基础上，新增单张图片复刻动作闭环。

## 2. 模块边界

本轮只修改 `MODULE_SCOPE.json` 中动作板块允许写入的路径：

```text
src/modules/pose/**
legacy/v8/tests/physics-rig.mjs
control/active-tasks/pose.md
control/module-status/pose.json
```

没有修改以下绑定数据：

```text
父子层级
稳定骨骼 ID
绑定局部位置
固定骨长
骨骼缩放
逆绑定矩阵
人物比例
蒙皮权重
```

对 `pose-patch-v001` 工作包进行了逐文件 SHA256 对比。本轮共检测到 9 个新增或修改文件，全部位于允许写入范围，越界修改数量为 0。最终 `pose-patch-v002` 采用相对原始 0.5.0 工作包的累计交付方式，包含 11 个动作板块可写文件，因此可以直接应用到原始动作工作包，也可以覆盖已经应用 v001 的同名文件。

## 3. 用户工作流

动作面板顶部新增“图片复刻动作”区域，操作顺序如下：

1. 上传一张全身人物图片。
2. 网站首次使用时加载 MediaPipe Tasks Vision 和 Pose Landmarker Full 模型。
3. 系统识别 33 个人体关键点、近似三维世界关键点、可见性和置信度。
4. 系统将图片关键点映射到当前人物的稳定关节 ID。
5. 固定骨长、四点刚性骨盆、人体活动范围、地面碰撞和全身求解共同生成三维姿势候选。
6. 用户检查原图上的关键点叠加和质量报告。
7. 用户可以调整左右镜像、前后深度翻转、深度强度、脚底接触和根位置选项。
8. 点击“应用到三维人物”可直接预览。
9. 点击“保存并应用”后，动作进入网站动作库。
10. 动作库支持重新应用、载入源图、导出 JSON 和删除。
11. 已保存动作再次使用时，会依据当前绑定版本重新重定向。

## 4. 图片识别与重定向管线

```text
图片文件
  → MediaPipe Pose Landmarker
  → 33 点 PoseObservation
  → 左右与坐标标准化
  → 单图深度处理
  → SMPL24 与 28 控制节点映射
  → 当前绑定骨长目标构建
  → PhysicsRig 全身约束求解
  → PoseCandidate
  → PoseSnapshot + IKTargets + PinnedJoints + Contacts + Constraints
  → 三维视口兼容世界坐标桥接
  → 网站动作资产
```

识别运行参数：

```text
包：@mediapipe/tasks-vision@1.0.1
任务：PoseLandmarker
模型：pose_landmarker_full_float16_v1
运行模式：IMAGE
人物数量：1
首选执行器：GPU
回退执行器：CPU
```

模型运行库和模型资产在首次分析时按需下载。补丁中没有包含第三方模型二进制。

## 5. 姿势输出

每个图片姿势候选包含：

```text
根节点位移
根节点局部四元数
26 个稳定关节局部四元数
图片关键点生成的 IK 目标
脚底接触和固定点
固定骨长声明
刚性骨盆声明
人体活动范围设置
全身联动和阻尼
重力与地面设置
质量指标和警告
来源图片摘要
来源关键点和置信度
当前 rigVersion
```

当前中央 V8.4 视口仍通过旧版世界坐标载荷显示三维姿势。图片动作同时保存标准 PoseSnapshot，并用 `sourceLegacyUpdatedAt` 与兼容载荷保持一致。动作导出会同时包含两种表示，并将桥接模式标记为：

```text
canonical-plus-legacy-view-bridge
```

后续总控修改只读桥接文件后，可以让中央视口直接读取标准 PoseSnapshot，动作资产不需要重新制作。

## 6. 持久化规则

结构化动作资产保存于项目状态：

```text
state.modules.pose.imagePose
```

当前应用姿势保存于：

```text
state.character.pose.poseSnapshot
state.character.pose.v8Payload
state.character.pose.imagePoseAssetId
```

原图 Blob 保存于浏览器 IndexedDB：

```text
数据库：humanoid-rig-lab-next-image-poses
对象仓库：source-images
键：image pose asset id
```

普通项目 JSON 不包含图片二进制。即使源图在其他浏览器中缺失，动作资产中的 PoseObservation、PoseSnapshot 和兼容姿势仍可继续使用。当前动作库最多保留最近 24 个图片动作。

## 7. 新增文件

### `src/modules/pose/image-pose-estimator.js`

负责按需加载 MediaPipe Tasks Vision、GPU 与 CPU 回退、33 点结果标准化、置信度汇总和错误处理。提供纯函数 `normalizePoseLandmarkerResult()`，便于不依赖网络的确定性测试。

### `src/modules/pose/image-pose-retarget.js`

负责图片关键点标准化、左右镜像、深度处理、关节映射、固定骨长目标构建、PhysicsRig 求解、脚底接触推断、PoseSnapshot、IK 目标、兼容世界坐标姿势、二维预览和质量报告。

### `src/modules/pose/image-pose-store.js`

负责源图在 IndexedDB 中的保存、读取和删除。无 IndexedDB 环境使用内存回退，供测试和受限环境使用。

### `src/modules/pose/image-pose-controller.js`

负责图片动作面板、上传、识别、原图关键点叠加、修正选项、质量数据显示、应用、保存、动作库、源图恢复、JSON 导出和删除。

## 8. 修改文件

### `src/modules/pose/index.js`

接入图片动作面板。应用普通预设时清理旧图片姿势快照。脚部固定操作同时更新标准 PoseSnapshot 和当前三维视口兼容载荷。模块重置时清空图片动作库元数据。

### `src/modules/pose/pose-contract.js`

支持标准 PoseSnapshot 与旧三维世界坐标载荷并存。增加时间戳同步检查，避免旧四元数快照覆盖更新后的三维姿势。导出中包含两种表示、桥接状态和图片动作资产 ID。增加 PoseSnapshot 固定点同步。

### `legacy/v8/tests/physics-rig.mjs`

增加图片姿势结果标准化、单图重定向、镜像、二维深度回退、固定骨长、刚性骨盆、关节范围、四元数、动作资产、动作库、双格式桥接和存储回退测试。

### `control/active-tasks/pose.md`

记录图片复刻动作功能、测试、人工验收和后续增强。

### `control/module-status/pose.json`

动作模块升级为 `pose@0.4.0`，记录测试状态、兼容版本和阻塞事项。

## 9. 测试姿势

自动测试使用一组确定性的 33 点图片观测。源姿势包含：

```text
左手明显举起
左臂向外并向前
右脚迈出并抬起
左脚作为主要支撑脚
躯干和骨盆参与全身补偿
```

覆盖场景：

1. 正常左右方向重建。
2. 左右镜像重建。
3. 世界关键点可用。
4. 世界关键点缺失，回退到二维坐标加深度估计。
5. 单脚接触推断。
6. 不同比例目标人物重定向。
7. PoseSnapshot 应用到全新 PhysicsRig。
8. 动作资产保存和动作库恢复。
9. 源图存储的保存、读取和删除。
10. 标准四元数快照与旧三维视口桥接并行导出。

## 10. 测试结果

### 修改前基线

```text
npm test：通过
主平台验证：通过
模块补丁合并测试：通过
V8.4 全部测试：通过
```

### 修改后完整测试

```text
npm test：通过
JavaScript 语法检查：通过
JSON 解析检查：通过
模块可写范围审计：通过
越界修改：0
HTTP 静态文件检查：index.html 与 4 个图片姿势模块文件均返回 200
最终 pose-patch-v002.zip 解压到全新原始 0.5.0 工作包后再次运行 npm test：通过
补丁载荷逐文件 SHA256 对比：0 个不一致
```

### 图片姿势确定性测量

```text
目标 rigVersion：rig@0.4.0
旧三维兼容关节数：28
局部四元数关节数：26
图片 IK 目标数：15
最大骨长误差：0.000000000648 m
刚性骨盆误差：0.000000029315 m
最大关节范围越界：0.000000528°
普通方向支撑脚：leftFoot
镜像后支撑脚：rightFoot
普通方向举手侧：leftHand
镜像后举手侧：rightHand
```

二维加深度回退会添加：

```text
WORLD_LANDMARKS_UNAVAILABLE_USING_IMAGE_DEPTH
manualReviewRequired = true
```

## 11. 第三方与隐私

MediaPipe 主仓库采用 Apache License 2.0。当前补丁通过 CDN 按需加载运行库，并从 Google 的官方模型地址加载 Pose Landmarker 模型。补丁没有重新分发第三方二进制。

正式发布前需要由总控完成：

1. 在 `THIRD_PARTY_NOTICES.md` 登记 MediaPipe、使用版本和 Apache 2.0 许可。
2. 单独确认 Pose Landmarker 模型资产在目标发布方式下的使用和再分发条款。
3. 如果将运行库和模型改为同源离线资产，保存来源、版本、哈希和更新规则。
4. 在隐私界面说明图片输入在设备内处理。
5. 按供应商隐私说明披露 SDK 可能发送性能和使用指标，并根据适用规则建立用户同意机制。

## 12. 已知问题

1. 首次自动识别需要访问 jsDelivr 和 Google 模型存储。离线状态只能使用已经缓存的模型，或由总控配置同源本地资源。
2. 单张图片无法唯一确定全部关节的前后深度、躯干扭转和遮挡关节。当前提供整体深度翻转与强度调整，精细骨链修正仍需三维手动拖动。
3. 当前只分析一个人物，没有多人选择界面。
4. 当前没有二维关键点逐点拖动功能。
5. 手指、面部表情和精细脚趾方向没有进入本轮范围。
6. Pose Landmarker 的 `detect()` 当前在主线程执行。大图或低性能设备上可能出现短暂界面停顿，后续应迁移到 Worker。
7. 当前中央三维视口通过只读共享桥接的旧世界坐标载荷显示。标准 PoseSnapshot 已经保存，直接四元数驱动仍需总控修改 `legacy/v8/src/main.js` 和 `src/studio.js`。
8. 图片二进制只保存在当前浏览器 IndexedDB，动作 JSON 导出不包含源图。
9. 模块重置会清空动作库元数据，现阶段不会批量扫描并删除可能遗留的 IndexedDB 源图 Blob。
10. 自动化环境无法访问外部模型资源，因此本轮自动测试使用确定性的 33 点模型结果。需要在可联网的 Chrome 或 Safari 中完成一次真实图片端到端验收。
11. MediaPipe SDK 的性能与使用指标规则需要在正式产品隐私流程中处理。

## 13. 总控后续接线

建议按以下顺序继续：

1. 在联网浏览器中用 6 类真实图片完成端到端验收。
2. 将 Tasks Vision WASM 和 Pose Landmarker 模型纳入项目版本化资产策略，避免依赖 `latest`。
3. 更新第三方声明与隐私同意界面。
4. 将推理迁移到 Worker。
5. 增加二维关键点拖动和局部骨链深度翻转。
6. 修改只读桥接，使中央视口直接读取 `state.character.pose.poseSnapshot`。
7. 将图片动作资产登记到动画板块 MotionClip 或 PoseSnapshot 引用库。
8. 后续加入多角度融合、批量姿势和连续图片转动作。

## 14. 回滚

回滚到 `pose-patch-v001` 时：

1. 删除 4 个 `image-pose-*.js` 新文件。
2. 恢复 `src/modules/pose/index.js`。
3. 恢复 `src/modules/pose/pose-contract.js`。
4. 恢复 `legacy/v8/tests/physics-rig.mjs`。
5. 恢复动作任务和状态文件。
6. 浏览器中的旧图片动作 IndexedDB 可以保留，不会影响旧版本；需要彻底清理时删除数据库 `humanoid-rig-lab-next-image-poses`。
