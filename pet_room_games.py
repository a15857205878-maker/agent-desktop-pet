"""Fixed local room-game records; no browser-origin storage or arbitrary paths."""
from pathlib import Path
from urllib.parse import urlsplit
import json,os,re,tempfile,threading
_lock=threading.RLock()

def _integer(value,low,high):return type(value) is int and low<=value<=high

def validate_request(value):
    if not isinstance(value,dict) or value.get('t')!='home-game' or value.get('gameId') not in ('memory','fish','snake') or value.get('op') not in ('load','record'):raise ValueError('Unsupported game request')
    if not isinstance(value.get('requestId'),str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',value['requestId']):raise ValueError('Invalid request ID')
    fields={'t','requestId','op','gameId'}
    if value['op']=='record':
        if value['gameId']=='memory':
            fields|={'moves','elapsedMs'}
            if not _integer(value.get('moves'),6,100000) or not _integer(value.get('elapsedMs'),0,86400000):raise ValueError('Invalid game result')
        else:
            fields|={'score','elapsedMs'}
            if not _integer(value.get('score'),0,397 if value['gameId']=='snake' else 100000) or not _integer(value.get('elapsedMs'),0,86400000) or (value['gameId']=='fish' and value['elapsedMs']!=15000):raise ValueError('Invalid score result')
    if set(value)!=fields:raise ValueError('Unexpected fields')
    return value

def _validate_scores(value):
    if not isinstance(value,dict) or type(value.get('version')) is not int or value['version'] not in (1,2,3):raise ValueError('Unsupported records')
    if set(value)!=({'version','memory'} if value['version']==1 else {'version','memory','fish'} if value['version']==2 else {'version','memory','fish','snake'}):raise ValueError('Unsupported records')
    s=value['memory']
    if not isinstance(s,dict) or set(s)!={'plays','bestMoves','bestTimeMs'} or not _integer(s['plays'],0,1000000000):raise ValueError('Invalid records')
    if s['plays']==0:
        if s['bestMoves'] is not None or s['bestTimeMs'] is not None:raise ValueError('Invalid empty records')
    elif not _integer(s['bestMoves'],6,100000) or not _integer(s['bestTimeMs'],0,86400000):raise ValueError('Invalid best records')
    fish=value.get('fish',{'plays':0,'bestScore':None})
    if not isinstance(fish,dict) or set(fish)!={'plays','bestScore'} or not _integer(fish['plays'],0,1000000000):raise ValueError('Invalid fish records')
    if fish['plays']==0:
        if fish['bestScore'] is not None:raise ValueError('Invalid empty fish records')
    elif not _integer(fish['bestScore'],0,100000):raise ValueError('Invalid best fish score')
    snake=value.get('snake',{'plays':0,'bestScore':None})
    if not isinstance(snake,dict) or set(snake)!={'plays','bestScore'} or not _integer(snake['plays'],0,1000000000):raise ValueError('Invalid snake records')
    if snake['plays']==0:
        if snake['bestScore'] is not None:raise ValueError('Invalid empty snake records')
    elif not _integer(snake['bestScore'],0,637):raise ValueError('Invalid best snake score')
    return {'version':3,'memory':s,'fish':fish,'snake':snake}

def load_scores(root):
    with _lock:
        path=Path(root)/'data/room-games.json'
        if not path.exists():return {'version':3,'memory':{'plays':0,'bestMoves':None,'bestTimeMs':None},'fish':{'plays':0,'bestScore':None},'snake':{'plays':0,'bestScore':None}}
        if path.stat().st_size>16384:raise ValueError('Records too large')
        return _validate_scores(json.loads(path.read_text(encoding='utf-8')))

def _atomic(path,raw):
    name=None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent,prefix='.room-games-',suffix='.tmp',delete=False) as f:
            name=f.name;f.write(raw);f.flush();os.fsync(f.fileno())
        os.replace(name,path);name=None
    finally:
        if name is not None and os.path.exists(name):os.unlink(name)

def record_result(root,moves,elapsed_ms):
    validate_request({'t':'home-game','requestId':'internal','op':'record','gameId':'memory','moves':moves,'elapsedMs':elapsed_ms})
    with _lock:
        value=load_scores(root);s=value['memory'];s['plays']+=1;s['bestMoves']=moves if s['bestMoves'] is None else min(s['bestMoves'],moves);s['bestTimeMs']=elapsed_ms if s['bestTimeMs'] is None else min(s['bestTimeMs'],elapsed_ms);_validate_scores(value)
        path=Path(root)/'data/room-games.json';path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists():_atomic(path.with_name('room-games.previous.json'),path.read_bytes())
        _atomic(path,json.dumps(value,ensure_ascii=False,allow_nan=False,indent=2).encode('utf-8'));return value

def record_fish_result(root,score,elapsed_ms):
    validate_request({'t':'home-game','requestId':'internal','op':'record','gameId':'fish','score':score,'elapsedMs':elapsed_ms})
    with _lock:
        value=load_scores(root);s=value['fish'];s['plays']+=1;s['bestScore']=score if s['bestScore'] is None else max(s['bestScore'],score);_validate_scores(value)
        path=Path(root)/'data/room-games.json';path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists():_atomic(path.with_name('room-games.previous.json'),path.read_bytes())
        _atomic(path,json.dumps(value,ensure_ascii=False,allow_nan=False,indent=2).encode('utf-8'));return value

def record_snake_result(root,score,elapsed_ms):
    validate_request({'t':'home-game','requestId':'internal','op':'record','gameId':'snake','score':score,'elapsedMs':elapsed_ms})
    with _lock:
        value=load_scores(root);s=value['snake'];s['plays']+=1;s['bestScore']=score if s['bestScore'] is None else max(s['bestScore'],score);_validate_scores(value)
        path=Path(root)/'data/room-games.json';path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists():_atomic(path.with_name('room-games.previous.json'),path.read_bytes())
        _atomic(path,json.dumps(value,ensure_ascii=False,allow_nan=False,indent=2).encode('utf-8'));return value

def handle_game_request(home,value,source):
    u=urlsplit(str(source));h=home.host
    if not home.active or u.scheme!='http' or u.hostname!='127.0.0.1' or u.port!=h.port or u.path!='/index.html' or u.query or u.fragment:return False
    request=validate_request(value);reply={'t':'home-game-records','requestId':request['requestId']}
    try:
        if request['op']=='load':scores=load_scores(__import__('pet_paths').data_dir(create=True))
        else:
            receipts=getattr(home,'game_receipts',None)
            if receipts is None:home.game_receipts={};receipts=home.game_receipts
            identity=(request['gameId'],request.get('moves',request.get('score')),request['elapsedMs']);prior=receipts.get(request['requestId'])
            if prior is not None:
                if prior[0]!=identity:raise ValueError('Conflicting duplicate result')
                scores=prior[1]
            else:
                scores=({'memory':record_result,'fish':record_fish_result,'snake':record_snake_result}[identity[0]])(__import__('pet_paths').data_dir(create=True),*identity[1:]);receipts[request['requestId']]=(identity,scores)
                if len(receipts)>64:receipts.pop(next(iter(receipts)))
        reply.update(ok=True,scores=scores)
    except (OSError,ValueError):reply.update(ok=False,error='本机成绩暂不可用，本局仍可正常游玩。')
    h.post(reply);return True
