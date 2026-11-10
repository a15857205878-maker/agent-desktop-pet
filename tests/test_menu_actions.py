from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import importlib.util,json,sys,unittest

PET=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(PET))
import run

class HostWiringTests(unittest.TestCase):
    def test_card_hello_resends_compact_before_state(self):
        order=[]
        core=SimpleNamespace(PostWebMessageAsJson=lambda raw:order.append(json.loads(raw)))
        host=SimpleNamespace(card_compact=True,card_webview=SimpleNamespace(CoreWebView2=core),last_payload={'title':'示例'},schedule_card_update=lambda payload:order.append({'state':payload}))
        run.PetHost.on_card_message(host,None,SimpleNamespace(WebMessageAsJson='{"t":"hello"}'))
        self.assertEqual(order,[{'t':'compact','value':True},{'state':{'title':'示例'}}])

    def test_unknown_action_does_not_touch_host(self):
        from pet_menu_actions import dispatch_menu_action
        class Forbidden:
            def __getattr__(self,key):raise AssertionError('Unknown action accessed host')
        for value in ['shell','../quit',None,[],{}]:
            with self.assertRaises(ValueError):dispatch_menu_action(Forbidden(),value)

    def test_fixed_actions_reach_original_handlers(self):
        from pet_menu_actions import dispatch_menu_action
        calls=[]
        def mark(name):return lambda *args,**kwargs:calls.append((name,args,kwargs))
        host=SimpleNamespace(desktop_home=SimpleNamespace(enter=mark('home')),open_assistant_panel=mark('panel'),toggle_metric_card=mark('quota'),show_settings=mark('settings'),toggle_card=mark('progress'),refresh_card_now=mark('refresh'),user_interaction=mark('interaction'),post=mark('post'),focus_agent_window=mark('focus'),open_agent_picker=mark('agent'),reload_page=mark('reload'),repaint_now=mark('repaint'),hide_to_tray=mark('hide'),run_action=mark('run'),open_buddy_dnd=mark('dnd'),open_companion_panel=mark('quiet'))
        with patch('pet_workbench.open_entry',side_effect=mark('workbench')),patch('app_link_client.open_hub',side_effect=mark('hub')):
            for key in ['desktop_home','tools','console','quota','settings','workbench_quick','workbench_main','progress','refresh','focus_agent','agent','reload','repaint','hide','quit','app_link','pat','expression','motion']:
                before=len(calls);dispatch_menu_action(host,key);self.assertEqual(len(calls),before+1,key)
        self.assertIn(('workbench',('main',),{}),calls)
        self.assertIn(('post',({'t':'cycle-expression'},),{}),calls)
        self.assertIn(('run',('quit',),{}),calls)

if __name__=='__main__':unittest.main(verbosity=2)
