from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class TransitionTests(unittest.TestCase):
    def test_entry_is_160ms_with_20ms_item_stagger(self):
        from pet_floating_motion import Transition
        transition = Transition(10.0, incoming=('a', 'b', 'c'),
                                in_duration=0.16, in_stagger=0.02)
        self.assertEqual(transition.progress('a', 10.0), 0.0)
        self.assertGreater(transition.progress('a', 10.08), 0.0)
        self.assertLess(transition.progress('a', 10.08), 1.0)
        self.assertAlmostEqual(transition.progress('a', 10.16), 1.0)
        self.assertAlmostEqual(transition.progress('b', 10.18), 1.0)
        self.assertAlmostEqual(transition.progress('c', 10.20), 1.0)
        self.assertTrue(transition.finished(10.20))
        self.assertFalse(transition.finished(10.19))

    def test_exit_is_short_and_reverses_progress(self):
        from pet_floating_motion import Transition
        transition = Transition(10.0, outgoing={'a': 1.0, 'b': 0.6},
                                out_duration=0.12, out_stagger=0.01)
        self.assertAlmostEqual(transition.progress('a', 10.0), 1.0)
        self.assertGreater(transition.progress('a', 10.05), 0.0)
        self.assertAlmostEqual(transition.progress('a', 10.12), 0.0)
        self.assertAlmostEqual(transition.progress('b', 10.13), 0.0)
        self.assertTrue(transition.finished(10.13))

    def test_pose_is_4px_lift_and_light_scale(self):
        from pet_floating_motion import animated_rect, pose
        down, small = pose(0.0)
        self.assertEqual((down, small), (4.0, 0.9))
        up, full = pose(1.0)
        self.assertEqual((up, full), (0.0, 1.0))
        x, y, w, h = animated_rect((10, 10, 20, 20), 0.0)
        self.assertAlmostEqual(x, 11.0)
        self.assertAlmostEqual(y, 15.0)
        self.assertAlmostEqual(w, 18.0)
        self.assertAlmostEqual(h, 18.0)

    def test_fast_switch_has_no_ghost_items(self):
        from pet_floating_motion import Transition
        first = Transition(10.0, incoming=('a', 'b'),
                           in_duration=0.16, in_stagger=0.02)
        current = {
            'a': first.progress('a', 10.05),
            'b': first.progress('b', 10.05),
        }
        second = Transition(10.05, outgoing=current, incoming=('b', 'c'),
                            out_duration=0.12, out_stagger=0.01,
                            in_duration=0.16, in_stagger=0.02)
        self.assertNotIn('b', dict(second.outgoing))
        self.assertAlmostEqual(second.progress('a', 10.05), current['a'])
        self.assertEqual(second.progress('b', 10.05), 0.0)
        self.assertTrue(second.finished(10.40))
        self.assertEqual(second.progress('a', 10.40), 0.0)
        self.assertAlmostEqual(second.progress('b', 10.40), 1.0)
        self.assertAlmostEqual(second.progress('c', 10.40), 1.0)
        self.assertEqual(second.visible(10.40), ('b', 'c'))

    def test_empty_transition_finishes_immediately(self):
        from pet_floating_motion import Transition
        transition = Transition(10.0)
        self.assertTrue(transition.finished(10.0))
        self.assertEqual(transition.visible(10.0), ())


if __name__ == '__main__':
    unittest.main()
