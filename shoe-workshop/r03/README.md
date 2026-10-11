# 鞋履研究台 R03-A：原裁片配缝校准

本轮接手 2026-10-11。用户网址锚点 a3970ea63c931ed8c7241ac9f121f096ab636564；读取当前鞋履分支 3a4db20b7df844120d85dc514ac615edad4679c3 后继承其交接文档。本轮不修改 R02 或人物、皮革、裁缝、帽子等其他工作台。

**这是 R03 的一个子步骤，不是 R03 上楦系统全部完成，更不是合格皮鞋或影视级成果。**

新增内核直接读取原九个 CAD 部件的真实边界，支持两片外轮廓的起止点选择、反转方向、沿毫米弧长布置同序定位点、长度与实际间距误差、来源/鞋楦失效检查、保存恢复及 JSON 导入导出。两个默认原片 P22/P23 仅按源文件顺序选取；几何直边候选绝不自动升级为真实工艺缝边。原有五个工位继续从 ../r02/src/main.mjs 继承。

黄色连接线只是同序定位点的检查连线，不是缝线、缝合动画或物理解算。长度相等也不证明两条边应当缝在一起。原片的全部顶点、三角索引、孔和厚度保持不变，仅为观察做刚性平移及坐标轴转换。未伪造鞋面—楦面对应，未以表面材质冒充结构完成。

参考核查与后续方向见 [docs/TAKEOVER.md](docs/TAKEOVER.md)。沿用 R02 的来源锁、vendor 和许可证说明；不新增外部模型或贴图。

## 构建与验证

在 shoe-workshop 安装锁定运行时 three@0.179.1、esbuild@0.25.10、playwright@1.56.0，Node 22。执行：

```
node shoe-workshop/r03/tests/kernel.mjs
node shoe-workshop/r03/tools/build.mjs
node shoe-workshop/r03/tests/browser.mjs
```

独立 workflow shoe-r03-calibration.yml 仅向本分支快进提交 r03 构建/证据，不合并、不强推。最终入口以 PUBLIC_URL.txt 为准；完整单体 public-lite.html 内嵌运行时和已有研究数据。file:// 与真实公网 HTMLPreview 分别测试；公网还比对固定提交的完整字节 SHA-256。

验收状态以 evidence/numerics/QA.json、evidence/browser/QA.json、evidence/public/QA.json 为准。手机只是 390×844 视口，不是实机。新版本通过功能检查不等于用户认可，也不等于完整制鞋验收。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际新增生产源码，继承原裁片而非另造几何。
- [ ] 用户看到的是经本次公网检查的可交互三维工作台：以新证据为准。
- [x] 三维几何来自真实运行时；本阶段没有人物或动画变更。
- [ ] 镜头、选择和参数控制可操作：以 browser/QA.json 为准。
- [ ] 公网固定链接和真实浏览器已验证：以 public/QA.json 为准。
- [x] 只有截图而没有工作台则本轮交付失败。
