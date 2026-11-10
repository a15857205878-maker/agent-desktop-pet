from pathlib import Path
from types import SimpleNamespace
import sys,tempfile,unittest,json
P=Path(__file__).resolve().parents[1];sys.path.insert(0,str(P))

class HomeTests(unittest.TestCase):
 def test_geometry_snapshot_restores_without_persisting_room_mode(self):
  from pet_desktop_home import HomeState
  value=HomeState();self.assertFalse(value.active)
  value.enter((100,200,420,550),True,.8)
  with self.assertRaises(ValueError):value.enter((0,0,800,600),False,1)
  self.assertEqual(value.leave()['bounds'],(100,200,420,550));self.assertFalse(value.active);self.assertIsNone(value.leave())
 def test_only_fixed_local_assets_and_actions_are_accepted(self):
  from pet_desktop_home import validate_message,validate_layers
  self.assertEqual(validate_message({'t':'home-action','action':'close'}),'close')
  for msg in [{'t':'home-action','action':'exec'},{'t':'home-action','action':'close','path':'x'},{'t':'home-action','action':'open','url':'https://example.com'}]:
   with self.assertRaises(ValueError):validate_message(msg)
  self.assertTrue(validate_layers({'version':1,'width':1200,'height':800,'actor':{'centerX':.3,'bottom':.6,'height':.31}}))
  with self.assertRaises(ValueError):validate_layers({'version':1,'width':1200,'height':800,'actor':{'centerX':float('nan'),'bottom':.6,'height':.31}})
 def test_room_menu_entry_is_unique_and_preserves_old_actions(self):
  from pet_banner_model import MORE
  self.assertEqual(sum(k=='desktop_home' for k,_ in MORE),1)
  self.assertTrue({'quit','hide','workbench_main','reload'}<={k for k,_ in MORE})

if __name__=='__main__':unittest.main()
