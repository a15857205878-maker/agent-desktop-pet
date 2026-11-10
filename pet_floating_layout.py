"""Pure geometry and action catalog for the pet's floating icon menu.

The main column is icon-only.  All branches live inside one reserved Form
envelope so the four primary targets never move while a branch opens or closes.
Nothing in this module imports CLR/WinForms.
"""
from math import ceil, isfinite

# -- action catalog ---------------------------------------------------------

MAIN_ACTIONS = (
    ('desktop_home', '小屋', 'home'),
    ('tools', '工作站', 'workbench'),
    ('interaction', '互动', 'hand'),
    ('more', '更多', 'more'),
)

INTERACTION_ACTIONS = (
    ('pat', '摸摸头', 'hand'),
    ('expression', '换表情', 'face'),
    ('motion', '随机动作', 'motion'),
)

# Default "more" layer: six small icon buttons.  "other" is a UI-only expander;
# it must never be handed to the business dispatcher.
MORE_ACTIONS = (
    ('console', '管家', 'console'),
    ('quota', '额度', 'quota'),
    ('settings', '设置', 'sliders'),
    ('other', '其他', 'grid'),
    ('hide', '隐藏', 'eye'),
    ('quit', '退出', 'power'),
)

# Second "more" layer: compact two-column text entries.
OTHER_ACTIONS = (
    ('workbench_quick', '快速下指令', 'bolt'),
    ('workbench_main', '个人工作站', 'monitor'),
    ('progress', '显示 / 隐藏进度', 'progress'),
    ('refresh', '刷新进度信息', 'refresh'),
    ('focus_agent', '切到 Agent 窗口', 'target'),
    ('agent', '切换 Agent', 'person'),
    ('reload', '重载形象', 'reload'),
    ('repaint', '重画窗口', 'brush'),
    ('app_link', '个人维护台', 'link'),
)

OTHER_KEY = 'other'
BRANCH_HEADS = frozenset(('interaction', 'more'))
BRANCH_KEYS = frozenset(('interaction', 'more', OTHER_KEY))
UI_BRANCH_KEYS = BRANCH_KEYS

# Only real business actions are dispatchable.  "other" expands the second
# layer locally and is deliberately absent from this mapping.
ACTIONS = {key: (label, icon) for key, label, icon in
           MAIN_ACTIONS + INTERACTION_ACTIONS + MORE_ACTIONS + OTHER_ACTIONS
           if key not in BRANCH_KEYS}
ALL_ACTION_KEYS = tuple(ACTIONS)
DIRECT_ACTION_KEYS = ('desktop_home', 'tools')


def action_label(key):
    return ACTIONS[key][0]


def is_branch(key):
    return key in BRANCH_KEYS


def toggle_branch(current, key):
    """Return the branch that should be open after activating *key*."""
    if key not in BRANCH_HEADS:
        return current
    return None if current == key else key


def toggle_other(branch, other_open, key):
    if branch != 'more' or key != OTHER_KEY:
        return other_open
    return not other_open


def reachable_actions():
    """All 19 fixed business keys, reachable from main/branches/other."""
    return set(ACTIONS)


# -- small geometry helpers -------------------------------------------------

def _px(value, scale):
    return max(1, int(round(float(value) * float(scale))))


def _clamp(value, low, high):
    if high < low:
        return low
    return max(low, min(high, value))


def contains_point(point, surfaces):
    """Hit-test ((x, y, w, h, radius), ...) including rounded corners."""
    if not point:
        return False
    try:
        x, y = float(point[0]), float(point[1])
    except (TypeError, ValueError, IndexError):
        return False
    for left, top, width, height, radius in surfaces:
        if not (left <= x < left + width and top <= y < top + height):
            continue
        r = max(0.0, min(float(radius), width / 2.0, height / 2.0))
        cx = min(max(x, left + r), left + width - r)
        cy = min(max(y, top + r), top + height - r)
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1e-9:
            return True
    return False


def _item_surfaces(item):
    """Exact clickable shapes for one child item (no padding)."""
    if item['kind'] == 'text':
        box = item['box']
        return ((box[0], box[1], box[2], box[3], 4.0),)
    circle = item['circle']
    label = item['label_rect']
    return ((circle[0], circle[1], circle[2], circle[3], circle[2] / 2.0),
            (label[0], label[1], label[2], label[3], 2.0))


def _settled(progress, key):
    if progress is None:
        return True
    return float(progress.get(key, 0.0)) >= 0.999


