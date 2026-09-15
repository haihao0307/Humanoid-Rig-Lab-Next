# Chicken V4.6 R9.1 当前交接

## 活动版本

`V4.6_R9.1_FINAL_SILHOUETTE_HEAD_TOP_CANDIDATE`

R9 冻结保留，R9.1 只修改可见头顶包络、单冠表面和头部材质分区。关闭 `headTopR91` 后，17 个网格的位置与索引哈希和冻结 R9 完全一致。

## 本轮采用的修改

1. 将额部至喙根附近的二次隆起改成单一、平滑的冠顶—额线—喙根坡度。
2. 把旧鸡冠改成一张连续的中线薄叶片，并在叶片上生成 5 个圆钝锯齿候选。
3. 让冠根轻微嵌入头顶，移除旧版明显的悬浮端盖关系。
4. 缩小头部大面积红色材质掩码，头顶恢复为羽被身份；鸡冠、肉髯、耳叶候选继续使用软组织分支。
5. 保留 R9 的主体、翼羽、尾部、腿足和身体羽被，不借本轮名义改动其他区域。

## 当前技术统计

- 网格：17
- 顶点：131,948
- 三角面：184,512
- 退化三角面：0
- 鸡冠：3,390 顶点 / 6,776 三角面
- 鸡冠截面：121
- 鸡冠锯齿候选：5
- 页面错误、控制台错误、请求失败：0
- 外部网络依赖：0
- 390×844 新窗口及触控按钮：通过
- 4 组头部/整体边界组合：通过
- R9 精确回退：通过

## 当前视觉判断

有效改善：

- 侧面头顶的第二隆起明显减少；
- 头顶到喙根的坡度更连续；
- 鸡冠从分离尖块转成连续中线叶片；
- 冠根和头顶的连接更自然；
- 头顶不再被整片红色软组织材质覆盖。

仍未通过：

- 鸡冠锯齿节律仍偏简化；
- 眼眶、上下眼睑和耳叶仍有程序贴片感；
- 颈部偏长、头部相对偏小，整只鸡的头颈—胸体关系尚未最终收敛；
- 翼覆羽、胸腹体羽和尾羽仍可看出规则排列；
- 腿足和爪仍未达到近景最终质量。

## 状态

```text
technicalGatePassed=true
headTopCandidateAdopted=true
singleCombCandidateAdopted=true
manualVisualAcceptance=false
wholeVisualGatePassed=false
canonicalChickenSurfaceComplete=false
rigAuthorized=false
motionImplemented=false
productionReady=false
publicHttpsPublished=false
```

## 关键入口

- 活动页面：`CHICKEN_V46_R9_1.html`
- 冻结 R9：`history/CHICKEN_V46_R9_FROZEN.html`
- 前后头顶对照：`evidence/CHICKEN_R9_R91_HEAD_TOP_COMPARISON.jpg`
- 六视图：`evidence/CHICKEN_R91_SIX_VIEW_REVIEW.jpg`
- 最终 QA：`qa/CHICKEN_R91_FINAL_QA.json`
- 参数记录：`data/CHICKEN_R91_HEAD_TOP_PARAMETERS.json`

## 下一阶段

`V4.6_R9.2_GLOBAL_HEAD_NECK_BODY_SILHOUETTE_GATE`

不再继续只修鸡冠。下一轮在冻结 R9.1 头顶成果的前提下，联合调整头部尺度、颈长/颈根、前胸和背线，使侧面、正面和顶部轮廓在同一身体参考架内收敛。外形未获人工确认前，Rig 与动作继续阻断。
