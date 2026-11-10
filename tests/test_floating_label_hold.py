from pathlib import Path
from types import SimpleNamespace
import sys,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pet_floating_menu import FloatingMenu

class LabelHoldTests(unittest.TestCase):
    def menu(self,label=None):
        c=FloatingMenu.__new__(FloatingMenu);c._label_key=label;c._label_hide_at=None
        c._sync_region=lambda now:None;c._redraw=lambda:None
        return c

    def test_show_is_immediate(self):
        c=self.menu();c._update_label('tools',10)
        self.assertEqual(c._label_key,'tools')

    def test_hides_only_after_120ms_outside(self):
        c=self.menu('tools');c._update_label(None,10);c._update_label(None,10.119)
        self.assertEqual(c._label_key,'tools')
        c._update_label(None,10.121);self.assertIsNone(c._label_key)

    def test_returning_to_label_cancels_pending_hide(self):
        c=self.menu('tools');c._update_label(None,10);c._update_label('tools',10.05)
        c._update_label(None,10.15);self.assertEqual(c._label_key,'tools')
        c._update_label(None,10.271);self.assertIsNone(c._label_key)

    def test_switching_icon_immediately_replaces_old_label(self):
        c=self.menu('tools');c._update_label(None,10);c._update_label('more',10.05)
        self.assertEqual(c._label_key,'more');self.assertIsNone(c._label_hide_at)

if __name__=='__main__':unittest.main()
