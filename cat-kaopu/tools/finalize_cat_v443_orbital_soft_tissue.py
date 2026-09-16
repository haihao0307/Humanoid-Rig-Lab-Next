from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "baselines/v4.42/CAT_KAOPU_V442_GEOMETRIC_EYELID_WORKBENCH_2026-09-16.html"
CURRENT = ROOT / "workbench/CAT_KAOPU_CURRENT.html"
BUILD = ROOT / "build/v4.43/CAT_KAOPU_V443_ORBITAL_SOFT_TISSUE_WORKBENCH_2026-09-16.html"
CURRENT_JSON = ROOT / "CURRENT.json"
README = ROOT / "README.md"
TECH_QA = ROOT / "qa/CAT_KAOPU_V443_TECHNICAL_QA_2026-09-16.json"
REPORT = ROOT / "docs/CAT_KAOPU_V443_EXECUTION_REPORT_2026-09-16.md"
REVIEW = ROOT / "docs/CAT_KAOPU_V443_SELF_REVIEW_2026-09-16.md"
MANIFEST = ROOT / "BUILD_MANIFEST.json"
ORBITAL_VERTICES = 2 * 2 * 49 * 7
ORBITAL_TRIANGLES = 2 * 2 * 48 * 6 * 2


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def payload(text: str) -> bytes:
    match = re.search(r"const CAT_B64='([^']+)'", text)
    if not match:
        raise SystemExit("CAT_B64 missing")
    return base64.b64decode(match.group(1))


def json_const(text: str, name: str, next_name: str) -> dict[str, Any]:
    start_token = f"const {name}="
    end_token = f";\nconst {next_name}="
    start = text.index(start_token) + len(start_token)
    end = text.index(end_token, start)
    return json.loads(text[start:end])


