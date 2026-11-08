# 当前实测摘要

数据：final-verification.json。重复运行：node tools/verify-female-resident-final-20261107.cjs；同步记录：node tools/sync-female-resident-review-20261107.cjs。

- 指针输入目标：60 Hz。4.037秒、110个完成帧、27.247 FPS。
- 首次准备：71.630秒；其他会话存在约55–108秒波动。
- 转动384、静止768；预热输出384/768，源表1份。
- CPU相机查询0、准备后fetch0、源上传0；受监测的纹理/buffer/FBO/程序/存储分配与编译0。逐帧fence及计时query不在此资源计数内。
- 六视图全部等待新完成帧；正面同几何重绘不计为新角度速度。各图unknown数：0°/zoom1: 0, 45°/zoom1: 1, -45°/zoom1: 0, 90°/zoom1: 0, 180°/zoom1: 0, 45°/zoom3: 0；未宣布首交一比一验收。
- 真实指针最后一次请求已显示；准备期间最后操作另见../female-continuation-ab-20261107/comparison.json。

当前路径没有CPU逐角度整帧重建，没有人物三角网格显示。性能、眼内模型、边界精度与真人材质验收分别保留限制。
