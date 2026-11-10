"""Opt-in layered home using the existing native window and renderer."""
from pathlib import Path
import json,math,ctypes
from urllib.parse import urlsplit

ASSETS=('day-background.png','day-foreground.png','night-background.png','night-foreground.png')
ACTIONS=frozenset(('close','drag','menu','pat','asset-error','quit'))
def validate_message(value):
    if not isinstance(value,dict) or set(value)!={'t','action'} or value['t']!='home-action' or value['action'] not in ACTIONS:raise ValueError('小屋仅支持固定的本机动作。')
    return value['action']
def validate_layers(value):
    if not isinstance(value,dict) or value.get('version')!=1 or value.get('width')!=1200 or value.get('height')!=800:raise ValueError('房间图层尺寸不正确。')
    actor=value.get('actor')
    if not isinstance(actor,dict) or set(actor)!={'centerX','bottom','height'} or any(type(n) not in (int,float) or not math.isfinite(n) or not 0<n<1 for n in actor.values()):raise ValueError('房间角色位置不正确。')
    return True

class HomeState:
    def __init__(self):self.active=False;self.saved=None
    def enter(self,bounds,topmost,opacity):
        if self.active:raise ValueError('小屋已经打开。')
        self.saved=dict(bounds=tuple(bounds),topmost=bool(topmost),opacity=float(opacity));self.active=True
    def leave(self):
        if not self.active:return None
        saved=self.saved;self.saved=None;self.active=False;return saved

