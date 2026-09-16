> 生成机制与来源参考。此文中的历史检查不代表当前纯函数版本的运行或视觉验收；当前状态见根目录 README.md。

# 躯干框架继承说明

本目录承接 V1.14.0 预览版。该版本的独立正式框架文档此前未交付。其完整来源与规则保存在 source/body.v1140.runtime.mjs 的 TORSO_KNOWLEDGE_CONTRACT，相关函数包括 torsoEnvelope、torsoSurfaceRelief、torsoVertexMask、refineTorsoSurfaceVertices、fitThoracicGeometryToEnvelope。

当前 V1.15.0 完整继承这些函数和默认参数。头颈改动在颈根的共享网格上允许连续过渡，不重新塑造胸廓。原预览的完整多姿态视觉验收仍未宣告完成，当前的头颈 QA 不替代躯干验收。
