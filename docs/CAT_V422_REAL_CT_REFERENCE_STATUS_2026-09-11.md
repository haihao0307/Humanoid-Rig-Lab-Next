# CAT V4.22 Real CT Reference Inversion

Date: 2026-09-11

## Branch boundary

This branch remains isolated from production runtime and from the currently accepted human body baselines. It inherits the verified human canonical-reference method from commit `78a0ad0f227a69e1eac5e6c1a186f8a5ec4511ee` and applies the same evidence discipline to the cat line.

## Authoritative source now ingested

The University of Texas at Austin DigiMorph `Felis sylvestris catus`, specimen `TMM M-628`, was downloaded by GitHub Actions run `34568159952` and stored as artifact `cat-digimorph-authoritative-reference-v1`.

The intake workflow keeps the original source ZIP unmodified, records SHA256, validates the ZIP, inventories every source member and writes a source receipt. The source asset remains an isolated measurement reference and is not a production runtime dependency.

## V4.22 local reconstruction chain

The downloaded artifact has now been processed through the following deterministic chain:

```text
source ZIP integrity lock
→ CT image stack detection
→ calibrated or explicitly partial-calibration volume manifest
→ intensity normalization and bone segmentation
→ CT-derived reference surface extraction
→ PCA canonical frame
→ longitudinal regional sections
→ adaptive Fourier function fitting
→ independent code-generated surface reconstruction
→ reference-to-replica and replica-to-reference distance audit
→ gzip level 9 byte-identical recovery check
```

The reconstruction represents the CT-derived cranial osseous envelope. Internal cavities, teeth, separated mandible surfaces and other multi-valued regions still require local charts or signed-distance residual fields.

## Acceptance state

```json
{
  "authoritativeSourceDownloaded": true,
  "sourceIntegrityLocked": true,
  "realCTProcessed": true,
  "functionRecordGenerated": true,
  "codeReplicaGenerated": true,
  "bidirectionalDistanceAuditGenerated": true,
  "losslessRoundTripRequired": true,
  "externalSoftTissueBodyAuthority": "pending",
  "oneToOneAccepted": false,
  "visualAcceptance": false,
  "behaviorAcceptance": false,
  "productionReady": false
}
```

## Next hard gate

The next retained task is a permissively licensed, officially downloadable full external-body reference for the neutral domestic cat. It must be source-locked and measured separately from the CT skull. The full cat replica may only claim one-to-one status after every anatomical region passes bidirectional surface-distance limits and joint-pose checks.
