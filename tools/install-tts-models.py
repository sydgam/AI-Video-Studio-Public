"""Download every Qwen3-TTS model exposed by Studio, serially and resumably."""
import os
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '0'
os.environ['TRANSFORMERS_OFFLINE'] = '0'
root = Path(__file__).resolve().parents[1] / '.runtime' / 'tts' / 'models'
os.environ['HF_HOME'] = str(root / '.hf-cache')
from huggingface_hub import snapshot_download

models = [
    'Qwen3-TTS-12Hz-1.7B-CustomVoice',
    'Qwen3-TTS-12Hz-0.6B-CustomVoice',
    'Qwen3-TTS-12Hz-1.7B-VoiceDesign',
    'Qwen3-TTS-12Hz-1.7B-Base',
    'Qwen3-TTS-12Hz-0.6B-Base',
]

root.mkdir(parents=True, exist_ok=True)
for name in models:
    target = root / name
    target.mkdir(parents=True, exist_ok=True)
    marker = target / '.installing'
    marker.touch()
    print('Downloading ' + name, flush=True)
    snapshot_download('Qwen/' + name, local_dir=str(target), max_workers=2)
    for required in ['config.json', 'model.safetensors', 'speech_tokenizer/model.safetensors']:
        if not (target / required).is_file():
            raise RuntimeError(f'Incomplete download: {target / required}')
    marker.unlink()
    print('Installed ' + name, flush=True)
