# 身体三维工作页 · R22

本机入口：[原数据与实际皮肤对照](http://127.0.0.1:8914/) · [完整参数与动作](http://127.0.0.1:8914/workbench)。可拖动旋转、滚轮缩放、Shift 拖动平移；对照页可双击身体查看局部。交付实际三维网页，本轮不制作截图画廊。

**整个重构仍未完成。** R22 补回原颈部 contour/fairing/harmonic 处理，修正之前只对照基础材质的问题，接入实际启用的身体皮肤、原版多级噪波字段、固定状态阴影和表面散射；另将参数工作页的 CPU 常驻/传输函数场从 352.9 MB 无损压至 185.2 MB。GPU 仍使用原 Float32 场和着色器，未降低精度。

来源对照页仍只有九个固定原版状态，保留来源分面分区信息，不是自主结构母体。参数工作页保留 1916 项目录、965 项身体控制、34 对左右联动、两套驱动和完整人物档案。原颈部流程在当前状态具备匹配的头侧边界输入时执行；任意连续状态的实际头部提供方尚未接通，缺失时明确显示未执行，禁止复用过期边界。两页表面都尚未完成一比一验收。详见 [本轮证据与未完成任务](docs/SOURCE-FIDELITY-R22.md)。

原始 R15 和独立头部项目均不修改。R21 文件继续保留回退；R18–R20 估算改形不混入本轮默认母体。

## 使用与构建

- `node tools/build.cjs`：使用仓库内的数据、源码重建 R22 两页及 BUILD 清单。
- `node tools/preview-body.cjs`：启动本机 8914 端口。R22 来源页必须连同 delivery/assets/body-skin-r22 内的系数文件通过 HTTP 打开；直接双击 HTML 不能保证浏览器允许读取这些文件。
- `node tools/check-release-r22.cjs`：核对全部构建、来源标记、函数包和皮肤/阴影系数字节。
- `node tools/qa-workbench-r22.cjs`：操作、两套驱动、真实存档/重复载入、头颈保留、边界提供方及失败回退。
- `node tools/qa-field-pages-r22.cjs`、`qa-field-pages-browser-r22.cjs`：逐位恢复及旧/新显示整帧一致性。
- `node tools/qa-source-profiles-r22.cjs`、`qa-source-precision-r22.cjs`：固定状态、交点/法线/肌理坐标、操作、存档和零人物三角面。
- `node tools/qa-active-optics-complete-r22.cjs`：实际原版启用的皮肤/阴影/散射同机位对照，保留整幅、内部、边缘、局部最大值；不据此自动宣布验收。
- `node tools/finalize-fidelity-r22.cjs`：只有当前构建的必要检查齐全时更新 DELIVERY 和任务记录。

来源检查另需本机 qa/fidelity-r21/offline、qa/fidelity-r22/offline 的冻结资料。它们含原模型，只用于隔离离线测量，不进入新运行时或 GitHub 交付。普通构建只需仓库文件和 Node.js。皮肤与阴影资产是原项目噪波及固定状态可见性的数值缓存，来源保留，不能当作自主肌理/动态阴影系统完成。

当前版本以 BUILD.json、BUILD-SOURCE-R22.json、BUILD-R22.json 和 DELIVERY.json 为准。GitHub 同步到 haihao0307/Humanoid-Rig-Lab-Next 的 body/reconstruction-r18-20261023 独立分支；这不等于部署了公网网站。
