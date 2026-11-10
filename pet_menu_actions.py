"""Fixed existing pet actions for native menus. No arbitrary commands or paths."""
from pathlib import Path

ACTION_KEYS = frozenset((
    'desktop_home','tools','console','inbox','dnd','buddy','quota','settings',
    'workbench_quick','workbench_main','progress','refresh','pat','expression',
    'motion','reminders','quiet','focus_agent','agent','reload','repaint',
    'hide','quit','app_link',
))


def dispatch_menu_action(host, key):
    if not isinstance(key, str) or key not in ACTION_KEYS:
        raise ValueError('未知桌宠操作')
    actions = {
        'desktop_home': lambda: host.desktop_home.enter(),
        'tools': lambda: __import__('pet_workbench').open_entry('main'),
        'workbench_main': lambda: __import__('pet_workbench').open_entry('main'),
        'workbench_quick': lambda: __import__('pet_workbench').open_entry('quick'),
        'console': lambda: host.open_assistant_panel('control'),
        'inbox': lambda: host.open_assistant_panel('inbox'),
        'buddy': lambda: host.open_assistant_panel('buddy'),
        'reminders': lambda: host.open_assistant_panel('reminders'),
        'dnd': lambda: host.open_buddy_dnd(),
        'quiet': lambda: host.open_companion_panel(),
        'quota': lambda: host.toggle_metric_card(),
        'settings': lambda: host.show_settings(),
        'progress': lambda: host.toggle_card(),
        'refresh': lambda: host.refresh_card_now(),
        'pat': lambda: host.user_interaction('pat'),
        'expression': lambda: host.post({'t': 'cycle-expression'}),
        'motion': lambda: host.post({'t': 'react', 'kind': 'motion'}),
        'focus_agent': lambda: host.focus_agent_window(),
        'agent': lambda: host.open_agent_picker(),
        'reload': lambda: host.reload_page(),
        'repaint': lambda: host.repaint_now(),
        'hide': lambda: host.hide_to_tray(),
        'quit': lambda: host.run_action('quit'),
        'app_link': lambda: __import__('app_link_client').open_hub(Path(__file__).resolve().parent),
    }
    return actions[key]()
