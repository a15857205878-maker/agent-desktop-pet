from pathlib import Path
from types import SimpleNamespace
import sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pet_floating_menu import FloatingMenu

class FloatingDispatchTests(unittest.TestCase):
    def fixture(self,fail=False):
        calls=[]
        menu=FloatingMenu.__new__(FloatingMenu)
        menu._disposed=False;menu._closing=False;menu.host=SimpleNamespace()
        def close():
            calls.append('close')
            if fail:raise RuntimeError('synthetic close failure')
        menu.menu=SimpleNamespace(Close=close)
        menu._dispatch=lambda key:calls.append(('action',key))
        return menu,calls

    def test_close_precedes_single_dispatch(self):
        menu,calls=self.fixture();menu.activate('settings')
        self.assertEqual(calls,['close',('action','settings')]);self.assertFalse(menu._closing)

    def test_failed_close_does_not_execute_business_action(self):
        menu,calls=self.fixture(True)
        with self.assertRaises(RuntimeError):menu.activate('settings')
        self.assertEqual(calls,['close']);self.assertFalse(menu._closing)

    def test_unknown_action_does_not_close_or_dispatch(self):
        menu,calls=self.fixture();menu.activate('unknown')
        self.assertEqual(calls,[])

if __name__=='__main__':unittest.main()
