# Original Bird R0.16.3｜双源局部结构审查执行记录

日期：2026-09-21

## 已执行

- `BIRD-REF-005 / seagull2(2).glb` 保持当前高细主源；
- `BIRD-REF-004 / seagull(2).glb` 保持低模次级参考；
- 新增双源审查工作台 `original-bird-seagull-detail-audit-r0163.html`；
- 主源默认占大画面，次级只用于粗翼链、动作和差异对照；
- 两套源模型均读取节点、材质、纹理、动画、相机和八相位矩阵；
- 主源加入 slow pick 点选：眼睛、相邻头部、喙部；
- 眼睛与头部按 material 和 instanceID 对照，仅输出候选结论；
- 支持双源截图、固定视角、本机保存、JSON 与 `.kaopu` 导出；
- 新增合同 `LARID_C_DETAIL_AUDIT_R0163.json`；
- 状态已推进到 `R0.16.3-dual-source-detail-audit`；
- CI 已通过术语扫描、工具自检、双源身份门禁和 JavaScript 语法检查。

## 当前未完成

- 浏览器内实际眼睛与头部 slow pick 尚未记录；
- 眼睛是独立几何、贴图或混合结构仍为 `UNRESOLVED`；
- 主次两源八相位实际数据尚未写回仓库；
- 原始 GLB 二进制仍未通过 Git LFS 入库；
- `visualAcceptance=false`；
- `productionReady=false`。
