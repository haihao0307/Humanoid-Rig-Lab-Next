# R15 S2B — bounded completed-pose delivery

Start from the frozen R14 recorded in S2B_TASK_ANCHOR.json. The primary change is an explicit worker/client acknowledgement protocol, not a solver or appearance change. Only one autonomous snapshot may be in transit. Every physical step continues normally even when no new snapshot may be published; shell.x remains the latest computed state. After receiving a snapshot the client acknowledges its serial and the worker may publish the latest state, not a queue of historical poses.

Command replies (reset, explicit stepping, tests) are never coalesced. They invalidate prior autonomous credits. Duplicate/stale acknowledgements are ignored; a disposed product client applies no further pose. The stable app composition root and pointer cancellation stay unchanged. Native source and WASM remain R14 byte-identical.

Normal build: python leather-workshop/r15/build.py. Verification: python leather-workshop/r15/verify-s2b.py. One-time s2b-delivery/prepare.py is not called by the build and must not overwrite edited canonical sources. The accepted compiler and Python/Node requirements remain those recorded by R14.

Profile copies instrument only mutable app functions and worker envelopes. They are not shipped. CPU render submission is not GPU completion; message transfer and event-loop wait remain grouped. Existing software-rendering slowness may remain even when message traffic is bounded. Do not claim the full S2,50ms target, real-device performance, material calibration or legal clearance from this change.

- [x] Real runtime and physics; no generated images or substitutes.
- [x] Production worker/client source changed; original material and geometry retained.
- [ ] Standalone/public browser gates: authoritative only in fresh DELIVERY.json.
- [ ] User visual acceptance remains pending.
