# 自然跑步 R7

2026-10-01。可交互入口 <http://127.0.0.1:8877/?version=R008-run-7>，WASD 移动、Shift 奔跑、空格跳跃。用户否定 R6 风格后，实际替换跑步上半身协调源码，仍为供用户判断动作感觉的候选版。

## 来源与研究范围

R6 使用运动学论文原则和本项目手写约束，没有使用 GTA 动作。其固定摆动平面、狭窄肘角和固定腕部参考使动作显得拘束。R7 在修改前重新查阅游戏动画开发者资料，并离线提取真实普通跑步数据。

- [Rockstar 官方 GTA V gameplay](https://www.youtube.com/watch?v=N-xHcvug3WI)：找到官方来源，但当前环境视频播放失败；没有把它当作已经观看的运动证据，也没有提取 GTA 动画或引擎代码。
- [Daniel Holden：Code vs Data Driven Displacement](https://theorangeduck.com/page/code-vs-data-driven-displacement)：实际读取作者文章，采用控制器负责世界位移、采集姿态负责视觉动作、姿态与控制速度同步、平滑过渡的原则。
- [Daniel Holden：Learned Motion Matching](https://theorangeduck.com/page/learned-motion-matching)：实际读取作者说明，关注紧凑表示与响应控制。当前只实现周期函数重定向，没有宣称实现动作匹配数据库或学习网络。
- [CMU 官方 subject 02](https://mocap.cs.cmu.edu/search.php?subjectnumber=2)：官方表格标注 `02_03` 为 `run/jog`。实际下载 [02.asf](https://mocap.cs.cmu.edu/subjects/02/02.asf) 与 [02_03.amc](https://mocap.cs.cmu.edu/subjects/02/02_03.amc)，173 帧、120 Hz，选取第 39 至 131 帧之间完整步态周期。AMC SHA256 `07df256876f0941ea464083162503790a05ffa021fd6d6d5b2c22ac98127762a`。
- [AMCParser 作者实现](https://github.com/CalciferZh/AMCParser/blob/master/amc_parser.py)：用于核对 ASF 轴校正与父子旋转约定；本项目离线编译器自行实现前向运动学和系数拟合。

## 实际实现

`tools/compile-natural-run.mjs` 将来源骨架姿态转换到角色 Y-up、+Z 前向坐标，提取上下臂方向、掌面法线、胸部旋转和小幅腕部变化。25 个通道各以常量及三阶正余弦项拟合，175 个系数共 2,315 字节，输出 `NaturalRunData.mjs`。周期函数在循环边界连续；手臂随现有跑步 clip 的同一时钟求值，以左腿前摆事件对齐相位，速度改变不会另起一个摆臂时钟。

`GameAnimator.mjs` 根据既有绑定参考将胸部与上下臂目标转换到当前父骨骼坐标，保留采集中的肘角变化、三维回摆、前臂旋转和左右差异。手掌长轴先对齐实际前臂，再叠加去除演员校准偏置的腕部小幅变化；四指沿既有掌面形成松弛弯曲。跑步权重随走跑混合与跳跃权重退出，落地恢复跑姿仍有角速度上限。

没有改动角色物理、腿部走跑曲线、跳跃方案和面部绑定。表皮参数包保持 15,424,996 字节，SHA256 `0f801bc60163a968aef8a647b2a9b472279236dc63d5b81d5c320654141333e2`。原始 ASF/AMC 只用于离线处理，留在忽略的 QA 目录，生产服务器不提供这些文件；运行没有加载来源模型或动作帧数组。

## 实际检查

最终生产代码以 4.2 m/s、120 Hz 连续采集 480 帧：左肘屈曲 85.90–116.96°、右肘 73.77–113.37°；上臂前后摆角左侧约 -57.64–4.51°、右侧 -54.23–15.02°。掌部长轴与前臂夹角最高约 3.14° / 4.30°。手部前后行程约 0.348 / 0.437 m，对侧腿摆角相关系数 0.952 / 0.915。最大单步关节旋转 0.0923 rad，所有骨骼矩阵有限。

走→跑、跑步转向、跑跳、落地继续跑、跑→走、停步、自动环顾均检查完成。最大切换步进约 0.1167 rad；待机脚底漂移小于 9e-8 m。真实后台键盘 W+Shift、A、Space 已触发奔跑、转向、起跳，页面脚本错误和来源模型/AMC/ASF 请求为零。本机 RTX 4070 Ti SUPER / D3D11 的稳定帧间隔中位数 16.7 ms、p95 16.8 ms、最大 16.8 ms，超过 50 ms 的间隔为零。

证据：`qa/running-arms-r7-final.json`、`qa/running-r7-browser-report.json`、`qa/running-r7-transition-report.json`、`qa/running-r7-current.png` 与侧面实拍。复现脚本 `qa/probe-running-arms.cjs`、`qa/verify-running-r7.cjs`。R6 对比报告中的腕角是相对旧参考四元数的偏移，R7 改为实际掌部与前臂夹角，两者不能直接比较。

源码装配与文件审查通过；12 项角色物理、13 项跳跃曲线检查通过。最终源码下三种跳跃的真实浏览器回归均通过，全部成功落到矮墙，页面错误与来源资产请求为零。报告 `qa/jump-v5-browser-report.json`，本轮源码哈希与证据清单保存在 `qa/running-r7-verified-source.json`。

这些检查验证协调、连续性和交互响应，不证明动作艺术风格已经被用户接受。当前上半身来自 CMU 普通跑步，腿部仍沿用现有角色曲线；后续如需要不同跑速或带装备跑步，应以对应完整采集重新校准。

## 真实三维工作台门禁

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [x] 用户看到的是可交互三维工作台；
- [x] 人物几何、骨骼和动作来自真实运行时；
- [x] 镜头、动作或参数控制可以实际操作；
- [ ] 公网固定链接和真实浏览器已验证（本机真实浏览器已验证，公网尚未发布）；
- [x] 如果只有截图而没有工作台，本轮判定失败（本轮交付真实工作台）。
