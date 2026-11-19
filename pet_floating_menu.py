"""Native owner-drawn floating icon menu for the desktop pet.

The four primary entries are icon-only and the background is genuinely
transparent (per-pixel alpha + a Region made only of visible item envelopes).
Branches expand inside one reserved Form envelope, so opening/closing them never
moves the main column.  Animation frames use small deterministic offsets/scales;
Form.Bounds is never changed by hover or animation.
"""
import time

from pet_banner_motion import Tween
from pet_floating_layout import (
    ACTIONS,
    BRANCH_HEADS,
    MAIN_ACTIONS,
    OTHER_KEY,
    branch_items,
    character_bounds,
    contains_point,
    floating_layout,
    hit_key_local,
    main_item_at,
    navigation_order,
    toggle_branch,
)
from pet_floating_motion import SETTLED, Transition, animated_rect
from pet_floating_surface import LayeredPresenter

BASE_BG = '#F8F2EA'
HOVER_BG = '#EEE4F2'
PRESSED_BG = '#E4D5EC'
INK = '#352942'
HOVER_INK = '#694D84'
FOCUS = '#8B6BB1'
TRANSPARENT_KEY = '#FCFAFE'

INPUT_KEY_CODES = frozenset((
    0x09, 0x0D, 0x1B, 0x20, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
))


def _rgb(value):
    value = str(value).lstrip('#')
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def _mix(first, second, amount):
    amount = max(0.0, min(1.0, float(amount)))
    return tuple(int(round(a + (b - a) * amount)) for a, b in zip(first, second))


BASE_RGB = _rgb(BASE_BG)
HOVER_RGB = _rgb(HOVER_BG)
PRESSED_RGB = _rgb(PRESSED_BG)
INK_RGB = _rgb(INK)
HOVER_INK_RGB = _rgb(HOVER_INK)
FOCUS_RGB = _rgb(FOCUS)
KEY_RGB = _rgb(TRANSPARENT_KEY)


