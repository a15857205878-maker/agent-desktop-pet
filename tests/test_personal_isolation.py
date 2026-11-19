"""Catch old settings switching the personal app back to the original character."""
from pathlib import Path
import importlib.util,json,tempfile,unittest

ROOT=Path(__file__).resolve().parents[1]

class PersonalSettingsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        spec=importlib.util.spec_from_file_location('personal_settings',ROOT/'settings_store.py')
        self.store=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.store)
        self.store.SETTINGS_FILE=str(Path(self.tmp.name)/'pet_settings.json')
    def tearDown(self): self.tmp.cleanup()
    def test_first_launch_is_dragon_with_supported_interrupted_expression(self):
        cfg=self.store.load()
        self.assertEqual(cfg['petAppearance'],'dragon')
        self.assertEqual(cfg['expressions']['interrupted'],'悲伤')
    def test_old_legacy_preference_cannot_load_original_character(self):
        Path(self.store.SETTINGS_FILE).write_text(json.dumps({'petAppearance':'legacy','scale':0.72}),encoding='utf-8')
        cfg=self.store.load()
        self.assertEqual(cfg['petAppearance'],'dragon');self.assertEqual(cfg['scale'],0.72)
    def test_save_cannot_reintroduce_original_character(self):
        cfg=self.store.save({'petAppearance':'legacy','scale':0.8})
        self.assertEqual(cfg['petAppearance'],'dragon')
        self.assertEqual(json.loads(Path(self.store.SETTINGS_FILE).read_text(encoding='utf-8'))['petAppearance'],'dragon')

if __name__=='__main__': unittest.main()
