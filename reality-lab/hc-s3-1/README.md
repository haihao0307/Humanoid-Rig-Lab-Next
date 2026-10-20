# RF01 / REALITY-HC-S3.1-A · 牛仔原生只读导出与共同协议桥接

任务日期：2026-10-20。用户要求继续第1名世界规范，不启动已归档的RF02—RF07。源基线、允许路径、验收与排除项见TASK_ANCHOR.json。

## 本步要解决什么

S3的材料表主要来自固定证据，无法说明用户刚刚调整后的原台到底向GPU上传了什么。本步把牛仔作为第一个完整实例：实际原生工作台 → 显式只读接口 → 实际GPU输入与来源清单 → 未改变的S2.1共同对象协议 → 缺失/风险和复验导出。

这是S3.1的A段，不声称针织与皮革也已经实时接入。S3七类历史材料通过同一个桥接器进入共同协议，仍保留fixed_snapshot身份。它们没有被伪装成新的运行时观察。

## 源与集成形式

固定原生外观是R17.2：22cdb3f4c3bfd101bd86f0ffa246d255b561d915/denim-workshop/r17-scale/preview-v3.html，其公开装配器引用a5af1e0140c935703dec7c4d4da4f5549449b657的index.html。

构建先核对两份Git blob身份，在受限Node VM中重放原发布器的相同转换，得到原R17.2完整HTML。然后只在原有闭包增加native-exporter.js。移除唯一插入段必须逐字恢复原装配HTML。原顶点与片元shader、几何生成、控件、相机、灯光、运动原样保留。

接口为window.KAOPU_REALITY.read()/exportJSON()，只复制小型清单，返回深层冻结对象。不暴露set/write，不调用原版renderNow、setParam、gl.getError或矩阵更新，不转移原始缓冲所有权。原生控件仍由用户操作；平台等待原渲染稳定帧后再读取。

该接口仅安装在本次封装的原生候选副本，没有修改生产工作台或其分支。这是可移植的源端接口实现与集成验证，不是原生产网址已经自动安装，也不是跨设备服务。

## 真正读取与仍未知的量

读取gl.getUniform的uWeaveScale、uStitchPitch、uThreadWidth等实际上传值，与同一时刻的源状态对照。源状态尚未上传时拒绝为NATIVE_FRAME_PENDING，不把旧GPU值冒充当前值。

经纬节距由原shader中25.4/60、25.4/40毫米及当前GPU倍率计算。四纱周期注明是在固定V时的U方向；材料坐标是生成时local X/Y，在顶点运动之前，不自动等于变形后的世界长度。

实际针脚默认上传值与名义11针/30mm目标分别保留；没有制造公差时不擅自判产品不合格。线宽始终标成显示代理，厚度、几何纱径、Tex仍未知，不借R15物理候选把R17.2补成一个虚假的统一版本。

只读保护检查同一JavaScript任务中的原状态、CPU顶点/索引、VS/FS文本和列出的uniform。FNV诊断指纹用于同任务比较，源文件用SHA-256/Git blob另行核对；不冒称数学上的全程序无副作用证明。原画布还做读取前后实际像素对照。

## 共同协议，而不是第三套替代协议

bridge.js调用原reality-lab/hc-s2-1/protocol.js，固定其Git blob，不修改其源码；测量字典通过命名空间扩展，不把别名改名当作语义等价。

S3的kg/m2显式换算为共同协议支持的g/m2，并保留原值、原单位和换算。原工程估计保持原basis在context，不变成physical_measured。共同协议不支持的N/m、gauge、axis值保留在扩展并产生显式警告，不能静默删除。原S3对象和缺陷保留，便于回溯与无损复核。

新只读导出schema用于传输来源/读取保护/实际参数；进入平台后的对象依然是kaopu/reality-object@0.2及共同bundle@0.2。这不是把全系统schema随意改版。

## 用户可操作的内容

加载原生牛仔，读取当前清单，在原台调整织纹尺度或针脚节距，观察自动重读与相邻读数差异。七类历史材料可切换，标签明确区分历史、当前读取与导入报告。

支持导出原生清单、S2.1共同报告、复验包和缺失派单；导入文件必须匹配源版本、量纲和计算关系，失败时原子拒绝且不改当前有效对象。导入文件无论声称何种live状态，都只能成为imported_unverified；用户须重新读取才能获得当前实例证据。关闭原生后保存的读数也不继续冒称持续实时监控。

所有派单repairAuthorized=false。原生与规范核心封装在单HTML中，file://可运行；旧人物/鞋/裁片链接仅为外部导航，不是新页面运行依赖。不含私有key、解密运行包或用户照片。

## 验收

以实际生成的PROTOCOL_REPORT、ASSEMBLY_REPORT、BROWSER_REPORT和DELIVERY为准，不能因README存在就说完成。数值夹具标synthetic，与真实原生浏览器检查分开；file、本地与公网重复执行不累计宣传成不同功能。

检查：完整来源、插入段可逆、读取前后原画布像素不变、真实控件改变实际uniform、未知保留、错误单位/源commit/来源摘要/权限升级拒绝、导入降为未复验、共同报告回溯、资源关闭、390px视口、脚本错误及缺失请求。软件渲染不是消费级GPU性能或手机实机认证。

## 后续

S3.1-B先以同接口接针织，再皮革。源码核对发现针织原report包含gl.getError与间接缓存计算，皮革worldShellMeasurements会updateMatrixWorld；不能仅按函数名视为纯读取，应从明确read-set导出或单独证明副作用边界。此观察不等于它们的实时适配已经完成。

之后才接当前成衣宿主与人物比例/材料轴，仍不触及建筑、飞机等其他工作者。原物理、材料效果和S2裁片警告本轮不修。

## 参考与保护

[MDN structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)、[Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)、[postMessage来源与身份边界](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)。本次使用自包含同源srcdoc，不开放任意跨来源消息监听；以后跨源接入须另外验证origin/source/schema。

- [x] 没有生成图片、假画布或简化替身。
- [x] 已修改本次标准平台与只读接口源码；原生产运行源保护不改。
- [ ] 实际原生控件与画布已通过本任务浏览器验收（以报告为准）。
- [ ] 固定公网与file://已验收（以DELIVERY为准）。
- [ ] 用户视觉验收、实体设备、实物/制造与成衣试穿认证。

保持独立Draft，不合并、不强推、不覆盖旧固定版本。
