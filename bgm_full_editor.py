"""Start and stop the local official editor without shell commands."""
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROCESS = None
LOCK = threading.Lock()


def running():
    return PROCESS is not None and PROCESS.poll() is None


def start():
    global PROCESS
    with LOCK:
        if not running():
            with (ROOT / '.runtime/bgm/full-editor.log').open('w', encoding='utf-8') as log:
                PROCESS = subprocess.Popen([str(ROOT / '.runtime/bgm/ACE-Step-1.5/.venv/Scripts/python.exe'),
                                            '-u', str(ROOT / 'tools/run-bgm-full-ui.py')],
                                           cwd=ROOT, stdout=log, stderr=log,
                                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return {'url': 'http://127.0.0.1:7861', 'running': running()}


def stop():
    with LOCK:
        if running():
            PROCESS.terminate()
            PROCESS.wait(timeout=15)
    return {'running': False}
