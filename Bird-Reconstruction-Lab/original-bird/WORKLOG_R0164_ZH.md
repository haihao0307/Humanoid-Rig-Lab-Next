# Original Bird R0.16.4｜海鸥形体—动作分工与飞行学习执行记录

日期：2026-09-21

## 固定分工

- `BIRD-REF-005 / seagull2(2).glb`：形体与细节主源；
- `BIRD-REF-004 / seagull(2).glb`：动画与飞行主参考；
- 两只都保留，不互相覆盖职责。

形体与细节主源负责：

- 身体轮廓和质量分布；
- 头、眼、喙与颈部过渡；
- 翼根、翼面、翼尖和尾部可见结构；
- 材质区域边界与可见形变上限。

动画与飞行主参考负责：

- 粗左右翼链；
- 归一化拍翼相位；
- 拍翼—滑翔过渡候选；
- 可读取的身体、颈头和尾部相位耦合。

## 已执行

- 新增 `LARID_DUAL_SOURCE_ROLE_AND_FLIGHT_LEARNING_R0164.json`；
- 新增 `BIRD_MOTION_REFERENCE_INTAKE_R0164.schema.json`；
- 新增统一工作台 `original-bird-seagull-flight-learning-r0164.html`；
- 两源读取节点、材质、纹理、动画、相机和八个归一化相位矩阵；
- 对动作源节点计算平移与方向变化幅度并排序；
- 加入动作源节点到规范角色的人工映射；
- 加入拍翼巡航、拍翼—滑翔、滑翔与上升气流、转弯、爬升下降、起飞、进近着陆和抗风保持八类状态；
- 加入后续 GLB、FBX、视频、图序列、论文与现场观察的统一登记模板；
- 新参考必须记录来源、许可边界、物种置信度、动作类型、时间点、镜头、可见部位和未知项；
- 新参考只成为可追踪学习候选，不静默替换当前形体或动作主源；
- 当前导出格式为 `kaopu/bird-flight-learning@1.0`；
- CI 已通过术语扫描、工具自检、源角色、身份哈希、动作状态、参考入库结构和 JavaScript 语法检查。

## 已纳入的飞行研究依据

- gull flapping / soaring / gliding strategy selection：`10.1242/jeb.02385`；
- gliding elbow morphing and static pitch stability：`10.1098/rsif.2018.0641`；
- shoulder / elbow / wrist morphing and dynamic stability：`10.1073/pnas.2204847119`；
- coordinated joint-driven wing morphing：`10.1098/rsif.2021.0132`；
- atmospheric lift and gull route / soaring choice：`10.1038/s41598-019-46017-3`；
- optic-flow contribution to altitude control over sea：`10.1038/s41598-019-52632-z`。

## 当前未完成

- 动作源八相位实际浏览器数据尚未写回仓库；
- 动作源翼、躯干、颈头和尾部规范角色尚未全部人工确认；
- 起飞与着陆仍缺可靠腿足参考；
- 转弯、爬升下降和抗风保持仍需更多用户参考与外部视频证据；
- 正式规范飞行动作库尚未生成；
- 独立 Original Bird 运行时动作尚未生成；
- `visualAcceptance=false`；
- `productionReady=false`。
