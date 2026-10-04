# BodyParts3D source attribution and derivative notice

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

- Official dataset and downloads: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Official current license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Creative Commons Attribution 4.0 International: https://creativecommons.org/licenses/by/4.0/
- Official license page last updated: 2025-02-27; checked for this work: 2026-10-04

The original 4.0 OBJ archive headers mention the historical CC BY-SA 2.1 Japan
license. The official archive's current licensing page explicitly specifies
CC BY 4.0 International. This release attributes the data using that page's
required wording and preserves source/geometry hashes in `bone-fields.json`.

The fields are adapted material. Changes include selection and deduplication,
area-weighted PCA coordinate domains, cosine-polynomial fitting of offline
signed distance, amplitude quantization, and finite-resolution reconstruction.
No endorsement by the source authors or licensor is implied. The fields and
measurements are provided as an anatomical visualization reference, without
clinical validity or a guarantee of biological completeness or correctness.

Original source OBJ files and vertex/triangle arrays are not redistributed in
this repository. The generated parameter payload retains source identifiers and
provenance so that the transformation can be independently reproduced.
