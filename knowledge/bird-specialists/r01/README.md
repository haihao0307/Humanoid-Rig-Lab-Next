# 鸟类专项数学方法库 R01

本库提供可逐个选用的专项方法，不是通用鸟体，不是新工作台，也不要求更换当前对象。当前任务只研究、整理、上传；等用户确认现有优化完成后，再由Codex针对当前对象的一个属性逐项接入。

## 交接入口

先读 [CODEX_HANDOFF.md](CODEX_HANDOFF.md)，再按问题查下表。每个方法卡写出来源、数学/工程适配、输入输出、可调属性、验收方法、适用范围和成本。高级论文方法只登记方法，不冒称已实现。

| 专项 | 方法编号 | 入口 |
|---|---|---|
| 鸟群、避碰、航迹 | FL01–FL05 | [鸟群专项](docs/01-flock.md) |
| 扑翼、耦合、头颈、起降、接触 | MO01–MO07 | [动作专项](docs/02-motion-contact.md) |
| 形态、翼轮廓、权重、蒙皮 | SH01–SH05、SK01–SK03 | [形态与蒙皮](docs/03-shape-skinning.md) |
| 羽毛、羽列、弹性、色素、虹彩 | FE01–FE04、MA01–MA03 | [羽毛与材质](docs/04-feathers-materials.md) |
| 升阻力、力矩优化、非定常、小翼羽、翼尾配平 | AE01–AE05 | [气动力专项](docs/05-aerodynamics.md) |

共有32张方法卡、26条经相应范围核查的来源记录、12个独立编写的数值原型函数。原型只验证基础数学；它们不是32个完整生产插件，也不是论文复现包。机器索引为 [modules.json](modules.json)；原始出处与核查层次为 [SOURCES.md](SOURCES.md)、[sources.json](sources.json)。

## 当前仓库存放关系

仓库：`haihao0307/Humanoid-Rig-Lab-Next`。资料分支：`research/bird-specialists-r01-20261003`。只添加`knowledge/bird-specialists/r01/`。

本轮分支从已读取的main提交`ff67491636ea53d6dea147c5b99a709aaa86fdd6`建立，纯作研究存档，**不是选择main人物代码作为鸟类生产母本**。当前目标名称仍是用户确认的`Palau-Bird-Workbench`；其Codex最新本地源码和准确远端分支尚未核实。旧Bird Mother、Original Bird、kaopu-bird-triad都不是本次目标替代品。资料归档不能被误写为“已接入Palau”。

## 检验

在本目录运行：

```sh
node --test tests/*.test.mjs
```

测试无需安装包、下载模型、联网或运行GPU。验收范围与结果见 [TEST_REPORT.json](TEST_REPORT.json)。没有跑真实鸟的浏览器、外观、运动或性能验收；现有工作台的运行代码、依赖、部署、默认参数都未接入这些原型。

## 使用边界

参考模型只属于制作/比对环境，是否删除及何时删除遵守当前项目验收；不能因为资料入库就删除老师。所有物种尺寸、关节范围、颜色与动作系数均须来自当前对象的证据，测试里的数值全部是合成数学夹具。

误用风险及前一轮说明的修订见 [SCOPE_AND_CORRECTIONS.md](SCOPE_AND_CORRECTIONS.md)。版权和第三方边界见 [NOTICE.md](NOTICE.md)。未核实的论文细节、没有跑通的依赖、尚未测过的参数保持待验证，不计为已完成。
