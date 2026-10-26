# R29 保留的失败与未选候选

- `pre-morph-normal-baseline.gz`：尚未加入原头侧下颌形态场及当前标志点坐标架的法线函数。保留对应描述符与数值结果；没有通过原法线核对。
- `display-normals-incomplete-head-operator-rejected.json`：误将身体输出所需的裁剪颈口支撑用作完整头侧最终支撑，出现较大法线偏差，未选择。
- `native-subnormal-source-difference-discovered.json` 和后续绑定检查：原绑定矩阵重新求值导致接近零处的 Float32 坐标不同。没有放宽容差；当前候选改用原运算数及原绑定结果。
- `late-mouth-support-observation.json`：早期探针要求整个头侧坐标架不随身体动作变化，未成立；该探针观察的口唇增量实际为零。不能据此认定口唇固定偏移是法线差异原因。
- `head-morph-support-observation.json` 及编译工具：后续读取原宽域头形函数、原参考坐标与当前标志点坐标架，仅将影响身体法线的支撑编译为标量函数。原头部源文件未修改。

原几何、原点/面表、完整头侧观察、Git 重建目录保存在忽略的 `offline/`，不会被新页面读取或提交为运行表面。
