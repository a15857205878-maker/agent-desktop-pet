"""Validated raster silhouette for the ordinary WebView room window (no color key)."""
import math,base64,struct
from urllib.parse import urlsplit

def decode_edge(value,w,h):
    if value is None:return None
    prefix='data:image/png;base64,'
    if not isinstance(value,str) or not value.startswith(prefix) or len(value)>4*1024*1024:raise ValueError('Invalid edge image')
    raw=base64.b64decode(value[len(prefix):],validate=True)
    if len(raw)<33 or raw[:8]!=b'\x89PNG\r\n\x1a\n' or raw[12:16]!=b'IHDR' or struct.unpack('>II',raw[16:24])!=(w,h):raise ValueError('Invalid edge dimensions')
    return raw

def validate_mask(value):
    if not isinstance(value,dict) or value.get('t')!='home-mask':raise ValueError('Invalid mask')
    w,h=value.get('width'),value.get('height')
    if type(w) is not int or type(h) is not int or not 1<=w<=4096 or not 1<=h<=4096:raise ValueError('Invalid size')
    runs=value.get('runs');overlays=value.get('overlays',[])
    if not isinstance(runs,list) or not 1<=len(runs)<=20000 or not isinstance(overlays,list) or len(overlays)>8:raise ValueError('Invalid runs')
    for run in runs:
        if not isinstance(run,list) or len(run)!=3 or any(type(n) is not int for n in run):raise ValueError('Invalid run')
        y,a,b=run
        if not (0<=y<h and 0<=a<b<=w):raise ValueError('Run outside viewport')
    for rect in overlays:
        if not isinstance(rect,list) or len(rect) not in (4,5) or any(type(n) not in (int,float) or not math.isfinite(n) for n in rect):raise ValueError('Invalid overlay')
        a,b,c,d=rect[:4]
        if not (0<=a<c<=w and 0<=b<d<=h):raise ValueError('Overlay outside viewport')
        if len(rect)==5 and not 0<=rect[4]<=min(c-a,d-b)/2:raise ValueError('Invalid overlay radius')
    return w,h,runs,overlays

def apply_mask(home,value,source):
    url=urlsplit(str(source));host=home.host
    if not home.active or url.scheme!='http' or url.hostname!='127.0.0.1' or url.port!=host.port or url.path!='/index.html' or url.query or url.fragment:return False
    w,h,runs,overlays=validate_mask(value)
    edge=decode_edge(value.get('edgePng'),w,h)
    from System.Drawing import Region,RectangleF
    from System.Drawing.Drawing2D import GraphicsPath,FillMode
    f=host.form;sx=f.ClientSize.Width/w;sy=f.ClientSize.Height/h;path=GraphicsPath(FillMode.Winding)
    try:
        for y,a,b in runs:path.AddRectangle(RectangleF(float(a*sx),float(y*sy),float((b-a)*sx),float(sy+.05)))
        for rect in overlays:
            a,b,c,d=rect[:4];r=rect[4] if len(rect)==5 else 0
            if not r:path.AddRectangle(RectangleF(float(a*sx),float(b*sy),float((c-a)*sx),float((d-b)*sy)));continue
            # Match the DOM's rounded surface rather than including transparent corners.
            rx,ry=r*sx,r*sy;x,y=a*sx,b*sy;right,bottom=c*sx,d*sy
            path.StartFigure()
            path.AddArc(float(x),float(y),float(2*rx),float(2*ry),180.,90.)
            path.AddArc(float(right-2*rx),float(y),float(2*rx),float(2*ry),270.,90.)
            path.AddArc(float(right-2*rx),float(bottom-2*ry),float(2*rx),float(2*ry),0.,90.)
            path.AddArc(float(x),float(bottom-2*ry),float(2*rx),float(2*ry),90.,90.)
            path.CloseFigure()
        previous=f.Region;f.Region=Region(path)
        if previous is not None:previous.Dispose()
    finally:path.Dispose()
    if edge is not None:
        try:
            from pet_home_edge import HomeEdge
            if getattr(home,'edge',None) is None:home.edge=HomeEdge(f)
            home.edge.update_image(edge);home.edge_error=None
        except Exception as exc:
            home.edge_error=type(exc).__name__
            if getattr(home,'edge',None) is not None:home.edge.dispose();home.edge=None
    return True
