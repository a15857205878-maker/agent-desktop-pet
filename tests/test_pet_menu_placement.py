from pathlib import Path
import sys,unittest
PET=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(PET))
from pet_floating_layout import floating_layout

def intersects(a,b):
    return min(a[2],b[2])>max(a[0],b[0]) and min(a[3],b[3])>max(a[1],b[1])

class PetPlacementTests(unittest.TestCase):
    def test_icon_column_is_the_edge_nearest_the_pet(self):
        for pet in [(1600,400,1850,800),(20,400,270,800)]:
            d=floating_layout((pet[0]+40,600),(0,0,1920,1080),1.5,avoid_rect=pet)
            item=d['main'][0];r=item['target'];left=d['origin'][0]+r[0];right=left+r[2]
            distance=pet[0]-right if d['side']=='left' else left-pet[2]
            self.assertLessEqual(distance,12,'hidden label reservation still separates icons and pet')
            if d['side']=='left':self.assertLess(item['label_rect'][0],r[0])
            else:self.assertGreater(item['label_rect'][0],r[0])

    def test_uses_visible_character_bounds_in_native_pixels(self):
        from pet_floating_layout import character_bounds
        self.assertEqual(character_bounds((1000,500,1300,950),(40,150,210,240)),(1040,650,1250,890))
        self.assertEqual(character_bounds((1000,500,1300,950),None),(1000,500,1300,950))

    def test_main_column_centers_on_character_instead_of_click(self):
        pet=(1400,400,1680,800)
        a=floating_layout((1450,440),(0,0,2560,1440),1,avoid_rect=pet)
        b=floating_layout((1620,750),(0,0,2560,1440),1,avoid_rect=pet)
        self.assertEqual(a['origin'],b['origin'])
        first=a['main'][0]['target'];last=a['main'][-1]['target']
        center=a['origin'][1]+(first[1]+last[1]+last[3])/2
        self.assertAlmostEqual(center,600,delta=1)

    def test_full_envelope_clears_pet_at_multiple_click_positions(self):
        for scale in [1,1.5,2]:
            for pet in [(2263,705,2551,1151),(12,300,300,746),(1100,400,1388,846),(-400,500,-112,946)]:
                area=(-1920,0,2560,1440)
                for point in [(pet[0]+30,pet[1]+30),(pet[2]-30,pet[3]-30)]:
                    d=floating_layout(point,area,scale,avoid_rect=pet)
                    self.assertFalse(intersects(d['bounds'],pet),(point,scale,d['bounds']))
                    self.assertTrue(area[0]<=d['bounds'][0]<d['bounds'][2]<=area[2])
                    self.assertTrue(area[1]<=d['bounds'][1]<d['bounds'][3]<=area[3])

    def test_moves_above_when_neither_side_has_room(self):
        pet=(260,650,540,1050);area=(0,0,800,1200)
        d=floating_layout((400,800),area,1,avoid_rect=pet)
        self.assertFalse(intersects(d['bounds'],pet))
        self.assertLess(d['bounds'][3],pet[1])

if __name__=='__main__':unittest.main()
