"""Trusted room status, navigation and bounded calls to the original town owner."""
import re
import threading
from urllib.parse import urlsplit

def handle_request(home,value,source):
    h=home.host;u=urlsplit(str(source))
    if not home.active or u.scheme!='http' or u.hostname!='127.0.0.1' or u.port!=h.port or u.path!='/index.html' or u.query or u.fragment:return False
    if not isinstance(value,dict) or value.get('t')!='home-workstation' or value.get('op') not in ('status','open','town'):raise ValueError('Invalid room request')
    op=value['op'];allowed={'t','op','requestId'}|({'page'} if op=='open' else {'action','payload'} if op=='town' else set())
    if set(value)!=allowed or not isinstance(value.get('requestId'),str) or not re.fullmatch('[A-Za-z0-9_-]{1,64}',value['requestId']):raise ValueError('Invalid room fields')
    if op=='open' and value.get('page') not in ('town','reading'):raise ValueError('Invalid room destination')
    if op=='town':
        if value.get('action') not in ('bootstrap','focus_state','town_action','focus_start','focus_pause','focus_resume','focus_end') or not isinstance(value.get('payload'),dict):raise ValueError('Invalid town action')
    from pet_workstation import client_for
    client=client_for(h);request_id=value['requestId']
    import json
    identity=(op,value.get('page'),json.dumps([value.get('action'),value.get('payload')],sort_keys=True,ensure_ascii=False))
    receipts=getattr(home,'_workstation_receipts',{})
    if request_id in receipts:
        previous_identity,reply=receipts[request_id]
        if previous_identity!=identity:raise ValueError('Conflicting room request')
        if reply:h.post(reply)
        return True
    if getattr(home,'_workstation_pending',False):
        h.post({'t':'home-workstation-response','requestId':request_id,'ok':False,'error':'工作站正在响应，请稍候。'});return True
    home._workstation_pending=True
    remember=op=='open' or (op=='town' and value['action'] not in ('bootstrap','focus_state'))
    if remember:
        receipts[request_id]=(identity,None);home._workstation_receipts=receipts
        if len(receipts)>64:receipts.pop(next(iter(receipts)))
    def work():
        reply={'t':'home-workstation-response','requestId':request_id,'ok':False}
        try:
            if op=='status':
                raw=client.transport('GET',None);focus=raw.get('focus') or {};counts=raw.get('counts') or {}
                safe_counts={k:n if type(n) is int and 0<=n<=200 else None for k in ('active','attention') for n in [counts.get(k)]}
                kind=focus.get('kind');remaining=focus.get('remaining')
                safe_focus={'kind':kind if kind in ('running','paused','idle') else 'unknown','remaining':remaining if type(remaining) is int and 0<=remaining<=86400 else None}
                reply.update(ok=True,data={'focus':safe_focus,'counts':safe_counts})
            elif op=='town':
                reply.update(ok=True,data=client.town({'action':value['action'],'payload':value['payload']}))
            else:
                if not client.open(value['page']):raise ValueError('busy')
                thread=getattr(client,'action_thread',None)
                if thread:thread.join(timeout=14)
                action=client.snapshot().get('last_action') or {}
                if action.get('state')!='opened':raise ValueError('navigation uncertain')
                reply.update(ok=True,data={'opened':True,'page':value['page']})
        except Exception:reply['error']='工作站状态或页面请求尚未确认，请在电脑端检查。'
        finally:
            home._workstation_pending=False
            if remember:receipts[request_id]=(identity,reply)
            if home.active:h.post(reply)
    home._workstation_thread=threading.Thread(target=work,name='room-workstation',daemon=True);home._workstation_thread.start();return True