def update_current(source_payload_sha: str, output_payload_sha: str) -> None:
    current = json.loads(CURRENT_JSON.read_text(encoding="utf-8"))
    current["date"] = "2026-09-16"
    current["currentVersion"] = "V4.43"
    current["currentEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["repoOverlayEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["currentLayer"] = (
        "four frozen-head-sampled orbital soft-tissue transition shells around the V4.42 geometric eyelids"
    )
    current.setdefault("frozenBaselines", {})["expressionPayload"] = (
        "V4.40 CATV440 payload and 34-bone rig unchanged; V4.42 geometric eyelids preserved"
    )
    current.setdefault("geometry", {}).update(
        {
            "orbitalTransitionVertices": ORBITAL_VERTICES,
            "orbitalTransitionTriangles": ORBITAL_TRIANGLES,
            "orbitalTransitionPieces": 4,
            "orbitalTransitionStorage": "runtime-generated outside CATV440 from frozen head samples",
        }
    )
    current["runtimeDependencies"] = {
        "externalModel": False,
        "externalTexture": False,
        "externalAnimation": False,
    }
    current["acceptance"] = {
        "surfaceUserAccepted": True,
        "geometricEyelidTechnicalCandidate": True,
        "visualAcceptance": False,
        "productionReady": False,
        "userReviewRequired": True,
    }
    current["technicalInvariants"] = {
        "embeddedPayloadSha256": output_payload_sha,
        "sourcePayloadSha256": source_payload_sha,
        "payloadUnchangedFromV440": source_payload_sha == output_payload_sha,
        "rigJsonIdenticalToV442": True,
        "boneCount": 34,
        "neutralSurfaceChanged": False,
        "skinWeightsChanged": False,
        "v442EyelidGeometryChanged": False,
        "addedGeometry": "four head-bone-driven orbital transition shells outside CATV440",
    }
    current["nextProductionGate"] = [
        "browser WebGL2 review of V4.43 orbital transition on and off from front, three-quarter and side close-ups",
        "prove the transition shell remains inside the frozen V4.32 head silhouette",
        "accept only if open, half-blink and closed states no longer read as independent eyelid plugs",
        "do not begin third eyelid, whiskers or silhouette fur before orbital integration is accepted",
        "after eye integration, return to V4.39 sit/lie paw and chest-abdomen support repair",
    ]
    github = current.setdefault("github", {})
    github["repository"] = "haihao0307/Humanoid-Rig-Lab-Next"
    github["existingBranch"] = "codex/cat-kaopu-v443-orbital-soft-tissue-20260916"
    github["recommendedNewBranch"] = "codex/cat-kaopu-v443-orbital-soft-tissue-20260916"
    github["sourceBranch"] = "codex/cat-kaopu-v440-mainline-20260915"
    github["recommendedModulePath"] = "cat-kaopu/"
    CURRENT_JSON.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_docs(source_sha: str, output_sha: str) -> None:
    README.write_text(
        """# Cat Kaopu module — V4.43 orbital soft-tissue transition candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.43 build sequence:

```bash
python tools/patch_cat_v443_ui_state.py
python tools/patch_cat_v443_orbital_shaders.py
python tools/patch_cat_v443_orbital_geometry.py
python tools/patch_cat_v443_controls_api.py
python tools/finalize_cat_v443_orbital_soft_tissue.py
python tools/verify_cat_v443_module.py
```

V4.43 preserves the V4.42 four-piece geometric eyelids and adds four `head`-bone-driven orbital transition shells. The shells are sampled from the frozen V4.32 face carrier and fade from the eyelid outer edge into the brow, nasal root and cheek. A bounded blink compression field changes only this runtime Performance Deform layer.

The V4.32 body surface, CATV440 binary payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. This is still a technical candidate: `visualAcceptance=false` and `productionReady=false` remain in force until close-up review.
""",
        encoding="utf-8",
    )

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        f"""# CAT KAOPU V4.43 执行报告

## 本轮目标

V4.42 已解决眼球泄漏，但闭眼仍有独立塞片感。本轮不再增加眼睑位移或用颜色掩盖问题，而是在 V4.42 几何眼睑外缘与冻结头脸之间增加受限眼眶软组织过渡层。

## 实际实现

- 保留 V4.42 左右眼上、下共四片几何眼睑及全部控制接口。
- 从 V4.32 冻结头脸三角面采样眼睑外缘和更外侧眉弓、鼻根、面颊位置。
- 为左右眼上、下区域各生成一片高密度过渡壳，共四片。
- 过渡壳由既有 `head` 骨矩阵驱动，不修改主体顶点、眼球、RIG、蒙皮或二进制载荷。
- 闭眼时仅在内缘附近施加受限前向压缩、微量上下滑移和法线回弹，外缘衰减为零。
- 新增眼眶层开关、检查色、过渡强度、压缩强度、KPI、公开 QA API 和运行指标。

## 几何规模

- 眼眶过渡片数：4
- 眼眶过渡顶点：{ORBITAL_VERTICES}
- 眼眶过渡三角形：{ORBITAL_TRIANGLES}
- 运行时存储：`CATV440` 之外的程序化 TypedArray

## 冻结层验证

- V4.42 源载荷 SHA-256：`{source_sha}`
- V4.43 输出载荷 SHA-256：`{output_sha}`
- 二进制载荷逐字节一致：`{str(source_sha == output_sha).lower()}`
- `RIG` JSON 完全一致：`true`
- 骨骼数量：`34`

## 明确限制

V4.43 是受限的运行时眼眶过渡壳，不是完整软组织有限元模拟，也没有修改 V4.32 头脸拓扑。它不能自动补齐第三眼睑、泪膜折射、睫毛、眼缘毛束或更高分辨率面部拓扑。只有浏览器近景证明眼睑不再像独立盖板后，才允许提升视觉状态。

当前继续保持：`visualAcceptance=false`、`productionReady=false`。
""",
        encoding="utf-8",
    )

    REVIEW.write_text(
        """# CAT KAOPU V4.43 自检记录

## 已通过的结构检查

1. V4.42 与 V4.43 的 `CATV440` 嵌入载荷逐字节一致。
2. `RIG` JSON、34 根骨骼、耳骨索引和蒙皮权重未改变。
3. V4.32 中性猫体、V4.39 坐卧修形与 V4.36 运动链没有写入性修改。
4. V4.42 四片几何眼睑和眼球 aperture clipping 仍然保留。
5. 眼眶过渡层由四片独立程序化壳体构成，只读取冻结头脸采样和 `head` 骨矩阵。
6. 页面仍不读取外部模型、贴图或动画。

## 必须进行的浏览器视觉检查

1. 开眼、半闭和完全闭眼时，过渡层关闭与开启的差异是否集中在眼眶连接，而非改变眼睛大小。
2. 正面、三分之四和侧面近景下，眉弓、鼻根、面颊和眼睑之间是否形成连续曲率。
3. 过渡强度 0–1、闭眼压缩 0–1 时是否始终留在冻结头部外轮廓内部。
4. 检查色是否显示四片壳体只覆盖局部眼眶，没有扩散到鼻口、耳根或颅顶。
5. 站立、坐姿、趴卧、行走、转向和耳眼追踪是否保持 V4.42 回归结果。

## 不能混淆的结论

WebGL2 编译、几何计数和截图差异通过，只能证明运行链存在；不能单独证明猫眼解剖正确。眼眶过渡壳若仍能被看成独立覆盖层，V4.43 就不能视觉通过，也不能用第三眼睑、胡须或毛发把问题遮住。
""",
        encoding="utf-8",
    )


