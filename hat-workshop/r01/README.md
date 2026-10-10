# KAOPU Hat Atelier R01

真实帽子工作台：12个明确来源帽型；三维目录、单帽/原人物静态头形试戴、六组艺术配色、表面分层、三灯光、比例/佩戴变换、配方导入导出与浏览器本地保存。

原型来源：MakeHuman官方Hats01/03，各作者CC0或CC BY许可见SOURCES.json。几何/UV与原材料保留，显示细分和Three.js PBR为本版适配，不是原渲染器逐像素复刻；帽型不是我们从零函数生成。原人物来源为guilin-dem-pipeline固定02f596de的CommonPerson实际生成，静态头部样本/中性检验材料，不是36预设实时整合。

构建：`npm install --no-save three@0.179.1 esbuild@0.25.9`；`pip install numpy pillow playwright`；`playwright install --with-deps chromium`；依次运行capture.py、prepare.py、qa.py。公开验证：`python qa.py --url <固定HTTPS入口>`。核心资源封装在index.html，HTML可离线file://运行；公开镜像单独测试。

SOURCES.json绑定下载及原文件哈希；BUILD_MANIFEST.json绑定真实sourceSha和HTML哈希。QA记录来自实际浏览器，手机仅390×844视口，不是实机。SESSION_LOG.md记录本次用户输入、沟通摘要、执行和框架缺口。旧方法与所有原工作台不修改。

限制：无实测帽围、纸样生产、头发压缩、头皮/帽子碰撞、连续动态或舒适度认证；静态适配不能冒称物理。原贴图中的织纹与法线并非逐根毛线实体。原样本、拟合、来源光学、影视级和用户接受分别记录，首版等待视觉审核。

状态以DELIVERY.json和实际报告为准；文件未生成或公开测试未通过时为交付未完成。只有截图或仅源码，不算已交付工作台。

- [x] 未生成图片代替三维；已新增真实渲染和控制源码。
- [ ] 当前固定公网与file://验收：以本轮实际QA报告为准，不预填通过。
- [ ] 用户视觉接受、影视级、动态穿戴和手机实机：尚未通过。
