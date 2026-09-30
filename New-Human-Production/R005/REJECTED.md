# R005 已否决

用户实测截图确认 R005 存在严重跨肢体拉伸、肩腋撕裂、前臂长带、手指错误、腿部断层和错误关节轴。

本分支只保留失败证据，不得继续扩展或合并。

失败原因：

- 自建简化骨架，没有继承原 R2 Human Core；
- 按高度带和质心猜测身体区域及关节；
- 四权重直接 LBS，没有原系统的八影响、表面邻接扩散和 DQS；
- 没有沿用原系统的骨盆中线、肩部过渡、手腕旋转和手指/脚趾绑定；
- 动作使用新写正弦曲线，没有复用原 MotionLab / NaturalLocomotion / TaskAgent。

替代执行线：

`work/human-character-surface-001-r006-inherit-original-core-20260930`
