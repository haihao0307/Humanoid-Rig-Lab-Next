# HRLSurface V1 user visual review

Open `production-surface-review-standalone.html` by double-clicking it, or use `OPEN_REVIEW.cmd`. No server or network connection is required.

## Identity and loading

- Confirm the page identifies the project surface as web-native and editable.
- Confirm Reference mode is labelled reference-only and not final runtime.
- Confirm there is no load-error panel.
- Keep `visualAcceptance=false`, `productionReady=false`, and `userVisualAcceptance=pending` until the review is complete.

## Full-body review

Inspect Production in Front, Side, Back and Three-quarter views. Repeat with Solid, Wireframe, Solid + wire and Topology modes. Confirm the head, hands and feet are not clipped.

## Reference comparison

Inspect Compare and Overlay for all four views. Reference is only a proportion and silhouette reference; it is not the production source-of-truth asset.

## Local review

The standalone page accepts query parameters. Examples:

```text
production-surface-review-standalone.html?model=production&view=front&mode=solid&closeup=head-face
production-surface-review-standalone.html?model=production&view=front&mode=topology&closeup=axilla
production-surface-review-standalone.html?model=production&view=side&mode=topology&closeup=knee
```

Available close-ups: `head-face`, `neck-shoulder`, `axilla`, `elbow`, `hand`, `chest-waist`, `pelvis-groin`, `knee`, `ankle-foot`.

Review head/face, neck/shoulder, front and back axilla, elbow, wrist/hand, chest/waist, pelvis/groin, knee and ankle/foot. Check that the surface reads as an adult human and that the semantic bands are useful for later skinning work.

## Editability review

- Move several continuous shape sliders and confirm the surface changes continuously.
- Enable Sculpt mode, click the surface, and confirm the brush-result count changes.
- Test bilateral counterpart on and off.
- Test Undo, Redo and Reset shape.
- Reload the page and confirm the neutral base is restored.

The current delivery intentionally contains no `.blend` authoring file and no production GLB. The `.hrlsurface` file is the editable production source of truth.
