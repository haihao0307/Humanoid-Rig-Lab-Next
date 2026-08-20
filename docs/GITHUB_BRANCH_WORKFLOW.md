# GitHub 手动提交与四分支工作流

目标仓库：

```text
haihao0307/Humanoid-Rig-Lab-Next
```

## 一、首次上传

先把完整项目提交到 `main`。推荐使用 GitHub Desktop，也可以双击根目录的 `同步到GitHub.bat`。

首次提交成功后运行：

```text
PREPARE_BRANCHES.cmd
```

脚本会准备：

```text
integration
work/proportion
work/skin
work/pose
work/animation
```

## 二、分支职责

```text
main             已审查的稳定版本
integration      四个模块的集成候选
work/proportion  骨骼比例
work/skin        人物蒙皮
work/pose        动作与物理
work/animation   动画系统
```

## 三、手动更新一个模块

以蒙皮模块为例：

```text
1. 在 GitHub Desktop 切换到 work/skin
2. 覆盖蒙皮补丁中的文件
3. 查看差异
4. 运行 npm test
5. 提交并推送 work/skin
6. 在 GitHub 创建 Pull Request，目标分支选择 integration
7. 总控审查后合并
```

其他模块采用相同步骤。

## 四、网页如何看到更新

浏览器窗口不能直接修改 GitHub 源码。GitHub 上的代码变化经过 Actions 验证和 Pages 发布后，在线页面才会更新。

本地四窗口共享的是当前浏览器运行时项目状态。GitHub 保存的是代码、默认数据、测试和正式版本。

推荐循环：

```text
模块对话生成补丁
用户提交到模块分支
GitHub Actions 验证
Pull Request 合并到 integration
本地或集成构建审查
确认后合并到 main
GitHub Pages 发布稳定站点
```

## 五、在线站点的四个入口

发布后，同一个站点通过不同 URL 打开四个工作台：

```text
studio.html?module=proportion
studio.html?module=skin
studio.html?module=pose
studio.html?module=animation
```

这些页面使用同一个构建版本。它们可以共享同源浏览器状态。跨电脑同步需要导出项目 JSON，或后续接入云端项目服务。

## 六、注意事项

1. 不要在四个分支同时修改共享协议文件。
2. 每次提交前运行 `npm test`。
3. 模块补丁必须标记兼容的 rigVersion。
4. `integration` 通过综合预览后再进入 `main`。
5. 大型 GLB 资产增多后需要 Git LFS 或对象存储，当前示例资产可以继续随仓库保存。
