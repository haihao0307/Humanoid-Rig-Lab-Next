# CAT BODY REFERENCE INTAKE V1

日期：2026-09-17

## 路线修正

R0–R3 证明了连续程序化身体生成链路能够运行，但也证明仅靠人工调整隐式场参数不能高效得到可信猫体。下一步停止继续凭感觉修改 SDF；先通过授权的兽医 CT、骨架和截面资料提取可审计的轴向、尺度、截面和关节关系，再重建程序化身体。

这不是把外部模型直接当作最终资产。原始参考只进入离线证据层，运行时继续只保存：

- 来源和许可证；
- 坐标与尺度确认；
- 包围盒、拓扑和截面数据；
- 人工确认的解剖锚点；
- 由这些证据生成的程序化配方和二进制。

## 已登记的主要三维参考

The University of Edinburgh Open.Ed / Royal (Dick) School of Veterinary Studies 发布的 **Domestic Cat (Felis catus)** 为兽医 CT 重建，页面标明 CC Attribution。它适合作为骨架比例、脊柱、肢体链和关节中心候选参考，不是外部皮肤真值。下载必须使用来源平台允许的授权账户流程，仓库不保存未经授权取得的文件。

来源清单与归属信息保存在：

`cat-kaopu/reference-intake/REFERENCE_SOURCES.json`

## 工具

`cat-kaopu/tools/extract_cat_reference_profile.py`

支持：

- OBJ；
- STL（二进制和 ASCII）；
- GLB 2.0 三角形网格。

输出：

- 文件哈希和来源元数据；
- 顶点、三角形、连通分量、边界边和非流形边；
- 包围盒和轴向候选；
- 纵向分段截面；
- 几何极值候选；
- 空的人工解剖锚点区；
- 禁止直接发布原始参考的决策边界。

示例：

```bash
python cat-kaopu/tools/extract_cat_reference_profile.py \
  /authorized/reference/cat.glb \
  cat-kaopu/reference-intake/profiles/edinburgh-cat.json \
  --source-metadata cat-kaopu/reference-intake/edinburgh-source-instance.json \
  --forward +x --left +y --up +z --scale 0.001
```

轴向和单位必须由固定视图确认。工具给出的最长轴、几何极值和自动截面只用于初筛，不得自动升级为解剖真值。

## 接下来的生产顺序

1. 通过授权渠道取得 CT 衍生参考。
2. 运行 intake 工具，保留哈希、许可证和来源。
3. 在正面、侧面、顶部视图中确认轴向和单位。
4. 人工标记颅面、颈根、肩胛、胸廓、骨盆、四肢关节、足掌和尾根锚点。
5. 从参考中提取纵向截面、骨段关系和区域尺度。
6. 用记录数据重新生成 `cat_body_bind_v1`，不把参考网格带入运行时。
7. 固定四视图通过后才冻结拓扑、建立绑定和权重。

## 当前边界

- R3 保留为失败的自由隐式场实验，不进入绑定。
- 不继续制作动作、导航、生活行为或猫群。
- 不使用第三方下载器或绕过来源平台授权。
- 不把骨架 CT 当作外部皮肤表面。
- 自动 QA 只证明数据和工具有效，不能批准形态。