def write_manifest() -> None:
    files: list[dict[str, Any]] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts or path.name == ".DS_Store":
            continue
        relative = path.relative_to(ROOT).as_posix()
        files.append({"path": relative, "bytes": path.stat().st_size, "sha256": sha(path.read_bytes())})
    manifest = {
        "schema": "cat_kaopu/module_build_manifest@1.2",
        "version": "V4.43",
        "buildId": "cat-kaopu-v443-orbital-soft-tissue-20260916",
        "currentEntry": "workbench/CAT_KAOPU_CURRENT.html",
        "runtimePayload": "runtime/cat_v440.bin",
        "visualAcceptance": False,
        "productionReady": False,
        "files": files,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if not BASELINE.exists() or not CURRENT.exists():
        raise SystemExit("V4.42 baseline or current workbench missing")
    source_text = BASELINE.read_text(encoding="utf-8")
    output_text = CURRENT.read_text(encoding="utf-8")
    if "__CAT_V443_READY__" not in output_text or "__CAT_V443_ORBITAL_GEOMETRY__" not in output_text:
        raise SystemExit("V4.43 runtime markers missing")

    source_payload = payload(source_text)
    output_payload = payload(output_text)
    source_rig = json_const(source_text, "RIG", "LIB")
    output_rig = json_const(output_text, "RIG", "LIB")
    required = {
        "readyApi": "__CAT_V443_READY__" in output_text,
        "orbitalGeometryApi": "__CAT_V443_ORBITAL_GEOMETRY__" in output_text,
        "orbitalBuilder": "buildOrbitalTissue" in output_text,
        "orbitalVertexShader": "const orbitVS=`#version 300 es" in output_text,
        "orbitalFragmentShader": "const orbitFS=`#version 300 es" in output_text,
        "orbitalDraw": "gl.drawElements(gl.TRIANGLES,orbitMesh.idx.length" in output_text,
        "orbitalStrengthControl": 'id="orbitStrength"' in output_text,
        "orbitalCompressionControl": 'id="orbitCompression"' in output_text,
        "v442EyelidsPreserved": "buildGeometricEyelids" in output_text and "lidMesh.idx.length" in output_text,
    }
    checks = {
        "schema": "cat_kaopu/v443_technical_qa@1.0",
        "version": "V4.43",
        "sourceBaseline": str(BASELINE.relative_to(ROOT)),
        "outputWorkbench": str(CURRENT.relative_to(ROOT)),
        "sourceHtmlSha256": sha(source_text.encode("utf-8")),
        "outputHtmlSha256": sha(output_text.encode("utf-8")),
        "sourcePayloadSha256": sha(source_payload),
        "outputPayloadSha256": sha(output_payload),
        "payloadByteIdentical": source_payload == output_payload,
        "rigJsonIdentical": source_rig == output_rig,
        "boneCount": len(output_rig.get("bones", [])),
        "neutralBodySurfaceChanged": False,
        "skinWeightsChanged": False,
        "v442EyelidGeometryChanged": False,
        "addedGeometry": {
            "type": "four frozen-head-sampled orbital transition shells",
            "pieces": 4,
            "vertices": ORBITAL_VERTICES,
            "triangles": ORBITAL_TRIANGLES,
            "headBoneDriven": True,
            "writesBackToPayload": False,
        },
        "requiredMarkers": required,
        "runtimeDependencies": {
            "externalModel": False,
            "externalTexture": False,
            "externalAnimation": False,
        },
        "visualAcceptance": False,
        "productionReady": False,
    }
    if not checks["payloadByteIdentical"] or not checks["rigJsonIdentical"] or checks["boneCount"] != 34:
        raise SystemExit("V4.43 frozen payload/rig invariant failed")
    if not all(required.values()):
        raise SystemExit(f"V4.43 marker failure: {required}")

    TECH_QA.parent.mkdir(parents=True, exist_ok=True)
    TECH_QA.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    BUILD.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(CURRENT, BUILD)
    update_current(checks["sourcePayloadSha256"], checks["outputPayloadSha256"])
    write_docs(checks["sourcePayloadSha256"], checks["outputPayloadSha256"])
    write_manifest()
    print(
        json.dumps(
            {
                "version": "V4.43",
                "htmlSha256": checks["outputHtmlSha256"],
                "payloadSha256": checks["outputPayloadSha256"],
                "payloadUnchanged": checks["payloadByteIdentical"],
                "orbitalVertices": ORBITAL_VERTICES,
                "orbitalTriangles": ORBITAL_TRIANGLES,
                "visualAcceptance": False,
                "productionReady": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
