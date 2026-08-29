# Humanoid Rig Lab Next AI Instructions

处理本仓库任何人体相关任务前，必须先读取根目录 `AGENTS.md`，以及：

```text
docs/HUMAN_SYSTEM_PROCEDURAL_ORIGINALITY_POLICY.md
docs/HUMAN_SYSTEM_PROCEDURAL_ORIGINALITY_POLICY.json
HUMANOID_RIG_LAB_NEXT_MASTER_CONTEXT.md
README.md
BUILD_MANIFEST.json
```

永久规则：

1. 禁止将第三方人体、骨骼、肌肉、软组织和皮肤模型搬入正式生产路线。
2. 允许引用来源明确的数据、测量、统计、解剖关系、公式和研究结论。
3. 新人体结构采用 `BodyDNA → SkeletalDNA → AnatomicalGraph → Procedural Generators → AnatomicalProfile → HumanRigCore`。
4. 固定模型和 GLB 只可作为历史对照、派生缓存、兼容和导出。
5. 人体结构必须支持参数化修改、局部重建、依赖失效、确定性哈希、版本比较和回滚。
6. HumanRigCore 与 finalPose 的权威边界保持不变。
7. 已下发任务和未提交工作树保持原命令与原保护规则。

若任务与这些规则冲突，停止执行并返回 `HUMAN_SYSTEM_POLICY_CONFLICT`。
