"""Fixed local home-open request and expiring actual pet status. No arbitrary actions."""
from pathlib import Path
import json,math,os,re,time,uuid

def _read(path):
 try:
  if path.stat().st_size>4096:return {}
  value=json.loads(path.read_text(encoding='utf8'))
  return value if isinstance(value,dict) else {}
 except (OSError,ValueError,UnicodeError):return {}

def _write(path,value):
 tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
 try:tmp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False),encoding='utf8');os.replace(tmp,path)
 finally:tmp.unlink(missing_ok=True)

def _number(value):return type(value) in (int,float) and math.isfinite(value)
def _id(value):return isinstance(value,str) and re.fullmatch('[a-f0-9]{32}',value) is not None

def request_home(root,clock=time.time):
 root=Path(root)
 if not root.is_dir():raise ValueError('桌宠安装位置不可用。')
 now=clock();old=_read(root/'home-link.request.json')
 if _number(old.get('expires')) and 0<old['expires']-now<=15 and _id(old.get('id')):
  status=read_status(root,clock)
  if status.get('request_id')!=old['id'] or status.get('request_state') not in ('opened','failed'):raise ValueError('正在等待桌宠打开小屋，请稍后查看结果。')
 identifier=uuid.uuid4().hex
 _write(root/'home-link.request.json',dict(version=1,id=identifier,action='open-home',expires=now+15))
 return identifier

def read_status(root,clock=time.time):
 value=_read(Path(root)/'home-link.status.json');at=value.get('at');now=clock()
 if value.get('version')!=1 or not _number(at) or not 0<=now-at<7 or value.get('mode') not in ('home','desktop'):return {'connected':False,'mode':'unknown'}
 result={'connected':True,'mode':value['mode'],'visible':value.get('visible') is True,'appearance':'dragon' if value.get('appearance')=='dragon' else 'legacy','observed_at':at}
 if _id(value.get('request_id')) and value.get('request_state') in ('opened','failed'):
  result.update(request_id=value['request_id'],request_state=value['request_state'],error=str(value.get('error',''))[:160])
 return result

class HomeLink:
 def __init__(self,root,clock=time.time):
  self.root=Path(root);self.clock=clock;self.last=0;self.signature=None
  previous=_read(self.root/'home-link.status.json')
  self.seen=previous.get('request_id') if _id(previous.get('request_id')) else None
  self.result={k:previous.get(k,'') for k in ('request_id','request_state','error')} if self.seen and previous.get('request_state') in ('opened','failed') else {}
 def tick(self,host):
  now=self.clock()
  if now-self.last<.5:return
  request=_read(self.root/'home-link.request.json');identifier=request.get('id');expires=request.get('expires')
  if set(request)=={'version','id','action','expires'} and request['version']==1 and request['action']=='open-home' and _id(identifier) and identifier!=self.seen and _number(expires) and 0<expires-now<=15 and host.ready.is_set():
   # Consume before executing: uncertain failures are not replayed by the timer.
   self.seen=identifier
   try:
    host.desktop_home.enter()
    if not host.desktop_home.active:raise ValueError('小屋尚未确认打开。')
    self.result=dict(request_id=identifier,request_state='opened',error='')
   except Exception as exc:self.result=dict(request_id=identifier,request_state='failed',error=str(exc)[:160])
  value=dict(version=1,at=now,mode='home' if host.desktop_home.active else 'desktop',visible=bool(host.pet_is_visible()),appearance=getattr(host,'render_appearance','legacy'),**self.result)
  signature={k:v for k,v in value.items() if k!='at'}
  if signature!=self.signature or now-self.last>=2:
   _write(self.root/'home-link.status.json',value);self.signature=signature;self.last=now
