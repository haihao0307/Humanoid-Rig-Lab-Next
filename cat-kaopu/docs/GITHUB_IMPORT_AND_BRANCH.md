# GitHub 导入与固定分支

## 远端现状

仓库：`haihao0307/Humanoid-Rig-Lab-Next`

现有猫分支：`experiment/cat-authoritative-reference-intake-v1-20260911`

包生成时已知 HEAD：`3ff695a980a346e1cecf6b96e6963d80328052bd`

该远端分支仍停留在旧参考筛选阶段，不能直接代表 V4.40。

## 推荐固定分支

`codex/cat-kaopu-v440-mainline-20260915`

## 推荐仓库目录

`cat-kaopu/`

把本包的 `repo_overlay/cat-kaopu/` 原样放到仓库根目录。第一次提交不要删除旧猫资料；先新增当前目录、核对工作台和哈希，再单独做清理提交。

## 第一次提交的通过门

1. `cat-kaopu/workbench/CAT_KAOPU_CURRENT.html` 可直接打开。
2. `cat-kaopu/runtime/cat_v440.bin` 与 HTML 内嵌载荷一致。
3. `python cat-kaopu/tools/verify_cat_kaopu_module.py` 通过。
4. `CURRENT.json` 中的当前版本仍是 V4.40。
5. 没有修改 V4.32 中性表面、V4.39 坐卧修形和 V4.36 运动回归。
6. V4.33 原入口不能成为默认入口。

## 后续工作规则

后续只在这个固定分支继续。每个新版本保留旧入口、更新 `CURRENT.json`、追加 QA 与回滚点，不覆盖上一确认版。