class FloatingMenu:
    """Icon-only main column plus interaction / more / other branches."""

    def __init__(self, host, dispatcher):
        from System.Drawing import Color, Font
        from System.Windows.Forms import (
            AutoScaleMode,
            Cursors,
            Form,
            FormBorderStyle,
            FormStartPosition,
            Padding,
            Timer,
            ToolTip,
        )
        import pet_banner_style as style

        if callable(dispatcher):
            self._dispatch = dispatcher
        elif hasattr(dispatcher, 'dispatch'):
            self._dispatch = dispatcher.dispatch
        else:
            raise TypeError('dispatcher must be callable or expose dispatch(key)')

        self.host = host
        self._scale = max(1.0, min(4.0, float(getattr(host, 'dpi_scale', 1.0) or 1.0)))
        self.px = lambda value: max(1, int(round(float(value) * self._scale)))
        self._area = (0, 0, 1920, 1080)
        self._anchor = (0, 0)
        self._data = None
        self._items = {}
        self._main_keys = tuple(key for key, _label, _icon in MAIN_ACTIONS)
        self._target_branch = None
        self._other_open = False
        self._branch_transition = None
        self._other_transition = None
        self._main_transition = Transition(0.0)
        self._focus = self._main_keys[0]
        self._keyboard_active = False
        self._hover_key = None
        self._near_key = None
        self._pressed_key = None
        self._label_key = None
        self._last_cursor = None
        self._hover_motion = {key: Tween() for key in ACTIONS}
        self._hover_motion[OTHER_KEY] = Tween()
        self._press_motion = {key: Tween() for key in ACTIONS}
        self._press_motion[OTHER_KEY] = Tween()
        self._origin = (0, 0)
        self._hit_surfaces = ()
        self._region_signature = None
        self._visible = False
        self._disposed = False
        self._closing = False
        self._last_rect = None

        self._font = Font('Microsoft YaHei UI', 9.5)
        self._small = Font('Microsoft YaHei UI', 8.0)
        self._tiny = Font('Microsoft YaHei UI', 7.5)

        self.menu = Form()
        # Compatibility with the host's existing lost-capture ghost guard.
        self.menu.Tag = 'banner'
        self.menu.Name = 'pet-floating-menu'
        self.menu.Text = 'Agent 桌宠 · 悬浮菜单'
        self.menu.AutoSize = False
        self.menu.AutoScaleMode = getattr(AutoScaleMode, 'None')
        self.menu.FormBorderStyle = getattr(FormBorderStyle, 'None')
        self.menu.StartPosition = FormStartPosition.Manual
        self.menu.ShowInTaskbar = False
        self.menu.TopMost = True
        self.menu.MinimizeBox = False
        self.menu.MaximizeBox = False
        self.menu.KeyPreview = True
        self.menu.Padding = Padding(0)
        self.menu.BackColor = Color.FromArgb(*KEY_RGB)
        self.menu.TransparencyKey = Color.Empty
        try:
            self.menu.AllowTransparency = True
        except Exception:
            pass
        self.menu.Cursor = Cursors.Hand
        self.menu.AccessibleName = '桌宠悬浮菜单'
        self.menu.AccessibleDescription = '方向键或 Tab 选择，Enter 执行，Escape 收起'
        style.enable_double_buffer(self.menu)

        self.menu.Paint += self._paint
        self.menu.MouseMove += self._mouse_move
        self.menu.MouseLeave += self._mouse_leave
        self.menu.MouseDown += self._mouse_down
        self.menu.MouseUp += self._mouse_up
        self._bind_keyboard()
        self.menu.Deactivate += self._deactivate
        self.menu.Closed += self._closed
        self.menu.Disposed += self._on_disposed

        self._tip = ToolTip()
        self._tip.InitialDelay = 700
        self._tip.AutoPopDelay = 4000
        self._tip.ReshowDelay = 100
        self._tip.ShowAlways = True

        self._timer = Timer()
        self._timer.Interval = 16
        self._timer.Tick += self._tick

        self._owner_closed = lambda sender, args: self._dispose_menu()
        self.host.form.FormClosed += self._owner_closed
        self._presenter = LayeredPresenter(
            self.menu, self._paint,
            lambda: self._region_shapes(self._progress_map(time.monotonic())))

    # -- public interface ---------------------------------------------------

    def show_at(self, x, y):
        from System.Drawing import Point
        from System.Windows.Forms import Cursor, Screen, SystemInformation

        if self._disposed:
            return
        self._reduce_motion = not bool(SystemInformation.IsMenuAnimationEnabled)
        self._anchor = (int(round(float(x))), int(round(float(y))))
        try:
            area = Screen.FromPoint(
                Point(self._anchor[0], self._anchor[1])).WorkingArea
            self._area = (area.Left, area.Top, area.Right, area.Bottom)
        except Exception:
            self._area = (0, 0, 1920, 1080)
        pet = self.host.form
        avoid = character_bounds((pet.Left, pet.Top, pet.Right, pet.Bottom),
                                  getattr(self.host, 'char_rect', None))
        self._data = floating_layout(self._anchor, self._area, self._scale,
                                     avoid_rect=avoid)
        self._items = {}
        for item in self._data['main']:
            self._items[item['key']] = item
        for branch in ('interaction', 'more', 'other'):
            for item in self._data['branches'][branch]['items']:
                self._items[item['key']] = item
        self._target_branch = None
        self._other_open = False
        self._branch_transition = None
        self._other_transition = None
        self._focus = self._main_keys[0]
        self._keyboard_active = False
        self._hover_key = None
        self._near_key = None
        self._pressed_key = None
        self._label_key = None
        self._region_signature = None
        self._closing = False
        self._hover_motion = {key: Tween() for key in ACTIONS}
        self._hover_motion[OTHER_KEY] = Tween()
        self._press_motion = {key: Tween() for key in ACTIONS}
        self._press_motion[OTHER_KEY] = Tween()
        now = time.monotonic()
        self._main_transition = self._transition(now - .001, self._main_keys)
        self.menu.SetBounds(self._data['origin'][0], self._data['origin'][1],
                            self._data['width'], self._data['height'])
        self._origin = (self.menu.Left, self.menu.Top)
        self._sync_region(now)
        try:
            self._presenter.enable()
            self._presenter.render()
            self.menu.Show(self.host.form)
            self.menu.Activate()
        except Exception:
            pass
        if self._disposed:
            return
        try:
            self._visible = bool(self.menu.Visible)
            if not self._visible:
                return
            self._origin = (self.menu.Left, self.menu.Top)
        except Exception:
            self._visible = False
            return
        self._last_cursor = Cursor.Position
        # Show may have adjusted the owner-provided bounds; re-publish the hit
        # snapshot against the actual window origin even if the shape set is
        # unchanged.
        self._region_signature = None
        self._sync_region(now)
        self._update_menu_rect()
        self._timer.Start()
        self._redraw()

    def contains_screen_point(self, point):
        """Read-only snapshot; never touches CLR from the input hook."""
        if self._disposed or not self._visible:
            return False
        return contains_point(point, self._hit_surfaces)

    # -- time / state -------------------------------------------------------

    def _progress_map(self, now):
        progress = {}
        for key in self._main_keys:
            progress[key] = self._main_transition.progress(key, now)
        if self._branch_transition is not None:
            for key in self._items:
                if key in self._main_keys:
                    continue
                p = self._branch_transition.progress(key, now)
                if p > progress.get(key, 0.0):
                    progress[key] = p
        if self._other_transition is not None:
            for key in self._items:
                if key in self._main_keys:
                    continue
                p = self._other_transition.progress(key, now)
                if p > progress.get(key, 0.0):
                    progress[key] = p
        return progress

    def _redraw(self):
        if self._disposed:
            return
        presenter = getattr(self, '_presenter', None)
        if presenter is not None:
            presenter.render()
        else:
            self.menu.Invalidate()

    def _is_ready(self, key, now=None):
        if getattr(self, '_data', None) is None:
            return True
        now = time.monotonic() if now is None else now
        eligible = navigation_order(self._data, self._target_branch, self._other_open)
        return key in eligible and self._progress_map(now).get(key, 0.0) >= SETTLED

    def _region_shapes(self, progress):
        shapes = []
        for item in self._data['main']:
            key = item['key']
            if progress.get(key, 0.0) <= 0.0:
                continue
            x, y, width, height = item['target']
            shapes.append((x, y, width, height, width / 2.0))
            if self._label_key == key:
                rect = item['label_rect']
                shapes.append((rect[0], rect[1], rect[2], rect[3], rect[3] / 2.0))
        for key, value in progress.items():
            if key in self._main_keys or value <= 0.0:
                continue
            item = self._items.get(key)
            if item is None:
                continue
            region = item['region']
            shapes.append((region[0], region[1], region[2], region[3], 6.0))
        return tuple(shapes)

    def _sync_region(self, now):
        if self._disposed or self._data is None:
            return False
        shapes = self._region_shapes(self._progress_map(now))
        signature = tuple((round(x, 2), round(y, 2), round(w, 2),
                           round(h, 2), round(r, 2))
                          for x, y, w, h, r in shapes)
        if signature == self._region_signature:
            return False
        self._region_signature = signature
        self._apply_region(shapes)
        return True

    def _apply_region(self, shapes):
        from System.Drawing import Region
        from pet_banner_style import rounded_path
        region = Region()
        region.MakeEmpty()
        try:
            for x, y, width, height, radius in shapes:
                path = rounded_path(x, y, width, height, radius)
                try:
                    region.Union(path)
                finally:
                    path.Dispose()
            old = self.menu.Region
            self.menu.Region = region
            if old is not None:
                old.Dispose()
        except Exception:
            region.Dispose()
            raise
        ox, oy = self._origin
        self._hit_surfaces = tuple(
            (x + ox, y + oy, width, height, radius)
            for x, y, width, height, radius in shapes)

    def _update_menu_rect(self):
        if self._disposed:
            return
        try:
            bounds = self.menu.Bounds
            rect = (bounds.Left, bounds.Top, bounds.Right, bounds.Bottom)
        except Exception:
            rect = self._data['bounds'] if self._data else None
        self._last_rect = rect
        try:
            self.host._menu_rect = rect
        except Exception:
            pass

    def _tick(self, sender, event):
        if self._disposed:
            return
        if not self._visible:
            self._timer.Stop()
            return
        from System.Windows.Forms import Cursor
        if self._data is None:
            return
        now = time.monotonic()
        try:
            cursor = Cursor.Position
        except Exception:
            cursor = None
        if cursor is not None:
            if self._last_cursor is not None:
                moved = (abs(cursor.X - self._last_cursor.X) +
                         abs(cursor.Y - self._last_cursor.Y))
                if moved > 1 and self._keyboard_active:
                    self._keyboard_active = False
            self._last_cursor = cursor
            near = main_item_at((cursor.X, cursor.Y), self._data, self.px(10))
            local = (cursor.X - self._origin[0], cursor.Y - self._origin[1])
            hover = hit_key_local(
                local, self._data, self._target_branch, self._other_open,
                progress=self._progress_map(now), label_key=self._label_key)
            hover = hover or near
            if hover != self._hover_key:
                self._set_hover(hover, now)
            self._near_key = near
            desired = None
            if self._keyboard_active and self._focus in self._main_keys:
                desired = self._focus
            elif near in self._main_keys:
                desired = near
            elif hover in self._main_keys:
                # Once the small label is visible the pointer may move onto it;
                # keep it alive instead of requiring the pointer to stay within
                # the 44 px icon target.
                desired = hover
            self._update_label(desired, now)
        changed = self._sync_region(now)
        moving = not self._main_transition.finished(now)
        if self._branch_transition is not None and not self._branch_transition.finished(now):
            moving = True
        if self._other_transition is not None and not self._other_transition.finished(now):
            moving = True
        for tween in self._hover_motion.values():
            moving = moving or tween.moving(now)
        for tween in self._press_motion.values():
            moving = moving or tween.moving(now)
        if changed or moving:
            self._redraw()

    def _update_label(self, desired, now):
        """Show/switch immediately, but tolerate 120ms outside the name target."""
        if desired is not None or self._label_key is None:
            self._label_hide_at = None
        else:
            deadline = getattr(self, '_label_hide_at', None)
            if deadline is None:
                self._label_hide_at = now + 0.12
                return
            if now < deadline:
                return
            self._label_hide_at = None
        if desired != self._label_key:
            self._label_key = desired
            self._sync_region(now)
            self._redraw()

    def _set_hover(self, key, now=None):
        now = time.monotonic() if now is None else now
        old = self._hover_key
        self._hover_key = key
        if old in self._hover_motion:
            self._hover_motion[old].to(0.0, now, 0.16)
        if key in self._hover_motion:
            self._hover_motion[key].to(1.0, now, 0.16)

    def _amounts(self, key, now):
        hover = self._hover_motion.get(key)
        press = self._press_motion.get(key)
        return (hover.value(now) if hover else 0.0,
                press.value(now) if press else 0.0)

    # -- pointer / keyboard -------------------------------------------------

    def _key_at(self, point, now=None):
        if self._data is None:
            return None
        now = time.monotonic() if now is None else now
        return hit_key_local(
            point, self._data, self._target_branch, self._other_open,
            progress=self._progress_map(now), label_key=self._label_key)

    def _mouse_move(self, sender, event):
        if self._disposed:
            return
        self._keyboard_active = False
        self._redraw()

    def _mouse_leave(self, sender, event):
        # Cursor polling in _tick owns proximity/label retraction.
        pass

    def _mouse_down(self, sender, event):
        from System.Windows.Forms import MouseButtons
        if self._disposed or event.Button != MouseButtons.Left:
            return
        self._keyboard_active = False
        key = self._key_at((event.X, event.Y))
        if key is None:
            return
        self._pressed_key = key
        self._focus = key
        now = time.monotonic()
        if key in self._press_motion:
            self._press_motion[key].to(1.0, now, 0.12)
        self._redraw()

    def _mouse_up(self, sender, event):
        from System.Windows.Forms import MouseButtons
        if self._disposed or event.Button != MouseButtons.Left:
            return
        key = self._key_at((event.X, event.Y))
        pressed, self._pressed_key = self._pressed_key, None
        now = time.monotonic()
        if pressed in self._press_motion:
            self._press_motion[pressed].to(0.0, now, 0.16)
        self._redraw()
        if pressed is not None and key == pressed:
            self.activate(key)

    def _bind_keyboard(self):
        self.menu.PreviewKeyDown += self._preview_key
        self.menu.KeyDown += self._key_down

    def _unbind_keyboard(self):
        try:
            self.menu.PreviewKeyDown -= self._preview_key
        except Exception:
            pass
        try:
            self.menu.KeyDown -= self._key_down
        except Exception:
            pass

    def _preview_key(self, sender, event):
        """Mark supported navigation keys as input so KeyDown actually fires."""
        try:
            code = int(event.KeyCode)
        except (AttributeError, TypeError, ValueError):
            return
        if code in INPUT_KEY_CODES:
            event.IsInputKey = True

    def _key_down(self, sender, event):
        from System.Windows.Forms import Keys
        if self._disposed or self._data is None:
            return
        key = event.KeyCode
        handled = True
        now = time.monotonic()
        order = navigation_order(self._data, self._target_branch, self._other_open)
        if self._focus not in order:
            self._focus = order[0] if order else None
        if key == Keys.Escape:
            if self._other_open:
                self._toggle_other(now)
            elif self._target_branch is not None:
                self._switch_branch(None, self._target_branch, now, True)
            else:
                self._close_without_dispatch()
        elif key in (Keys.Enter, Keys.Space):
            if self._focus:
                self.activate(self._focus)
        elif key == Keys.Tab:
            self._cycle(-1 if event.Shift else 1)
        elif key in (Keys.Down, Keys.Up):
            self._move(1 if key == Keys.Down else -1)
        elif key == Keys.Left:
            if self._other_open:
                self._toggle_other(now)
            elif self._target_branch is not None:
                self._switch_branch(None, self._target_branch, now, True)
            else:
                handled = False
        elif key == Keys.Right:
            if self._focus in BRANCH_HEADS:
                if self._target_branch != self._focus:
                    self._switch_branch(self._focus, self._focus, now, True)
                else:
                    items = branch_items(self._data, self._target_branch, False)
                    if items:
                        self._focus = items[0]['key']
            elif self._focus == OTHER_KEY and self._target_branch == 'more':
                if not self._other_open:
                    self._toggle_other(now)
            else:
                handled = False
        elif key in (Keys.Home, Keys.End):
            if order:
                self._set_focus(order[0] if key == Keys.Home else order[-1])
        else:
            handled = False
        if handled:
            event.Handled = True
            event.SuppressKeyPress = True
            if self._disposed or not self._visible:
                return
            self._keyboard_active = True
            if self._focus in self._main_keys:
                self._label_key = self._focus
            else:
                self._label_key = None
            self._sync_region(now)
            self._redraw()

    def _set_focus(self, key):
        if self._disposed or self._data is None:
            return
        if key not in navigation_order(self._data, self._target_branch, self._other_open):
            return
        self._focus = key
        if self._keyboard_active:
            self._label_key = key if key in self._main_keys else None
            self._sync_region(time.monotonic())
            self._redraw()

    def _cycle(self, step):
        order = navigation_order(self._data, self._target_branch, self._other_open)
        if not order:
            return
        try:
            index = order.index(self._focus)
        except ValueError:
            index = 0
        self._set_focus(order[(index + step) % len(order)])

    def _move(self, step):
        order = navigation_order(self._data, self._target_branch, self._other_open)
        if not order:
            return
        main = list(self._main_keys)
        branch = [key for key in order if key not in main]
        if self._other_open and self._focus in branch:
            other_keys = [item['key'] for item in
                          self._data['branches']['other']['items']]
            if self._focus in other_keys:
                index = other_keys.index(self._focus)
                target = index + step
                if target < 0 or target >= len(other_keys):
                    self._set_focus(OTHER_KEY)
                else:
                    self._set_focus(other_keys[target])
                return
        if self._focus in BRANCH_HEADS and self._target_branch == self._focus and step > 0:
            items = branch_items(self._data, self._focus, False)
            if items:
                self._set_focus(items[0]['key'])
                return
        if self._focus in main:
            index = main.index(self._focus)
            self._set_focus(main[(index + step) % len(main)])
            return
        if branch:
            if self._focus in BRANCH_HEADS:
                self._set_focus(branch[0] if step > 0 else branch[-1])
                return
            index = branch.index(self._focus)
            self._set_focus(branch[(index + step) % len(branch)])

    def _transition(self, now, incoming, outgoing=None):
        if getattr(self, '_reduce_motion', False):
            return Transition(now - .01, incoming=incoming,
                              in_duration=.001, in_stagger=0)
        return Transition(now, outgoing=outgoing, incoming=incoming,
                          out_duration=.12, out_stagger=0,
                          in_duration=.15, in_stagger=.016)

    def _switch_branch(self, branch, focus_key, now=None, keyboard=False):
        if self._disposed:
            return
        if branch not in (None, 'interaction', 'more'):
            return
        now = time.monotonic() if now is None else now
        progress = self._progress_map(now)
        outgoing = {key: value for key, value in progress.items()
                    if key not in self._main_keys and value > 0.0}
        if branch is None:
            incoming = ()
            self._other_open = False
        elif branch == 'interaction':
            incoming = tuple(item['key'] for item in
                             self._data['branches']['interaction']['items'])
            self._other_open = False
        else:
            incoming = tuple(item['key'] for item in
                             self._data['branches']['more']['items'])
            self._other_open = False
        self._branch_transition = self._transition(now, incoming, outgoing)
        self._other_transition = None
        self._target_branch = branch
        self._pressed_key = None
        self._hover_key = None
        self._near_key = None
        if focus_key is not None:
            self._focus = focus_key
        elif branch is not None:
            self._focus = branch
        elif self._focus not in self._main_keys:
            self._focus = self._main_keys[0]
        self._keyboard_active = bool(keyboard)
        self._label_key = self._focus if (
            self._keyboard_active and self._focus in self._main_keys) else None
        self._sync_region(now)
        self._redraw()

    def _toggle_other(self, now=None):
        if self._data is None or self._target_branch != 'more':
            return
        now = time.monotonic() if now is None else now
        other_items = [item['key'] for item in
                       self._data['branches']['other']['items']]
        current = {}
        if self._other_transition is not None:
            for key in other_items:
                value = self._other_transition.progress(key, now)
                if value > 0.0:
                    current[key] = value
        if self._other_open:
            incoming = ()
            self._other_open = False
        else:
            incoming = tuple(other_items)
            self._other_open = True
        self._other_transition = self._transition(now, incoming, current)
        self._focus = OTHER_KEY
        self._label_key = None
        self._sync_region(now)
        self._redraw()

    def activate(self, key):
        if self._disposed:
            return
        if key in BRANCH_HEADS:
            if not self._is_ready(key):
                return
            self._switch_branch(toggle_branch(self._target_branch, key), key,
                                keyboard=self._keyboard_active)
            return
        if key == OTHER_KEY:
            if self._target_branch != 'more' or not self._is_ready(key):
                return
            self._toggle_other()
            if self._keyboard_active:
                self._label_key = None
                self._sync_region(time.monotonic())
            return
        if key not in ACTIONS or not self._is_ready(key):
            return
        self._close_then_dispatch(key)

    def _close_then_dispatch(self, key):
        self._closing = True
        self._visible = False
        self._hit_surfaces = ()
        try:
            self.host._menu_close_reason = '点选了悬浮菜单入口'
        except Exception:
            pass
        try:
            self.menu.Close()
        except Exception:
            self._closing = False
            self._restore_after_failed_close()
            raise
        try:
            closed = bool(self.menu.IsDisposed) or not bool(self.menu.Visible)
        except Exception:
            closed = True
        if not closed:
            self._closing = False
            self._restore_after_failed_close()
            return
        try:
            self._dispatch(key)
        finally:
            self._closing = False

    def _restore_after_failed_close(self):
        if self._disposed:
            return
        try:
            self._visible = bool(self.menu.Visible)
        except Exception:
            self._visible = False
        if self._visible:
            self._sync_region(time.monotonic())
            try:
                self._redraw()
            except Exception:
                pass

    def _close_without_dispatch(self):
        self._closing = True
        self._visible = False
        self._hit_surfaces = ()
        try:
            self.menu.Close()
        except Exception:
            self._closing = False
            self._restore_after_failed_close()
            return
        try:
            closed = bool(self.menu.IsDisposed) or not bool(self.menu.Visible)
        except Exception:
            closed = True
        if not closed:
            self._closing = False
            self._restore_after_failed_close()
            return
        self._closing = False

    def _deactivate(self, sender, event):
        if self._disposed or self._closing:
            return
        try:
            if self.menu.Visible:
                self._close_without_dispatch()
        except Exception:
            pass

    # -- paint --------------------------------------------------------------

    def _fill_round(self, graphics, rect, radius, rgb):
        from System.Drawing import Color, SolidBrush
        from pet_banner_style import rounded_path
        path = rounded_path(rect[0], rect[1], rect[2], rect[3], radius)
        brush = SolidBrush(Color.FromArgb(*rgb))
        try:
            graphics.FillPath(brush, path)
        finally:
            brush.Dispose()
            path.Dispose()

    def _porcelain(self, graphics, rect, radius, tint):
        from System.Drawing import Color, RectangleF
        from System.Drawing.Drawing2D import LinearGradientBrush, LinearGradientMode
        from pet_banner_style import rounded_path
        x, y, width, height = rect
        path = rounded_path(x, y, width, height, radius)
        bounds = RectangleF(float(x), float(y), float(width), float(height))
        top = _mix(tint, (255, 252, 245), .62)
        brush = LinearGradientBrush(bounds, Color.FromArgb(*top),
                                    Color.FromArgb(*tint), LinearGradientMode.Vertical)
        try:
            graphics.FillPath(brush, path)
        finally:
            brush.Dispose()
            path.Dispose()
        inset = max(.6, .55 * self._scale)
        self._stroke_round(graphics,
                           (x + inset, y + inset, width - 2 * inset, height - 2 * inset),
                           max(1, radius - inset), _mix(tint, INK_RGB, .22), inset)

    def _stroke_round(self, graphics, rect, radius, rgb, width):
        from System.Drawing import Color, Pen
        from pet_banner_style import rounded_path
        path = rounded_path(rect[0], rect[1], rect[2], rect[3], radius)
        pen = Pen(Color.FromArgb(*rgb), float(width))
        try:
            graphics.DrawPath(pen, path)
        finally:
            pen.Dispose()
            path.Dispose()

    def _text(self, graphics, text, font, rect, rgb=INK_RGB, align='center'):
        from System.Drawing import Color, RectangleF, SolidBrush, StringFormat, StringAlignment, StringTrimming, StringFormatFlags
        from pet_native_style import draw_text
        brush = SolidBrush(Color.FromArgb(*rgb))
        fmt = StringFormat()
        fmt.Alignment = (StringAlignment.Center if align == 'center'
                         else StringAlignment.Near)
        fmt.LineAlignment = StringAlignment.Center
        fmt.Trimming = StringTrimming.EllipsisCharacter
        fmt.FormatFlags = StringFormatFlags.NoWrap
        try:
            draw_text(graphics, str(text), font, brush,
                      RectangleF(float(rect[0]), float(rect[1]),
                                 float(max(1, rect[2])), float(max(1, rect[3]))), fmt)
        finally:
            fmt.Dispose()
            brush.Dispose()

    def _paint(self, sender, event):
        if self._disposed or self._data is None:
            return
        from System.Drawing.Drawing2D import PixelOffsetMode, SmoothingMode
        from System.Drawing.Text import TextRenderingHint
        graphics = event.Graphics
        graphics.SmoothingMode = SmoothingMode.AntiAlias
        graphics.PixelOffsetMode = PixelOffsetMode.HighQuality
        graphics.TextRenderingHint = TextRenderingHint.AntiAliasGridFit
        now = time.monotonic()
        progress = self._progress_map(now)

        # Main names: one small independent label, shown only near/focused.
        if self._label_key:
            for item in self._data['main']:
                if item['key'] != self._label_key:
                    continue
                if progress.get(item['key'], 0.0) <= 0.0:
                    break
                rect = item['label_rect']
                self._porcelain(graphics, rect, rect[3] / 2.0, BASE_RGB)
                self._text(graphics, item['label'], self._font,
                           item['label_text'], INK_RGB, 'center')
                break

        # Main column: one line icon only.  No circle fill/border/backing.
        for item in self._data['main']:
            key = item['key']
            value = progress.get(key, 0.0)
            if value <= 0.0:
                continue
            rect = animated_rect(item['target'], value)
            hover, press = self._amounts(key, now)
            rgb = _mix(INK_RGB, HOVER_INK_RGB, hover)
            scale = 1.0 if getattr(self, '_reduce_motion', False) else 1.0 + .06 * hover - .04 * press
            size = rect[2] * 0.49 * scale
            cx, cy = rect[0] + rect[2] / 2.0, rect[1] + rect[3] / 2.0
            # A centered outline keeps bare icons legible over dark wallpaper.
            self._paint_icon(graphics, item['icon'], cx, cy, size, BASE_RGB, stroke_scale=1.9)
            self._paint_icon(graphics, item['icon'], cx, cy, size, rgb)
            if self._keyboard_active and self._focus == key:
                self._stroke_round(
                    graphics, (rect[0] + 1, rect[1] + 1,
                               max(1, rect[2] - 2), max(1, rect[3] - 2)),
                    rect[2] / 2.0, FOCUS_RGB, max(1.0, self._scale * 1.2))

        # Branch items: individual small surfaces, no long strips.
        for key, value in progress.items():
            if key in self._main_keys or value <= 0.0:
                continue
            item = self._items.get(key)
            if item is None:
                continue
            hover, press = self._amounts(key, now)
            fill = _mix(BASE_RGB, HOVER_RGB, hover)
            fill = _mix(fill, PRESSED_RGB, press)
            if item['kind'] == 'text':
                box = animated_rect(item['box'], value)
                self._porcelain(graphics, box, min(box[3] / 2.0, self.px(6)), fill)
                if self._keyboard_active and self._focus == key:
                    self._stroke_round(graphics, (box[0] + 1, box[1] + 1,
                                                  max(1, box[2] - 2),
                                                  max(1, box[3] - 2)),
                                       min((box[3] - 2) / 2.0, self.px(5)),
                                       FOCUS_RGB, max(1.0, self._scale))
                self._text(graphics, item['label'], self._tiny,
                           animated_rect(item['label_text'], value),
                           INK_RGB, 'center')
                continue
            circle = animated_rect(item['circle'], value)
            label_rect = animated_rect(item['label_rect'], value)
            self._porcelain(graphics, circle, circle[2] / 2.0, fill)
            if self._keyboard_active and self._focus == key:
                self._stroke_round(graphics, (circle[0] + 1, circle[1] + 1,
                                              max(1, circle[2] - 2),
                                              max(1, circle[3] - 2)),
                                   circle[2] / 2.0, FOCUS_RGB,
                                   max(1.0, self._scale))
            icon_size = circle[2] * 0.45
            ink = _mix(INK_RGB, HOVER_INK_RGB, hover)
            self._paint_icon(graphics, item['icon'],
                             circle[0] + circle[2] / 2.0,
                             circle[1] + circle[3] / 2.0, icon_size, ink)
            self._fill_round(graphics, label_rect, label_rect[3] / 2.0, fill)
            self._text(graphics, item['label'], self._small,
                       label_rect, ink, 'center')

    def _paint_icon(self, graphics, icon, cx, cy, size, rgb=INK_RGB, *, stroke_scale=1.0):
        from System.Drawing import Color, Pen, SolidBrush
        from System.Drawing.Drawing2D import LineCap, LineJoin, SmoothingMode
        ink = Color.FromArgb(*rgb)
        stroke_width = max(1.0, size * 0.085)
        pen = Pen(ink, stroke_width * stroke_scale)
        pen.StartCap = LineCap.Round
        pen.EndCap = LineCap.Round
        pen.LineJoin = LineJoin.Round
        brush = SolidBrush(ink)
        u = size / 2.0

        def line(x1, y1, x2, y2):
            graphics.DrawLine(pen, float(cx + x1 * u), float(cy + y1 * u),
                              float(cx + x2 * u), float(cy + y2 * u))

        def dot(x, y, r):
            r += stroke_width * (stroke_scale - 1.0) / 2.0
            graphics.FillEllipse(brush, float(cx + x * u - r),
                                 float(cy + y * u - r),
                                 float(r * 2), float(r * 2))

        try:
            graphics.SmoothingMode = SmoothingMode.AntiAlias
            if icon == 'home':
                line(-0.82, -0.05, 0.0, -0.78)
                line(0.0, -0.78, 0.82, -0.05)
                line(-0.62, -0.05, -0.62, 0.76)
                line(0.62, -0.05, 0.62, 0.76)
                line(-0.62, 0.76, 0.62, 0.76)
                line(-0.18, 0.76, -0.18, 0.28)
                line(-0.18, 0.28, 0.18, 0.28)
                line(0.18, 0.28, 0.18, 0.76)
            elif icon in ('workbench', 'monitor'):
                graphics.DrawRectangle(pen, float(cx - 0.72 * u),
                                       float(cy - 0.6 * u),
                                       float(1.44 * u), float(1.0 * u))
                line(-0.28, 0.72, 0.28, 0.72)
                line(0.0, 0.4, 0.0, 0.72)
            elif icon in ('hand', 'pat'):
                line(-0.34, -0.62, -0.34, -0.08)
                line(0.0, -0.78, 0.0, -0.08)
                line(0.34, -0.62, 0.34, -0.08)
                graphics.DrawArc(pen, float(cx - 0.52 * u),
                                 float(cy - 0.16 * u),
                                 float(1.04 * u), float(0.9 * u), 0.0, 180.0)
                line(-0.52, 0.0, -0.52, 0.24)
                line(0.52, 0.0, 0.52, 0.24)
            elif icon == 'more':
                for x in (-0.56, 0.0, 0.56):
                    dot(x, 0.0, max(1.2, u * 0.18))
            elif icon == 'grid':
                for x in (-0.42, 0.42):
                    for y in (-0.42, 0.42):
                        dot(x, y, max(1.4, u * 0.17))
            elif icon == 'face':
                graphics.DrawEllipse(pen, float(cx - 0.78 * u),
                                     float(cy - 0.78 * u),
                                     float(1.56 * u), float(1.56 * u))
                dot(-0.3, -0.18, max(1.0, u * 0.1))
                dot(0.3, -0.18, max(1.0, u * 0.1))
                graphics.DrawArc(pen, float(cx - 0.38 * u),
                                 float(cy - 0.08 * u),
                                 float(0.76 * u), float(0.56 * u), 10.0, 160.0)
            elif icon == 'motion':
                points = ((0.0, -0.9), (0.22, -0.24), (0.9, 0.0),
                          (0.22, 0.24), (0.0, 0.9), (-0.22, 0.24),
                          (-0.9, 0.0), (-0.22, -0.24))
                for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
                    line(x1, y1, x2, y2)
            elif icon == 'console':
                graphics.DrawRectangle(pen, float(cx - 0.78 * u),
                                       float(cy - 0.6 * u),
                                       float(1.56 * u), float(1.0 * u))
                line(-0.3, 0.55, 0.0, 0.82)
                line(0.0, 0.82, 0.14, 0.55)
                line(-0.46, -0.22, -0.18, 0.02)
                line(-0.18, 0.02, -0.46, 0.24)
            elif icon == 'quota':
                graphics.DrawEllipse(pen, float(cx - 0.78 * u),
                                     float(cy - 0.78 * u),
                                     float(1.56 * u), float(1.56 * u))
                line(0.0, 0.0, 0.48, -0.42)
                dot(0.0, 0.0, max(1.0, u * 0.09))
            elif icon == 'sliders':
                for y, knob in ((-0.55, -0.22), (0.0, 0.34), (0.55, -0.05)):
                    line(-0.78, y, 0.78, y)
                    dot(knob, y, max(1.2, u * 0.13))
            elif icon == 'bolt':
                line(0.12, -0.9, -0.5, 0.06)
                line(-0.5, 0.06, 0.02, 0.06)
                line(0.02, 0.06, -0.12, 0.9)
                line(-0.12, 0.9, 0.58, -0.1)
                line(0.58, -0.1, 0.06, -0.1)
                line(0.06, -0.1, 0.12, -0.9)
            elif icon == 'progress':
                line(-0.78, -0.52, 0.28, -0.52)
                line(-0.78, 0.0, 0.72, 0.0)
                line(-0.78, 0.52, 0.02, 0.52)
            elif icon in ('refresh', 'reload'):
                graphics.DrawArc(pen, float(cx - 0.62 * u),
                                 float(cy - 0.62 * u),
                                 float(1.24 * u), float(1.24 * u), 35.0, 285.0)
                line(0.52, -0.72, 0.74, -0.18)
                line(0.52, -0.72, 0.04, -0.56)
            elif icon == 'target':
                graphics.DrawEllipse(pen, float(cx - 0.78 * u),
                                     float(cy - 0.78 * u),
                                     float(1.56 * u), float(1.56 * u))
                graphics.DrawEllipse(pen, float(cx - 0.28 * u),
                                     float(cy - 0.28 * u),
                                     float(0.56 * u), float(0.56 * u))
                line(-0.95, 0.0, -0.62, 0.0)
                line(0.62, 0.0, 0.95, 0.0)
                line(0.0, -0.95, 0.0, -0.62)
                line(0.0, 0.62, 0.0, 0.95)
            elif icon == 'person':
                graphics.DrawEllipse(pen, float(cx - 0.3 * u),
                                     float(cy - 0.82 * u),
                                     float(0.6 * u), float(0.6 * u))
                graphics.DrawArc(pen, float(cx - 0.7 * u),
                                 float(cy - 0.08 * u),
                                 float(1.4 * u), float(1.2 * u), 195.0, 150.0)
            elif icon == 'brush':
                line(-0.62, 0.64, 0.38, -0.38)
                line(0.18, -0.68, 0.7, -0.16)
                line(0.38, -0.38, 0.7, -0.16)
                line(-0.62, 0.64, -0.22, 0.5)
                line(-0.62, 0.64, -0.5, 0.22)
            elif icon == 'eye':
                graphics.DrawArc(pen, float(cx - 0.84 * u),
                                 float(cy - 0.48 * u),
                                 float(1.68 * u), float(1.12 * u), 200.0, 140.0)
                graphics.DrawArc(pen, float(cx - 0.84 * u),
                                 float(cy - 0.48 * u),
                                 float(1.68 * u), float(1.12 * u), 20.0, 140.0)
                dot(0.0, 0.0, max(1.2, u * 0.15))
                line(-0.78, 0.72, 0.78, -0.72)
            elif icon == 'power':
                graphics.DrawArc(pen, float(cx - 0.66 * u),
                                 float(cy - 0.66 * u),
                                 float(1.32 * u), float(1.32 * u), -55.0, 290.0)
                line(0.0, -0.9, 0.0, 0.02)
            elif icon == 'link':
                graphics.DrawArc(pen, float(cx - 0.84 * u),
                                 float(cy - 0.42 * u),
                                 float(0.86 * u), float(0.84 * u), 40.0, 260.0)
                graphics.DrawArc(pen, float(cx - 0.02 * u),
                                 float(cy - 0.42 * u),
                                 float(0.86 * u), float(0.84 * u), 220.0, 260.0)
                line(-0.28, 0.0, 0.28, 0.0)
            else:
                dot(0.0, 0.0, max(2.0, u * 0.22))
        finally:
            brush.Dispose()
            pen.Dispose()

    # -- lifetime -----------------------------------------------------------

    def _closed(self, sender, event):
        self._visible = False
        self._hit_surfaces = ()
        rect = self._last_rect
        if rect is not None and getattr(self.host, '_menu_rect', None) == rect:
            try:
                self.host._menu_rect = None
            except Exception:
                pass

    def _dispose_menu(self):
        if self._disposed:
            return
        try:
            self.menu.Dispose()
        except Exception:
            pass

    def _on_disposed(self, sender, event):
        if self._disposed:
            return
        self._disposed = True
        self._visible = False
        presenter = getattr(self, "_presenter", None)
        if presenter is not None:
            presenter.dispose()
            self._presenter = None
        self._hit_surfaces = ()
        self._region_signature = None
        try:
            self._timer.Stop()
            self._timer.Tick -= self._tick
            self._timer.Dispose()
        except Exception:
            pass
        try:
            self.host.form.FormClosed -= self._owner_closed
        except Exception:
            pass
        self._unbind_keyboard()
        try:
            self.menu.Paint -= self._paint
        except Exception:
            pass
        try:
            self.menu.MouseMove -= self._mouse_move
        except Exception:
            pass
        try:
            self.menu.MouseLeave -= self._mouse_leave
        except Exception:
            pass
        try:
            self.menu.MouseDown -= self._mouse_down
        except Exception:
            pass
        try:
            self.menu.MouseUp -= self._mouse_up
        except Exception:
            pass
        try:
            self.menu.Deactivate -= self._deactivate
        except Exception:
            pass
        try:
            self.menu.Closed -= self._closed
        except Exception:
            pass
        try:
            region = self.menu.Region
            self.menu.Region = None
            if region is not None:
                region.Dispose()
        except Exception:
            pass
        try:
            self._tip.Dispose()
        except Exception:
            pass
        try:
            self._font.Dispose()
            self._small.Dispose()
            self._tiny.Dispose()
        except Exception:
            pass
        self._hover_motion.clear()
        self._press_motion.clear()
        self._items.clear()
        self._data = None
        rect = self._last_rect
        if rect is not None and getattr(self.host, '_menu_rect', None) == rect:
            try:
                self.host._menu_rect = None
            except Exception:
                pass
