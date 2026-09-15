# CAT V4.23 START HERE

> 历史资料：2026-09-15 起，当前猫平台已升级为 [Cat Kaopu V4.40](../../cat-kaopu/workbench/CAT_KAOPU_CURRENT.html)。后续修身从 [cat-kaopu/](../../cat-kaopu/) 开始；以下为原 V4.23 参考筛选记录。

本目录锁定完整身体主参考：The University of Edinburgh Open.Ed 发布的 `Domestic Cat (Felis catus)` CT 衍生家猫骨架模型。

1. 打开 `CAT_KAOPU_V423_AUTHORITATIVE_REFERENCE_WORKBENCH.html` 检查官方模型。
2. 在官方 Sketchfab 页面使用已登录账户下载原始模型包。
3. 保持下载包未修改，运行：

```bash
python intake_reference.py <official-download.zip>
```

4. 运行验证：

```bash
python verify_reference_lock.py
```

5. 原件、许可、SHA256、坐标、单位和姿态全部锁定后，才进入分区函数记录与双向曲面距离审计。

当前状态：

```text
primaryReferenceSelected=true
sourceGeometryIngested=false
oneToOneWholeBodyAccepted=false
visualAcceptance=false
productionReady=false
```
