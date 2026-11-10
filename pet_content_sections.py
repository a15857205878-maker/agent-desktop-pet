"""Deprecated split API; use pet_butler. No persisted mode exists."""
from pet_butler import selected as inbox_agent,visible_items as inbox_items,open_tool as legacy_tool
def current(host):return 'workstation'
def enter(host,section):
    if section not in ('workstation','legacy'):raise ValueError('未知入口')
def filter_message(host,message):return message
def notification_visible(host,agent):return agent in (inbox_agent(host),'workbench')
