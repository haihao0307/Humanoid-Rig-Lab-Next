> 生成机制与来源参考。此文中的历史检查不代表当前纯函数版本的运行或视觉验收；当前状态见根目录 README.md。

# 肩带、锁骨与上臂结构框架 V1.16.0

日期：2026-09-06。用途：以后修改肩带、锁骨、三角肌包覆和上臂近端时的结构约束。手掌、手腕、前臂继续采用用户认可的 V1.12.1 局部基线。

## 1. 本轮查阅的外部结构与三维参考

1. OpenStax, *Anatomy and Physiology 2e*, 8.1 The Pectoral Girdle。锁骨位于肩前侧，内端接胸骨柄，外端接肩峰；肩胛骨位于肩后侧，关节盂与肱骨形成肩关节。
   https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle
2. OpenStax, 11.5 Muscles of the Pectoral Girdle and Upper Limbs。三角肌、胸大肌、斜方肌、前锯肌等共同形成肩带外观与稳定关系。
   https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs
3. NIH 3D, 3DPX-016667, *3D Models of Axillary Bones*。该条目由医学影像分割获得锁骨、肩胛骨、肱骨、肋骨、胸骨等三维模型，条目说明模型以 100% 尺度打印并经解剖学家和外科医生复核，用于正常解剖展示。本项目仅观察其三维空间关系和轮廓，不复制或导入网格。
   https://3d.nih.gov/entries/3DPX-016667
4. Holzbaur et al., *Musculoskeletal model of the upper limb based on the visible human male dataset*, Computer Methods in Biomechanics and Biomedical Engineering, 2001。论文以 Visible Human 高分辨率影像重建锁骨、肩胛骨、肱骨、尺桡骨、腕与手的三维表面，并建立上肢数学模型。
   https://pubmed.ncbi.nlm.nih.gov/11264863/
5. Lee et al., *Alterations of anatomic relationships on chest computed tomography as a function of arm position*, 2010。其 CT 数据显示手臂在身体两侧时锁骨相对正中矢状面的角度具有明确的三维方向，手臂抬高会改变锁骨方向。本文只用于确认肩带不能被当成固定的正面水平杆。
   https://pubmed.ncbi.nlm.nih.gov/20351522/
6. 肩胛平面研究记录正常肩的肩胛平面约向冠状面前方倾 30°。这用于检查肩关节三维方向，不作为本角色的直接数值复制。
   https://pubmed.ncbi.nlm.nih.gov/7288225/

## 2. 项目结构规则

1. 胸骨、锁骨、肩胛骨、肱骨头构成连续肩带关系。锁骨表面只保留浅脊，禁止出现独立圆管或胸前球状肩。
2. 肩胛骨位于胸廓后侧，肩关节中心需要落在躯干前后厚度的合理侧方位置。自然垂臂时，三角肌外形不得整体冲向胸前。
3. 肩部皮肤连接具有前、上、后、下不同方向。前侧接胸大肌与前三角肌，后侧接后三角肌和肩胛平面，下侧形成腋褶。不得用同一个对称圆柱截面处理。
4. A 姿态绑定到自然垂臂会产生明显肩部形变，因此上侧和前后侧皮肤在蒙皮上要比腋下更长时间跟随肩带，逐步转交上臂。
5. 已认可的手掌、手腕和前臂局部几何不得因肩部重构而重新生成不同形状。它们可以随着上肢整体重新定位。
6. 肱骨长度、前臂长度、关节父子关系继续保持；肩带静态绑定位置属于 Proportion/Binding 版本修改，不能偷偷塞进 Pose。

## 3. V1.16 绑定基线

旧 V1.15 / V1.13 肩带：

- `scOffsetM = [0.020, 0.014, 0.139]`
- `clavicleVectorM = [0.160, 0.005, -0.055]`
- `shoulderOffsetM = [0.008, -0.023, 0.006]`

V1.16：

- `scOffsetM = [0.020, 0.012, 0.134]`
- `clavicleVectorM = [0.160, 0.010, -0.067]`
- `shoulderOffsetM = [0.008, -0.022, -0.005]`

X 方向总肩宽保持不变；Y 方向只做低幅调整；Z 方向把 AC 与肱骨中心向后重新定位。肱骨、前臂、手部长度未改变。这些是本角色的工程基线，不是医学人口均值。

## 4. 表面规则

- 近端上臂截面采用前浅、后深的不对称包络。
- 三角肌在肩顶和后侧有有限体积，向肱骨中段逐渐收束。
- 锁骨脊线直接由当前 SC 与 AC 的绑定位置计算，避免骨头位置改变后皮肤脊线仍留在旧位置。
- 肩胸连接用连续曲线和宽权重过渡，禁止二值切换。
- 仅在肩带局部做有限平滑，不允许平滑到肘部以下。

## 5. 后续检查清单

每次肩带相关调整必须至少检查：正面、背面、严格侧面、斜前侧、自然垂臂、A 姿态、侧抬、前伸。重点观察：肩是否前冲、锁骨脊是否贴合胸廓、肩背是否形成球状凸起、腋下是否断层、上臂是否从肩峰附近自然垂下、肘以下局部形状是否保持。
