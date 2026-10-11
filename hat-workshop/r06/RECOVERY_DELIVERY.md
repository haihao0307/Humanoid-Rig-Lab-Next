# R06 断点恢复与实际交付

源代码已在 ea818497 恢复，但原工作流38126982263在浏览器检查失败，网页没有发布。诊断38128772930确认首例只有一个Float32坐标相差9.313225746154785e-10米。

本轮不修改帽子或人物几何、不舍入数据，保留输入头形和同浏览器A→B→C→A逐字节校验；跨JavaScript运行时的派生坐标改用明确2e-8米上限，检查数量、顺序、有限值，报告每项实际差异。比较器负例确认真实位移、错序、截断和NaN均拒绝。

实际交付、33组合及公网状态见DELIVERY.json和qa/public/report.json。旧R01–R04保持不变。未实现毛发压缩、连续戴入、压力舒适度或任意新头形认证。用户视觉认可仍待反馈。

固定网页：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/dfff12ca0a27198a1b001b1ef5cb31ce677e5f46/hat-workshop/r06/index.html
