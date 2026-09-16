# Source and license notices

## BodyParts3D derived parameters

The seven `reconstruction/*.chf.gz` files are derived from BodyParts3D 4.0 reference data. Changes include piecewise surface and boundary fitting, boundary simplification, height coefficient quantization, normal-field fitting and lossless coefficient packing. They contain function coefficients and relationships rather than original meshes or precomputed display vertices. The source represents one anatomical reference, not a population average or a certified posed body.

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- [Original database and downloads](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html)
- [Database license and required attribution](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Source hashes and transformations: `docs/reconstruction/SOURCE_LOCK.json`.
- Distributed parameter hashes: `reconstruction/parameters.json`.

These derived data retain CC BY 4.0 attribution requirements; the repository's MIT software license does not replace that data license.

The R2 scalp radius field (`reconstruction/hair-scalp-radius-r2.json`) and head-domain metadata (`reconstruction/hair-domains-r2.json`) are also derived from the fitted BodyParts3D head and retain that attribution. They store scalar function samples and chart relationships, not display meshes. `reconstruction/hair-rules-r2.mjs` and its JSON rule parameters preserve this project's original Visual R2 grooming implementation; their exact input hashes are recorded in `reconstruction/appearance.json`. The R2 eye frames and procedural pigments are adapted from the same project's `visual-materials-r2.mjs`. The earlier rendered body and hair buffers and screenshot images are not bundled.

## Triangulation

`reconstruction/vendor/earcut.js` identifies itself as a copy of Mapbox Earcut 3.0.1, distributed through Three.js. The [upstream ISC license](https://github.com/mapbox/earcut/blob/v3.0.1/LICENSE) is retained in `reconstruction/vendor/EARCUT-LICENSE.txt`; the accompanying Three.js MIT notice is retained in `reconstruction/vendor/THREE-LICENSE.txt`.

The R7 joint parameters in `reconstruction/rig-reference.json` are also derived from the same BodyParts3D data. Joint centres are static geometric estimates from bone end caps, sphere fits and adjacent bone relationships. They retain the database attribution above; original bone meshes are not distributed.

## CMU skeletal motion parameters

The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

`reconstruction/motion-reference.json` contains derived skeletal parameters from trials 08_01, 113_08 and 113_27. Changes include unit conversion, coordinate conversion, interval selection, direction extraction, full segment quaternion extraction and adaptive temporal sampling. Source file URLs, sizes and SHA-256 hashes are recorded in that JSON; `tools/derive-motion-reference.py` records the conversion. These data are retargeted to a different anatomical reference and do not contain measured dynamic skin surfaces.

See the [CMU database](https://mocap.cs.cmu.edu/) and [use conditions](https://mocap.cs.cmu.edu/faqs.php). CMU permits use including commercial projects, while excluding direct resale of the data themselves. Preserve the attribution; the software MIT license does not replace the data provider's terms. Original ASF/AMC downloads are not bundled.

## Other references

R15 procedural hair uses authored preset parameters and local extensions of the R2 scalp rules. Groom organization and rendering decisions were informed by the Blender, SideFX and Epic documentation and the original hair breakdowns by Alex Lashko and Jansen Turk linked in [HAIR_SYSTEM_R15.md](docs/HAIR_SYSTEM_R15.md). No artist meshes, image atlases, shaders or tutorial assets are bundled. The active rule module's current hash and its R2 predecessor hash are recorded separately in `reconstruction/appearance.json`.

The eight modules in `motion/vendor/` are byte-identical copies of this workspace's independently tuned `Human-Motion-Lab/core/` R2.2 modules. `motion/source-lock.json` records their hashes and the common source rig. The independent laboratory directory is unchanged. Its `walk-data.mjs` derives from CMU trial 08_01 and retains the CMU attribution above. The build linker only wraps those modules; workbench world, skin and task extensions live outside them.

`body/StandardsMotion.js` implements anatomical contact targets informed by [中国人民解放军队列条令（2025）, 第十七条](https://tyjr.sh.gov.cn/shtyjrswj/sjxx/20250303/47c374e6242e45ef86a585cd3e63792f.html). It does not bundle the regulation text or claim measured salute timing. `body/MotionLabActions.js` combines captured crouch parameters with authored bilateral contact IK for carry/push tasks; those extensions are not recordings of loaded movement.

Anatomy and physiology references remain linked in `body/HumanBiology.json`; independent strength and thermal coefficients remain authored estimates. The old analytic body, schematic organs and shape editors were removed in R7. Reference textbooks, images, SMPL assets, MediaPipe models and textures are not distributed.

The project applies general ideas from the KAOPU / TLO / Object DNA charters in `haihao0307/guilin-dem-pipeline`; exact source versions are recorded in `body/HumanDNAContract.json`. The adapter remains a candidate. No other Mother's production code is bundled.

Optional speech dependencies are installed separately from `server/voice-requirements.txt` and retain their respective licenses. Their code, weights and user recordings are not included.

## cannon-es 0.20.0

The offline rigid-body solver uses the unmodified dist/cannon-es.js source distributed by the official cannon-es npm package, under the MIT license. The complete license is retained at world/physics/vendor/LICENSE and included in the assembled runtime. Exact source SHA-256 and npm package SHA-512 integrity are recorded in world/physics/source-lock.json. The application bundles the JavaScript locally and makes no physics-engine CDN or WebAssembly request.

Upstream: https://github.com/pmndrs/cannon-es
Published source package: https://registry.npmjs.org/cannon-es/-/cannon-es-0.20.0.tgz
