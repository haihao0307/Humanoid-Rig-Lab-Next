# Hat Atelier R03 — measured category mothers

Accepted visual baseline: R02 build d56bc8498a152ff501ffaf80ec80a109b2ec4865. User requested fitting and procedural parameters after accepting the replication appearance as a usable starting point.

Production source: mother.mjs (control-net regeneration, actual triangle sections, category deformation), surface.mjs (optional procedural shader families), generated app.js and shell.html, upgrade.py, build.py. Original R01/R02 and original heads remain unchanged. Attribution is retained; this is source-control-net procedural generation, not independent pure analytic reconstruction.

Rebuild: run upgrade.py, record.py, build.py --assets, node verify.mjs; commit source/resources, then build.py --pages --data-sha FIXED_SHA --source-sha FIXED_SHA. Test qa.py locally and --url on the immutable public URL. Final public and file results must come from actual qa reports and DELIVERY.json, never prefilled text.

New controls: measured wear plane, hair allowance, clearance, knit rest negative ease, crown height/fullness, brim extent/curve, band fullness, crown back lean, three category presets, source/procedural wool/twill/knit surface, custom colour and texture scale. UI disables inapplicable controls.

Limits: selected engineering wear plane, no automatic anatomical landmark recognition; three static original head samples, no live 36-person integration; radial vertex clearance not full continuous collision/pressure; source textures and control nets remain attributed assets; shader relief not physical yarns; no physical-phone test claimed.

Evidence: qa/numeric, qa/local, qa/public, BUILD_MANIFEST.json, MOTHER_REPRESENTATION.json and DELIVERY.json. Missing/failed public receipt means delivery incomplete.

- [x] No generated images replace real 3D.
- [x] Production source implements measured fitting and regeneration.
- [ ] R03 user visual acceptance (awaiting actual review).
- [ ] Calibrated material and dynamic collision certification (not implemented).
