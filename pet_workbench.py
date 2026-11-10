"""Explicit local workbench entry points and idempotent reminder ingestion; no model APIs."""
from pathlib import Path
import json,os,re,subprocess,threading,time
HERE=Path(__file__).resolve().parent

def workbench_root():
    from pet_paths import data_dir
    p=data_dir()/'workbench_link.json'
    if p.stat().st_size>4096:raise ValueError('工作台入口配置无效。')
    root=Path(json.loads(p.read_text(encoding='utf-8'))['workbench_root'])
    if not root.is_absolute() or not root.is_dir():raise ValueError('未找到已连接的Agent工作台。')
    return root

def open_entry(kind):
    names={'quick':'打开快捷指令.vbs','main':'启动工作台.vbs'}
    if kind not in names:raise ValueError('未知工作台入口')
    p=workbench_root()/names[kind]
    if not p.is_file():raise ValueError('工作台启动入口缺失。')
    subprocess.Popen(['wscript.exe',str(p)],cwd=str(p.parent),creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))

def start_background():
    """Start the existing owner hidden; never send a show/navigation request."""
    base=workbench_root()
    import sys
    candidates=[Path(sys.executable).with_name('pythonw.exe'),Path(sys.executable)]
    python=next((p for p in candidates if p.is_file()),None)
    if python is None or not (base/'launch.pyw').is_file():raise OSError('后台小镇连接入口不可用')
    subprocess.Popen([str(python),str(base/'launch.pyw'),'--background'],cwd=str(base),creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))


class WorkbenchFeed:
    def __init__(self,base,feed=None):
        self.base=Path(base);self.path=self.base/'workbench_seen.json';self.feed=Path(feed) if feed else None;self.seen=[];self.inflight=set();self.lock=threading.RLock();self.next=0;self.error='';self.last_error=''
        if self.path.exists():
            try:
                if self.path.stat().st_size>32768:raise ValueError('提醒游标过大')
                self.seen=json.loads(self.path.read_text(encoding='utf-8'))['seen']
                if not isinstance(self.seen,list) or any(not isinstance(x,str) for x in self.seen):raise ValueError('提醒游标格式无效')
            except Exception:self.error='工作台提醒游标损坏，原文件已保留。';self.seen=[]
    def pending(self,force=False):
        with self.lock:
            if self.error or (not force and time.monotonic()<self.next):return []
            self.next=time.monotonic()+5
            try:
                p=self.feed if self.feed else workbench_root()/'data/pet-notices.json'
                if not p.exists():self.last_error='';return []
                if p.stat().st_size>131072:raise ValueError('工作台提醒文件过大')
                data=json.loads(p.read_text(encoding='utf-8'))
                if data.get('version')!=1 or not isinstance(data.get('events'),list):raise ValueError('工作台提醒格式无效')
            except (OSError,ValueError,KeyError,TypeError,AttributeError):
                self.last_error='工作台提醒暂不可读，已保留收件箱并会自动重试。';return []
            self.last_error=''
            result=[]
            for e in data['events'][-100:]:
                if not isinstance(e,dict) or not re.fullmatch('[a-f0-9]{32}',str(e.get('id',''))) or e.get('kind') not in ('done','waiting'):continue
                identifier=e['id']
                if identifier in self.seen or identifier in self.inflight:continue
                self.inflight.add(identifier);result.append(dict(id=identifier,kind=e['kind'],title=str(e.get('title','工作台任务更新'))[:80],key='workbench:'+identifier,agent='workbench',thread='workbench',at=e.get('at')))
            return result
    def finish(self,identifier,success):
        with self.lock:
            self.inflight.discard(identifier)
            if not success:return
            candidate=(self.seen+[identifier])[-200:];self.path.parent.mkdir(parents=True,exist_ok=True)
            temporary=self.path.with_suffix('.tmp');temporary.write_text(json.dumps(dict(seen=candidate)),encoding='utf-8');os.replace(temporary,self.path);self.seen=candidate

def deliver(host,event):
    feed=host.workbench_feed
    try:
        exists=any(i.get('key')==event['key'] and i.get('agent')=='workbench' for i in host.buddy.snapshot()['inbox'])
        enabled=host.assistant_settings.get(event['kind'],True)
        if not exists and enabled:host.show_assistant_notification(event)
        success=not enabled or any(i.get('key')==event['key'] and i.get('agent')=='workbench' for i in host.buddy.snapshot()['inbox'])
        feed.finish(event['id'],success);feed.last_error=''
        return success
    except Exception:
        feed.inflight.discard(event['id']);feed.last_error='工作台消息暂未保存，将稍后重试。'
        return False
