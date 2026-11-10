"""Local butler policy; no GUI, rendering SDK or upstream scanner imports."""
import re

def selected(host):
    value=getattr(host,'settings',{}).get('agent','codex')
    return value if isinstance(value,str) and re.fullmatch(r'[a-z0-9_-]{1,40}',value) else 'codex'

def scopes(host,data=None):
    agent=selected(host)
    if data is not None and data.get('agent',agent)!=agent:raise ValueError('Agent已切换，请刷新后重试。')
    return tuple(dict.fromkeys((agent,'workbench')))

def visible_items(host,items):
    allowed=scopes(host)
    return [item for item in items if item.get('agent','codex') in allowed]

def read_scope(host,data,items):
    allowed=scopes(host,data)
    item=next((item for item in items if item.get('id')==data.get('id') and item.get('agent','codex') in allowed),None)
    if item is None:raise ValueError('提醒不属于当前可见来源。')
    return item.get('agent','codex')

def open_tool(host,key):
    actions={'progress':'toggle_card','refresh':'refresh_card_now','quota':'toggle_metric_card','agent':'open_agent_picker','focus_agent':'focus_agent_window','settings':'show_settings'}
    if key not in actions:raise ValueError('未知管家工具')
    return getattr(host,actions[key])()
