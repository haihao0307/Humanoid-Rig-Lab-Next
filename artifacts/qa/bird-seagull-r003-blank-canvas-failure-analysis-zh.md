# Bird Seagull A R0.03 空白视窗故障结论

- 用户侧表现：页面外壳、按钮和说明可以显示，但三维视窗内没有鸟。
- 直接原因：R0.03 的五段 Base64 形态载荷实际拼接长度为 39,899 个字符，而旧清单写成 39,900；载荷缺失 1 个字符。
- 浏览器失败点：`window.atob()` 抛出 `InvalidCharacterError: The string to be decoded is not correctly encoded`，因此 gzip 解码、几何解析和 WebGL 绘制均未开始。
- 旧自动检查的第二个缺陷：命令使用 `node ... | tee ...` 且没有启用 `pipefail`，Node 进程失败可能被管道末端 `tee` 的成功退出码遮蔽。
- 结论：这不是用户操作、相机位置或模型颜色问题；R0.03 不应继续交付。
- 修复：从用户原始 `seagull (A).zip` 中的 GLB 重新生成确定性载荷，得到 39,876 字符的完整 Base64 数据，并在 R0.04 中增加长度、索引、gzip、WebGL 和可见像素检查。
