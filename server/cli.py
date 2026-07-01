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

    window = webview.create_window(
        'KRUX // LINKMAPPER',
        f'http://localhost:{SERVER_PORT}',
        width=1280,
        height=800,
        resizable=True,
        min_size=(800, 500),
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
