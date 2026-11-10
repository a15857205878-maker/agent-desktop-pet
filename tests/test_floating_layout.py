from pathlib import Path
from types import SimpleNamespace
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def layout(anchor=(960, 540), area=(0, 0, 1920, 1080), scale=1.0):
    from pet_floating_layout import floating_layout
    return floating_layout(anchor, area, scale)


def main_rects(data):
    return [item['target'] for item in data['main']]


def item_center(rect):
    return rect[0] + rect[2] / 2.0, rect[1] + rect[3] / 2.0


class CatalogTests(unittest.TestCase):
    def test_main_entries_and_icon_only_design(self):
        from pet_floating_layout import MAIN_ACTIONS
        self.assertEqual([key for key, _label, _icon in MAIN_ACTIONS],
                         ['desktop_home', 'tools', 'interaction', 'more'])
        self.assertEqual([label for _key, label, _icon in MAIN_ACTIONS],
                         ['小屋', '工作站', '互动', '更多'])
        data = layout()
        self.assertFalse(data['main_background'])
        self.assertEqual(data['diameter'], 44)
        self.assertEqual(data['main_gap'], 10)
        self.assertLessEqual(data['label_width'], 80)

    def test_interaction_and_more_are_lightweight(self):
        from pet_floating_layout import (
            INTERACTION_ACTIONS, MORE_ACTIONS, OTHER_ACTIONS, branch_items)
        self.assertEqual([key for key, _label, _icon in INTERACTION_ACTIONS],
                         ['pat', 'expression', 'motion'])
        self.assertEqual([key for key, _label, _icon in MORE_ACTIONS],
                         ['console', 'quota', 'settings', 'other', 'hide', 'quit'])
        self.assertEqual([key for key, _label, _icon in OTHER_ACTIONS],
                         ['workbench_quick', 'workbench_main', 'progress',
                          'refresh', 'focus_agent', 'agent', 'reload',
                          'repaint', 'app_link'])
        data = layout()
        more = branch_items(data, 'more')
        self.assertEqual(len(more), 6)
        self.assertEqual(len(branch_items(data, 'more', True)), 15)
        self.assertEqual(len(branch_items(data, 'interaction')), 3)
        self.assertEqual(data['more_columns'], 3)
        self.assertEqual(data['branches']['other']['columns'], 2)

    def test_all_business_actions_remain_reachable_but_other_is_ui_only(self):
        from pet_floating_layout import ACTIONS, branch_items, reachable_actions
        expected = {
            'desktop_home', 'tools', 'pat', 'expression', 'motion',
            'console', 'quota', 'settings', 'hide', 'quit',
            'workbench_quick', 'workbench_main', 'progress', 'refresh',
            'focus_agent', 'agent', 'reload', 'repaint', 'app_link',
        }
        self.assertEqual(set(ACTIONS), expected)
        self.assertEqual(set(reachable_actions()), expected)
        self.assertNotIn('other', ACTIONS)
        data = layout()
        keys = {item['key'] for item in data['main']}
        keys |= {item['key'] for item in branch_items(data, 'interaction')}
        keys |= {item['key'] for item in branch_items(data, 'more', True)}
        self.assertEqual({key for key in keys
                          if key not in {'other', 'interaction', 'more'}},
                         expected)

    def test_app_link_label_is_personal_maintenance(self):
        from pet_floating_layout import ACTIONS
        self.assertEqual(ACTIONS['app_link'][0], '个人维护台')

    def test_other_only_expands_inside_more(self):
        from pet_floating_layout import (
            branch_items, navigation_order, toggle_other)
        self.assertTrue(toggle_other('more', False, 'other'))
        self.assertFalse(toggle_other('more', True, 'other'))
        self.assertFalse(toggle_other('interaction', False, 'other'))
        data = layout()
        closed = navigation_order(data, 'more', False)
        opened = navigation_order(data, 'more', True)
        self.assertEqual(len(opened) - len(closed), 9)
        self.assertNotIn('workbench_quick', closed)
        self.assertIn('workbench_quick', opened)
        self.assertFalse(any(item['key'] == 'workbench_quick'
                             for item in branch_items(data, 'interaction', True)))


