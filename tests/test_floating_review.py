from pathlib import Path
import sys,unittest
PET=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(PET))
from pet_floating_layout import floating_layout,branch_items,MAIN_ACTIONS
from pet_floating_motion import Transition
from pet_floating_menu import FloatingMenu

def overlap(a,b):return min(a[0]+a[2],b[0]+b[2])>max(a[0],b[0]) and min(a[1]+a[3],b[1]+b[3])>max(a[1],b[1])

class ReviewRegressions(unittest.TestCase):
    def test_more_and_other_can_remain_visible_without_overlapping(self):
        d=floating_layout((600,300),(0,0,1920,1080),1.0)
        circles=d['branches']['more']['items'];text=d['branches']['other']['items']
        self.assertFalse(any(overlap(a['region'],b['region']) for a in circles for b in text),'other covers the more icons')

    def test_outgoing_action_is_ineligible_from_first_exit_frame(self):
        c=FloatingMenu.__new__(FloatingMenu);c._data=floating_layout((600,300),(0,0,1920,1080));c._main_keys=tuple(x[0] for x in MAIN_ACTIONS)
        c._main_transition=Transition(0,incoming=c._main_keys);c._items={i['key']:i for branch in ['interaction','more','other'] for i in branch_items(c._data,branch)}
        c._branch_transition=Transition(10,outgoing={'pat':1},incoming=tuple(i['key'] for i in branch_items(c._data,'more')));c._other_transition=None;c._target_branch='more';c._other_open=False
        self.assertFalse(c._is_ready('pat',10),'outgoing action still executes before progress drops')

if __name__=='__main__':unittest.main()
