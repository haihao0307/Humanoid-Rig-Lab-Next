# CAT KAOPU V4.23 权威完整身体参考模型锁定报告

日期：2026-09-11

## 选择结果

主参考固定为 The University of Edinburgh Open.Ed 发布的 `Domestic Cat (Felis catus)`。模型来自 Royal (Dick) School of Veterinary Studies，来源页面声明原始 CT 信息由 Dr. Tobias Schwarz 提供，Brian Mather 负责整理。公开模型页记录约 1.1M 三角形、541.3K 顶点和 CC Attribution 许可。

## 选择原因

1. 具备兽医学院来源。
2. 由 CT 数据整理得到。
3. 模型身份、机构、贡献者和许可均可追溯。
4. 覆盖完整家猫骨架，可承担全身骨骼拓扑和比例锚点。
5. 分辨率显著高于常见游戏、机器人与通用装饰模型。

## 数据职责

该模型成为完整身体结构基础参考。V4.22 DigiMorph TMM M-628 继续承担高精度颅骨 CT 函数真值。

活体外轮廓、肌肉、筋膜、皮下组织、耳廓软组织、肉垫、胡须和被毛继续使用独立证据，不由骨架固定厚度外扩生成。

## 已完成工程动作

1. 写入权威模型锁定文件。
2. 写入原件、生成结果与正式运行时分离规则。
3. 建立官方模型并排查看工作台。
4. 建立本地原始包 SHA256 记录入口。
5. 建立安全原件接收与压缩包清单脚本。
6. 建立自动 QA 验证器。
7. 保持 `sourceGeometryIngested=false`，避免将网页查看器误报为原始几何已进入工程。

## 当前阻塞

Sketchfab 官方下载接口需要已登录账户。当前自动工具不会绕过认证。取得官方原始下载包后，运行：

```bash
python intake_reference.py <official-download.zip>
```

脚本会保存原件、计算 SHA256、检查压缩包路径、抽取许可候选和几何候选，并生成 `REFERENCE_SOURCE_RECEIPT.json`。

## 状态

```text
primaryReferenceSelected=true
viewerIntegrated=true
sourceGeometryIngested=false
oneToOneWholeBodyAccepted=false
visualAcceptance=false
productionReady=false
```
