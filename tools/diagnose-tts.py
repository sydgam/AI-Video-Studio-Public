"""Run a short offline TTS check; keep diagnostics and generated WAV in the workspace."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import sys
import time
import base64
import faulthandler
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'local-tts'))
faulthandler.dump_traceback_later(40, repeat=True)
import app
started = time.monotonic()
print('Loading local TTS and generating Korean test...', flush=True)
result = app.generate(app.GenerateRequest(text='안녕하세요. 음성 생성 테스트입니다.'))
output = root / 'local-tts' / 'diagnostic.wav'
output.write_bytes(base64.b64decode(result['audio'].split(',', 1)[1]))
print({'seconds': round(time.monotonic()-started, 2), 'sampleRate': result['sampleRate'], 'wav': str(output)}, flush=True)
faulthandler.cancel_dump_traceback_later()