class GeometryTests(unittest.TestCase):
    def test_four_main_targets_are_44px_with_10px_gap(self):
        data = layout()
        targets = main_rects(data)
        self.assertEqual(len(targets), 4)
        self.assertTrue(all(rect[2] == 44 and rect[3] == 44 for rect in targets))
        self.assertEqual(len({rect[0] for rect in targets}), 1)
        self.assertEqual([targets[i + 1][1] - targets[i][1] for i in range(3)],
                         [54, 54, 54])

    def test_interaction_is_three_38px_circles_in_one_row(self):
        from pet_floating_layout import branch_items
        data = layout()
        items = branch_items(data, 'interaction')
        circles = [item['circle'] for item in items]
        self.assertTrue(all(circle[2] == 38 and circle[3] == 38 for circle in circles))
        self.assertEqual(len({circle[1] for circle in circles}), 1)
        self.assertEqual([items[i + 1]['circle'][0] - items[i]['circle'][0]
                          for i in range(2)], [58, 58])
        self.assertTrue(all(item['kind'] == 'icon' for item in items))
        self.assertTrue(all(item['label_rect'][2] >= 44 for item in items))

    def test_more_is_three_columns_by_two_rows(self):
        from pet_floating_layout import branch_items
        data = layout()
        items = branch_items(data, 'more')
        rows = {item['circle'][1] for item in items}
        cols = sorted({item['circle'][0] for item in items})
        self.assertEqual(len(rows), 2)
        self.assertEqual(len(cols), 3)
        self.assertEqual(len(items), 6)

    def test_other_is_two_text_columns(self):
        from pet_floating_layout import branch_items
        data = layout()
        items = branch_items(data, 'other')
        self.assertEqual(len(items), 9)
        self.assertTrue(all(item['kind'] == 'text' for item in items))
        self.assertEqual(len({item['box'][0] for item in items}), 2)
        self.assertEqual(len({item['box'][1] for item in items}), 5)

    def test_every_branch_rect_stays_inside_the_reserved_envelope(self):
        from pet_floating_layout import branch_items
        data = layout()
        rects = list(main_rects(data))
        for branch in ('interaction', 'more', 'other'):
            for item in branch_items(data, branch, branch == 'other'):
                if 'circle' in item:
                    rects.append(item['circle'])
                    rects.append(item['label_rect'])
                else:
                    rects.append(item['box'])
        for rect in rects:
            self.assertGreaterEqual(rect[0], 0)
            self.assertGreaterEqual(rect[1], 0)
            self.assertLessEqual(rect[0] + rect[2], data['width'])
            self.assertLessEqual(rect[1] + rect[3], data['height'])

    def test_main_screen_rects_are_stable_for_the_whole_menu(self):
        from pet_floating_layout import main_screen_rect
        data = layout(anchor=(1900, 500))
        before = {key: main_screen_rect(data, key) for key in
                  ('desktop_home', 'tools', 'interaction', 'more')}
        self.assertEqual(before,
                         {key: main_screen_rect(data, key) for key in before})
        self.assertEqual(data['side'], 'left')
        for rect in before.values():
            self.assertGreaterEqual(rect[0], 0)
            self.assertLessEqual(rect[0] + rect[2], 1920)
            self.assertGreaterEqual(rect[1], 0)
            self.assertLessEqual(rect[1] + rect[3], 1080)

    def test_labels_are_outward_so_the_main_column_can_hug_the_character(self):
        data = layout(anchor=(1900, 500))
        main = data['main'][0]['target']
        label = data['main'][0]['label_rect']
        # side=left: names and branches extend left; no hidden name strip
        # separates the main column from the character on its right.
        self.assertEqual(data['side'], 'left')
        self.assertLess(label[0] + label[2], main[0])
        self.assertLessEqual(label[2], 80)

    def test_main_hover_geometry_is_state_independent(self):
        one = layout(anchor=(960, 540))
        two = layout(anchor=(960, 540))
        self.assertEqual(one, two)
        self.assertEqual(one['bounds'], two['bounds'])

    def test_negative_monitor_origin_stays_inside(self):
        area = (-1920, 0, 0, 1080)
        data = layout(anchor=(-120, 540), area=area)
        left, top, right, bottom = data['bounds']
        self.assertGreaterEqual(left, area[0])
        self.assertGreaterEqual(top, area[1])
        self.assertLessEqual(right, area[2])
        self.assertLessEqual(bottom, area[3])

    def test_screen_edges_and_side_stay_reachable(self):
        for anchor in ((1910, 540), (5, 540), (960, 3), (960, 1077)):
            data = layout(anchor=anchor)
            left, top, right, bottom = data['bounds']
            self.assertGreaterEqual(left, 0)
            self.assertGreaterEqual(top, 0)
            self.assertLessEqual(right, 1920)
            self.assertLessEqual(bottom, 1080)

    def test_small_screens_remain_reachable(self):
        for area in ((0, 0, 480, 320), (0, 0, 320, 240)):
            data = layout(anchor=(area[2] - 20, area[3] // 2), area=area)
            left, top, right, bottom = data['bounds']
            self.assertGreaterEqual(left, area[0])
            self.assertGreaterEqual(top, area[1])
            self.assertLessEqual(right, area[2])
            self.assertLessEqual(bottom, area[3])
            self.assertIn(data['more_columns'], (2, 3))
            self.assertTrue(main_rects(data))

    def test_dpi_100_150_200_scale_and_stay_inside(self):
        for scale, diameter, gap in ((1.0, 44, 10), (1.5, 66, 15), (2.0, 88, 20)):
            data = layout(anchor=(1900, 500), scale=scale)
            self.assertEqual(data['diameter'], diameter)
            self.assertEqual(data['main_gap'], gap)
            left, top, right, bottom = data['bounds']
            self.assertGreaterEqual(left, 0)
            self.assertGreaterEqual(top, 0)
            self.assertLessEqual(right, 1920)
            self.assertLessEqual(bottom, 1080)

    def test_small_screen_at_200_percent_keeps_every_region_inside(self):
        from pet_floating_layout import branch_items
        area = (0, 0, 480, 320)
        data = layout(anchor=(460, 160), area=area, scale=2.0)
        left, top, right, bottom = data['bounds']
        self.assertGreaterEqual(left, area[0])
        self.assertGreaterEqual(top, area[1])
        self.assertLessEqual(right, area[2])
        self.assertLessEqual(bottom, area[3])
        for branch in ('interaction', 'more', 'other'):
            for item in branch_items(data, branch, branch == 'other'):
                region = item['region']
                self.assertGreaterEqual(region[1], 0)
                self.assertLessEqual(region[1] + region[3], data['height'])
                self.assertGreaterEqual(region[0], 0)
                self.assertLessEqual(region[0] + region[2], data['width'])

    def test_precise_gaps_between_main_targets_do_not_hit(self):
        from pet_floating_layout import hit_key_local
        data = layout()
        targets = main_rects(data)
        for index in range(3):
            x, y, width, _height = targets[index]
            gap_point = (x + width / 2.0, y + width + data['main_gap'] / 2.0)
            self.assertIsNone(hit_key_local(gap_point, data, None, False))

    def test_unfinished_or_leaving_items_cannot_be_hit(self):
        from pet_floating_layout import branch_items, hit_key_local
        data = layout()
        item = branch_items(data, 'interaction')[0]
        point = item_center(item['circle'])
        self.assertIsNone(hit_key_local(point, data, 'interaction', False,
                                        progress={item['key']: 0.5}))
        self.assertIsNone(hit_key_local(point, data, 'interaction', False,
                                        progress={item['key']: 0.0}))
        self.assertEqual(hit_key_local(point, data, 'interaction', False,
                                       progress={item['key']: 1.0}), 'pat')
        self.assertEqual(hit_key_local(point, data, 'interaction', False), 'pat')

    def test_hit_key_maps_labels_and_other_text_rows(self):
        from pet_floating_layout import branch_items, hit_key_local
        data = layout()
        label = data['main'][0]['label_rect']
        self.assertEqual(hit_key_local((label[0] + label[2] / 2,
                                        label[1] + label[3] / 2),
                                       data, None, False,
                                       label_key='desktop_home'), 'desktop_home')
        other = branch_items(data, 'other')[0]
        point = item_center(other['box'])
        self.assertEqual(hit_key_local(point, data, 'more', True), other['key'])

    def test_window_has_no_reserved_140px_label_strip(self):
        data = layout()
        self.assertLessEqual(data['label_width'], 80)
        gap = data['main'][0]['target'][0] - (data['main'][0]['label_rect'][0] +
                                              data['main'][0]['label_rect'][2])
        self.assertLessEqual(gap, 8)

    def test_main_proximity_start_and_stop_points(self):
        from pet_floating_layout import main_item_at, main_screen_rect
        data = layout()
        rect = main_screen_rect(data, 'tools')
        cx, cy = rect[0] + rect[2] / 2.0, rect[1] + rect[3] / 2.0
        # 10 px beyond the 44 px target is still inside the near-label zone.
        self.assertEqual(main_item_at((cx + rect[2] / 2.0 + 9, cy), data, 10), 'tools')
        self.assertIsNone(main_item_at((cx + rect[2] / 2.0 + 11, cy), data, 10))


class MenuContractTests(unittest.TestCase):
    def _controller(self, menu, dispatched, branch=None):
        from pet_floating_menu import FloatingMenu
        obj = FloatingMenu.__new__(FloatingMenu)
        obj._disposed = False
        obj._visible = True
        obj._closing = False
        obj._hit_surfaces = ()
        obj._data = None
        obj._branch = branch
        obj._target_branch = branch
        obj._other_open = False
        obj.host = SimpleNamespace(_menu_close_reason='')
        obj.menu = menu
        obj._dispatch = dispatched.append
        return obj

    def test_close_failure_never_dispatches(self):
        class BrokenMenu:
            Visible = True
            IsDisposed = False
            def Close(self):
                raise RuntimeError('close failed')
        calls = []
        controller = self._controller(BrokenMenu(), calls)
        with self.assertRaises(RuntimeError):
            controller.activate('quit')
        self.assertEqual(calls, [])

    def test_close_that_does_not_close_never_dispatches(self):
        class StuckMenu:
            Visible = True
            IsDisposed = False
            def Close(self):
                pass
        calls = []
        controller = self._controller(StuckMenu(), calls)
        controller.activate('quit')
        self.assertEqual(calls, [])

    def test_close_success_then_dispatch(self):
        class ClosedMenu:
            Visible = True
            IsDisposed = False
            def Close(self):
                self.Visible = False
                self.IsDisposed = True
        calls = []
        controller = self._controller(ClosedMenu(), calls)
        controller.activate('quit')
        self.assertEqual(calls, ['quit'])


class DisposalTests(unittest.TestCase):
    def test_dispose_releases_region_timer_fonts_and_handlers(self):
        from pet_floating_menu import FloatingMenu

        class Hook:
            def __init__(self):
                self.added = []
                self.removed = []
            def __iadd__(self, handler):
                self.added.append(handler)
                return self
            def __isub__(self, handler):
                self.removed.append(handler)
                return self

        class Region:
            def __init__(self):
                self.disposed = False
            def Dispose(self):
                self.disposed = True

        class Menu:
            IsDisposed = False
            Visible = True
            def __init__(self):
                for name in ('Paint', 'MouseMove', 'MouseLeave', 'MouseDown',
                             'MouseUp', 'PreviewKeyDown', 'KeyDown',
                             'Deactivate', 'Closed'):
                    setattr(self, name, Hook())
                self._region = Region()
            @property
            def Region(self):
                return self._region
            @Region.setter
            def Region(self, value):
                self._region = value

        class Timer:
            def __init__(self):
                self.Tick = Hook()
                self.stopped = False
                self.disposed = False
            def Stop(self):
                self.stopped = True
            def Dispose(self):
                self.disposed = True

        class Disposable:
            def __init__(self):
                self.disposed = False
            def Dispose(self):
                self.disposed = True

        class Form:
            def __init__(self):
                self.FormClosed = Hook()

        menu = Menu()
        timer = Timer()
        tip = Disposable()
        font = Disposable()
        small = Disposable()
        tiny = Disposable()
        host = SimpleNamespace(form=Form(), _menu_rect=(1, 2, 3, 4))
        obj = FloatingMenu.__new__(FloatingMenu)
        obj._disposed = False
        obj._visible = True
        obj._hit_surfaces = ((0, 0, 1, 1, 0.5),)
        obj._region_signature = 'x'
        obj._timer = timer
        obj._tip = tip
        obj._font = font
        obj._small = small
        obj._tiny = tiny
        obj._hover_motion = {'x': object()}
        obj._press_motion = {'x': object()}
        obj._items = {'x': object()}
        obj._data = {'x': 1}
        obj._last_rect = (1, 2, 3, 4)
        obj.host = host
        obj.menu = menu
        obj._owner_closed = lambda sender, args: None
        obj._on_disposed(None, None)
        self.assertTrue(obj._disposed)
        self.assertFalse(obj._visible)
        self.assertEqual(obj._hit_surfaces, ())
        self.assertIsNone(obj._data)
        self.assertEqual(obj._items, {})
        self.assertFalse(obj.contains_screen_point((0, 0)))
        self.assertTrue(timer.stopped and timer.disposed)
        self.assertTrue(tip.disposed and font.disposed and small.disposed and tiny.disposed)
        self.assertEqual(menu.Region, None)
        self.assertTrue(menu._region is None)
        self.assertTrue(host._menu_rect is None)
        for hook in (menu.Paint, menu.MouseMove, menu.MouseLeave, menu.MouseDown,
                     menu.MouseUp, menu.PreviewKeyDown, menu.KeyDown,
                     menu.Deactivate, menu.Closed, timer.Tick, host.form.FormClosed):
            self.assertTrue(hook.removed, 'handler was not unbound')


class KeyboardPreviewTests(unittest.TestCase):
    def test_supported_keys_are_marked_input_and_unknown_keys_untouched(self):
        from pet_floating_menu import FloatingMenu

        class Event:
            def __init__(self, code):
                self.KeyCode = code
                self.IsInputKey = False

        for code in (0x09, 0x0D, 0x1B, 0x20, 0x23, 0x24,
                     0x25, 0x26, 0x27, 0x28):
            event = Event(code)
            FloatingMenu._preview_key(None, None, event)
            self.assertTrue(event.IsInputKey)
        for code in (0x41, 0x70, 0x00, None):
            event = Event(code)
            FloatingMenu._preview_key(None, None, event)
            self.assertFalse(event.IsInputKey)


class CardContractTests(unittest.TestCase):
    def test_required_ids_and_compact_limits_survive_markup_changes(self):
        html = (ROOT / 'web' / 'card.html').read_text(encoding='utf-8')
        css = (ROOT / 'web' / 'card.css').read_text(encoding='utf-8')
        for element_id in ('card', 'dot', 'state', 'title', 'elapsed', 'tools',
                           'tokens', 'source', 'activity', 'say'):
            self.assertIn('id="%s"' % element_id, html)
        self.assertIn('Esc', html)
        self.assertIn('body.compact .card-activity', css)
        self.assertIn('body.compact .card-say', css)
        self.assertIn('body.compact .card-row', css)
        self.assertIn('-webkit-line-clamp: 2', css)
        self.assertIn('Microsoft YaHei UI', css)


if __name__ == '__main__':
    unittest.main()
