# HRLFullBilateralSurfaceV1 user visual review

Open `production-surface-review-standalone.html` by double-clicking it, or use `OPEN_REVIEW.cmd`. No server or network connection is required.

## Identity and loading

- Confirm the page identifies one complete bilateral project surface as web-native and editable.
- Confirm `reference-compare` labels Reference as comparison-only and not final runtime.
- Confirm `failed-mirror-compare` labels the rejected surface as historical diagnostic-only.
- Confirm there is no load-error panel.
- Keep `visualAcceptance=false`, `productionReady=false`, and `userVisualAcceptance=pending` until the review is complete.

## Full-body review

Inspect `production-full` in Front, Side, Back and Three-quarter views. Repeat the required views with `production-wireframe`. Confirm the head, hands and feet are not clipped.

## Responsive layout review

- Check 2560×1440, 1920×1080, 1600×900 and 1366×768 with the 300–340 px docked right panel.
- Check 1000×800 and 800×900 with the default-closed right overlay drawer; opening it must not compress the canvas.
- Check 600×900 with the default-closed bottom drawer; its parameter list must scroll internally without moving the page.
- Use `F` to fit the full body, `H` to toggle parameters, `R` to reset to Front, and `Esc` to leave fullscreen or close an overlay drawer.
- Check 专注查看, 全屏, 正面/侧面/背面/四分之三, and 实体/线框/实体+线框.
- Capture the ten filenames listed in `../../qa/task16a-r2b-production-surface-v1/responsive-ui-screenshot-manifest.json`; the repository intentionally contains no fabricated PNGs.

## Camera safety retest

The previous real Chrome `file://` camera-navigation result is failed. Run all checks below before changing that status:

1. In full-body mode, zoom to the nearest allowed distance and confirm the human remains present without near-plane holes.
2. Continue scrolling inward and confirm the camera cannot pass through the human surface.
3. Zoom to the farthest distance and confirm the human remains visible.
4. Continue scrolling outward and confirm the distance is limited and “已达到最远查看距离” appears.
5. Select `head-face` and confirm the face can be inspected clearly without entering the local safety sphere.
6. Select left and right shoulder/axilla regions and confirm each shoulder can be inspected clearly.
7. Click 返回全身 and confirm the complete human is framed again.
8. Repeat current-region fitting in a small window, maximized window, and fullscreen.
9. Shift-drag or right-drag repeatedly and confirm panning cannot leave the human permanently outside the view; test 最近相机状态 recovery.
10. Refresh the page and confirm the default complete-human view returns.

Keep `cameraNavigationVisualGate=failed`, `fullBodyReviewReliable=false`, `visualAcceptance=false`, `productionReady=false`, and `userVisualAcceptance=pending` until this real-browser retest passes.

Inspect `centerline` at the head, face, neck/chest, abdomen, pelvis/groin and back. Confirm the red/yellow diagnostic line is one continuous chain and the shaded surface has no visible seam.

## Reference comparison

Inspect `reference-compare` and `failed-mirror-compare`. Reference and the rejected surface are evidence-only; neither is the production source-of-truth asset.

## Local review

The standalone page accepts query parameters. Examples:

```text
production-surface-review-standalone.html?view=front&mode=centerline&closeup=head-face
production-surface-review-standalone.html?view=front&mode=production-wireframe&closeup=axilla
production-surface-review-standalone.html?view=side&mode=production-wireframe&closeup=knee
```

Available close-ups: `head-face`, `neck-shoulder`, `axilla`, `elbow`, `hand`, `chest-waist`, `pelvis-groin`, `knee`, `ankle-foot`.

Review head/face, neck/shoulder, front and back axilla, elbow, wrist/hand, chest/waist, pelvis/groin, knee and ankle/foot. Check that the surface reads as an adult human and that the semantic bands are useful for later skinning work.

## Editability review

- Move several continuous shape sliders and confirm the surface changes continuously.
- Enable Sculpt mode, click the surface, and confirm the brush-result count changes.
- Test 对称编辑 on and off. With it off, confirm the unselected opposite side does not move.
- Leave 中心线偏移实验 off for ordinary editing; centerline X should remain zero.
- Test Undo, Redo and Reset shape.
- Reload the page and confirm the neutral base is restored.

The current delivery intentionally contains no `.blend` authoring file and no production GLB. The `.hrlsurface` file is the editable `HRLFullBilateralSurfaceV1` source of truth.
