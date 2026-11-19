"""Asynchronous local butler client. No model requests or copied credentials."""
from pathlib import Path
import json,re,threading,time
from urllib.request import Request,build_opener,ProxyHandler
from pet_workbench import workbench_root,open_entry,start_background

PAGES=frozenset(('reading','overview','partner','tasks','work','pack','chat','games','wheel','town','remote','artifacts','companion','settings','quick'))

class WorkstationClient:
    def __init__(self,transport=None,opener=None,background_opener=None):
        self.transport=transport or self._transport
        self.opener=opener or (lambda:open_entry('main'))
        self.background_opener=background_opener or start_background
        self.lock=threading.RLock();self.refreshing=False;self.opening=False;self.next=0
        self.status_thread=None;self.action_thread=None
        self.cache={'state':'checking','counts':None,'last_action':None}

    @staticmethod
    def _transport(method,payload,route='/assistant'):
        path=workbench_root()/'data/remote_gateway.key'
        if path.stat().st_size>256:raise ValueError('invalid local access')
        key=path.read_text(encoding='ascii').strip()
        if not re.fullmatch(r'[A-Za-z0-9_-]{32,256}',key):raise ValueError('invalid local access')
        body=json.dumps(payload).encode('utf-8') if method=='POST' else None
        request=Request('http://127.0.0.1:47633'+route,data=body,headers={'X-Workbench-Key':key,'Content-Type':'application/json'},method=method)
        limit=8*1024*1024 if route=='/room-town' else 65536
        with build_opener(ProxyHandler({})).open(request,timeout=5) as response:raw=response.read(limit+1)
        if len(raw)>limit:raise ValueError('invalid response')
        result=json.loads(raw)
        if not isinstance(result,dict) or result.get('ok') is not True:raise ValueError('request not confirmed')
        return result['data']

    def town(self,request):
        # Probe/launch before the single POST. An uncertain mutation is never retried.
        try:data=self.transport('GET',None)
        except Exception:self.background_opener();data=None
        deadline=time.monotonic()+12
        while not isinstance(data,dict) or data.get('navigation_ready') is not True:
            if time.monotonic()>=deadline:raise ValueError('工作站尚未就绪')
            time.sleep(.25)
            try:data=self.transport('GET',None)
            except Exception:data=None
        return self.transport('POST',request,route='/room-town')

    def _accept(self,data):
        if not isinstance(data,dict) or data.get('version')!=1 or not isinstance(data.get('counts'),dict):raise ValueError('invalid status')
        counts={
            name:max(0,min(10000,data['counts'][name]))
            for name in ('tasks','collaborations','conversations','deliveries','active','attention')
            if type(data['counts'].get(name)) is int
        }
        with self.lock:self.cache.update(state='online',counts=counts)

    def snapshot(self):
        with self.lock:
            if time.monotonic()>=self.next and not self.refreshing:
                self.refreshing=True;self.next=time.monotonic()+5
                self.status_thread=threading.Thread(target=self._refresh,name='pet-workstation-status',daemon=True);self.status_thread.start()
            return {**self.cache,'counts':dict(self.cache['counts']) if self.cache['counts'] is not None else None,
                    'last_action':dict(self.cache['last_action']) if self.cache['last_action'] else None}

    def _refresh(self):
        try:self._accept(self.transport('GET',None))
        except Exception:
            with self.lock:self.cache.update(state='offline',counts=None)
        finally:
            with self.lock:self.refreshing=False;self.next=time.monotonic()+5

    def open(self,page):
        if not isinstance(page,str) or page not in PAGES:raise ValueError('未知工作站功能')
        return self._start_open({'page':page})

    def open_turn(self,turn_id,on_result=None):
        if not isinstance(turn_id,str) or not re.fullmatch('[a-f0-9]{32}',turn_id):
            raise ValueError('未知工作站任务')
        return self._start_open({'turn_id':turn_id},on_result)

    def _start_open(self,target,on_result=None):
        with self.lock:
            if self.opening:return False
            self.opening=True;self.cache['last_action']={'state':'opening','message':'正在打开工作站功能…'}
            self.action_thread=threading.Thread(target=self._open,args=(target,on_result),name='pet-workstation-open',daemon=True);self.action_thread.start()
        return True

    def _open(self,target,on_result):
        opened=False
        try:
            try:data=self.transport('GET',None)
            except Exception:data=None
            if not isinstance(data,dict) or data.get('navigation_ready') is not True:
                self.opener()
            deadline=time.monotonic()+12
            while not isinstance(data,dict) or data.get('navigation_ready') is not True:
                if time.monotonic()>=deadline:raise ValueError('not ready')
                time.sleep(.25)
                try:data=self.transport('GET',None)
                except Exception:data=None
            self._accept(data)
            receipt=self.transport('POST',target)  # Never replay a POST with an uncertain receipt.
            if 'turn_id' in target and (not isinstance(receipt,dict) or receipt.get('opened') is not True or receipt.get('turn_id')!=target['turn_id']):
                raise ValueError('task navigation not confirmed')
            opened=True
            with self.lock:self.cache['last_action']={'state':'opened','message':'工作站已确认打开指定功能。'}
        except Exception:
            with self.lock:self.cache['last_action']={'state':'error','message':'页面请求未确认，请在电脑端查看后再试。'}
        finally:
            with self.lock:self.opening=False
            if on_result:on_result(opened)

def client_for(host):
    if not hasattr(host,'workstation_client'):host.workstation_client=WorkstationClient()
    return host.workstation_client
