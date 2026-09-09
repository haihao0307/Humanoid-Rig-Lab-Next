> 生成机制与来源参考。此文中的历史检查不代表当前纯函数版本的运行或视觉验收；当前状态见根目录 README.md。

# 腕背衔接与掌侧分区 R5 研究记录

日期：2026-09-06。代码基线：用户上传的 JARVIS_PROCEDURAL_HUMAN_V1.12.0.zip。
本轮以附件源码和当前用户反馈为执行依据，没有从远端仓库拉取或发布。

## 实际阅读的外部来源

1. Dartmouth, The Hand / chapter_11.html。
https://humananatomy.host.dartmouth.edu/BHA/public_html/part_2/chapter_11.html
读取范围：Hand、palmar aponeurosis、flexor tendons、muscles of hand、joints of wrist and hand。
支持：大鱼际与小鱼际区域，掌腱膜、屈肌腱与脂肪组织的层次，掌背皮肤区别，桡腕与腕中关节关系。近侧腕骨经桡腕关节联系桡骨和关节盘，尺骨与腕骨之间有该盘隔开。

2. Temple University Press / North Broad Press, Hands-on Anatomy, The Wrist and Hand。
https://temple.manifoldapp.org/read/hands-on-anatomy-c6538f97-bc62-44ae-96ff-0f1f97d6c977/section/fb71fe32-554a-413c-ab1d-0454b2fb90cb
读取范围：桡尺骨远端、腕骨及掌骨的触诊与表面标志。
支持：手背轮廓应与远端骨性标志、腕骨区和掌骨纵向走向对应，不能用横向一圈凸台表达所有结构。

3. Clavert et al., New findings on intermetacarpal fat pads: anatomy and imaging. Surgical and Radiologic Anatomy 28, 351–354 (2006).
https://pubmed.ncbi.nlm.nih.gov/16607465/
DOI: 10.1007/s00276-006-0106-z。
本轮读取公开摘要，未声称取得论文全文。解剖、组织学和影像观察识别了第2至第5掌骨头之间的脂肪垫。

美国手外科学会 ASSH 的 muscles、bones 页面检索摘要也被查询；直接页面解析内容不足，没有把这些网页登记成完整阅读或曲面尺寸依据。

## 资料支持与建模解释分开

用户描述的三个可见体积区，适合作为外表检查区域：拇指基底的大鱼际，小指侧的小鱼际，四指基底附近的远侧掌部软组织区域。第三个区域涉及筋膜、脂肪和肌腱周围组织，不能笼统登记成一块独立肌肉。研究中的掌骨间脂肪垫也不等同于整片可见皮肤表面。

本轮将第三个区域处理成轻微斜向的连续掌垫，保留浅掌窝；小鱼际稍收束到尺侧掌根；大鱼际沿用上一版已接受的斜向体积，不重新堆起鼓包。以上曲面外观为原创程序化近似。

骨性结构的查阅用来约束腕背的过渡方向。本轮继续沿用已有腕骨显示和关节层级，没有新增八块腕骨各自的关节面接触求解，也没有验证已有腕骨几何达到解剖教学级精度。

## 改动落点

body/HandForearm.js：handWristPalmSection 用统一的分段 Hermite 截面连接腕前后，保持接口数值和一阶斜率连续。去除旧版在细分之后对腕部重新投影的局部修形，它曾把前臂与掌背重新处理成不同截面。

handWristSkinWeight 在腕点前后共用单调蒙皮过渡，避免权重在接缝处回退。大鱼际的拇指权重从腕远侧渐进引入。

body/ConnectedSurface.js：增加腕点近侧约36毫米区域的采样密度；上臂、肩、躯干和腿部的生成规则保持原样。

小指新增 littleFingerLength 数值。默认1.08，三个指骨合计从65毫米变为70.2毫米。其余四指、拇指、掌骨长度不随这个独立参数变化。

## 人工设计参数，不作临床测量声明

默认腕宽58毫米、腕厚36毫米和掌厚30毫米沿用V1.12.0。小指增加8%属于针对本项目外观的设计修改；没有资料证明这是全人群统一标准。所有截面幅值、掌垫位置及编辑区间都属于程序化设计参数。

保留尺寸和姿态分离：尺寸应用创建新的绑定版本，重算固定骨长与逆绑定；姿态编辑只改局部旋转。没有外部手网格、纹理图或生成图片进入皮肤生成路径。
