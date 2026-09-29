"""Create reusable local 1.7B Korean speaker previews, with no paid API."""
import base64
import io
import json
import urllib.request
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'assets' / 'tts' / 'speakers'
root.mkdir(parents=True, exist_ok=True)
speakers = ['Sohee', 'Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna']
text = '안녕하세요. 오늘의 이야기를 전해드립니다.'
for speaker in speakers:
    output = root / (speaker.lower() + '.wav')
    if output.exists():
        continue
    with urllib.request.urlopen('http://127.0.0.1:8060/health', timeout=5) as response:
        if json.load(response)['busy']:
            raise RuntimeError('TTS is busy. Run again after the current request finishes.')
    print('Generating ' + speaker, flush=True)
    payload = dict(text=text, mode='preset', model_size='1.7b', language='Korean', speaker=speaker)
    request = urllib.request.Request('http://127.0.0.1:8060/generate', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=300) as response:
        result = json.load(response)
    raw = base64.b64decode(result['audio'].split(',', 1)[1])
    with wave.open(io.BytesIO(raw)) as audio:
        assert audio.getnframes() > audio.getframerate() // 2
    output.write_bytes(raw)
    print(f"Saved {speaker}: {result.get('seconds')} seconds", flush=True)
(root / 'README.md').write_text(f'Qwen3-TTS 1.7B CustomVoice · Korean · no style instruction.\n\nText: {text}\n\nGenerated locally for speaker comparison; 0.6B and other languages may sound different.\n', encoding='utf-8')
