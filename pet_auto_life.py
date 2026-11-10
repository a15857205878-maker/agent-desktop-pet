"""Idle-only room life state. Fixed local metadata; no screen capture or business writes."""
from pathlib import Path
import json,math,time,ctypes
from urllib.parse import urlsplit
from pet_home_link import _read,_write

SCENES=frozenset(('room','home','plaza','orchard','desktop'))
POSES=frozenset(('back','turn','relax','rest','front','sit'))
PHASES=frozenset(('stable','switching','paused'))

def windows_idle_seconds():
 # GetLastInputInfo is scoped to the current Windows session (Microsoft Learn).
 class LastInput(ctypes.Structure):_fields_=[('cbSize',ctypes.c_uint32),('dwTime',ctypes.c_uint32)]
 value=LastInput();value.cbSize=ctypes.sizeof(value)
 try:
  if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(value)):return None
  ms=(ctypes.windll.kernel32.GetTickCount()-value.dwTime)&0xffffffff
  return ms/1000 if ms<=86400000 else None
 except (OSError,AttributeError):return None

def public_activity(value,now=None):
 now=time.time() if now is None else now;at=value.get('observed_at') if isinstance(value,dict) else None
 if not isinstance(value,dict) or value.get('available') is not True or type(at) not in (int,float) or not math.isfinite(at) or not 0<=now-at<=12:return {'available':False}
 if value.get('scene') not in SCENES or value.get('pose') not in POSES or value.get('phase') not in PHASES:return {'available':False}
 changed=value.get('changed_at');changed=changed if type(changed) in (int,float) and math.isfinite(changed) and 0<=changed<=at else at
 return dict(available=True,scene=value['scene'],pose=value['pose'],night=value.get('night') is True,automatic=value.get('automatic') is True,held=value.get('held') is True,phase=value['phase'],observed_at=at,changed_at=changed)

def read_activity(root,now=None):return public_activity(_read(Path(root)/'pet-activity.status.json'),now)

class AutoLife:
 def __init__(self,root,clock=time.time,idle=windows_idle_seconds):
  self.root=Path(root);self.clock=clock;self.idle=idle;self.last_tick=0;self.last_report=0;self.report=None;self.signature=None;self.changed_at=0
  c=_read(self.root/'pet-life-settings.json');self.enabled=c.get('enabled',True) is True;self.held=c.get('held',False) is True
 def receive(self,host,value,source):
  u=urlsplit(str(source));home=host.desktop_home
  if not home.active or u.scheme!='http' or u.hostname!='127.0.0.1' or u.port!=host.port or u.path!='/index.html' or u.query or u.fragment:return False
  if value.get('t')=='home-life-config':
   if set(value)!={'t','enabled','held'} or any(type(value[k]) is not bool for k in ('enabled','held')):raise ValueError('Invalid life options')
   _write(self.root/'pet-life-settings.json',dict(enabled=value['enabled'],held=value['held']))
   self.enabled=value['enabled'];self.held=value['held'];self.last_tick=0;return True
  if value.get('t')!='home-life-report' or set(value)!={'t','scene','pose','night','automatic','phase'}:raise ValueError('Invalid life report')
  if value['scene'] not in SCENES-{'desktop'} or value['pose'] not in POSES or value['phase'] not in PHASES or any(type(value[k]) is not bool for k in ('night','automatic')):raise ValueError('Invalid life fields')
  self.last_report=self.clock();self.report={k:v for k,v in value.items() if k!='t'};return True
 def tick(self,host):
  now=self.clock()
  if now-self.last_tick<2:return
  self.last_tick=now;idle=self.idle();idle=idle if type(idle) in (int,float) and math.isfinite(idle) and 0<=idle<=86400 else None
  host.post(dict(t='home-life-state',enabled=self.enabled,held=self.held,idle_seconds=idle))
  if not host.desktop_home.active:
   value=dict(scene='desktop',pose='front',night=False,automatic=False,phase='paused')
  elif self.report is not None and 0<=now-self.last_report<=12:value=dict(self.report)
  else:
   _write(self.root/'pet-activity.status.json',{'available':False});return
  value['held']=self.held;signature=tuple(value.items())
  observed=self.last_report if host.desktop_home.active else now
  if signature!=self.signature:self.changed_at=observed;self.signature=signature
  value.update(available=True,observed_at=observed,changed_at=self.changed_at)
  _write(self.root/'pet-activity.status.json',value)
