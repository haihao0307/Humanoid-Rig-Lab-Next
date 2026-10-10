# KAOPU 鞋履研究台 R02-S1

R01.2 已被用户否决。新候选只位于本目录，不改旧入口或人物、皮革、服装工作台。

本轮是真实原工程的研究工位：楦上设计线、参数化鞋楦研究、原始平面裁片和继承的连续针路试片。**不是已完成的皮革成鞋，也不是商业CAD或Grasshopper全图1:1复刻。**

用用户给的 SymbioticShoes 实际3dm/GH，保留对象身份和毫米尺度。零偏移还原原缓存网格，六条源截线可独立研究；改楦使旧纸样失效。9个原始平面部件保留轮廓、孔和厚度；不造假缝合动画。原皮革台连续马鞍缝、原裁缝台规范编译器直接继承，源码摘要在 SOURCES_LOCK.json。

方法与观察员补充：[docs/OBSERVER_AND_METHOD.md](docs/OBSERVER_AND_METHOD.md)。来源／复现关系：[docs/RESEARCH.md](docs/RESEARCH.md)。当前权限和保护范围：TASK.json。

## 重建

Node22；three0.179.1、esbuild0.25.10、playwright1.56.0；Python3.13、rhino3dm8.17.0、numpy2.3.5、shapely2.1.2。依赖完整命令见独立 shoe-r02-build 工作流。

```
python tools/intake.py
SHOE_TEACHER=source/teacher python tools/export_teacher.py
node tests/numerics.mjs
node tools/build.mjs
node tests/browser.mjs
```

public-lite.html 是源码构建产物，内嵌三维数据和渲染器；不在运行时拉取模型或贴图。离线file://、公网固定链接分别测试。默认推荐桌面；手机只做390×844视口模拟，不冒充实机。

## 验收记录

以 evidence/numerics/QA.json、evidence/browser/QA.json、evidence/public/QA.json 和 RELEASE.json 为准。报告不存在或相应状态不通过时，该项未完成。所有内部检查都不代表用户视觉认可。

## 后续真实依赖

先完成一个原鞋面裁片—楦面对应、整段缝边／方向／缝份和二维展平误差的校准，再接贴楦与装配。样鞋可实际装配后才扩展款式。没有通过对应关系的原片禁止改名为“适配成品”。

## 固定公网候选

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/a3970ea63c931ed8c7241ac9f121f096ab636564/shoe-workshop/r02/public-lite.html

当前仅交付原工程复现与参数研究工位，不是已完成成鞋。详细校验及未完成项见 RELEASE.json。
