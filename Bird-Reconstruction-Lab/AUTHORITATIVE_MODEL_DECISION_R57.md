# Bird R57 权威模型决策

## 已锁定的物种原件

目标物种为珠颈斑鸠，接受名 `Spilopelia chinensis`，旧组合名 `Streptopelia chinensis`，GBIF usage key 为 `6101224`。

当前最直接的物种级三维原件来自 Occidental College 的 Moore Laboratory of Zoology。oBird 项目通过博物馆标本摄影测量制作真实颜色三维模型。已经定位到同物种、同名称并带有馆藏标本标识的模型：

* 模型名称：Spotted Dove - Spilopelia chinensis
* 标本：MLZ:Bird:65780
* Sketchfab UID：0014e26b6ddd4c1ab48116355ed46209
* 顶点：43,609
* 三角面：87,214
* 许可：Creative Commons Attribution 4.0
* 商业使用：许可允许，必须署名
* 下载状态：模型标记为 downloadable，下载接口要求经过身份验证

该模型作为珠颈斑鸠外表形态的第一物种原件。原件用途包括头喙轮廓、颈胸体积、折翼包络、尾部包络和羽色区域。它不会直接进入最终运行时。

## 三套权威来源的分工

### 1. MooreLab oBird

负责珠颈斑鸠物种形态。来源是明确馆藏标本的摄影测量模型，能够提供真实表面和羽毛形成的整体包络。

限制：馆藏标本姿态和活体自然姿态存在差异。模型表面包含羽毛体积，没有内部骨架。进入函数化重建前必须与活体多视图资料交叉校准。

### 2. AVES

负责通用鸟类标准拓扑和跨物种形态基底。固定原件为 `yufu-wang/aves` 的 `bird_meshes/template.ply`。该文件已经完成文件大小、Git blob SHA1 和 SHA256 核验。

AVES 用于建立稳定顶点对应、区域映射、低频形态基和误差计算。MooreLab 物种表面需要配准到该标准拓扑，避免把未经组织的扫描三角面直接固化为运行时结构。

### 3. 3D Bird Reconstruction

负责骨架、关节树、蒙皮权重和关键点映射。固定原件为 `marcbadger/avian-mesh` 的 `models/bird_eccv.json`。

它为动作和姿态提供结构基础。MooreLab 扫描只负责外表形态，不能自行决定骨架关系。

## 头骨补充来源

MorphoSource 已检索到三个同物种头骨微米级 CT 序列：

* media 000865537，South Australian Museum，标本 B47804
* media 000865532，South Australian Museum，标本 B48177
* media 000865409，Museums Victoria，标本 B30170

三组数据的体素间距均为 0.025 mm。它们的下载为 restricted，并采用 CC BY-NC 4.0。当前仅登记为非商业解剖验证来源，不能写入计划上架 App Store 的商业运行时。

## 固定重建顺序

1. 取得 MooreLab 原始 glTF 包并记录原始文件哈希、模型 UID、标本 GUID、许可和下载时间。
2. 原件只读保存，纹理、材质和几何分别登记。
3. 清理扫描支撑、底座和与鸟体无关的孤立几何，所有删除都保存索引与理由。
4. 建立 MooreLab 表面到 AVES 模板的非刚性对应。
5. 将头、喙、颈、胸腹、折翼、尾、腿和足分成独立误差区域。
6. 从配准结果提取低频函数参数，再保存局部高频残差。
7. 将 3D Bird Reconstruction 的骨架和蒙皮权重重定向到物种表面。
8. 使用活体多视图校正标本姿态、羽毛压缩和软组织形态。
9. 建立双向表面距离、轮廓误差、区域误差和严格位模式复刻检查。
10. 生成全代码和二进制参数运行时，网页不得加载 MooreLab、AVES 或其他外部网格。
11. R56 保持可回滚。R57 通过固定视角、动作姿态和手机窗口检查后才进入用户验收。

## 当前门禁

`exactSpeciesModelLocated=true`

`exactSpeciesArchiveAcquired=false`

`speciesRegistrationComplete=false`

`visualAcceptance=false`

`productionReady=false`
