# 参考继承与实际边界

2026-10-11。本轮来源优先是用户自己的R10固定提交，不用外部视觉替身。

## 直接复用

leather-workshop/r02/site/leather.js：R10原样继承的多尺度粒面、孔、色差、涂饰、法线、粗糙度、AO与mipmap。
leather-workshop/r05/site/appearance.js：R10粒面/肉面/切边分工。
leather-workshop/r06/site/catalogue.js：R10实际的13项配方目录，镜像重复时法线向量方向修正。
leather-workshop/r05/site/seam.mjs：R10真实使用的连续马鞍针路，两个工作端属于同一根线，不是分离圆柱。原文件只读，验证范围扩展与R10原builder一致。
R10的scanData：原来已嵌入的Poly Haven Brown Leather / Rob Tuytel / CC0数据，未请求新的扫描资产。
固定来源：https://github.com/haihao0307/Humanoid-Rig-Lab-Next/tree/af389cc216ddd01e3b1aa66c972f42b2587bc797/leather-workshop/r10

## 转化为适配知识

R10/r08/site/sewing.js采用局部路径弧长、针孔坐标与曲面映射，并使用0.215/0.52比例的扁蜡线截面。本轮据此将R05拓扑映射到鞋片两层实际针孔，不把R10抓取物理当作已移植。

Rhino OffsetSrf/Shell：https://docs.mcneel.com/rhino/8/help/en-us/commands/offsetsrf.htm
阅读法向厚度与对应边界封闭。官方也列出自由曲面偏移自交等失败情况。本轮变厚并不证明无自交。

Symbiotic Shoes：https://class.textile-academy.org/2021/sara.alvarez/projects/symbiotic-shoes/04-how/
原楦上画线—原平片—组装与绷楦—底部连接流程保留。其TPE热成形不能转成皮革物性。原CAD含四个孔，鞋带按这些孔定位；网页图片未复制进本台。

## 现实约束

外观配方不包含可直接通用的皮革实测本构参数；有针孔和厚度也不能证明可制造。曲面对应的局部伸缩、涂层在变形后的响应、整鞋接触、CPU/GPU与浏览器预算仍需独立验证。没有购买商业内核、没有新增收费服务，也没有把未取得的软件说成已复制。
