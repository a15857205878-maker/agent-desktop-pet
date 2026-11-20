import json
from pathlib import Path
import tempfile
import unittest

import setup_check


class InstallDiagnosisTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="龙娘 测试 ")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.model = self.root / "web/appearances/dragon-live"
        self.lib = self.root / "web/lib"

    def write(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding="utf-8")

    def write_compatible_tree(self):
        motions = ("Idle", "ReactionNod", "ReactionCurious", "ReactionChuckle",
                   "ReactionShake", "ReactionWink", "ReactionLookAround", "ReactionCheer")
        self.spec = {"Version": 3, "FileReferences": {
            "Moc": "test.moc3", "Textures": ["textures/texture 00.png"],
            "Motions": {name: [{"File": "motions/test.motion3.json"}] for name in motions},
        }}
        self.write(self.model / "dragon.states.model3.json", json.dumps(self.spec))
        self.write(self.model / "catalog.json", '[{"id":"idle","values":{}}]')
        self.write(self.model / "rig-map.json", "{}")
        for name in ("test.moc3", "textures/texture 00.png", "motions/test.motion3.json"):
            self.write(self.model / name, "fixture")
        for name in ("live2dcubismcore.min.js", "pixi-v6.min.js", "pixi-live2d-display-cubism4.min.js"):
            self.write(self.lib / name, "/* fixture */ void 0;")

    def report(self):
        return setup_check.asset_report(self.root)

    def test_empty_export_identifies_three_missing_asset_groups(self):
        self.assertTrue(self.report()["model"])
        self.assertTrue(self.report()["core"])
        self.assertTrue(self.report()["renderer"])
        self.assertFalse(self.report()["placement"])
        self.assertFalse((self.root / "web").exists())

    def test_nested_folder_and_download_filename_have_expected_destinations(self):
        self.write_compatible_tree()
        for path in self.model.iterdir():
            if path.is_file():
                (self.model / "dragon-live").mkdir(exist_ok=True)
                path.rename(self.model / "dragon-live" / path.name)
        (self.lib / "pixi-v6.min.js").rename(self.lib / "pixi.min.js.txt")

        report = self.report()
        self.assertTrue(report["model"])
        self.assertTrue(report["renderer"])
        self.assertFalse(report["core"])
        placement = "\n".join(report["placement"])
        self.assertIn("web/appearances/dragon-live/dragon-live/dragon.states.model3.json", placement)
        self.assertIn("web/appearances/dragon-live/dragon.states.model3.json", placement)
        self.assertIn("web/lib/pixi.min.js.txt", placement)
        self.assertIn("web/lib/pixi-v6.min.js", placement)

    def test_outside_model_reference_counts_as_placement_and_model_issue(self):
        self.write_compatible_tree()
        self.spec["FileReferences"]["Moc"] = "../outside.moc3"
        self.write(self.model / "dragon.states.model3.json", json.dumps(self.spec))
        self.write(self.model.parent / "outside.moc3", "fixture")

        report = self.report()
        self.assertIn("../outside.moc3", "\n".join(report["model"]))
        self.assertIn("../outside.moc3", "\n".join(report["placement"]))

    def test_filename_and_directory_collisions_are_path_problems(self):
        self.write(self.lib, "an accidental file in place of the script directory")
        (self.model / "catalog.json").mkdir(parents=True)

        placement = "\n".join(self.report()["placement"])
        self.assertIn("web/lib", placement)
        self.assertIn("web/appearances/dragon-live/catalog.json", placement)

    def test_missing_reaction_and_corrupt_core_are_reported_independently(self):
        self.write_compatible_tree()
        del self.spec["FileReferences"]["Motions"]["ReactionWink"]
        self.write(self.model / "dragon.states.model3.json", json.dumps(self.spec))
        self.write(self.lib / "live2dcubismcore.min.js", " \n<!doctype html><html>404</html>")

        report = self.report()
        self.assertIn("ReactionWink", "\n".join(report["model"]))
        self.assertIn("live2dcubismcore.min.js", "\n".join(report["core"]))
        self.assertFalse(report["renderer"])

    def test_complete_fixture_passes_asset_checks_without_starting_pet(self):
        self.write_compatible_tree()
        self.assertTrue(all(not issues for issues in self.report().values()))