# -- layout -----------------------------------------------------------------

def character_bounds(window, rect=None):
    """Use the reported visible model bounds; they are already native pixels."""
    if rect is None:
        return window
    try:
        x, y, width, height = map(float, rect)
        if not all(isfinite(v) for v in (x, y, width, height)) or width <= 0 or height <= 0:
            return window
        left = max(window[0], window[0] + x)
        top = max(window[1], window[1] + y)
        right = min(window[2], window[0] + x + width)
        bottom = min(window[3], window[1] + y + height)
        return (left, top, right, bottom) if right > left and bottom > top else window
    except (TypeError, ValueError):
        return window


def floating_layout(anchor, area, scale=1.0, avoid_rect=None):
    """Lay out one fixed envelope containing every possible branch."""
    scale = max(1.0, min(4.0, float(scale)))
    px = lambda value: _px(value, scale)

    area_left, area_top, area_right, area_bottom = map(float, area)
    edge = px(6)
    avail_w = max(1, int(area_right - area_left) - 2 * edge)
    avail_h = max(1, int(area_bottom - area_top) - 2 * edge)

    pad = px(4)
    diameter = px(44)
    main_gap = px(10)
    inner_h = max(1, avail_h - 2 * pad)
    if 4 * diameter + 3 * main_gap > inner_h:
        main_gap = px(4)
        diameter = max(px(14), min(px(44), (inner_h - 3 * main_gap) // 4))
    main_h = 4 * diameter + 3 * main_gap

    label_width = px(68)
    label_height = px(22)
    label_gap = px(6)
    branch_gap = px(16)

    icon_d = min(px(38), max(px(24), diameter - px(6)))
    item_gap = px(6)
    cell_w = max(icon_d + px(8), px(52))
    child_label_h = px(16)
    child_label_gap = px(3)
    item_h = icon_d + child_label_gap + child_label_h
    row_gap = px(8)
    more_columns = 3
    text_width = px(116)
    text_height = px(24)
    text_gap = px(4)
    other_columns = 2

    def widths():
        return (3 * cell_w + 2 * item_gap,
                more_columns * cell_w + (more_columns - 1) * item_gap,
                other_columns * text_width + (other_columns - 1) * text_gap)

    inter_w, more_w, other_w = widths()
    max_branch_w = max(inter_w, more_w, other_w)
    width = (2 * pad + label_width + label_gap + diameter +
             branch_gap + max_branch_w)

    if width > avail_w:
        # Narrow screen: more may become 2 columns; other pieces tighten too.
        more_columns = 2
        label_width = min(label_width, px(52))
        label_gap = min(label_gap, px(4))
        branch_gap = min(branch_gap, px(12))
        cell_w = max(icon_d + px(6), min(cell_w, px(46)))
        item_gap = min(item_gap, px(6))
        text_width = min(text_width, px(92))
        text_height = min(text_height, px(24))
        text_gap = min(text_gap, px(4))
        item_h = icon_d + child_label_gap + child_label_h
        inter_w, more_w, other_w = widths()
        max_branch_w = max(inter_w, more_w, other_w)
        width = (2 * pad + label_width + label_gap + diameter +
                 branch_gap + max_branch_w)

    while width > avail_w:
        changed = False
        if text_width > px(40):
            text_width = max(px(40), text_width - px(4))
            changed = True
        elif label_width > px(28):
            label_width = max(px(28), label_width - px(2))
            changed = True
        elif cell_w > icon_d + px(4):
            cell_w = max(icon_d + px(4), cell_w - px(2))
            changed = True
        elif icon_d > px(24):
            icon_d = max(px(24), icon_d - px(2))
            cell_w = max(cell_w, icon_d + px(4))
            item_h = icon_d + child_label_gap + child_label_h
            changed = True
        elif branch_gap > px(8):
            branch_gap = px(8)
            changed = True
        elif label_gap > px(2):
            label_gap = px(2)
            changed = True
        if not changed:
            break
        inter_w, more_w, other_w = widths()
        max_branch_w = max(inter_w, more_w, other_w)
        width = (2 * pad + label_width + label_gap + diameter +
                 branch_gap + max_branch_w)

    main_top = pad
    main_centers = [main_top + index * (diameter + main_gap) + diameter / 2.0
                    for index in range(4)]
    interaction_h = item_h
    more_rows = int(ceil(len(MORE_ACTIONS) / float(more_columns)))
    more_h = more_rows * item_h + (more_rows - 1) * row_gap
    other_rows = int(ceil(len(OTHER_ACTIONS) / float(other_columns)))
    other_h = other_rows * text_height + (other_rows - 1) * text_gap

    # Short work areas: compress branch paging before the Form can outgrow the
    # screen.  This is independent of the horizontal 3->2 column fallback.
    max_content_h = max(main_h, avail_h - 2 * pad)
    while max(interaction_h, more_h, other_h) > max_content_h:
        changed = False
        if child_label_h > px(12):
            child_label_h = max(px(12), child_label_h - px(2))
            changed = True
        elif row_gap > px(2):
            row_gap = max(px(2), row_gap - px(2))
            changed = True
        elif icon_d > px(20):
            icon_d = max(px(20), icon_d - px(2))
            cell_w = max(cell_w, icon_d + px(4))
            changed = True
        elif text_height > px(18):
            text_height = max(px(18), text_height - px(2))
            changed = True
        elif text_gap > px(2):
            text_gap = max(px(2), text_gap - px(2))
            changed = True
        if not changed:
            break
        item_h = icon_d + child_label_gap + child_label_h
        interaction_h = item_h
        more_rows = int(ceil(len(MORE_ACTIONS) / float(more_columns)))
        more_h = more_rows * item_h + (more_rows - 1) * row_gap
        other_rows = int(ceil(len(OTHER_ACTIONS) / float(other_columns)))
        other_h = other_rows * text_height + (other_rows - 1) * text_gap

    # Other unfolds below the six shortcuts, never on top of them. Reserve
    # the same envelope while collapsed so the main column stays anchored.
    sub_gap = px(10)
    combined_h = more_h + sub_gap + other_h
    if combined_h > inner_h:
        factor = inner_h / float(combined_h)
        icon_d *= factor
        child_label_h *= factor
        child_label_gap *= factor
        item_h = icon_d + child_label_gap + child_label_h
        row_gap *= factor
        text_height *= factor
        text_gap *= factor
        sub_gap *= factor
        interaction_h = item_h
        more_h = more_rows * item_h + (more_rows - 1) * row_gap
        other_h = other_rows * text_height + (other_rows - 1) * text_gap
        combined_h = more_h + sub_gap + other_h
    content_h = max(main_h, interaction_h, combined_h)
    height = content_h + 2 * pad
    if height > avail_h:
        content_h = max(main_h, avail_h - 2 * pad)
        height = content_h + 2 * pad

    def top_for(center, item_height):
        return _clamp(center - item_height / 2.0,
                      pad, pad + content_h - item_height)

    inter_top = top_for(main_centers[2], interaction_h)
    more_top = top_for(main_centers[3], combined_h)
    other_top = more_top + more_h + sub_gap

    anchor_x, anchor_y = float(anchor[0]), float(anchor[1])
    mid = (area_left + area_right) / 2.0
    side = 'right' if anchor_x <= mid else 'left'
    if avoid_rect is not None:
        side = ('right' if area_right - float(avoid_rect[2]) >=
                float(avoid_rect[0]) - area_left else 'left')
    anchor_gap = px(4 if avoid_rect is not None else 14)

    def main_x_for(candidate_side):
        if candidate_side == 'right':
            return pad
        return width - pad - diameter

    def left_for(candidate_side, candidate_main_x):
        if avoid_rect is not None:
            # Keep the complete reserved envelope, including names and future
            # branches, outside the character window rather than the cursor.
            return (float(avoid_rect[2]) + anchor_gap if candidate_side == 'right'
                    else float(avoid_rect[0]) - anchor_gap - width)
        if candidate_side == 'right':
            return anchor_x + anchor_gap - candidate_main_x
        return anchor_x - anchor_gap - diameter - candidate_main_x

    main_x = main_x_for(side)
    left_candidate = left_for(side, main_x)
    fits = (left_candidate >= area_left + edge and
            left_candidate + width <= area_right - edge)
    other_side = 'left' if side == 'right' else 'right'
    other_main_x = main_x_for(other_side)
    other_left = left_for(other_side, other_main_x)
    other_fits = (other_left >= area_left + edge and
                  other_left + width <= area_right - edge)
    if not fits and other_fits:
        side = other_side
        main_x = other_main_x
        left_candidate = other_left

    origin_x = _clamp(left_candidate, area_left + edge,
                      area_right - edge - width)
    desired_y = anchor_y - (main_top + diameter / 2.0)
    if avoid_rect is not None:
        desired_y = (float(avoid_rect[1]) + float(avoid_rect[3])) / 2.0 - main_top - main_h / 2.0
    origin_y = _clamp(desired_y,
                      area_top + edge, area_bottom - edge - height)
    if avoid_rect is not None and not fits and not other_fits:
        above = float(avoid_rect[1]) - anchor_gap - height
        below = float(avoid_rect[3]) + anchor_gap
        # Narrow monitors may have no horizontal slot. Move the complete menu
        # above/below the pet when that fits, without moving the pet itself.
        if above >= area_top + edge:
            origin_y = above
        elif below + height <= area_bottom - edge:
            origin_y = below
    origin = (int(round(origin_x)), int(round(origin_y)))

    if side == 'right':
        label_x = main_x + diameter + label_gap
        branch_left = label_x + label_width + branch_gap
    else:
        label_x = main_x - label_gap - label_width
        branch_left = label_x - branch_gap - max_branch_w

    main = []
    for index, (key, label, icon) in enumerate(MAIN_ACTIONS):
        top = main_top + index * (diameter + main_gap)
        target = (main_x, top, diameter, diameter)
        label_top = top + (diameter - label_height) / 2.0
        label_rect = (label_x, label_top, label_width, label_height)
        main.append({
            'key': key, 'label': label, 'icon': icon,
            'target': target,
            'label_rect': label_rect,
            'label_text': (label_rect[0] + px(6), label_rect[1],
                           max(1, label_rect[2] - px(12)), label_rect[3]),
        })

    def icon_item(key, label, icon, cell_x, cell_y, cell_w_, circle_x):
        circle = (circle_x, cell_y, icon_d, icon_d)
        label_y = cell_y + icon_d + child_label_gap
        label_rect = (cell_x, label_y, cell_w_, child_label_h)
        return {
            'key': key, 'label': label, 'icon': icon, 'kind': 'icon',
            'circle': circle,
            'label_rect': label_rect,
            'label_text': (label_rect[0] + px(2), label_rect[1],
                           max(1, label_rect[2] - px(4)), label_rect[3]),
            'region': (cell_x, cell_y, cell_w_, item_h + px(4)),
        }

    interaction_items = []
    inter_w = 3 * cell_w + 2 * item_gap
    inter_left = branch_left if side == 'right' else branch_left + (max_branch_w - inter_w)
    for index, (key, label, icon) in enumerate(INTERACTION_ACTIONS):
        cell_x = inter_left + index * (cell_w + item_gap)
        circle_x = cell_x + (cell_w - icon_d) / 2.0
        interaction_items.append(icon_item(
            key, label, icon, cell_x, inter_top, cell_w, circle_x))

    more_items = []
    more_w = more_columns * cell_w + (more_columns - 1) * item_gap
    more_left = branch_left if side == 'right' else branch_left + (max_branch_w - more_w)
    for index, (key, label, icon) in enumerate(MORE_ACTIONS):
        column = index % more_columns
        row = index // more_columns
        cell_x = more_left + column * (cell_w + item_gap)
        cell_y = more_top + row * (item_h + row_gap)
        circle_x = cell_x + (cell_w - icon_d) / 2.0
        more_items.append(icon_item(
            key, label, icon, cell_x, cell_y, cell_w, circle_x))

    other_items = []
    other_w = other_columns * text_width + (other_columns - 1) * text_gap
    other_left = branch_left if side == 'right' else branch_left + (max_branch_w - other_w)
    for index, (key, label, icon) in enumerate(OTHER_ACTIONS):
        column = index % other_columns
        row = index // other_columns
        box = (other_left + column * (text_width + text_gap),
               other_top + row * (text_height + text_gap),
               text_width, text_height)
        other_items.append({
            'key': key, 'label': label, 'icon': icon, 'kind': 'text',
            'box': box,
            'label_rect': None,
            'label_text': (box[0] + px(8), box[1],
                           max(1, box[2] - px(16)), box[3]),
            'region': (box[0], box[1], box[2], box[3] + px(4)),
        })

    return {
        'origin': origin,
        'width': width,
        'height': height,
        'bounds': (origin[0], origin[1], origin[0] + width, origin[1] + height),
        'side': side,
        'scale': scale,
        'pad': pad,
        'diameter': diameter,
        'main_gap': main_gap,
        'label_width': label_width,
        'label_height': label_height,
        'main_background': False,
        'main': tuple(main),
        'branches': {
            'interaction': {
                'items': tuple(interaction_items),
                'width': inter_w, 'height': interaction_h, 'top': inter_top,
                'left': inter_left,
            },
            'more': {
                'items': tuple(more_items),
                'width': more_w, 'height': more_h, 'top': more_top,
                'left': more_left, 'columns': more_columns,
            },
            'other': {
                'items': tuple(other_items),
                'width': other_w, 'height': other_h, 'top': other_top,
                'left': other_left, 'columns': other_columns,
            },
        },
        'more_columns': more_columns,
        'icon_diameter': icon_d,
        'item_gap': item_gap,
        'row_gap': row_gap,
        'child_item_height': item_h,
        'text_width': text_width,
    }


def main_items(data):
    return tuple(data.get('main', ()))


def branch_items(data, branch, other_open=False):
    if branch == 'interaction':
        return tuple(data['branches']['interaction']['items'])
    if branch == 'more':
        items = tuple(data['branches']['more']['items'])
        if other_open:
            items += tuple(data['branches']['other']['items'])
        return items
    if branch == 'other':
        return tuple(data['branches']['other']['items'])
    return ()


def navigation_order(data, branch=None, other_open=False):
    keys = [item['key'] for item in data.get('main', ())]
    keys.extend(item['key'] for item in branch_items(data, branch, other_open))
    return tuple(keys)


def main_screen_rect(data, key):
    ox, oy = data['origin']
    for item in data.get('main', ()):
        if item['key'] == key:
            x, y, width, height = item['target']
            return (ox + x, oy + y, width, height)
    raise KeyError(key)


def main_item_at(point, data, margin=0.0):
    """Nearest main target within radius+margin (UI-thread proximity check)."""
    if not point:
        return None
    x, y = float(point[0]), float(point[1])
    ox, oy = data['origin']
    best = None
    best_distance = None
    for item in data.get('main', ()):
        left, top, width, height = item['target']
        cx = ox + left + width / 2.0
        cy = oy + top + height / 2.0
        limit = width / 2.0 + float(margin)
        dx, dy = x - cx, y - cy
        distance = dx * dx + dy * dy
        if distance <= limit * limit and (best_distance is None or distance < best_distance):
            best = item['key']
            best_distance = distance
    return best


def painted_surfaces(data, branch=None, other_open=False, progress=None,
                     label_key=None):
    """Region envelope for painted groups (settled and animating)."""
    surfaces = []
    for item in data.get('main', ()):
        key = item['key']
        if progress is not None and float(progress.get(key, 0.0)) <= 0.0:
            continue
        x, y, width, height = item['target']
        surfaces.append((x, y, width, height, width / 2.0))
        if label_key == key:
            rect = item['label_rect']
            surfaces.append((rect[0], rect[1], rect[2], rect[3], rect[3] / 2.0))
    for item in branch_items(data, branch, other_open):
        key = item['key']
        if progress is not None and float(progress.get(key, 0.0)) <= 0.0:
            continue
        region = item['region']
        surfaces.append((region[0], region[1], region[2], region[3], 6.0))
    return tuple(surfaces)


def hit_key_local(point, data, branch=None, other_open=False, progress=None,
                  label_key=None):
    """Dispatch hit test: only fully settled items can be activated."""
    if not point:
        return None
    if label_key:
        if _settled(progress, label_key):
            for item in data.get('main', ()):
                if item['key'] == label_key:
                    rect = item['label_rect']
                    if contains_point(point, ((rect[0], rect[1], rect[2],
                                               rect[3], rect[3] / 2.0),)):
                        return label_key
                    break
    for item in data.get('main', ()):
        if not _settled(progress, item['key']):
            continue
        rect = item['target']
        if contains_point(point, ((rect[0], rect[1], rect[2], rect[3],
                                   rect[2] / 2.0),)):
            return item['key']
    for item in branch_items(data, branch, other_open):
        if not _settled(progress, item['key']):
            continue
        if contains_point(point, _item_surfaces(item)):
            return item['key']
    return None


def item_surfaces(item):
    return _item_surfaces(item)


def screen_surfaces(data, surfaces):
    ox, oy = data['origin']
    return tuple((x + ox, y + oy, width, height, radius)
                 for x, y, width, height, radius in surfaces)


def contains_surface_point(data, point, surfaces):
    return contains_point((point[0] - data['origin'][0],
                           point[1] - data['origin'][1]), surfaces)
