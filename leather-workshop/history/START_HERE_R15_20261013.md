# 皮革工作台：从这里接续

更新2026-10-13。当前实现 `leather-workshop/r15/`，版本 **R15.0-S2B**。集成分支 `perf/leather-r10-input-20261011`。PR66已按用户授权合并，提交bf23b49bdffbe4f00187ac02da8824ec816b15cf；人物main和旧R01–R14未动。不要重新做S1、S2A或S2B。

## 当前网页

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/70883deb4659b601faacf5eb49277eee4774b824/leather-workshop/r15/public-lite.html

源码8c23de26525afff3ae2280463cd298a28fc07b6c，构建70883deb4659b601faacf5eb49277eee4774b824，正式回执09dcb3af3660629b00e367c06e3c8f46fc87bf98。HTML3,630,580字节，SHA2568d885617f72403d67adcd678a53425c3033a8f76abe8a1a06c86c3f45536597a。

## 恢复顺序

本文件 → TASK_STATE.json → ROADMAP.md → r15/README.md → r15/DELIVERY.json → r15/NEXT_TASK_S2C.md。Issue52为检索入口，以集成分支实际文件和回执为准；历史refactor/perf任务分支不作为接续状态中心。旧任务全文及状态逐字保存在history。

## 这一步完成什么

主线程忙时最多一个自主姿势包待接收；序号确认后发布最新真实计算状态，不积压旧姿势。Worker仍独立计算每个物理步骤，明确重置/手动步进等命令不合并，过期确认无效，销毁产品不能接收旧结果。只有成品Worker与客户端传输实现改变，C/WASM、材质、几何、厚度、输入和渲染器保持R14。

144源码门禁、45协议案例、18数值、25应用接口、25几何、六款52步差分通过。45离线和16固定公网浏览器检查通过，9组原始图片逐像素一致。明确的停收包压力测试为52步仍照算、52个自主包变为1个，不是52倍速度。

验证来源：38356482372的CPU/browser/profile成功，publish因测试case JSON忽略规则失败；38357446186核对相同源与产物后只恢复发布，并新做公网验收成功。没有改已验证运行代码、反复重跑求好数字或降低门槛。

## 下一项S2C

r15/NEXT_TASK_S2C.md。区分实际动画帧节奏、页面可见性、姿势应用、CPU绘制提交和合成/显示等待。已发姿势包的尾部等待减少，但软件Chrome的绘制间隔中位仍约1.03秒；不能称整体FPS或50ms输入目标已达成，不能凭CPU提交很快就断定GPU根因。计时诊断副本与未插桩发布检查继续分开。

## 保护与开发

已认可皮纹/磨损/厚度/受力、碰撞候选/CCD/摩擦、时间步及迭代预算不降低；六款产品、13外观、6类工艺保留，夹克不恢复，R11随机场不启用。R01–R14、固定链接、根LICENSE/署名、人物main及其他工作台保护。合格后只合入皮革集成分支，禁止强推。

构建 `python leather-workshop/r15/build.py`；复验 `python leather-workshop/r15/verify-s2b.py`。正常构建不运行旧迁移器；不要用materialize覆盖规范源码。开发工具锁定clang18/lld18等，用户打开HTML不需要编译器。

S1已完成，S2B已完成，完整S2仍未完成。用户视觉认可、全设备性能、实物标定和商业法律放行继续独立记录；390×844仅视口模拟。
