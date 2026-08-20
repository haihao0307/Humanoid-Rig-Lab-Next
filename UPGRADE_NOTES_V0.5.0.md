# Humanoid Rig Lab Next V0.5.0 升级说明

## 1. 本次处理的问题

V0.4.0 的比例工作台中央仍然显示轻量 2D 人偶。根因有两项：

1. 样式表中的 `.standard-stage { display: block; }` 会覆盖 HTML 的 `hidden` 状态，使 2D 后备层继续占据主视口。
2. 比例滑块只修改母平台的 `BodyProfile`，嵌入式 V8 视口没有读取这些数据，因此界面参数变化与真实三维骨架脱节。

V0.5.0 对这两条链路进行了重构。

## 2. 三维视口成为比例工作台主流程

页面启动时会明确执行：

```text
standardStage.hidden = true
legacyStage.hidden = false
```

样式表增加：

```css
.standard-stage[hidden],
.legacy-stage[hidden] {
  display: none !important;
}
```

这样可以确保 2D Canvas 不会因旧样式覆盖而继续出现。2D 预览只在三维运行库失败时由用户手动启用。

## 3. BodyProfile 三维重建器

新增：

```text
legacy/v8/src/body-profile.js
```

它从不可变参考骨架重新生成绑定数据，可以精确应用：

```text
height
shoulderWidth
hipWidth
upperArmLength
forearmLength
handControlLength
thighLength
lowerLegLength
```

每次重建都会重新创建 PhysicsRig，随后执行约束投影并向母平台返回实际三维测量值。

## 4. 实时通信

母平台新增：

```text
HRL_PREVIEW_BODY_PROFILE
```

V8.4 新增：

```text
HRL_PROFILE_STATUS
HRL_RENDERER_STATUS
```

拖动滑块时使用预览消息更新三维骨架。松开滑块后，正式 BodyProfile 通过 ModulePatch 写入共享项目状态。

## 5. 比例预设和规则开关

以下项目已经接入真实状态：

```text
SMPL 男性示例参考
高挑均衡成人
紧凑均衡成人
宽肩成人参考
自定义体型
锁定骨骼 ID
发布后锁定绑定姿势
左右镜像比例
恢复参考比例
生成新绑定草案
```

规则开关属于发布与兼容校验数据，部分开关不会产生立即可见的形体变化。

## 6. 比例与蒙皮兼容

参考比例对应当前示例表皮。任一比例参数发生变化后：

```text
requiresRebind = true
```

中央可以继续显示旧表皮作为位置对照，系统会明确标注它需要重新绑定。正式发布需要由蒙皮模块生成匹配新 RigDefinition 的 SkinBinding。

## 7. 锁骨和肩关节显示

左右 SMPL collar 节点保留为隐藏控制点：

```text
leftShoulder  左锁骨控制点  visualJoint=false
rightShoulder 右锁骨控制点  visualJoint=false
```

左右 `UpperArm` 节点作为真正可见肩关节。每侧只显示一个肩关节球。

## 8. 数据版本

```text
母平台版本          0.5.0
ProjectState schema  5
V8 编辑器版本        0.8.4
Rig export schema    6
Three.js             0.185.1
```

## 9. 安装

推荐解压到全新目录，然后双击：

```text
start.bat
```

从旧版升级后按一次：

```text
Ctrl + F5
```

V0.5.0 会迁移 `project-state:v4` 到 `project-state:v5`。

## 10. 验收步骤

1. 打开骨骼比例工作台。
2. 确认中央直接显示 3D 骨架。
3. 调整身高，确认骨架整体高度实时变化。
4. 调整肩宽、髋宽，确认左右关节中心距离变化。
5. 调整上臂、前臂、大腿和小腿，确认对应骨段变化。
6. 确认锁骨控制点没有额外关节球。
7. 确认右侧实际三维测量值与滑块目标一致。
8. 切换到“骨架和当前表皮参考”，确认自定义比例会提示需要重新绑定。
9. 打开第二个工作台，确认 ProjectState revision 和 BodyProfile 同步。

## 四对话并行开发

本版本完成四个模块的源码边界、状态切片和 GitHub 分支工作流。可以把比例、蒙皮、动作和动画分别交给四个 ChatGPT 对话。每个对话使用独立模块工作包，完成后交回补丁 ZIP 和 HANDOFF.md。

新增资料：

```text
docs/FOUR_MODULE_COLLABORATION.md
docs/CHAT_WINDOW_START_PROMPTS.md
docs/GITHUB_BRANCH_WORKFLOW.md
control/handoffs/HANDOFF_TEMPLATE.md
PREPARE_BRANCHES.cmd
```
