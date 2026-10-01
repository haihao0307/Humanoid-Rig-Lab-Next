# 第三人称角色控制记录

2026-10-01。当前入口 <http://127.0.0.1:8877/?version=R008-jumps-4>。用户认可 R008 表皮后，要求走跑转向、跳上台阶或矮墙、WASD/空格控制和第三人称固定摄像头。用户否定的四种跳跃已替换，最新来源、连续性与性能证据见 [跳跃替换记录](JUMP_REPLACEMENT_R3.md)。

## 来源与实现边界

研究参考 [Epic Game Animation Sample](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-animation-sample-project-in-unreal-engine)、[Pose Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine)、[Motion Warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/motion-warping-in-unreal-engine) 与 [Three.js AnimationAction](https://threejs.org/docs/pages/AnimationAction.html)。这些资料展示了移动状态、转向、腿部修正及障碍遍历与动画协同的方法。

本项目采用其中的分层原则：碰撞驱动世界位移，行走/奔跑曲线混合，关节叠加转向，跳跃姿态由实际腾空和接触状态决定。没有下载 Epic 的动作资产，也没有实现其 Motion Matching 数据库或完整攀爬系统。新跳跃是本项目的参数化动作层；原有四段动作仍可单独检查。曲面、权重、材质参数包完全保留，SHA256 为 `0f801bc60163a968aef8a647b2a9b472279236dc63d5b81d5c320654141333e2`，15,424,996 字节。

## 功能与参数

- `CharacterController.mjs`：120 Hz 固定子步、圆形水平碰撞足迹与立式高度范围、盒体侧面阻挡、顶部接触、20 cm 自动上阶、重力和落地检测。世界单位为米，角色碰撞半径 0.25 m，高度 1.8 m。
- 默认行走 1.65 m/s，Shift 奔跑 4.2 m/s；斜向输入归一化。转身走最短角度路径，行走最大 7 rad/s，奔跑最大 9 rad/s。急转先减速，再恢复速度。
- 空格的按下沿触发跳跃；300 ms 准备（R5 全身协调增强），重力 20 m/s²，物理最高点约 1.02 m，起跳速度 `sqrt(2*g*h)`。90 ms 边缘容错和 140 ms 提前输入缓存；长按不会落地后连续跳跃。准备期间离开台沿会立即执行已接受的起跳，空中水平加速率为 12/s，支持贴近台面时控制前进。
- `GameAnimator.mjs`：待机/行走/奔跑连续权重混合；头部和上身领先朝向，跑步转向加入受限侧倾。跳跃含准备、伸展起跳、空中平衡、接触准备和 360 ms 落地恢复；强度随实际接触速度变化。跳跃关节使用保持进入动作动量的临界阻尼，随后执行渐进腿部 IK。准备记录当前脚位置，落地短时保持世界接触点，并按速度释放到行走。
- `SubjectRuntime.mjs`：恢复原始逆绑定关系，生成临时待机曲线；消除原动作水平位移时转入角色父节点坐标系，避免世界转向造成错误抵消。单独检查动作时恢复动作权重与播放速度。原曲线骨盆位移实测行走 2.771055 m / 2.333333 s，奔跑 5.410191 m / 1.25 s，使用约 1.187595 / 4.328153 m/s 的原速度校准播放速度。
- `game-world.mjs` 的同一组尺寸参数驱动障碍渲染与碰撞，不使用外部场景模型。
- `app.mjs`：固定世界朝向的跟随镜头，不监听鼠标移动、不锁定指针；遇到遮挡时调整距离，紧贴高墙时升到人物上方，并检查插值后的镜头路径。DOM 键盘输入跳过文本、选择器、快捷键修饰键；失焦、隐藏、暂停及重置释放输入。

控制：WASD 移动，Shift 奔跑，空格跳跃，R 回到起点。页面按钮可暂停和重新进入控制。“骨架与表面检查”保留骨架、权重分区、三种密度和原动作检查。

当前 `JumpProfiles.mjs` 提供三种替换候选：A 实采前跳（CMU 16_05）、B 舒展前跳（CMU 16_07，默认）、C 实采跑跳（CMU 75_01）。`JumpMotionData.mjs` 保存拟合后的关节曲线系数，运行时按实际腾空与接触状态求值。选择对下一次跳跃生效，空中不会突然切换，落地后立即再次起跳也会采用新选择；物理高度、速度和碰撞参数一致。静止 2.8 秒后混入原有环顾，输入后快速退出并在下一次静止时重新计时。游戏步态先重置肩胸参考，再加入按行走权重淡入的力量姿态层；普通走跑足部仍使用继承曲线。

## 验证与限制

运行 `node New-Human-Production/R008/tools/test-game.mjs`，12 项检查包括走路阻挡、矮墙顶部落地、地面跳上 0.80 m 平台、从矮墙跑跳到平台、蓄力时离开边缘、高墙阻挡、四级台阶、斜向速度、急转、不同帧率、失焦与边缘跳跃。结果为 `qa/controller-report.json`。`node tools/build-pure.mjs` 和 `node tools/check-pure.mjs` 检查当前装配与参数完整性。

运行 `node New-Human-Production/R008/tools/game-preview.cjs`，在后台真实浏览器输入 WASD、Shift、空格，检查失焦释放、走跑转向、跳跃各阶段、矮墙和平台落地、台阶，检查原动作权重恢复、密度切换、材质恢复及镜头避障。报告为 `qa/game-browser-report.json`，实际截图为 `qa/game-current.png`、`qa/game-walk-turn.png`、`qa/game-run-turn.png`、`qa/game-jump-prepare.png`、`qa/game-jump-takeoff.png`、`qa/game-jump-flight.png`、`qa/game-jump-land.png`、`qa/game-wall-top.png`、`qa/game-platform-land.png`、`qa/game-stairs.png`。侧面跳跃图 `qa/game-flight-side.png` 使用后台 QA 镜头观察关节折叠，不改变玩家默认镜头。截图是运行证据，交付主体为可操作三维场景。

目前针对平地和参数盒体障碍；没有任意斜坡、手部撑墙翻越、动态刚体或专门的 mocap 急转片段。普通走跑保留原有足部曲线，急转不声称实现完整接触脚锁定。参数化动作仍供用户主观测试。

- [x] 已修改实际生产代码；
- [x] 三维人物、动画和碰撞在真实运行时执行；
- [x] 用户可以操作实际游戏场景；
- [x] WASD、Shift、空格、重置和暂停可操作；
- [x] 没有使用 AI 图片代替三维实现；
- [ ] 公网固定链接已验证（本次为本地场景，未发布公网）；
- [x] 实际截图仅作为证据，不替代交互结果。
