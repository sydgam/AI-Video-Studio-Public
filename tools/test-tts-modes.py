"""Offline local HTTP smoke tests for installed voice modes; no paid APIs."""
import base64
import io
import json
import urllib.request
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / '.runtime' / 'tts'
reference = base64.b64encode((root / 'smoke-test.wav').read_bytes()).decode()
cases = [
    dict(mode='preset', model_size='0.6b', speaker='Sohee'),
    dict(mode='design', model_size='1.7b', instruct='A calm Korean female narrator with a clear, warm voice.'),
    dict(mode='clone', model_size='1.7b', reference_audio_base64=reference),
]
results = []
for case in cases:
    print('Testing ' + case['mode'], flush=True)
    payload = dict(text='안녕하세요. 반갑습니다.', language='Korean', **case)
    request = urllib.request.Request('http://127.0.0.1:8060/generate', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.load(response)
    raw = base64.b64decode(result['audio'].split(',', 1)[1])
    with wave.open(io.BytesIO(raw)) as audio:
        assert audio.getnframes() > audio.getframerate() // 2
        assert audio.getframerate() == result['sampleRate']
    (root / ('test-' + case['mode'] + '.wav')).write_bytes(raw)
    summary = {key: result[key] for key in ['model', 'seconds', 'audioSeconds']}
    results.append(summary)
    print(json.dumps(summary), flush=True)
    (root / 'mode-test-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
