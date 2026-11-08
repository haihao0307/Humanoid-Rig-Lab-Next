# 女士头部三维工作台 · 独立运行候选

此目录从头部研究工作台提取，包含当前页面、运行所需函数与材质、眼部数据和 GPU 数值缓存。其他研究工作台及历史实验保留在原项目中。头部采用原工作台的函数表面；此候选尚未通过全视角一比一验收。

## 获取与启动

需要 Node.js、Git 和 Git LFS。以下 Windows PowerShell 示例只检出本工作台，避免下载整个人物仓库的其他大文件：

```powershell
$env:GIT_LFS_SKIP_SMUDGE = '1'
git clone --depth=1 --filter=blob:none --sparse https://github.com/haihao0307/Humanoid-Rig-Lab-Next.git
Set-Location Humanoid-Rig-Lab-Next
git sparse-checkout set workbenches/female-head-resident-20261108
git lfs pull --include='workbenches/female-head-resident-20261108/**'
Remove-Item Env:GIT_LFS_SKIP_SMUDGE
Set-Location workbenches/female-head-resident-20261108
node server.cjs
```

浏览器打开 <http://127.0.0.1:18732/>。首次编译及准备时间较长，完成后拖动旋转、滚轮缩放。服务器仅监听本机。

需要支持 WebGL 2 和浮点颜色缓冲的浏览器。转动时默认384，停止后768，也可选择固定768。性能及首次加载时间依设备变化。材质由照片拟合参数与模型先验构成，不能称为本人实测组织参数；少量几何首交边界仍未通过验收。

源目录为 `Human-Function-Head-R04-20261023`。`QA.md` 是本次独立验证，`runtime-files.json` 是文件 SHA-256 清单，`docs/` 记录资源常驻和皮肤研究边界。
