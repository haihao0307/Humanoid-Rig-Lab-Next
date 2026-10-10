"""Synthetic consistency tests, NOT tests of a historical 3D workbench."""
import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("method", ROOT / "tools/workbench_methodology.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "proof.txt").write_text("SYNTHETIC TEST ONLY\n", encoding="utf-8")
        self.proof = {"path": "proof.txt", "sha256": hashlib.sha256((self.root / "proof.txt").read_bytes()).hexdigest()}
        self.task = m.load_json(ROOT / m.PACKAGE / "TASK.template.json")
        self.task.update(taskId="test-1", kind="implementation", state="LOCKED", target="test", userDirective="synthetic", primaryDefect="synthetic", dispatchTime="2026-10-10T10:00:00+00:00", baseSha="a" * 40, allowedPaths=["lab/"], protectedPaths=["lab/frozen/"])
        self.receipt = m.load_json(ROOT / m.PACKAGE / "RECEIPT.template.json")
        self.receipt.update(taskId="test-1", status="VERIFIED", sourceSha="b" * 40, buildSha="c" * 40, testedBuildSha="c" * 40, checkedAt="2026-10-10T10:01:00Z", filesChanged=["lab/src.py"], entryArtifact=copy.deepcopy(self.proof), fixtureOnly=True, publicUrl="https://example.org/fixed-build/")
        self.receipt["claims"]["publicDelivered"] = True
        self.receipt["review"] = {"producerId": "synthetic-a", "verifierId": "synthetic-b", "kind": "INDEPENDENT", "evidence": copy.deepcopy(self.proof)}
        for name in self.task["requiredChecks"]:
            self.receipt["checks"].append({"name": name, "status": "PASS", "subject": "build", "subjectSha": "c" * 40, "evidence": copy.deepcopy(self.proof)})
        self.receipt["checks"][-1].update(url=self.receipt["publicUrl"], artifactSha256=self.proof["sha256"])

    def errors(self):
        return m.validate_receipt(self.task, self.receipt, self.root, allow_fixtures=True)

    def test_consistent_synthetic_record(self):
        self.assertEqual(self.errors(), [])

    def test_documentation_candidate_with_no_runtime_claims(self):
        self.task["kind"] = self.receipt["kind"] = "documentation"
        self.receipt["status"] = "CANDIDATE"
        self.receipt["claims"]["publicDelivered"] = False
        self.assertEqual(self.errors(), [])

    def test_explicit_user_scope_binds_build(self):
        self.receipt["status"] = "ACCEPTED_SCOPE"
        self.receipt["claims"]["visualAccepted"] = True
        self.receipt["acceptance"] = {"by": "user", "buildSha": "c" * 40, "scope": ["silhouette"], "evidence": copy.deepcopy(self.proof)}
        self.assertEqual(self.errors(), [])
        self.receipt["acceptance"]["buildSha"] = "d" * 40
        self.assertTrue(self.errors())

    def test_fixture_rejected_by_default(self):
        self.assertIn("synthetic fixture cannot certify delivery", m.validate_receipt(self.task, self.receipt, self.root))

    def test_template_cannot_pass(self):
        self.assertTrue(m.validate_receipt(m.load_json(ROOT / m.PACKAGE / "TASK.template.json"), m.load_json(ROOT / m.PACKAGE / "RECEIPT.template.json"), self.root))

    def test_draft_refused(self):
        self.task["state"] = "DRAFT"
        self.assertTrue(self.errors())

    def test_changed_identity_refused(self):
        self.receipt["taskId"] = "other"
        self.assertTrue(self.errors())

    def test_stale_build_refused(self):
        self.receipt["testedBuildSha"] = "d" * 40
        self.assertTrue(self.errors())

    def test_source_and_build_may_differ(self):
        self.receipt["checks"][0].update(subject="source", subjectSha="b" * 40)
        self.assertEqual(self.errors(), [])

    def test_stale_check_refused(self):
        self.receipt["checks"][0]["subjectSha"] = "d" * 40
        self.assertTrue(self.errors())

    def test_stale_timestamp_refused(self):
        self.receipt["checkedAt"] = "2026-10-09T10:01:00Z"
        self.assertTrue(self.errors())

    def test_naive_timestamp_refused(self):
        self.receipt["checkedAt"] = "2026-10-10T10:01:00"
        self.assertTrue(self.errors())

    def test_unchanged_source_refused(self):
        self.receipt["sourceSha"] = self.task["baseSha"]
        self.assertTrue(self.errors())

    def test_outside_scope_refused(self):
        self.receipt["filesChanged"] = ["other/file.py"]
        self.assertTrue(self.errors())

    def test_protected_change_refused(self):
        self.receipt["filesChanged"] = ["lab/frozen/original.py"]
        self.assertTrue(self.errors())

    def test_path_boundary_not_prefix(self):
        self.receipt["filesChanged"] = ["laboratory/file.py"]
        self.assertTrue(self.errors())

    def test_missing_evidence_refused(self):
        (self.root / "proof.txt").unlink()
        self.assertTrue(self.errors())

    def test_wrong_hash_refused(self):
        self.receipt["entryArtifact"]["sha256"] = "0" * 64
        self.assertTrue(self.errors())

    def test_traversal_refused(self):
        self.receipt["entryArtifact"]["path"] = "../proof.txt"
        self.assertTrue(self.errors())

    def test_escaping_symlink_refused(self):
        with tempfile.TemporaryDirectory() as other:
            outside = Path(other) / "outside"
            outside.write_text("SYNTHETIC TEST ONLY\n")
            (self.root / "link").symlink_to(outside)
            self.receipt["entryArtifact"]["path"] = "link"
            self.assertTrue(self.errors())

    def test_missing_required_check_refused(self):
        self.receipt["checks"].pop(0)
        self.assertTrue(self.errors())

    def test_no_weakening_required_checks(self):
        self.task["requiredChecks"] = []
        self.receipt["checks"] = []
        self.assertTrue(self.errors())

    def test_duplicate_check_refused(self):
        self.receipt["checks"].append(self.receipt["checks"][0])
        self.assertTrue(self.errors())

    def test_extra_failure_blocks_promotion(self):
        self.receipt["checks"].append({"name": "other", "status": "FAIL"})
        self.assertTrue(self.errors())

    def test_wrong_public_identity_refused(self):
        self.receipt["checks"][-1]["url"] = "https://example.org/old"
        self.assertTrue(self.errors())

    def test_nonpublic_urls_refused(self):
        for url in ("http://example.org", "https://localhost/", "https://127.0.0.1", "https://192.168.0.1", "https://[::1]", "file:///tmp/a", "https://u:p@example.org", "https://a.local", "https://a.test"):
            with self.subTest(url=url):
                self.assertFalse(m.public_https(url))

    def test_public_claim_required(self):
        self.receipt["claims"]["publicDelivered"] = False
        self.assertTrue(self.errors())

    def test_self_review_refused(self):
        self.receipt["review"]["verifierId"] = "synthetic-a"
        self.assertTrue(self.errors())

    def test_visual_claim_without_user_refused(self):
        self.receipt["claims"]["visualAccepted"] = True
        self.assertTrue(self.errors())

    def test_emulator_is_not_device(self):
        self.receipt["claims"]["deviceTested"] = True
        self.receipt["platforms"] = [{"kind": "viewport", "device": "390x844"}]
        self.assertTrue(self.errors())

    def test_physics_claim_needs_evidence(self):
        self.receipt["claims"]["physicalValidated"] = True
        self.assertTrue(self.errors())

    def test_cinematic_claim_needs_scoped_acceptance(self):
        self.receipt["claims"].update(visualAccepted=True, cinematicAccepted=True)
        self.assertTrue(self.errors())

    def test_documentation_cannot_certify_runtime(self):
        self.task["kind"] = self.receipt["kind"] = "documentation"
        self.assertTrue(self.errors())

    def test_licensed_lab_needs_authorization(self):
        self.task["assetPolicy"] = "LICENSED_LAB"
        self.assertTrue(self.errors())

    def test_fallback_blocks(self):
        self.receipt["fallbackActive"] = True
        self.assertTrue(self.errors())

    def test_malformed_nested_fields_fail_not_crash(self):
        for key in ("claims", "checks", "review", "acceptance", "entryArtifact", "filesChanged"):
            for value in (None, [], "bad", 12, True):
                with self.subTest(key=key, value=value):
                    changed = copy.deepcopy(self.receipt)
                    changed[key] = value
                    changed["status"] = "ACCEPTED_SCOPE"
                    self.assertTrue(m.validate_receipt(self.task, changed, self.root, allow_fixtures=True))

    def test_malformed_task_fields_fail_not_crash(self):
        for key in ("allowedPaths", "protectedPaths", "requiredChecks", "kind", "dispatchTime"):
            changed = copy.deepcopy(self.task)
            changed[key] = {"bad": True}
            self.assertTrue(m.validate_receipt(changed, self.receipt, self.root, allow_fixtures=True))

    def test_init_creates_records_not_fake_workbench(self):
        dest = self.root / "new"
        m.initialize(dest, ROOT)
        self.assertEqual(set(p.name for p in dest.iterdir()), {"TASK.json", "RECEIPT.json", "SOURCES.json", "SCORE.json", "HANDOFF.md"})
        self.assertEqual(m.load_json(dest / "TASK.json")["state"], "DRAFT")
        self.assertTrue(m.validate_receipt(m.load_json(dest / "TASK.json"), m.load_json(dest / "RECEIPT.json"), dest))

    def test_init_does_not_overwrite(self):
        with self.assertRaises(FileExistsError):
            m.initialize(self.root, ROOT)
        self.assertTrue((self.root / "proof.txt").exists())

    def test_json_invalid_numbers_duplicates_refused(self):
        for text in ('{"a":1,"a":2}', '{"x":NaN}', '{"x":1e309}', '[]'):
            path = self.root / "bad.json"
            path.write_text(text)
            with self.assertRaises(ValueError):
                m.load_json(path)

    def test_methodology_package_lints(self):
        self.assertEqual(m.lint(ROOT), [])

    def test_replication_precedes_deep_dissection(self):
        registry = m.load_json(ROOT / m.PACKAGE / "registry.json")
        phases = [x["purpose"] for x in registry["stages"]]
        self.assertLess(phases.index("replicate"), phases.index("dissect"))
        self.assertLess(phases.index("freeze_replica"), phases.index("parameter_mapping"))
        self.assertLess(phases.index("parameter_mapping"), phases.index("controlled_variants"))
        self.assertLess(phases.index("controlled_variants"), phases.index("consolidate"))

    def test_user_is_not_the_parameter_operator(self):
        task = m.load_json(ROOT / m.PACKAGE / "TASK.template.json")
        self.assertEqual(task["methodologyVersion"], m.VERSION)
        self.assertEqual(task["autonomy"]["parameterOwner"], "executor")
        self.assertEqual(task["autonomy"]["humanRole"], "goal_and_key_result_review")
        self.assertIs(task["autonomy"]["perTechnicalStepHumanApproval"], False)
        self.assertIs(task["autonomy"]["backgroundExecutorInstalled"], False)

    def test_recent_cases_primary_and_old_cases_secondary(self):
        registry = m.load_json(ROOT / m.PACKAGE / "registry.json")
        sources = {s["id"]: s for s in registry["caseSources"]}
        self.assertEqual(sources["C02"]["methodRole"], "RECENT_PRIMARY")
        self.assertEqual(sources["C08"]["methodRole"], "HISTORICAL_SUPPORT_ONLY")
        self.assertIs(registry["methodologyPriority"]["externalTeacherPublicationDateRestricted"], False)

    def test_lint_rejects_reversed_replication_order(self):
        dest = self.root / "copy"
        import shutil
        shutil.copytree(ROOT / m.PACKAGE, dest / m.PACKAGE)
        shutil.copyfile(ROOT / "WORKBENCH_BUILD_SYSTEM.md", dest / "WORKBENCH_BUILD_SYSTEM.md")
        path = dest / m.PACKAGE / "registry.json"
        data = m.load_json(path)
        data["stages"][2], data["stages"][4] = data["stages"][4], data["stages"][2]
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertIn("replicate-first stage order mismatch", m.lint(dest))

    def test_lint_rejects_parameter_burden_on_user(self):
        dest = self.root / "copy"
        import shutil
        shutil.copytree(ROOT / m.PACKAGE, dest / m.PACKAGE)
        shutil.copyfile(ROOT / "WORKBENCH_BUILD_SYSTEM.md", dest / "WORKBENCH_BUILD_SYSTEM.md")
        path = dest / m.PACKAGE / "registry.json"
        data = m.load_json(path)
        data["autonomy"]["parameterOwner"] = "user"
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertIn("executor-owned parameters and review-only policy required", m.lint(dest))

    def test_cli_has_no_fixture_bypass(self):
        source = (ROOT / "tools/workbench_methodology.py").read_text()
        self.assertNotIn('add_argument("--allow-fixtures"', source)


if __name__ == "__main__":
    unittest.main()
