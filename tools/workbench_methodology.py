#!/usr/bin/env python3
"""KAOPU record helper. Consistency checks are NOT visual/physical certification.

Standard library only. No networking, model generation, deployment or execution
of third-party source. The CLI intentionally provides no fixture bypass.
"""
from __future__ import annotations
import argparse
import hashlib
import ipaddress
import json
import math
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

VERSION = "1.0.0"
PACKAGE = Path("docs/workbench-build-system")
SHA = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
KINDS = {"implementation", "documentation", "research", "verification"}
CLAIMS = {"publicDelivered", "visualAccepted", "physicalValidated", "deviceTested", "cinematicAccepted"}
MAX_RECORD = 2 * 1024 * 1024
MAX_EVIDENCE = 128 * 1024 * 1024


def load_json(path: Path) -> dict:
    if path.stat().st_size > MAX_RECORD:
        raise ValueError("record exceeds size limit")
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON key: " + key)
            result[key] = value
        return result
    def invalid(value):
        raise ValueError("nonfinite JSON number: " + value)
    def finite(value):
        number = float(value)
        if not math.isfinite(number):
            raise ValueError("nonfinite JSON number")
        return number
    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique,
                       parse_constant=invalid, parse_float=finite)
    if not isinstance(value, dict):
        raise ValueError("record must be a JSON object")
    return value


def relative_path(value) -> bool:
    return (isinstance(value, str) and bool(value) and not value.startswith("/")
            and "\\" not in value and not any(c in value for c in "*?[]:\x00")
            and not any(ord(c) < 32 for c in value)
            and all(p not in {"", ".", ".."} for p in value.rstrip("/").split("/")))


def under(path: str, scope: str) -> bool:
    scope = scope.rstrip("/")
    return path == scope or path.startswith(scope + "/")


def public_https(value) -> bool:
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower().rstrip(".")
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            return False
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".test", ".invalid")):
            return False
        _ = parsed.port
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            return "." in host and bool(re.fullmatch(r"[a-z0-9.-]+", host))
    except (TypeError, ValueError, AttributeError):
        return False


def moment(value):
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return result if result.utcoffset() is not None else None
    except ValueError:
        return None


