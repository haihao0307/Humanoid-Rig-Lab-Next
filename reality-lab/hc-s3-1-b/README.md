# RF01 · S3.1-B 保留版毛衣原生读取

任务：2026-10-20继续第1名世界规范。不是RF02材质交换开发，也不是改变毛衣外观。此步以独立候选把KNIT-P02 C2接入现有共同协议，并保留S3.1-A牛仔实时入口。最终状态读取DELIVERY.json和实际报告；README不预先授予验收。

## 基线与已确认的问题

毛衣支线feature/knit-public-lookdev-p01-20261014在本轮读取时为d3e2c5d39a884bcc15b89232ec8e6a4ecb1e7ee9，保留KNIT-P02 C2。冻结HTML为guilin-dem-pipeline@6f1a7f1353d2b47822525769313d63cc51890a0c/kaopu-fabric-workbench/knit-public-p02/index.html，SHA256 aff46d61deae59656fd4605356bd04b62789db8c64c3cf88ffd729d16f201ee1，761310字节。

P03不作为父节点；S3中的R15只是不同来源的历史物理/外观记录，不自动等于被否决的P03，也不能拿来填P02的缺失参数。P02本身是独立公共外观样片，clothPhysics=false。此事实由当前源main.mjs/BUILD_MANIFEST核对，不来自框架猜测。

原KnitPublic.report调用renderer.getContext().getError()并访问其他报告。新只读接口不调用该报告，不调用getError、render、rebuild、updateMatrixWorld、set、dispose，也不转移原生缓冲所有权。

## 实际接口设计

精确原HTML保持不变，仅在已锁定字节与已核对闭包变量处追加一个可移除工厂调用。移除插入段须逐字还原保留版HTML。没有重新编译Three.js、重新实现毛衣、改EB1或换几何。

KAOPU_REALITY.read()读取现有载纱网格、实例数量与GPU短绒uniform；通过生成拓扑中两个相邻针目的截面中心差测局部X/Y列行间距。名义半径与一个实际截面采样直径分开，不把载纱直径当布料厚度。短绒端点偏移按同一原shader输入和第0实例读取，不称为纤维弧长或实物测量。

返回源commit/hash、捕获时间/帧/重建序号、原控制值、实际上传uniform、生成测量、未知物理量、只读保护范围及禁止修复字段。数据深层冻结。

短绒隐藏时GPU值可能是最近一次上传，不等于当前正在绘制；记录active=false，检查项NOT_APPLICABLE，仍可显示当前CPU控制值，不能把隐藏状态假报为当前贡献。

## 性能边界

常规读取只遍历小型元数据、若干几何采样点和材质状态，不扫描全几何；原控件事件合并后按需读取，不逐帧轮询。read({fullIntegrity:true})额外扫描完整载纱、短绒、贴伏纤维CPU几何数组，必须由用户手动触发并显示该次耗时。

完整CPU数组指纹不等于全GPU纹理、驱动状态或实物正确性。FNV只是同任务诊断指纹；源文件身份由SHA256独立锁定。GPU查询和字符串序列化仍有成本；不预先承诺硬件毫秒数或帧率提升。

## 共用与隔离

knit-bridge.js调用原S2.1 protocol.js，并复用S3.1-A的历史与牛仔桥接。P02对象ID独立为fabric-knit-public-p02-c2，原fabric-knit-r15不改。新定义为rf01.knit命名空间，不伪装成经纬织造密度或标准针织机号。

同一新入口只保留一个活动三维工作台。切换毛衣/牛仔或选择历史时关闭旧iframe，清除待执行读取；取消的旧结果不能覆盖新对象。历史、导入未复验、当前原生捕获与本地保留读数明确区分。

导入只允许本步支持的来源与字段语义，错单位、P03源、旧R15身份、猜测厚度、权限升级和公式不一致拒绝。校验通过也不是数字签名；外部文件永远是imported_unverified，需要实际再读才恢复当前证据。

## 验证任务

协议测试使用明确标为synthetic的夹具；真实浏览器则打开原生P02，核对几何、实际GPU输入、原控件长度/密度变化、原花型重建、隐藏显示、只读前后像素不变、深度校验、导入信任级别和牛仔回归。单文件测试还将候选画布与同viewport的原保留版画布比较，不能降低几何或灯光来满足一致性。

测试本地file和固定HTTPS，保留截图为内部QA而非用户三维替代品。软件Chromium/窄屏视口不能冒充消费级GPU、手机、Safari或Vision Pro实机认证。原生产源安装、实物材料标定、制造、成衣试穿均未在此步完成。

本会话容器raw网络DNS失败且其受管Chromium拒绝file导航；未绕过管理策略。源字节通过已授权GitHub Actions读取并下载其审计工件，实际file与公网验证在Actions独立浏览器进行，最终按报告如实交付。

## 参考

[MDN WebGL getError](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getError)；[Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer)。运行依赖继续是保留版中的Three.js 0.180.0，不因此升级生产引擎。原公开HTML保留其许可注释，不上传私有R15解密运行包或访问密钥。

## 保护与下一步

新代码仅reality-lab/hc-s3-1-b和专用workflow；原S1/S2/S2.1/S3/S3.1-A、毛衣生产支线、牛仔、纸样、人物与鞋的源文件不改。保持Draft，不合并、不强推、不改写历史。

本步完成后，下一有界任务是皮革只读导出。先核对其真正活跃源与测量getter副作用，区分相对厚度倍率、绝对数字壳厚与实物皮料厚度；复用共同协议，不另建静态规范替代页。成衣宿主与人物版本关系仍在之后。建筑、飞机、地形、动物、植被及完整世界不接入。

- [x] 真实源代码实现，无生成图片或假模型替代。
- [x] 保留既有P02 C2及牛仔运行程序，只增加观察接口。
- [ ] 原生控件/像素/协议/file/公网验收：以本任务报告为准。
- [ ] 用户接受、实体设备、实物材料、制造与成衣试穿认证。
