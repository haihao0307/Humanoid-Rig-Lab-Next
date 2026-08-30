# HRL Bone Binary Geometry V1

`HRL Bone Binary Geometry V1` is the project-owned compiled geometry cache for the anatomical skeleton pipeline. JSON remains authoritative for SkeletalDNA, AnatomicalGraph, AnatomicalProfile, semantic IDs, parameters, sources, and revisions. A `.hrlbone` file contains only deterministic numeric geometry compiled from those records.

## Identity and coordinate system

| Field | Value |
| --- | --- |
| Extension | `.hrlbone` |
| Magic | ASCII `HRLBONE1` (8 bytes) |
| Version | major `1`, minor `0` |
| Byte order | little-endian |
| Coordinates | right-handed, `+Y` up, `+Z` character forward, `+X` character right |
| Unit | meter |
| Index type | unsigned 32-bit integer |
| Position/normal type | IEEE-754 32-bit float |

The format does not contain JSON text, base64, compression, a third-party model, skin weights, inverse bind matrices, node scale, or animation data.

## Fixed header

The fixed header is 128 bytes. All offsets are absolute byte offsets from the beginning of the file.

| Offset | Type | Meaning |
| ---: | --- | --- |
| 0 | `char[8]` | `HRLBONE1` |
| 8 | `uint16` | major version (`1`) |
| 10 | `uint16` | minor version (`0`) |
| 12 | `uint32` | flags; V1 writes `0` |
| 16 | `uint32` | first payload byte (`headerByteLength`) |
| 20 | `uint32` | chunk count |
| 24 | `uint32` | primitive group count |
| 28 | `uint32` | vertex count |
| 32 | `uint32` | index count |
| 36 | `uint32` | joint marker count |
| 40 | `uint32` | landmark count |
| 44 | `uint32` | reserved, zero |
| 48 | `float32[3]` | AABB minimum |
| 60 | `float32[3]` | AABB maximum |
| 72 | `uint8[32]` | SHA256 of bytes `[128, fileByteLength)` |
| 104 | `uint32` | chunk table offset (`128`) |
| 108 | `uint32` | chunk record byte length (`24`) |
| 112 | `uint32` | total file byte length |
| 116 | `uint32` | coordinate-system code (`0x595A5801`) |
| 120 | `uint32[2]` | reserved, zero |

The checksum covers both the chunk table and all numeric payloads. The separate manifest records the SHA256 of the complete file.

## Chunk table

Each 24-byte chunk record is:

| Offset in record | Type | Meaning |
| ---: | --- | --- |
| 0 | `uint32` | chunk type |
| 4 | `uint32` | component type (`1 = float32`, `2 = uint32`, `3 = mixed record`) |
| 8 | `uint32` | logical element count |
| 12 | `uint32` | absolute byte offset |
| 16 | `uint32` | byte length |
| 20 | `uint32` | element stride in bytes |

V1 chunk types are:

| ID | Chunk | Record layout |
| ---: | --- | --- |
| 1 | primitive groups | eight `uint32`: primitive, index offset, index count, semantic group ID, encoded LOD, side code, group ordinal, reserved |
| 2 | positions | tightly packed `float32 xyz` |
| 3 | normals | tightly packed `float32 xyz` |
| 4 | indices | tightly packed `uint32` |
| 5 | vertex semantic group IDs | one `uint32` per vertex |
| 6 | joint markers | `uint32 semanticGroupId` followed by `float32 xyz` |
| 7 | landmarks | `uint32 semanticGroupId` followed by `float32 xyz` |

Primitive codes are `1 = TRIANGLES`, `2 = LINES`, and `3 = POINTS`. LOD is stored as `lod + 1`; zero means no LOD. Side codes are `0 = center`, `1 = left`, and `2 = right`. Human-readable IDs live in the adjacent JSON manifest and are matched by array ordinal and semantic group ID.

## Determinism and regeneration

The compiler normalizes every numeric geometry value to Float32 or Uint32 before writing. Given the same SkeletalDNA, generator version, seed, precision, and source graph, it must produce the same byte sequence and full-file SHA256. The required audit performs three independent generations, a read/write round trip, and a baseline → variant → baseline restoration.

Deleting every `.hrlbone` file does not remove structural authority. Run:

```powershell
node tools/anatomical-skeleton-v1/compile-anatomical-skeleton.mjs
```

to rebuild all four committed variants from JSON-authoritative parameters and the project-owned generator.

## Authority and prohibited use

- The loader is a display/inspection adapter and does not create or modify HumanRigCore.
- The loader reads `finalPose` neither directly nor indirectly.
- `.hrlbone` is not a SkinnedMesh container and contains no bone scale.
- No GLB, glTF, OBJ, FBX, STL, Blend, DAE, external POSITION, external index, external topology, external weight, or hidden model is accepted as compiler input.