def validate_receipt(task: dict, receipt: dict, root: Path, *, allow_fixtures=False) -> list[str]:
    """Validate explicitly recorded scope, identity and local evidence hashes.

    SHA fields are identifiers, not remote Git verification. Evidence contents,
    reviewer independence, DNS resolution and scientific validity require an
    actual verifier. allow_fixtures is solely for tests, never exposed by CLI.
    """
    errors: list[str] = []
    def object_or_empty(value):
        return value if isinstance(value, dict) else {}
    root = root.resolve()
    def require(condition, message):
        if not condition:
            errors.append(message)
    def proof(value, label):
        if not isinstance(value, dict):
            errors.append(label + ": missing evidence object")
            return
        name, expected = value.get("path"), value.get("sha256")
        if not relative_path(name) or not SHA256.fullmatch(str(expected)):
            errors.append(label + ": invalid evidence path/hash")
            return
        try:
            path = (root / name).resolve(strict=True)
            path.relative_to(root)
            if not path.is_file() or path.stat().st_size > MAX_EVIDENCE:
                raise ValueError("not a file or too large")
            digest = hashlib.sha256()
            with path.open("rb") as stream:
                for block in iter(lambda: stream.read(1048576), b""):
                    digest.update(block)
            require(digest.hexdigest() == expected, label + ": evidence hash mismatch")
        except (OSError, ValueError):
            errors.append(label + ": missing, unsafe or oversized evidence")
    if not isinstance(task, dict) or not isinstance(receipt, dict):
        return ["task and receipt must be objects"]
    require(task.get("schema") == "kaopu.workbench.task@1", "unsupported task schema")
    require(receipt.get("schema") == "kaopu.workbench.receipt@1", "unsupported receipt schema")
    require(task.get("state") == "LOCKED", "task must be explicitly LOCKED")
    kind = task.get("kind")
    require(isinstance(kind, str) and kind in KINDS, "invalid task kind")
    require(receipt.get("kind") == kind, "task/receipt kinds differ")
    for name in ("taskId", "target", "primaryDefect", "userDirective"):
        value = task.get(name)
        require(isinstance(value, str) and value.strip() not in {"", "UNSET"}, "unresolved " + name)
    require(receipt.get("taskId") == task.get("taskId"), "task identity mismatch")
    require(receipt.get("status") in ("CANDIDATE", "VERIFIED", "ACCEPTED_SCOPE"), "receipt not ready for checking")
    require(isinstance(receipt.get("fixtureOnly"), bool), "fixtureOnly must be boolean")
    require(not receipt.get("fixtureOnly") or allow_fixtures, "synthetic fixture cannot certify delivery")
    require(receipt.get("fallbackActive") is False, "fallback must be explicitly false")
    require(isinstance(receipt.get("knownLimitations"), list), "knownLimitations must be explicit")
    for obj, field in ((task, "baseSha"), (receipt, "sourceSha"), (receipt, "buildSha"), (receipt, "testedBuildSha")):
        require(bool(SHA.fullmatch(str(obj.get(field)))), "invalid " + field)
    require(receipt.get("buildSha") == receipt.get("testedBuildSha"), "tested build differs from released build")
    if kind != "verification":
        require(task.get("baseSha") != receipt.get("sourceSha"), "no fresh source revision")
    dispatched, checked = moment(task.get("dispatchTime")), moment(receipt.get("checkedAt"))
    require(dispatched is not None and checked is not None, "timezone-aware timestamps required")
    if dispatched and checked:
        require(checked >= dispatched, "evidence predates task dispatch")
    scopes = {}
    for name, obj in (("allowedPaths", task), ("protectedPaths", task), ("filesChanged", receipt)):
        value = obj.get(name)
        valid = isinstance(value, list) and all(relative_path(p) for p in value)
        require(valid, "invalid " + name)
        scopes[name] = value if valid else []
    require(bool(scopes["allowedPaths"]), "allowedPaths is empty")
    if kind != "verification":
        require(bool(scopes["filesChanged"]), "no changed files recorded")
    for name in scopes["filesChanged"]:
        require(any(under(name, p) for p in scopes["allowedPaths"]), "out-of-scope change: " + name)
        require(not any(under(name, p) for p in scopes["protectedPaths"]), "protected change: " + name)
    require(task.get("assetPolicy") in ("INHERIT", "NATIVE_ONLY", "LICENSED_LAB"), "unknown asset policy")
    if task.get("assetPolicy") == "LICENSED_LAB":
        require(bool(task.get("authorizationRef")), "licensed-lab scope needs authorization reference")
    proof(receipt.get("entryArtifact"), "entryArtifact")
    checks = receipt.get("checks")
    if not isinstance(checks, list):
        errors.append("checks must be a list")
        checks = []
    passed = {}
    seen = set()
    for item in checks:
        if not isinstance(item, dict) or not isinstance(item.get("name"), str):
            errors.append("malformed check")
            continue
        name = item["name"]
        require(name not in seen, "duplicate check: " + name)
        seen.add(name)
        require(item.get("status") in ("PASS", "FAIL", "NOT_RUN"), "invalid check status")
        if receipt.get("status") in ("VERIFIED", "ACCEPTED_SCOPE"):
            require(item.get("status") != "FAIL", "failed check blocks promotion: " + name)
        if item.get("status") == "PASS":
            expected = receipt.get("sourceSha") if item.get("subject") == "source" else receipt.get("buildSha")
            require(item.get("subject") in ("source", "build"), "invalid check subject")
            require(item.get("subjectSha") == expected, "stale check: " + name)
            proof(item.get("evidence"), name)
            passed[name] = item
    required = task.get("requiredChecks")
    if not isinstance(required, list) or not all(isinstance(x, str) and x for x in required):
        errors.append("requiredChecks must be a list of names")
        required = []
    mandatory = {"source", "scope"}
    if kind == "implementation":
        mandatory.update({"reference", "structure", "interaction", "public"})
    elif kind == "research":
        mandatory.add("reference")
    for name in set(required) | mandatory:
        require(name in passed, "missing passing check: " + name)
    flags = receipt.get("claims")
    if not isinstance(flags, dict):
        flags = {}
    for name in CLAIMS:
        require(type(flags.get(name)) is bool, "claim must be boolean: " + name)
    if kind in ("documentation", "research"):
        require(not any(flags.get(name) for name in CLAIMS), "record-only work cannot certify a 3D delivery")
    if flags.get("publicDelivered"):
        url = receipt.get("publicUrl")
        require(public_https(url), "publicUrl is not a public HTTPS address")
        pub = passed.get("public", {})
        require(pub.get("url") == url and pub.get("subject") == "build", "public check URL/build mismatch")
        require(pub.get("artifactSha256") == object_or_empty(receipt.get("entryArtifact")).get("sha256"), "public artifact hash mismatch")
    if kind == "implementation" and receipt.get("status") != "CANDIDATE":
        require(flags.get("publicDelivered") is True, "verified implementation needs actual public delivery")
    if flags.get("physicalValidated"):
        require("physics" in passed, "physical claim needs physics evidence")
    if flags.get("deviceTested"):
        platforms = receipt.get("platforms")
        real = isinstance(platforms, list) and any(isinstance(p, dict) and p.get("kind") == "physical_device" and p.get("device") for p in platforms)
        require(real and "device" in passed, "viewport simulation is not physical-device evidence")
    if receipt.get("status") in ("VERIFIED", "ACCEPTED_SCOPE"):
        review = receipt.get("review")
        if not isinstance(review, dict):
            review = {}
        require(bool(review.get("producerId")) and bool(review.get("verifierId")) and review.get("producerId") != review.get("verifierId"), "independent reviewer required")
        require(review.get("kind") == "INDEPENDENT", "review kind must be INDEPENDENT")
        proof(review.get("evidence"), "review")
    if flags.get("visualAccepted") or receipt.get("status") == "ACCEPTED_SCOPE":
        acceptance = receipt.get("acceptance")
        if not isinstance(acceptance, dict):
            acceptance = {}
        require(acceptance.get("by") == "user", "user acceptance required")
        require(acceptance.get("buildSha") == receipt.get("buildSha"), "acceptance applies to another build")
        require(isinstance(acceptance.get("scope"), list) and bool(acceptance.get("scope")), "acceptance scope required")
        proof(acceptance.get("evidence"), "acceptance")
    if flags.get("cinematicAccepted"):
        scope = object_or_empty(receipt.get("acceptance")).get("scope", [])
        require(flags.get("visualAccepted") is True and "benchmark" in passed and isinstance(scope, list) and "cinematic" in scope, "cinematic claim needs benchmark and explicit user scope")
    return errors


