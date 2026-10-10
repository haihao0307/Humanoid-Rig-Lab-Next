# Source and generated-data notices

This directory adds authored adapters, recovery scripts and QA evidence. It does not replace upstream ownership or licences.

- Google GNM and XRBlocks head data/code: Apache-2.0; see the retained [GNM licence](../licenses/GNM-LICENSE.txt) and [XRBlocks licence](../licenses/XRBLOCKS-LICENSE.txt), and the pinned source references.
- NAVER Anny code: Apache-2.0. Its MakeHuman-derived model data is CC0-1.0; see the retained licences in the Anny/common workbench.
- Meta MHR code and v1.0.1 model assets: Apache-2.0; see [the retained model licence](../../kaopu-mhr-workbench/LICENSE-MHR.txt).
- MediaPipe provides the landmark proposal runtime. The exact model and WASM hashes are pinned and fetched from their existing public distribution; these dependency binaries are not rebundled here.
- Trimesh5.1.1 implements the cited Sumner/Popovic and Amberg correspondence algorithms. The offline dependencies are pinned in registration-requirements.txt and fetched through their official package registry.

The neutral-landmark fixtures were generated on2026-10-07 from these published neutral meshes with the authored diagnostic renderer. They contain observed native triangle IDs, barycentric coordinates and points, not private photographs. Detector proposals do not establish ground-truth semantic correspondence. Their generation commit, run and source artifact hash are recorded alongside the fixtures. All adapter modifications remain explicitly identified, with source engines and older released workbenches preserved.
