import sys
import threading
import time
import uvicorn
import os

from server.main import app
from server.config import SERVER_HOST, SERVER_PORT

VERSION = '0.1.0'


def _run_server():
    uvicorn.run(
        app,
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level='warning',
        reload=False,
    )


def _open_webview():
    import webview

    class _KruxAPI:
        """Minimal bridge so the page can move/resize/close the frameless window.
        The page passes *deltas*; we track current geometry in Python."""
        def __init__(self):
            self._x = 0
            self._y = 0
            self._w = 430
            self._h = 540

        def _sync(self):
            try:
                w = webview.windows[0]
                self._x, self._y = w.x, w.y
                self._w, self._h = w.width, w.height
            except Exception:
                pass

        def drag_by(self, dx: int, dy: int):
            self._sync()
            webview.windows[0].move(max(0, self._x + dx), max(0, self._y + dy))

        def resize_by(self, dw: int, dh: int):
            self._sync()
            webview.windows[0].resize(max(300, self._w + dw), max(380, self._h + dh))

        def close(self):
            try:
                webview.windows[0].destroy()
            except Exception:
                pass

        def minimize(self):
            try:
                webview.windows[0].minimize()
            except Exception:
                pass

    # Size the window to the *scaled device* so the casing fills it exactly
    # (no dead transparent margin, no squished content). BASE picks a comfy
    # scale from the primary monitor; the page derives --s = innerWidth/870.
    try:
        from pywebview.screen import Screen
        prim = Screen().get_primary()
        vw, vh = prim.width, prim.height
    except Exception:
        vw, vh = 1920, 1080
    BASE = min(vw * 0.82 / 870, vh * 0.82 / 1074)
    BASE = max(0.45, min(BASE, 1.1))

    window = webview.create_window(
        'KRUX // LINKMAPPER',
        f'http://localhost:{SERVER_PORT}',
        js_api=_KruxAPI(),
        width=int(870 * BASE),
        height=int(1074 * BASE),
        resizable=True,
        min_size=(int(870 * 0.4), int(1074 * 0.4)),
        frameless=True,
        transparent=True,
    )
    webview.start(private_mode=False)
    os._exit(0)


def _open_app_browser():
    import subprocess
    import shutil
    import webbrowser

    url = f'http://localhost:{SERVER_PORT}'

    browser_apps = [
        ['google-chrome', '--app=' + url, '--no-first-run'],
        ['chromium', '--app=' + url, '--no-first-run'],
        ['chromium-browser', '--app=' + url, '--no-first-run'],
        ['brave-browser', '--app=' + url, '--no-first-run'],
        ['firefox', '--new-window', url],
    ]

    for cmd in browser_apps:
        path = shutil.which(cmd[0])
        if path:
            subprocess.Popen([path] + cmd[1:],
                             stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
            return

    xdg_path = shutil.which('xdg-open')
    if xdg_path:
        subprocess.Popen([xdg_path, url])
        return

    webbrowser.open(url)


def main():
    if '--version' in sys.argv or '-v' in sys.argv:
        print(f'krux {VERSION}')
        return
    if '--help' in sys.argv or '-h' in sys.argv:
        print('usage: krux [--no-webview] [--version] [-v]')
        print('  --no-webview    open in browser instead of dedicated window')
        print('  --version, -v   show version')
        return

    print(f'\n  [KRUX] link-mapper v{VERSION} // terminalcore')
    print(f'  [KRUX] serving at http://localhost:{SERVER_PORT}\n')

    t = threading.Thread(target=_run_server, daemon=True)
    t.start()

    time.sleep(1.5)

    use_webview = '--no-webview' not in sys.argv

    if use_webview:
        try:
            _open_webview()
        except Exception as e:
            print(f'  [KRUX] webview unavailable ({e}), falling back to browser')
            _open_app_browser()
    else:
        _open_app_browser()

    print('  [KRUX] running. ctrl+c to stop.')
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\n  [KRUX] bye')
        sys.exit(0)


if __name__ == '__main__':
    main()