class DesktopHome:
    def __init__(self,host,root=None,tray=True):
        self.host=host;self.root=Path(root or Path(__file__).resolve().parent);self.state=HomeState();self.use_tray=tray;self.notify=None;self.icon=None;self.menu=None;self.paused=None;self.meta=None;self.card_visible=False
        self.edge=None;self.edge_error=None
        host.home_mode=False
        host.form.FormClosing+=self.closing
        host.form.Resize+=self.visibility
        host.form.VisibleChanged+=self.visibility
    @property
    def active(self):return self.state.active
    def enter(self):
        h=self.host
        if self.active:self.restore();return
        if not h.ready.is_set():raise ValueError('角色还在加载，请稍后再打开小屋。')
        source=self.root/'web/home';meta=source/'room-layers.json'
        if not meta.is_file() or meta.stat().st_size>8192:raise ValueError('房间图层尚未就绪。')
        value=json.loads(meta.read_text(encoding='utf-8'));validate_layers(value)
        if any(not (source/n).is_file() or (source/n).stat().st_size>4*1024*1024 for n in ASSETS):raise ValueError('房间图层缺失。')
        h.room_presence.revoke();h.update_game_quiet()
        if h.quiet_state.active:raise ValueError('当前处于游戏安静状态，请先恢复桌宠。')
        f=h.form;self.state.enter((f.Left,f.Top,f.ClientSize.Width,f.ClientSize.Height),f.TopMost,f.Opacity);h.home_mode=True;self.meta=value;self.saved_scale=h.pet_scale
        self.surface=(f.TransparencyKey,f.BackColor)
        self.saved_region=f.Region.Clone() if f.Region is not None else None
        f.Region=None
        try:
            h.release_mouse_capture();h.drag_stop.set();h.drag_monitor_stop.set()
            if h.drag_timer is not None:h.drag_timer.Stop()
            h.mouse=type(h.mouse)();h.manual_drag=None;h.pending_wheel=0;h._left_swallowed=False;h._right_swallowed=False;h._hook_mouse_steps.clear()
            self.card_visible=bool(h.card is not None and not h.card.IsDisposed and h.card.Visible)
            if self.card_visible:h.card.Hide()
            from System.Drawing import Color
            # The desktop pet's color-key surface can pass clicks through WebView2.
            # A house is an ordinary opaque surface, including its DOM buttons.
            f.TransparencyKey=Color.Empty;f.BackColor=Color.FromArgb(237,234,227)
            f.TopMost=False;f.Opacity=1.;self.center();self.resend();h.flush();f.Show();f.Activate();self.visibility()
            if self.use_tray:self.ensure_tray()
        except Exception:self.leave();raise
    def center(self):
        from System.Windows.Forms import Screen
        from System.Drawing import Size,Point
        f=self.host.form;area=Screen.FromControl(f).WorkingArea;s=max(1,float(self.host.dpi_scale))
        width=min(round(820*s),area.Width-32);height=min(round(width/1.4),area.Height-32)
        f.ClientSize=Size(width,height);f.Location=Point(area.Left+(area.Width-width)//2,area.Top+(area.Height-height)//2)
    def resend(self):
        if self.active:self.host.post({'t':'home-mode','enabled':True,'meta':self.meta})
    def leave(self):
        saved=self.state.leave()
        if not saved:return
        if self.edge is not None:self.edge.dispose();self.edge=None
        h=self.host;h.home_mode=False;self.dispose_tray();self.paused=None
        h.post({'t':'home-mode','enabled':False})
        from System.Drawing import Size,Point
        from System.Windows.Forms import FormWindowState
        f=h.form;f.WindowState=FormWindowState.Normal
        current_region=f.Region;f.Region=self.saved_region;self.saved_region=None
        if current_region is not None:current_region.Dispose()
        f.TransparencyKey,f.BackColor=self.surface
        x,y,w,height=saved['bounds'];ratio=h.pet_scale/self.saved_scale
        f.ClientSize=Size(round(w*ratio),round(height*ratio));f.Location=Point(x,y)
        f.TopMost=bool(h.settings.get('alwaysOnTop',saved['topmost']));f.Opacity=float(h.settings.get('opacity',saved['opacity']))
        if self.card_visible and h.card is not None and not h.card.IsDisposed and not h.quiet_state.active:h.card.Show()
        h.last_cursor=None;h._rect_cache=None
        h.flush()
    def closing(self,sender,args):
        if self.active:
            user_close=str(args.CloseReason)=='UserClosing';self.leave()
            if user_close:args.Cancel=True
    def visibility(self,*_):
        if not self.active:return
        f=self.host.form;paused=not f.Visible or str(f.WindowState)=='Minimized'
        if paused!=self.paused:self.paused=paused;self.host.post({'t':'home-visibility','hidden':paused})
    def restore(self):
        from System.Windows.Forms import FormWindowState
        f=self.host.form;f.WindowState=FormWindowState.Normal;f.Show();f.Activate();self.visibility()
    def ensure_tray(self):
        if self.notify is not None:return
        from System.Drawing import Icon
        from System.Windows.Forms import NotifyIcon,ContextMenuStrip
        self.icon=Icon(str(self.root/'web/icon.ico'));self.menu=ContextMenuStrip();self.menu.Items.Add('显示小屋与小镇').Click+=lambda *_:self.restore();self.menu.Items.Add('收起小屋，回到桌宠界面').Click+=lambda *_:self.leave()
        self.notify=NotifyIcon();self.notify.Icon=self.icon;self.notify.Text='龙娘的小屋 · 按需打开';self.notify.ContextMenuStrip=self.menu;self.notify.DoubleClick+=lambda *_:self.restore();self.notify.Visible=True
    def dispose_tray(self):
        if self.notify is not None:self.notify.Visible=False;self.notify.Dispose();self.notify=None
        if self.menu is not None:self.menu.Dispose();self.menu=None
        if self.icon is not None:self.icon.Dispose();self.icon=None
    def message(self,value,source):
        url=urlsplit(str(source));h=self.host
        if url.scheme!='http' or url.hostname!='127.0.0.1' or url.port!=h.port or url.path!='/index.html' or url.query or url.fragment:return
        action=validate_message(value)
        if not self.active:return
        if action=='close':self.leave()
        elif action=='quit':self.leave();h.form.Close()
        elif action=='asset-error':self.leave();h.post({'t':'say','text':'小屋图层未能加载，已回到桌面。'})
        elif action=='pat':h.user_interaction('pat')
        elif action=='menu':
            x,y=h.cursor_screen();h.show_menu(x,y)
        elif action=='drag':
            user=ctypes.windll.user32;user.ReleaseCapture();user.SendMessageW(ctypes.c_void_p(int(h.form.Handle.ToInt64())),0xA1,2,0)
