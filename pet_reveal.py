"""The personal pet's local, show-only request from the Dock."""

import ctypes
from ctypes import wintypes
import os

from pet_paths import profile_id


class RevealRequest:
    def __init__(self):
        self._kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        self._kernel.CreateEventW.argtypes = [
            wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR
        ]
        self._kernel.CreateEventW.restype = wintypes.HANDLE
        self._kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        self._kernel.WaitForSingleObject.restype = wintypes.DWORD
        self._kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self._kernel.CloseHandle.restype = wintypes.BOOL
        self._event = self._kernel.CreateEventW(
            None, False, False, f"Local\\AgentDesktopPet.Reveal.{profile_id()}.{os.getpid()}"
        )

    def poll(self):
        return bool(self._event and self._kernel.WaitForSingleObject(self._event, 0) == 0)

    def close(self):
        if self._event:
            self._kernel.CloseHandle(self._event)
            self._event = None


def show_from_dock(host):
    form = host.form
    if str(form.WindowState) == "Minimized":
        from System.Windows.Forms import FormWindowState

        form.WindowState = FormWindowState.Normal
    if not form.Visible or host.quiet_state.active:
        host.show_from_tray()
    else:
        form.Activate()

