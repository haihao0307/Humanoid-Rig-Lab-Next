# 无 Codex 额度期间的协作流程

## 1. 总体方式

1. 总控聊天维护整体架构、共享协议、集成和最终文件包。
2. 蒙皮、动作、动画和骨骼比例可以分别使用独立聊天窗口研究与制作模块补丁。
3. 每个执行窗口只处理自己的模块目录和数据包。
4. 每轮成果通过 `HumanoidRigModuleBundle` 或模块补丁 ZIP 交回总控窗口。
5. 总控窗口合并、运行测试、更新完整项目并生成下一版本 ZIP。
6. 用户本地启动网站，打开四个工作台和综合预览进行审查。
7. 用户通过截图、文字或 ReviewBundle 提交反馈。
8. 批准后使用 GitHub Desktop、本地 Git 或同步脚本写入母仓库。

## 2. 四个执行窗口的交付范围

```text
骨骼比例窗口
src/modules/proportion/
比例 JSON、RigDefinition、比例测试

人物蒙皮窗口
src/modules/skin/
legacy/v8/src/smpl-skin.js 的蒙皮相关改动
表皮资产、绑定数据、蒙皮测试

动作与物理窗口
src/modules/pose/
legacy/v8/src/physics-rig.js
legacy/v8/src/biomechanics.js
PoseSnapshot、约束和物理测试

动画窗口
src/modules/animation/
AnimationClip、关键帧、时间轴和动画测试
```

执行窗口不要修改 `src/state-schema.js`、`src/project-hub.js` 和 SharedWorker。需要改变共享协议时，先在交付说明中提出，由总控窗口统一处理。

## 3. 模块交付内容

每个执行窗口完成一轮后应提供：

```text
本轮完成内容
修改文件清单
新增或改变的数据字段
依赖的骨架版本
自动测试结果
实机观察结果
已知问题
集成说明
模块更新包
```

建议命名：

```text
proportion-patch-v001.zip
skin-patch-v001.zip
pose-patch-v001.zip
animation-patch-v001.zip
```

## 4. 本地四窗口审查

启动平台后点击“打开四个工作台”。四个窗口使用同一个浏览器配置和相同端口。右上角应显示 SharedWorker 或 BroadcastChannel 已连接。

V0.5.0 的模块级 Patch 可以合并不同板块的并行修改。完整项目导入和项目重置仍属于全局操作，执行前先导出项目 JSON 备份。

## 5. 每轮完整交付

总控窗口提供：

```text
完整项目 ZIP
CHANGELOG.md
VALIDATION.md
BUILD_MANIFEST.txt
SHA256 校验文件
```

用户解压到新文件夹后运行 `start.bat`，并在旧版本曾经打开过时按 `Ctrl + F5`。

## 6. GitHub 同步

批准版本后：

1. 使用 GitHub Desktop 打开解压后的项目文件夹，提交到 `haihao0307/Humanoid-Rig-Lab-Next`。
2. 或运行根目录 `同步到GitHub.bat`。
3. GitHub Actions 执行验证。
4. GitHub Pages 发布在线审查版本。
5. 总控聊天通过 GitHub 读取提交和测试状态。

Codex 恢复后，可以直接从四个独立模块目录和 moduleRevision 协议继续开发。
