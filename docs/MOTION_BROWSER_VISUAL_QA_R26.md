# 人物动作真实浏览器自动视觉验收 R26

日期：2026-09-15  
开发分支：`feature/human-motion-workbench-adjustment-v1`

## 目标

把动作验收从用户手工逐项录屏，改为可重复的真实浏览器质量门。该流程只生成验收证据，不改变动作、骨架、绑定、物理或人物外形。

## 强制边界

1. 测试固定提交对应的公网 HTTPS 预览，不把本地开发服务器当作验收结果。
2. 使用同一个有界面 Chrome 会话完成预检、动作执行、截图和视频录制。
3. 截图由 Selenium WebDriver 从真实浏览器画布取得；不使用静态合成、占位图、旧截图或呢���行截图替代。
4. 预检先验证安全上下文、身体握手、WebGL2、有效画布、首帧人体与浏览器严重错误。预检失败时停止，不生成截图、视频或公开验收页。
5. 所有结果保持：`visualAcceptance=false`、`productionReady=false`、`userVisualAcceptance=pending`。
6. 自动截图和数值检查用于筛选问题，不能替代最终用户视觉批准。

## 自动场景

- 皮肤、素模、骨骼的正面、侧面、背面基线；
- 直线行走并停止；
- 左转 90°、右转 180°；
- 坐下、稳定坐姿、起身；
- 挥手；
- 敬礼；
- 搬运 A 到一区；
- 推动 B 到二区；
- R25 支撑反馈开启/关闭的行走和转身 A/B。

每个场景保存动作中段、完成状态、肩部和足部真实截图裁切；主视角另保存连续视频。动作失败、拒绝或超时会保留为明确证据，不伪造完成。

## 交付物

工作流产出：

- `visual-review.html`
- `contact-sheet.png`
- `browser-run-report.json`
- `screenshot-manifest.json`
- `browser-console.json`
- `screenshots/`
- `videos/`

结果上传为 GitHub Actions artifact，并发布到独立分支 `visual-review/human-motion-workbench`。每个来源提交使用独立目录，旧版本不会被覆盖；最终链接使用发布提交哈希固定。

## 运行方式

自动触发条件是动作分支生成带 `[preview-build]` 的固定网页提交。也可以从 Actions 手动运行 `Motion real-browser visual QA`，并指定来源提交。

## 当前限制

- GitHub 托管运行器通常使用软件 WebGL，不能代替用户独立显卡、Mac、iPhone 或 Vision Pro 的性能结论。
- 图像自动检查不能可靠判断全部审美问题，肩腋折叠、动作气质和轻微节奏仍需人工查看验收页。
- 复杂搬运或推动受当前随机场景和物体能力影响；失败会进入报告，不会绕过任务系统。
