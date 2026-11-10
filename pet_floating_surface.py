"""Per-pixel native surface for the icon menu; no global hooks or policies."""
import ctypes
from ctypes import wintypes as W

class SIZE(ctypes.Structure):_fields_=[('cx',W.LONG),('cy',W.LONG)]
class BLEND(ctypes.Structure):_fields_=[('op',W.BYTE),('flags',W.BYTE),('alpha',W.BYTE),('format',W.BYTE)]
class HEADER(ctypes.Structure):
    _fields_=[('size',W.DWORD),('width',W.LONG),('height',W.LONG),('planes',W.WORD),('bits',W.WORD),('compression',W.DWORD),('bytes',W.DWORD),('x',W.LONG),('y',W.LONG),('used',W.DWORD),('important',W.DWORD)]
class INFO(ctypes.Structure):_fields_=[('header',HEADER),('colors',W.DWORD*3)]

class LayeredPresenter:
    def __init__(self,form,paint,hit_shapes):
        self.form=form;self.paint=paint;self.hit_shapes=hit_shapes;self.closed=False
        self.u=ctypes.WinDLL('user32',use_last_error=True);self.g=ctypes.WinDLL('gdi32',use_last_error=True)
        self.u.GetDC.argtypes=[W.HWND];self.u.GetDC.restype=W.HDC
        self.u.ReleaseDC.argtypes=[W.HWND,W.HDC];self.u.ReleaseDC.restype=ctypes.c_int
        self.u.GetWindowLongPtrW.argtypes=[W.HWND,ctypes.c_int];self.u.GetWindowLongPtrW.restype=ctypes.c_ssize_t
        self.u.SetWindowLongPtrW.argtypes=[W.HWND,ctypes.c_int,ctypes.c_ssize_t];self.u.SetWindowLongPtrW.restype=ctypes.c_ssize_t
        self.u.UpdateLayeredWindow.argtypes=[W.HWND,W.HDC,ctypes.POINTER(W.POINT),ctypes.POINTER(SIZE),W.HDC,ctypes.POINTER(W.POINT),W.DWORD,ctypes.POINTER(BLEND),W.DWORD];self.u.UpdateLayeredWindow.restype=W.BOOL
        self.g.CreateCompatibleDC.argtypes=[W.HDC];self.g.CreateCompatibleDC.restype=W.HDC
        self.g.DeleteDC.argtypes=[W.HDC];self.g.DeleteDC.restype=W.BOOL
        self.g.CreateDIBSection.argtypes=[W.HDC,ctypes.POINTER(INFO),W.UINT,ctypes.POINTER(ctypes.c_void_p),W.HANDLE,W.DWORD];self.g.CreateDIBSection.restype=W.HBITMAP
        self.g.SelectObject.argtypes=[W.HDC,W.HGDIOBJ];self.g.SelectObject.restype=W.HGDIOBJ
        self.g.DeleteObject.argtypes=[W.HGDIOBJ];self.g.DeleteObject.restype=W.BOOL
        self.hwnd=None

    def enable(self):
        if self.closed:return
        from System.Drawing import Color
        # A colour key would punch through the large mouse target around a
        # line icon and blend antialiased glyph edges against the key colour.
        self.form.TransparencyKey=Color.Empty
        self.hwnd=int(self.form.Handle.ToInt64())
        old=self.u.GetWindowLongPtrW(self.hwnd,-20)
        self.u.SetWindowLongPtrW(self.hwnd,-20,old|0x80000)

    def bitmap(self):
        from types import SimpleNamespace
        from System.Drawing import Bitmap,Graphics,Color,SolidBrush
        from System.Drawing.Imaging import PixelFormat
        from pet_banner_style import rounded_path
        image=Bitmap(self.form.Width,self.form.Height,PixelFormat.Format32bppPArgb)
        g=Graphics.FromImage(image)
        try:
            g.Clear(Color.Transparent)
            # Alpha=1 preserves the intended 44px native mouse targets without
            # a visible disk. Exact zero outside these shapes stays click-through.
            brush=SolidBrush(Color.FromArgb(1,0,0,0))
            try:
                for x,y,w,h,r in self.hit_shapes():
                    path=rounded_path(x,y,w,h,r)
                    try:g.FillPath(brush,path)
                    finally:path.Dispose()
            finally:brush.Dispose()
            self.paint(self.form,SimpleNamespace(Graphics=g))
            return image
        except Exception:image.Dispose();raise
        finally:g.Dispose()

    def render(self):
        if self.closed or self.form.IsDisposed:return
        if self.hwnd is None:self.enable()
        image=self.bitmap()
        try:self.upload(image)
        finally:image.Dispose()

    def upload(self,image):
        from System.Drawing import Rectangle
        from System.Drawing.Imaging import ImageLockMode,PixelFormat
        width,height=image.Width,image.Height
        data=image.LockBits(Rectangle(0,0,width,height),ImageLockMode.ReadOnly,PixelFormat.Format32bppPArgb)
        try:
            if data.Stride!=width*4:raise ValueError('Unexpected menu bitmap stride')
            raw=ctypes.string_at(int(data.Scan0.ToInt64()),height*data.Stride)
        finally:image.UnlockBits(data)
        info=INFO();info.header=HEADER(ctypes.sizeof(HEADER),width,-height,1,32,0,0,0,0,0,0)
        screen=self.u.GetDC(None);dc=bitmap=old=None
        try:
            if not screen:raise ctypes.WinError(ctypes.get_last_error())
            dc=self.g.CreateCompatibleDC(screen)
            if not dc:raise ctypes.WinError(ctypes.get_last_error())
            pixels=ctypes.c_void_p();bitmap=self.g.CreateDIBSection(screen,ctypes.byref(info),0,ctypes.byref(pixels),None,0)
            if not bitmap or not pixels.value:raise ctypes.WinError(ctypes.get_last_error())
            old=self.g.SelectObject(dc,bitmap)
            if not old or int(old)==ctypes.c_void_p(-1).value:old=None;raise ctypes.WinError(ctypes.get_last_error())
            ctypes.memmove(pixels,raw,len(raw))
            point=W.POINT(self.form.Left,self.form.Top);size=SIZE(width,height);source=W.POINT(0,0);blend=BLEND(0,0,255,1)
            if not self.u.UpdateLayeredWindow(self.hwnd,screen,ctypes.byref(point),ctypes.byref(size),dc,ctypes.byref(source),0,ctypes.byref(blend),2):raise ctypes.WinError(ctypes.get_last_error())
        finally:
            if dc and old:self.g.SelectObject(dc,old)
            if bitmap:self.g.DeleteObject(bitmap)
            if dc:self.g.DeleteDC(dc)
            if screen:self.u.ReleaseDC(None,screen)

    def dispose(self):
        self.closed=True;self.paint=None;self.hit_shapes=None;self.form=None;self.hwnd=None
