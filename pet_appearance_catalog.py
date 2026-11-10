"""Read-only inventories separated by appearance; no artwork changes."""
from pathlib import Path
import json

DRAGON_NAMES={'thinking':'呆呆眼','working':'开心兴奋','waiting':'感叹号','review':'方眼镜','syncing':'流汗','blocked':'生气','error':'哭','done':'爱心眼','interrupted':'悲伤','blush':'脸红','star':'星星眼','playful':'调皮','tongue':'吐舌','heartbeat':'心跳','round':'圆眼镜','gloom':'阴暗'}

def catalog(web,appearance):
    root=Path(web)
    path=root/'appearances/dragon-live/dragon.states.model3.json' if appearance=='dragon' else root/'model/settings.json'
    refs=json.loads(path.read_text(encoding='utf-8')).get('FileReferences',{})
    names=[item.get('Name') or item.get('File') for item in refs.get('Expressions',[]) if isinstance(item,dict)]
    if appearance=='dragon':names=[DRAGON_NAMES[name] for name in names if name in DRAGON_NAMES]
    motions=[]
    for group,entries in refs.get('Motions',{}).items():
        for index,item in enumerate(entries):
            rel=item.get('File','');duration=0.0
            try:duration=float(json.loads((path.parent/rel).read_text(encoding='utf-8')).get('Meta',{}).get('Duration',0))
            except (OSError,ValueError,TypeError):pass
            motions.append(dict(id=f'{group}:{index}',group=group,index=index,file=Path(rel).name,duration=round(duration,1)))
    return dict(expressions=[name for name in names if name],motions=motions)
