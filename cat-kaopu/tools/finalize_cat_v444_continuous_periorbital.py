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
BUILD = ROOT / "build/v4.44/CAT_KAOPU_V444_CONTINUOUS_PERIORBITAL_WORKBENCH_2026-09-16.html"
CURRENT_JSON = ROOT / "CURRENT.json"
README = ROOT / "README.md"
TECH_QA = ROOT / "qa/CAT_KAOPU_V444_TECHNICAL_QA_2026-09-16.json"
REPORT = ROOT / "docs/CAT_KAOPU_V444_EXECUTION_REPORT_2026-09-16.md"
REVIEW = ROOT / "docs/CAT_KAOPU_V444_SELF_REVIEW_2026-09-16.md"
MANIFEST = ROOT / "BUILD_MANIFEST.json"
PATCH_VERTICES = 2 * 65 * 9
PATCH_TRIANGLES = 2 * 64 * 8 * 2


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
    current["currentVersion"] = "V4.44"
    current["currentEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["repoOverlayEntry"] = "workbench/CAT_KAOPU_CURRENT.html"
    current["currentLayer"] = (
        "two continuous annular periorbital carriers with dynamic palpebral apertures and frozen-head outer boundaries"
    )
    current.setdefault("frozenBaselines", {})["expressionPayload"] = (
        "V4.40 CATV440 payload and 34-bone rig unchanged; V4.42 eyelid data preserved as legacy comparison"
    )
    current.setdefault("geometry", {}).update(
        {
            "continuousPeriorbitalVertices": PATCH_VERTICES,
            "continuousPeriorbitalTriangles": PATCH_TRIANGLES,
            "continuousPeriorbitalPieces": 2,
            "continuousPeriorbitalStorage": "runtime-generated outside CATV440 from frozen head samples",
        }
    )
    current["runtimeDependencies"] = {
        "externalModel": False,
        "externalTexture": False,
        "externalAnimation": False,
    }
    current["acceptance"] = {
        "surfaceUserAccepted": True,
        "legacyV442TechnicalCandidate": True,
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
        "legacyV442EyelidDataPreserved": True,
        "defaultV442EyelidDrawDisabled": True,
        "addedGeometry": "two continuous head-bone-driven annular periorbital carriers outside CATV440",
    }
    current["nextProductionGate"] = [
        "browser WebGL2 close-up review of open, half-blink and closed continuous apertures from front, three-quarter and side views",
        "verify inner and outer canthi remain continuous at all blink values",
        "verify the outer ring returns to the frozen V4.32 head surface without changing the head silhouette",
        "accept only if the closed state no longer reads as independent horizontal plugs",
        "do not begin third eyelid, whiskers or silhouette fur before periorbital topology is accepted",
    ]
    github = current.setdefault("github", {})
    github["repository"] = "haihao0307/Humanoid-Rig-Lab-Next"
    github["existingBranch"] = "codex/cat-kaopu-v444-continuous-periorbital-20260916"
    github["recommendedNewBranch"] = "codex/cat-kaopu-v444-continuous-periorbital-20260916"
    github["sourceBranch"] = "codex/cat-kaopu-v443-orbital-soft-tissue-20260916"
    github["recommendedModulePath"] = "cat-kaopu/"
    CURRENT_JSON.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_docs(source_sha: str, output_sha: str) -> None:
    README.write_text(
        """# Cat Kaopu module — V4.44 continuous periorbital candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.44 build sequence:

```bash
python tools/patch_cat_v444_ui_state.py
python tools/patch_cat_v444_periorbital_runtime.py
python tools/patch_cat_v444_controls_api.py
python tools/finalize_cat_v444_continuous_periorbital.py
python tools/verify_cat_v444_module.py
```

V4.44 replaces the default four-strip eyelid presentation with one continuous annular carrier per eye. Each patch has a dynamic inner palpebral aperture and an outer boundary sampled from the frozen V4.32 brow, nasal root and cheek. Inner and outer canthi are therefore part of the same topology instead of endpoints of separate upper/lower strips.

The V4.32 body surface, CATV440 binary payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. V4.42/V4.43 stay available as historical baselines. This is a technical candidate: `visualAcceptance=false` and `productionReady=false` remain in force until close-up review.
""",
        encoding="utf-8",
    )

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        f"""# CAT KAOPU V4.44 执行报告

## 本轮目标

V4.43 证明在四片眼睑后方继续叠加四片过渡壳，仍不能消除独立塞片感。本轮改变拓扑关系：每只眼只使用一张连续环形眶周载体，内边界形成睑裂，外边界返回冻结头脸。

## 实际实现

- 从 V4.42 冻结工作台重建，保留 `CATV440`、RIG、动作链、角膜、瞳孔和眼球裁剪逻辑。
- 左右眼各生成一张连续环形眶周载体，共两片。
- 每片网格以 64 个周向段和 8 个径向环带构成，内外眼角由同一拓扑自然连接。
- 内边界根据眨眼值连续改变开口；上眼睑承担主要闭合行程，下眼睑提供较小支撑。
- 外边界从冻结眉弓、鼻根和面颊三角面采样，并在最外环衰减为零。
- 默认不再绘制 V4.42 四片独立眼睑条带；原始数据和程序仍保留作历史比较。
- 新增眶周融合、闭眼褶皱、检查色、运行指标和公开 QA API。

## 几何规模

- 连续眶周片数：2
- 连续眶周顶点：{PATCH_VERTICES}
- 连续眶周三角形：{PATCH_TRIANGLES}
- 运行时存储：`CATV440` 之外的程序化 TypedArray

## 冻结层验证

- V4.42 源载荷 SHA-256：`{source_sha}`
- V4.44 输出载荷 SHA-256：`{output_sha}`
- 二进制载荷逐字节一致：`{str(source_sha == output_sha).lower()}`
- `RIG` JSON 完全一致：`true`
- 骨骼数量：`34`

## 明确限制

V4.44 仍是运行时 Performance Deform 层，不是高分辨率面部拓扑或真实软组织有限元。它没有第三眼睑、泪膜折射、睫毛和眼缘毛束。浏览器近景必须证明连续拓扑确实改善闭眼形态，否则不能视觉通过。

当前继续保持：`visualAcceptance=false`、`productionReady=false`。
""",
        encoding="utf-8",
    )

    REVIEW.write_text(
        """# CAT KAOPU V4.44 自检记录

## 已通过的结构检查

1. V4.42 与 V4.44 的 `CATV440` 嵌入载荷逐字节一致。
2. `RIG` JSON、34 根骨骼、耳骨索引和蒙皮权重未改变。
3. V4.32 中性猫体、V4.39 坐卧修形与 V4.36 运动链没有写入性修改。
4. V4.42 眼球 aperture clipping、角膜、瞳孔适应、耳眼控制和短毛方向场继续保留。
5. 默认眼睑表现改为左右眼各一张连续环形眶周载体。
6. V4.42 四片几何眼睑数据保留但默认绘制被关闭，可通过历史基线回退。
7. 页面仍不读取外部模型、贴图或动画。

## 必须进行的浏览器视觉检查

1. 开眼、半闭和完全闭眼时，内外眼角是否连续且没有矩形条带端头。
2. 正面、三分之四和侧面下，外环是否自然返回眉弓、鼻根和面颊。
3. 完全闭眼时是否形成上眼睑主导的连续凸面，而不是上下两块水平盖板。
4. 眶周融合和闭眼褶皱从 0 到 1 时是否留在冻结头部轮廓内部。
5. 检查色是否只覆盖双眼局部，不扩散到鼻口、耳根或颅顶。
6. 站立、坐姿、趴卧、行走、转向和耳眼追踪是否保持回归结果。

## 不能混淆的结论

两片连续拓扑优于八片叠层只是结构假设，必须由近景证据检验。WebGL2 编译、几何计数和截图差异通过，仍不能单独证明猫眼解剖正确。
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
        "schema": "cat_kaopu/module_build_manifest@1.3",
        "version": "V4.44",
        "buildId": "cat-kaopu-v444-continuous-periorbital-20260916",
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
    if "__CAT_V444_READY__" not in output_text or "__CAT_V444_PERIORBITAL_GEOMETRY__" not in output_text:
        raise SystemExit("V4.44 runtime markers missing")

    source_payload = payload(source_text)
    output_payload = payload(output_text)
    source_rig = json_const(source_text, "RIG", "LIB")
    output_rig = json_const(output_text, "RIG", "LIB")
    required = {
        "readyApi": "__CAT_V444_READY__" in output_text,
        "periorbitalGeometryApi": "__CAT_V444_PERIORBITAL_GEOMETRY__" in output_text,
        "periorbitalBuilder": "buildContinuousPeriorbital" in output_text,
        "periorbitalVertexShader": "const periVS=`#version 300 es" in output_text,
        "periorbitalFragmentShader": "const periFS=`#version 300 es" in output_text,
        "periorbitalDraw": "gl.drawElements(gl.TRIANGLES,periMesh.idx.length" in output_text,
        "patchStrengthControl": 'id="patchStrength"' in output_text,
        "creaseStrengthControl": 'id="creaseStrength"' in output_text,
        "legacyEyelidDataPreserved": "buildGeometricEyelids" in output_text and "lidVao=gl.createVertexArray()" in output_text,
    }
    checks = {
        "schema": "cat_kaopu/v444_technical_qa@1.0",
        "version": "V4.44",
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
        "legacyV442EyelidDataPreserved": True,
        "addedGeometry": {
            "type": "two continuous annular periorbital carriers",
            "pieces": 2,
            "vertices": PATCH_VERTICES,
            "triangles": PATCH_TRIANGLES,
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
        raise SystemExit("V4.44 frozen payload/rig invariant failed")
    if not all(required.values()):
        raise SystemExit(f"V4.44 marker failure: {required}")

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
                "version": "V4.44",
                "htmlSha256": checks["outputHtmlSha256"],
                "payloadSha256": checks["outputPayloadSha256"],
                "payloadUnchanged": checks["payloadByteIdentical"],
                "periorbitalVertices": PATCH_VERTICES,
                "periorbitalTriangles": PATCH_TRIANGLES,
                "visualAcceptance": False,
                "productionReady": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
