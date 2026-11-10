"""Deterministic native-menu motion; all sampling is driven by caller time.

No timer, sleep, WinForms or GDI object lives here.  A Transition is a small
value object so tests can sample exact frames and the menu can cancel/replace a
transition on rapid branch switches without leaving ghost items behind.
"""

SETTLED = 0.999


def clamp01(value):
    return max(0.0, min(1.0, float(value)))


def ease(value):
    """Smoothstep: gentle start/end for a 4 px / 160 ms move."""
    t = clamp01(value)
    return t * t * (3.0 - 2.0 * t)


def pose(progress, lift=4.0, scale_from=0.9):
    """Return (downward offset, scale) for one item's entry/exit frame."""
    p = clamp01(progress)
    scale = float(scale_from) + (1.0 - float(scale_from)) * p
    offset = (1.0 - p) * float(lift)
    return offset, scale


def animated_rect(rect, progress, lift=4.0, scale_from=0.9):
    """Scale around the item centre and shift it down by ``lift`` at p=0."""
    x, y, width, height = rect
    offset, scale = pose(progress, lift, scale_from)
    new_width = float(width) * scale
    new_height = float(height) * scale
    return (float(x) + (float(width) - new_width) / 2.0,
            float(y) + (float(height) - new_height) / 2.0 + offset,
            new_width, new_height)


class Transition:
    """One outgoing group followed by one incoming group.

    ``outgoing`` is a mapping ``key -> current visible progress`` (0..1), so a
    transition interrupted halfway can continue from the pixels currently on
    screen.  Keys that are also incoming are dropped from the outgoing set,
    which prevents duplicate/ghost items on rapid A->B->A switches.
    """

    def __init__(self, now, outgoing=None, incoming=(),
                 out_duration=0.12, out_stagger=0.01,
                 in_duration=0.16, in_stagger=0.02):
        self.start = float(now)
        self.out_duration = max(0.001, float(out_duration))
        self.out_stagger = max(0.0, float(out_stagger))
        self.in_duration = max(0.001, float(in_duration))
        self.in_stagger = max(0.0, float(in_stagger))
        incoming_keys = tuple(dict.fromkeys(str(key) for key in incoming))
        incoming_set = set(incoming_keys)
        outgoing_items = []
        for key, progress in (outgoing or {}).items():
            key = str(key)
            value = clamp01(progress)
            if value <= 0.0 or key in incoming_set:
                continue
            outgoing_items.append((key, value))
        self.outgoing = tuple(outgoing_items)
        self.incoming = incoming_keys
        self.out_end = (self.start
                        + (self.out_duration + self.out_stagger *
                           max(0, len(self.outgoing) - 1))
                        if self.outgoing else self.start)
        self.in_start = self.out_end
        self.in_end = (self.in_start
                       + (self.in_duration + self.in_stagger *
                          max(0, len(self.incoming) - 1))
                       if self.incoming else self.in_start)

    def outgoing_progress(self, key, now):
        for index, (candidate, initial) in enumerate(self.outgoing):
            if candidate != key:
                continue
            start = self.start + index * self.out_stagger
            t = (float(now) - start) / self.out_duration
            return initial * (1.0 - ease(t))
        return 0.0

    def incoming_progress(self, key, now):
        for index, candidate in enumerate(self.incoming):
            if candidate != key:
                continue
            start = self.in_start + index * self.in_stagger
            t = (float(now) - start) / self.in_duration
            return ease(t)
        return 0.0

    def progress(self, key, now):
        key = str(key)
        if key in self.incoming:
            return self.incoming_progress(key, now)
        return self.outgoing_progress(key, now)

    def visible(self, now):
        keys = []
        for key, _initial in self.outgoing:
            if self.outgoing_progress(key, now) > 0.0:
                keys.append(key)
        for key in self.incoming:
            if self.incoming_progress(key, now) > 0.0:
                keys.append(key)
        return tuple(keys)

    def out_finished(self, now):
        return float(now) >= self.out_end

    def in_started(self, now):
        return bool(self.incoming) and float(now) >= self.in_start

    def finished(self, now):
        return float(now) >= self.in_end

    def phase(self, now):
        now = float(now)
        if now >= self.in_end:
            return 'done'
        if self.incoming and now >= self.in_start:
            return 'in'
        if self.outgoing and now < self.out_end:
            return 'out'
        return 'done'
