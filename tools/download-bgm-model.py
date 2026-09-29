"""Download ACE-Step 1.5 XL SFT and every shared component it needs."""
import os
from pathlib import Path

root = Path(__file__).resolve().parents[1] / '.runtime' / 'bgm'
os.environ['HF_HOME'] = str(root / 'hf-cache')
os.environ['HF_HUB_OFFLINE'] = '0'
from huggingface_hub import snapshot_download

target = root / 'ACE-Step-1.5' / 'checkpoints'
target.mkdir(parents=True, exist_ok=True)

# The main repository contains the VAE, text encoder and default language model.
# Download only the shared components used by Studio; the replaced Turbo DiT is
# intentionally excluded to avoid several GB of unnecessary duplication.
shared_components = ['vae', 'Qwen3-Embedding-0.6B', 'acestep-5Hz-lm-1.7B']
shared_patterns = [f'{name}/**' for name in shared_components]
snapshot_download(
    'ACE-Step/Ace-Step1.5',
    local_dir=str(target),
    allow_patterns=shared_patterns,
    max_workers=2,
)
snapshot_download('ACE-Step/acestep-v15-xl-sft', local_dir=str(target / 'acestep-v15-xl-sft'), max_workers=2)
for name in ['acestep-v15-xl-sft', *shared_components]:
    if not list((target / name).rglob('*.safetensors')):
        raise RuntimeError(f'Missing weights: {name}')
print('BGM XL SFT components ready.', flush=True)
