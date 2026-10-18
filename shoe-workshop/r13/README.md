# 靠谱鞋履工作台 R13 · 形态与拼接

在 R12 的四种独立程序鞋型上，审核并修整缝线截面、鞋口、前片、弹力片、橡胶包边及材料外观坐标。保留便士乐福鞋、切尔西短靴、双搭扣皮鞋、帆布网球鞋和原 R10 鞋款入口。

**[打开固定 R13 工作台](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/c979ae664e53cdc2f09bd33511be5be61415efce/shoe-workshop/r13/public-lite.html)**

源码提交：`8b05ebd8b0755216743792034e3cbb58b8d9ff54`。固定公开构建：`c979ae664e53cdc2f09bd33511be5be61415efce`。同一 `public-lite.html` 也可下载后双击运行，核心 JavaScript、Three.js 与原 R10 数据均内嵌。公开地址、实际浏览器证据和最终状态分别见 `PUBLIC_URL.txt`、`RELEASE_RECEIPT.json`、`PUBLIC_VISUAL_REVIEW.json` 与 `TASK_ANCHOR.json`。

## 本轮变化

缝线以实际裁片为支承，分开计算针路、截面方向和入针深度；沿条逐针形成真实露出与埋入。乐福鞋使用连续 U 形前片和针路，鞍带按真实支承及厚度定位；低口鞋后口与包边共用边界。切尔西消除松紧片下方曲面折返，后拉环锚定后帮。帆布鞋鞋口修为连续切向过渡，橡胶包边改为完整周期厚壳。

开放裁片新增连续的外观坐标拟合，用实际三角形雅可比检测拉伸；针线、鞋带、松紧片、织带、内衬和橡胶按各自角色表达。材料调整不改变照明来掩盖几何。

界面新增「拼缝近看」视角，以及固定 R12 历史入口。原单鞋/双鞋/四款并看、剖切、爆炸、部件隔离、白模、线框、缝线开关、尺寸与几何弯折、配方保存恢复继续保留。

## 研究与验证记录

- `RESEARCH.md`：制帮、缝合及曲面参数化的一手研究与实现边界。
- `AUDIT.md`：原缺陷、实际测量、对应修正和一手研究依据。
- `tests/fixtures/r12-regression-before.json`：同一新回归对旧版本的真实失败。
- `tests/fixtures/r12-baseline.json`：27 个 R12 文件精确保留清单。
- `evidence/GEOMETRY.json`：独立数值验收，包含旧行为回归和本轮实际支承/闭合检查。
- `evidence/MATERIAL_COORDINATES.json`：66 个最终面片的独立材料坐标诊断，含位置不变核对、拉伸分位数与最坏三角形。
- `evidence/browser`：本次构建真实 Chromium 渲染与控制操作；每款七个视角。
- `evidence/before`：保持旧 R12 字节不变，以相同相机矩阵生成的后视和拼缝近景。
- `VISUAL_REVIEW.json`：独立 AI 对本轮实际证据的审核；不代表人工或用户批准。
- `PUBLIC_VISUAL_REVIEW.json`：公开工作台的独立复核，与已冻结的源码接受记录分别保存。
- `evidence/iterations`：保留未发布的后口缺口候选，以及一次原因尚未查明的历史材料统计对照异常；最终诊断通过不抹去原始失败。
- `BUILD_MANIFEST.json` / `PROMOTION_RECEIPT.json` / `RELEASE_RECEIPT.json`：源码、运行文件、流水线证据与固定公网地址的绑定。

最终源码 `8b05ebd8b0755216743792034e3cbb58b8d9ff54` 的[专用 CI](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/39098015887)已完成 157 项几何检查、100 组参数检查、66 个实际面片的材料坐标检查，以及 8 组真实浏览器功能检查。材料诊断按裁片身份冻结原统计，保存原值、最大差字段和运行时版本，核对 seed 构建及测量期间没有改写。该数值验收不代替独立视觉审核或公网验收，后两者分别记录。

源码候选与固定公开版本已分别获得独立 AI 接受。[公网验收](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/39100486059)再次通过 8 组操作，页面、控制台和请求失败均为 0；39 张公开截图与已接受候选逐字节相同。独立审核者另行请求了固定公开文件，其 13,746,414 字节及 SHA256 与 CI 构建完全一致。单文件 `file://` 核心运行请求为 0；公开镜像的页面加载使用 HTML Preview 和 GitHub raw。

## 本地复现

```sh
npm ci --ignore-scripts
npm run build
npm test
node tests/material-coordinates-audit.mjs evidence/MATERIAL_COORDINATES.json
npx playwright install --with-deps chromium
node tests/browser.mjs
```

依赖固定为 Three.js 0.170.0、esbuild 0.25.0 和 Playwright 1.56.1。构建将核心运行时代码及保留的 R10 数据一起打包为 `public-lite.html`；可选厂商参考图需要联网。实际发布只提升经过检查的同一构建产物，不在写权限任务中执行项目代码。

## 适用范围

这是可交互的真实程序三维构造与外观检查工具。鞋楦是设计截面，外观坐标不是生产纸样，弯折是几何检查。没有材料参数实测、实体打样、缝线强度、耐久、适脚或受力仿真验收。桌面 Chromium 的手机视口检查不等于真实手机测试。

R12、R10 原目录和网址保持冻结。本轮不修改人物或动物模块，不合并分支，不强推历史。

## AGENTS 要求对应清单

1. 新款为真实程序三维，没有用生成图片替代。
2. 实际修改生产源码，构建与源码散列对应。
3. 交付对象是可交互工作台；只有截图则不算交付。
4. 本轮为鞋几何；人体/动物骨骼和动作不适用。
5. 镜头、款式、部件、参数和配方通过真实控件验证。
6. 固定公网链接与真实浏览器需分别验收，见最终回执。
7. 独立验证和用户批准分开记录，不自行授予人工批准。
