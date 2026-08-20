# 四板块并行协作规则

## 一、当前可并行程度

V0.5.0 已经把四个板块拆成独立源码目录、独立状态切片和独立模块 revision。现在可以开始四个对话分别推进。

四个对话各自处理一个模块：

```text
骨骼比例  src/modules/proportion/
人物蒙皮  src/modules/skin/
动作物理  src/modules/pose/
动画系统  src/modules/animation/
```

共享底层仍由总控对话维护：

```text
src/state-schema.js
src/project-hub.js
src/studio.js
workers/project-hub.shared.js
legacy/v8/src/main.js
legacy/v8/src/three-view.js
```

执行对话需要改变共享底层时，只在交接文档中提出需求，由总控对话统一修改。

## 二、浏览器窗口与代码对话的区别

浏览器中的四个工作台用于实时审查和数据同步。它们通过 SharedWorker、BroadcastChannel 和本地存储共享同一个 ProjectState。

四个 ChatGPT 对话用于分别制作源代码。各对话没有共同文件系统，因此每个对话需要一份模块工作包。完成后输出模块补丁包，再由总控对话合并。

GitHub 保存经过审查的长期版本。网页运行时状态不会自动写入 GitHub。代码修改需要提交、构建和重新发布后，在线页面才会更新。

## 三、每个执行对话必须遵守的边界

### 骨骼比例

允许修改：

```text
src/modules/proportion/
legacy/v8/src/body-profile.js
legacy/v8/src/skeleton-presets.js
相关测试和比例数据
control/active-tasks/proportion.md
control/module-status/proportion.json
```

禁止直接修改蒙皮权重、动作姿势和动画轨道。

### 人物蒙皮

允许修改：

```text
src/modules/skin/
legacy/v8/src/smpl-skin.js
蒙皮资产、绑定数据和蒙皮测试
control/active-tasks/skin.md
control/module-status/skin.json
```

骨骼 ID、父子层级、绑定骨长保持只读。

### 动作与物理

允许修改：

```text
src/modules/pose/
legacy/v8/src/physics-rig.js
legacy/v8/src/biomechanics.js
姿势、IK、约束和物理测试
control/active-tasks/pose.md
control/module-status/pose.json
```

动作求解不得修改绑定骨长。

### 动画系统

允许修改：

```text
src/modules/animation/
动画片段、时间轴、关键帧和重定向测试
control/active-tasks/animation.md
control/module-status/animation.json
```

动画模块只读取稳定骨骼 ID 和动作快照。

## 四、模块工作包

每个模块工作包应包含：

```text
模块任务说明
当前项目数据协议
模块边界
本模块拥有的源码
本模块依赖的只读接口摘要
交接模板
当前状态 JSON
```

每个执行对话完成后交回：

```text
模块补丁 ZIP
HANDOFF.md
修改文件清单
新增数据字段
测试结果
截图或实机观察
已知问题
兼容骨架版本
```

## 五、合并顺序

建议按以下顺序集成：

```text
1. 骨骼比例发布 RigDefinition 草案
2. 蒙皮声明兼容的 rigVersion
3. 动作在相同 rigVersion 上验证
4. 动画引用稳定 PoseSnapshot 和骨骼 ID
5. 综合预览运行全套检查
```

模块之间可以同时开发。正式发布时必须通过兼容性检查。

## 六、冲突处理

每个模块拥有独立 moduleRevision。浏览器运行时的模块 Patch 会保留其他模块的变化。

代码层冲突由 Git 分支和 Pull Request 处理。执行对话不直接修改共享协议，可以显著减少合并冲突。

## 七、开始条件

四个对话现在可以开始。第一轮建议同时执行：

```text
比例：验证八项三维比例控件和绑定草案
蒙皮：设计预绑定 GLB 与原生 skinIndex/skinWeight 接入
动作：把姿势数据统一为局部四元数和 IK 目标
动画：建立关键帧、时间轴和 PoseSnapshot 引用协议
```