def initialize(destination: Path, package_root: Path):
    destination.mkdir(parents=True, exist_ok=False)
    for source, target in (("TASK.template.json", "TASK.json"), ("RECEIPT.template.json", "RECEIPT.json")):
        shutil.copyfile(package_root / PACKAGE / source, destination / target)
    for name, value in (("SOURCES.json", {"schema": "kaopu.sources@1", "sources": []}),
                        ("SCORE.json", {"schema": "kaopu.score@1", "status": "UNMEASURED", "observations": [], "unknowns": []})):
        (destination / name).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    (destination / "HANDOFF.md").write_text("# Handoff\n\nStatus: DRAFT. No workbench has been generated or certified.\n\nNext: locate the real baseline and current user directive.\n", encoding="utf-8")


def lint(root: Path) -> list[str]:
    errors = []
    required = ["WORKBENCH_BUILD_SYSTEM.md"] + [str(PACKAGE / x) for x in
        ("RESEARCH.md", "ARCHITECTURE.md", "QUALITY.md", "RUNBOOK.md", "CASEBOOK.md", "registry.json", "TASK.template.json", "RECEIPT.template.json")]
    for name in required:
        path = root / name
        if not path.is_file():
            errors.append("missing: " + name)
            continue
        if path.suffix == ".json":
            try:
                load_json(path)
            except (ValueError, OSError) as exc:
                errors.append(name + ": " + str(exc))
        else:
            for link in re.findall(r"\]\(([^)]+)\)", path.read_text(encoding="utf-8")):
                if "://" not in link and not link.startswith("#"):
                    target = (path.parent / link.split("#")[0]).resolve()
                    if not target.is_relative_to(root.resolve()) or not target.is_file():
                        errors.append(name + ": broken or escaping local link: " + link)
    registry = root / PACKAGE / "registry.json"
    if registry.is_file():
        try:
            data = load_json(registry)
            if data.get("version") != VERSION or len(data.get("stages", [])) != 10:
                errors.append("registry version/stage mismatch")
            for source in data.get("caseSources", []):
                if source.get("readLevel") == "PR_REPORT_READ":
                    if not source.get("urls") or not all(public_https(u) for u in source["urls"]):
                        errors.append("PR source lacks URLs")
                elif not SHA.fullmatch(str(source.get("blobSha"))):
                    errors.append("source lacks immutable blob: " + str(source.get("id")))
        except (ValueError, TypeError, AttributeError):
            errors.append("invalid registry")
    return errors


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init").add_argument("destination", type=Path)
    check = sub.add_parser("check")
    check.add_argument("receipt", type=Path)
    check.add_argument("--task", type=Path, required=True)
    check.add_argument("--evidence-root", type=Path, required=True)
    sub.add_parser("lint").add_argument("root", type=Path, nargs="?", default=Path(__file__).resolve().parents[1])
    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            initialize(args.destination, Path(__file__).resolve().parents[1])
            print(json.dumps({"status": "DRAFT", "destination": str(args.destination)}))
            return 0
        errors = lint(args.root) if args.command == "lint" else validate_receipt(load_json(args.task), load_json(args.receipt), args.evidence_root)
        print(json.dumps({"version": VERSION, "consistent": not errors, "errors": errors, "qualityCertification": False}, ensure_ascii=False, indent=2))
        return int(bool(errors))
    except (OSError, ValueError, TypeError) as exc:
        print(json.dumps({"consistent": False, "error": str(exc), "qualityCertification": False}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    sys.exit(main())
