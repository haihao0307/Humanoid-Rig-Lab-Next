# S2 timing-test recovery — 2026-10-13

Previous run 38342383451 passed CPU/native/trajectory/performance and 45 ordinary browser checks, but the separate timing test failed at startup. `LEATHER_ATELIER?.ready` throws ReferenceError before that global is declared. The corrected predicate reads `window.LEATHER_ATELIER?.ready` and waits for the real existing boot signal. No timeout or numerical/visual threshold was relaxed; no application source, shader, native code, collision, geometry, thickness, render loop or Worker scheduling was changed by this recovery.

Four executable Node VM assertions cover the original failure and absent/not-ready/ready states. Failures now retain partial timing evidence and traceback as pass=false. The old successful suites are evidence of the interrupted attempt only; delivery requires a fresh complete workflow, then the immutable public URL check. The regular production build never imports this one-time recovery script.
