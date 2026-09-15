# V4.40 导入与后续修身

本模块于 2026-09-15 从用户提供的 `CAT_KAOPU_CURRENT_FULL_HANDOFF_V440_2026-09-15.zip` 导入，替代旧 V4.23 参考筛选阶段作为当前猫平台。

## 当前入口

- 工作台：`workbench/CAT_KAOPU_CURRENT.html`，下载后可直接打开。
- 运行数据：`runtime/cat_v440.bin`。
- 构建工具：`tools/build_cat_v440_eye_ear_short_fur.py`。
- 验证：在仓库根目录运行 `python cat-kaopu/tools/verify_cat_kaopu_module.py`。
- 原始全量包：`handoff/CAT_KAOPU_CURRENT_FULL_HANDOFF_V440_2026-09-15.zip`，含全部历史阶段包与交接文档。

## GitHub 网页端创建后续分支

1. 进入 `haihao0307/Humanoid-Rig-Lab-Next`。
2. 选择 `experiment/cat-authoritative-reference-intake-v1-20260911`。
3. 从该分支创建自己的修身工作分支。
4. 在新分支修改 `cat-kaopu/` 内的平台，保留来源、冻结基线及回归记录。

本次更新沿用已有猫分支。包内 `docs/GITHUB_IMPORT_AND_BRANCH.md`、`CURRENT.json` 等保留原始交接内容，其中推荐的新分支并未创建，原 `existingBranchHead` 是导入前的历史值。`CURRENT.json` 的 `currentEntry` 和 `repoOverlayEntry` 是原始全量包内路径；仓库中的有效入口以上述 `workbench/CAT_KAOPU_CURRENT.html` 为准。

`repo_overlay/cat-kaopu/` 的 44 个原始文件按字节保留。本次仅导入版本、更新入口说明并存档完整交接包，未实施后续建模路线。包内历史 QA 是随包资料，本次文件校验不代表新的视觉验收；`visualAcceptance=false`、`productionReady=false` 保持原状。
