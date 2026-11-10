"""No GUI, live accounts, network or user installation is used."""
from pathlib import Path
import importlib,json,os,sys,tempfile,unittest
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

class ReleaseTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.old=os.environ.get('AGENT_PET_DATA_DIR');os.environ['AGENT_PET_DATA_DIR']=str(self.root/'profile')
 def tearDown(self):
  if self.old is None:os.environ.pop('AGENT_PET_DATA_DIR',None)
  else:os.environ['AGENT_PET_DATA_DIR']=self.old
  self.tmp.cleanup()
 def test_paths_reject_source_and_relative_and_have_profile_mutex(self):
  import pet_paths as p
  self.assertEqual(p.data_dir(),self.root/'profile');first=p.mutex_name()
  os.environ['AGENT_PET_DATA_DIR']=str(self.root/'other');self.assertNotEqual(first,p.mutex_name())
  for bad in [str(p.SOURCE_DIR),str(p.SOURCE_DIR/'data'),str(p.SOURCE_DIR.parent),'relative']:
   os.environ['AGENT_PET_DATA_DIR']=bad
   with self.assertRaises(ValueError):p.data_dir()
 def test_settings_and_empty_scores_only_write_test_profile(self):
  import settings_store,pet_room_games
  settings_store=importlib.reload(settings_store)
  settings_store.save(dict(settings_store.DEFAULTS));self.assertTrue((self.root/'profile/pet_settings.json').is_file())
  self.assertEqual(pet_room_games.load_scores(self.root/'profile')['memory']['plays'],0)
  pet_room_games.record_result(self.root/'profile',12,3000)
  self.assertEqual(pet_room_games.load_scores(self.root/'profile')['memory']['plays'],1)
 def test_home_link_and_activity_expire_and_do_not_replay(self):
  from pet_home_link import HomeLink,request_home,read_status
  from pet_auto_life import public_activity
  now=[100.];clock=lambda:now[0];self.root.mkdir(exist_ok=True)
  count=[];home=SimpleNamespace(active=False)
  def enter():count.append(1);home.active=True
  home.enter=enter
  host=SimpleNamespace(ready=SimpleNamespace(is_set=lambda:True),desktop_home=home,pet_is_visible=lambda:True)
  identifier=request_home(self.root,clock);link=HomeLink(self.root,clock);link.tick(host)
  self.assertEqual(read_status(self.root,clock)['request_id'],identifier)
  now[0]=103.;link.tick(host);self.assertEqual(len(count),1)
  now[0]=111.;self.assertFalse(read_status(self.root,clock)['connected'])
  value=dict(available=True,scene='room',pose='back',phase='stable',observed_at=100.,changed_at=100.)
  self.assertTrue(public_activity(value,110.)['available']);self.assertFalse(public_activity(value,113.)['available'])
 def test_workstation_fake_transport_has_no_model_or_real_owner(self):
  from pet_workstation import WorkstationClient
  seen=[]
  def transport(method,payload,route='/assistant'):
   seen.append((method,route));return {'version':1,'navigation_ready':True,'counts':{}} if method=='GET' else {'fixture':True}
  c=WorkstationClient(transport=transport,opener=lambda:None,background_opener=lambda:None)
  self.assertEqual(c.town({'action':'bootstrap','payload':{}}),{'fixture':True});self.assertEqual(seen,[('GET','/assistant'),('POST','/room-town')])
 def test_balance_default_and_missing_optional_owner(self):
  from pet_companion_config import CompanionStore
  from pet_workbench import workbench_root
  self.assertEqual(CompanionStore(self.root).load()['metricMode'],'off')
  with self.assertRaises((OSError,ValueError)):workbench_root()

if __name__=='__main__':unittest.main()
