"""Exercise the Studio proxy and validate the generated WAV without printing audio data."""
import base64
import io
import json
import math
import struct
import time
import urllib.request
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with urllib.request.urlopen('http://127.0.0.1:8060/health', timeout=10) as response:
    health = json.load(response)
assert Path(health['projectRoot']) == root, 'TTS is running from a different project'
started = time.monotonic()
request = urllib.request.Request('http://127.0.0.1:8055/api/tts/generate',
    data=json.dumps({'text':'안녕하세요. 음성 생성 테스트입니다.', 'mode':'preset',
                     'model_size':'1.7b', 'language':'Korean', 'speaker':'Sohee'}).encode(),
    headers={'Content-Type':'application/json'})
with urllib.request.urlopen(request, timeout=180) as response:
    result = json.load(response)
raw = base64.b64decode(result['audio'].split(',', 1)[1])
with wave.open(io.BytesIO(raw)) as wav:
    assert wav.getsampwidth() == 2
    samples = struct.unpack('<' + 'h' * (wav.getnframes()*wav.getnchannels()), wav.readframes(wav.getnframes()))
    rms = math.sqrt(sum(x*x for x in samples)/len(samples))
    duration = wav.getnframes()/wav.getframerate()
    assert 0.5 < duration < 30 and rms > 10, 'WAV is silent or unexpectedly long'
out = root / '.runtime/tts/smoke-test.wav'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(raw)
print(json.dumps({'ok':True, 'seconds':round(time.monotonic()-started,2),
                  'duration':round(duration,2), 'sampleRate':result['sampleRate'],
                  'rms':round(rms), 'file':str(out)}))
