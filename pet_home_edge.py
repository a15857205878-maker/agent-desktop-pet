"""Actual room-coloured alpha fringe, reusing the existing input-transparent halo."""
from pet_edge import EdgeHalo

class HomeEdge(EdgeHalo):
    def __init__(self,target):
        self._image_size=None;self._png=None
        super().__init__(target,scale=1,radius=0)
    def refresh(self,*_):
        self.move()
    def move(self,*_):
        if self.closed or not self.hwnd:return
        if self.target.IsDisposed or not self.target.Visible or str(self.target.WindowState)=='Minimized' or self._image_size!=(self.target.Width,self.target.Height):
            self.u.ShowWindow(self.hwnd,0);return
        super().move()
    def update_image(self,png):
        if self.closed:return
        size=(self.target.Width,self.target.Height)
        if png==self._png and self._image_size==size:self.move();return
        from System import Array,Byte
        from System.IO import MemoryStream
        from System.Drawing import Bitmap,Graphics,Rectangle,Color
        from System.Drawing.Imaging import PixelFormat
        from System.Drawing.Drawing2D import InterpolationMode,PixelOffsetMode
        stream=MemoryStream(Array[Byte](png));source=None;image=None;graphics=None
        try:
            source=Bitmap(stream);image=Bitmap(size[0],size[1],PixelFormat.Format32bppPArgb);graphics=Graphics.FromImage(image);graphics.Clear(Color.Transparent)
            graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;graphics.PixelOffsetMode=PixelOffsetMode.HighQuality
            graphics.DrawImage(source,Rectangle(0,0,*size));graphics.Dispose();graphics=None
            self._ensure();self.pad=0;self._upload(image);self._image_size=size;self._png=png;self.render_count+=1;self.move()
        finally:
            if graphics is not None:graphics.Dispose()
            if image is not None:image.Dispose()
            if source is not None:source.Dispose()
            stream.Dispose()
    def dispose(self,*_):
        super().dispose();self._png=None;self._image_size=None
