"""Native side of the fixed, expiring home-display lease; no web commands."""
from pathlib import Path
import json,math,os,re,time,uuid

class RoomPresence:
    def __init__(self,root,clock=time.time):
        self.root=Path(root);self.clock=clock;self.token=None;self.revoked=None;self.wanted=False;self.last_write=0;self.last_state=None
    def requested(self):
        self.wanted=False
        try:
            path=self.root/'room-presence.request.json'
            if path.stat().st_size>2048:return False
            v=json.loads(path.read_text(encoding='utf-8'));expires=v.get('expires');token=v.get('token')
            if v.get('version')!=1 or not isinstance(token,str) or not re.fullmatch('[a-f0-9]{32}',token):return False
            self.token=token
            self.wanted=bool(token!=self.revoked and v.get('mode')=='home' and type(expires) in (float,int) and math.isfinite(expires) and 0<expires-self.clock()<=8.1)
        except (OSError,ValueError,UnicodeError,AttributeError):pass
        return self.wanted
    def publish(self,hidden,appearance):
        if not self.token:return
        appearance='dragon' if appearance=='dragon' else 'legacy'
        state='revoked' if self.revoked==self.token else 'incompatible' if self.wanted and appearance!='dragon' else 'home' if self.wanted and hidden else 'waiting' if self.wanted else 'desktop'
        now=self.clock();signature=(self.token,state,bool(hidden),appearance)
        if signature==self.last_state and (state not in ('home','waiting') or 0<=now-self.last_write<.5):return
        path=self.root/'room-presence.status.json';tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
        try:
            tmp.write_text(json.dumps(dict(version=1,token=self.token,state=state,hidden=bool(hidden),appearance=appearance,at=now),allow_nan=False),encoding='utf-8');os.replace(tmp,path)
            self.last_write=now;self.last_state=signature
        except (OSError,ValueError):pass
        finally:
            try:tmp.unlink(missing_ok=True)
            except OSError:pass
    def revoke(self):
        self.revoked=self.token;self.wanted=False;self.publish(False,'dragon')
