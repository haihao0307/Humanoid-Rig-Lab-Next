# Shoe Atelier learning ledger — 2026-10-10

This workbench is an authored static implementation, not a port of proprietary CAD kernels. Do not describe workflow learning as a complete replica or cinematic-quality certification.

## Teacher mapping

- INESCOP iCAD — https://icad.inescopsolutions.com/ — public 3D last / style / material / 2D workflow. We implement a separate foot profile, visual design envelope and component hierarchy. Industrial last flattening and grading are not implemented.
- Shoemaster Design — https://atom-shoemaster.com/en/p/shoe-design/ — virtual samples, 3D styles and material variants. We provide real 3D preset thumbnails, a turntable and material/light variants. No Shoemaster code or commercial assets are copied.
- Shoemaster Custom — https://atom-shoemaster.com/en/p/custom-production/custom-tailor-made-production/ — footscan / measurement / last comparison and adaptation. Our three bodies are synthetic mesh snapshots, not real scans or bespoke comfort certification.
- Romans CAD — https://www.romans-cad.com/en/3d-design-1 — component and material editing, virtual shoe display. We implement sole, upper, lining, hardware and seam groups with exploded display, not its CAD engine.
- 3DShoemaker — https://3dshoemaker.com/3dshoemaker-shoe-last-and-component-design-software/ — parametric lasts, footbeds and components; commercial Rhino Windows plugin. We implement an independent browser design envelope and local clearance controls. Rhino, the plugin and its purchasable models are not dependencies.
- Boppana and Anderson, Dynamic foot morphology explained through 4D scanning and shape modeling — https://arxiv.org/abs/2007.11077 — reinforces the distinction between a static digital foot and load/pose-dependent morphology. No statistical model is reproduced in R01.
- Symbiotic Shoes — https://class.textile-academy.org/2021/sara.alvarez/projects/symbiotic-shoes/04-how/ — digital last/parameter workflow. Page carries a noncommercial Creative Commons notice; no downloadable files are rebundled.
- IPC — https://ipc-sim.github.io/ — future nonlinear contact/elastodynamics teacher. No IPC implementation or dynamic physics is claimed now.

## Implemented distinction

`FootProfile` is measured from source geometry. `design-envelope.mjs` generates a smooth static shoe surface from foot samples and design allowances. `geometry.mjs` adds actual thick surface and component meshes. `materials.mjs` generates small periodic maps for surface presentation. The ankle shaft of a boot is treated separately from the low vamp; raising the entire vamp is not a valid way to build a boot.

The preserved human body is never rescaled to conceal shoe overlap. Native snapshot vertex buffers are hashed in browser regressions. Source axes, units, profiles, topology and hashes are in `assets/BODY-PROVENANCE.json`.

## Explicit remaining gaps

No GNM/MHR/current-character synchronization, pressure, load deformation, full triangle intersection certification, standardized sizing, high-heel foot pose, manufacture-ready last, industrial pattern flattening or material laboratory calibration. A positive analytical clearance at sampled vertices is not proof of collision freedom between complete meshes. Close-up suede sheen is an approximation, not strand-level fiber geometry. Visual acceptance remains per shoe and per view.
