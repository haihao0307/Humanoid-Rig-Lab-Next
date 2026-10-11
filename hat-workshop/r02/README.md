# KAOPU Hat Atelier R02

接手固定R01，保留11款原帽型及原2K颜色/法线字节。运行`python hat-workshop/r02/upgrade.py`生成app.js与shell.html，`python hat-workshop/r02/build.py --assets`校验并派生无损资源；`--pages --data-sha <fixed SHA> --source-sha <source SHA>`生成轻量index.html和单文件standalone.html。

公开页面只在用户选择时加载对应帽型，试戴才加载静态头形。所有外部包地址为固定SHA并由浏览器校验SHA256。单体HTML包含相同资产，独立执行file://测试。三维目录缩略图由该运行时在构建阶段渲染，不使用生成图片或来源照片替代模型。

原R01位置数据、颜色贴图、法线贴图不改。针织帽的UV修正及空顶帽静态校准可关闭，也可按住对照。修正不是“影视级通过”或“物理通过”。本轮意见记录本地保存且可导出，不自动上传。

构建、QA、固定网页和SHA：见BUILD_MANIFEST.json、CORRECTION_REPORT.json、qa/local/report.json、qa/public/report.json与DELIVERY.json。不存在DELIVERY或publicVerified不是true时，公开交付未完成。

方法增补见 ../../docs/workbench-build-system/FEEDBACK_LOOP_HAT_R02.md（仓库根docs路径）；下一步仅依据用户对固定网页的实际反馈继续修，不预填认可，不合并或强推。
