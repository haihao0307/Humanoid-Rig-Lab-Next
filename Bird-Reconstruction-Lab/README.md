# Bird Reconstruction Lab R57

本目录把人物重建中已经验证的顺序迁移到鸟类板块：锁定权威原件，审计拓扑与骨架，记录可编辑函数参数，保存局部残差闭合，最后由代码精确恢复参考几何。

当前权威原件采用 AVES CVPR 2021 通用鸟类表面，以及 3D Bird Reconstruction ECCV 2020 的鸟类骨架、蒙皮权重和关键点数据。工作流会下载固定 Git 对象，核验文件大小、Git blob SHA1 与 SHA256，再生成函数 DNA、严格运行时、误差报告和单文件工作台。

严格模式逐位恢复标准化 Float32 顶点与 Uint32 索引。可编辑模式使用纵向 PCA、Bernstein、Fourier 和残差闭合。当前尚未完成珠颈斑鸠物种配准，R56 保持不变。

`visualAcceptance=false`

`productionReady=false`
