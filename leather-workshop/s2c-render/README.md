# R16 rendering batch — one integrated delivery

Base: R15 public70883deb4659b601faacf5eb49277eee4774b824, integration57865c3a033a7aee7f3dc02834ee7d896425a877. User requested larger integrated increments; this batch includes source diagnosis, shader addressing, scene/card invalidation, demand-driven display clock, lifecycle wakeup and sustained-operation verification. No separate tiny release is intended.

Fresh baseline38360802190: visible focused software Chrome; idle rAF median16.7ms; continuous static wallet GPU median413.38ms, frame median416.7ms, CPU submission0.7ms; grab GPU median498.13ms. Without draws rAF returned to16.7ms. This supports a rendering bottleneck in this software environment, not a universal real-GPU diagnosis or physical-screen latency measurement.

Changes: WebGL2 integer texel reads address the same three-column nearest-filtered node texture. IDs, frames, geometry and material arithmetic stay unchanged. Scene and thumbnail invalidation no longer redraw the hero for a card-only animation. A single demand-driven rAF stops when idle; completed true solver poses wake it. Visibility/page lifecycle restore marks the current view dirty, without resetting/pacing/skipping physics. The input cancellation rules and R15 bounded pose protocol remain intact.

Normal build uses only canonical R16 sources. prepare.py is a one-time registration tool and must not overwrite an existing source directory. No old edition is overwritten. C/WASM, geometry, texture maps, lighting, resolution, shadows, collision, friction, steps and iterations remain protected.

Gates: independent source/native builds; old18 numeric/25 geometry/6x52 trajectories/45 pose protocol/25 app semantics;22 frame/address checks; original45 offline and16 public browser checks; additional idle/card/200 view commands/24 product rebuilds/26 materials/12 craft changes/continuous pointer/lifecycle and three deformed pixel pairs; separate ABBA GPU probes. Production snapshots never include timing hooks. A simulated lifecycle event or390x844 viewport is not physical-device certification. Pure screen presentation remains unmeasured. Failed results retain their exact scope.

Sources: https://threejs.org/manual/pages/rendering-on-demand.html ; https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query ; WebGL2 integer texel addressing is verified against every generated node address and real render differences. Algorithms and permitted upstream implementations retain their original attribution. This is not legal clearance.

- [x] Actual source work, not generated images or stand-in meshes.
- [ ] Interactive standalone and fixed public browser validated: final DELIVERY.json controls promotion.
- [ ] User acceptance remains pending.

Merge only after successful gates into the existing leather integration branch, not repository main. Recovery: Issue52, TASK_STATE.json and r16/RENDER_BATCH_ANCHOR.json. Preserve R01–R15, jacket removal and disabled R11 random field.
