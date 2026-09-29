"""Generate one offline instrumental with ACE-Step and release GPU on exit."""
import argparse
import json
import os
import sys
import msvcrt
import time
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
import bgm_settings
runtime = root / '.runtime' / 'bgm'
repo = runtime / 'ACE-Step-1.5'
for key, value in {
    'HF_HOME': runtime / 'hf-cache',
    'NUMBA_CACHE_DIR': runtime / 'numba',
    'MPLCONFIGDIR': runtime / 'matplotlib',
    'HF_MODULES_CACHE': runtime / 'hf-modules',
    'ACESTEP_CHECKPOINTS_DIR': repo / 'checkpoints',
}.items():
    os.environ[key] = str(value)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

parser = argparse.ArgumentParser()
parser.add_argument('--prompt', default='Instrumental cinematic background music, gentle piano and warm strings, hopeful and calm, no vocals, no singing, clean studio sound.')
parser.add_argument('--duration', type=float, default=20)
parser.add_argument('--bpm', type=int, default=90)
parser.add_argument('--seed', type=int)
for key, (default, low, high, kind) in bgm_settings.SPECS.items():
    parser.add_argument('--' + key, type=kind, default=default)
parser.add_argument('--method', default='ode', choices=['ode', 'sde'])
parser.add_argument('--sampler', default='euler', choices=['euler', 'heun'])
parser.add_argument('--settings-file', help='JSON generation settings including lyrics and vocal metadata')
parser.add_argument('--wait', type=int, default=0, help='Wait up to this many seconds for other engines to become idle')
parser.add_argument('--output-dir', help='Output directory inside the project projects folder')
args = parser.parse_args()
options = bgm_settings.settings(json.loads(Path(args.settings_file).read_text(encoding='utf-8')) if args.settings_file else vars(args))
args.seed = bgm_settings.seed(args.seed)
args.duration = bgm_settings.duration(args.duration, False)
if not 30 <= args.bpm <= 240:
    parser.error('BPM must be 30-240.')
runtime.mkdir(parents=True, exist_ok=True)
lock_file = open(runtime / 'generation.lock', 'a+b')
lock_file.seek(0)
try:
    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
except OSError:
    raise RuntimeError('Another BGM generation is already running.')

# Do not add a competing generation while another local engine is busy.
deadline = time.monotonic() + args.wait
while True:
    busy = False
    for url, busy_key in [('http://127.0.0.1:8060/health', 'busy'), ('http://127.0.0.1:8188/queue', 'queue_running')]:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                busy = busy or bool(json.load(response).get(busy_key))
        except urllib.error.URLError:
            pass  # An engine which is not running cannot hold a generation job.
    if not busy:
        break
    if time.monotonic() >= deadline:
        raise RuntimeError('Another local generation is running. Please retry after it finishes.')
    print('Waiting for existing TTS/ComfyUI generation to finish...', flush=True)
    time.sleep(15)

started = time.monotonic()
print('Loading ACE-Step XL SFT (offline)...', flush=True)
import numpy as np
import soundfile as sf
import torch
from acestep.handler import AceStepHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

if not torch.cuda.is_available():
    raise RuntimeError('CUDA is unavailable; refusing an unexpectedly slow CPU generation.')
handler = AceStepHandler()
status, ready = handler.initialize_service(
    project_root=str(repo), config_path='acestep-v15-xl-sft', device='cuda',
    use_flash_attention=False, compile_model=False, offload_to_cpu=True,
    offload_dit_to_cpu=True, quantization=None,
)
if not ready:
    raise RuntimeError(status)
loaded = time.monotonic()
params = GenerationParams(caption=args.prompt,
                          lyrics='[Instrumental]' if options['mode'] == 'instrumental' else options['lyrics'],
                          instrumental=options['mode'] == 'instrumental',
                          vocal_language=options['language'], keyscale=options['keyscale'], timesignature=options['timesignature'],
                          enable_normalization=options['normalize'], normalization_db=options['normalizationDb'],
                          duration=args.duration, bpm=args.bpm, seed=args.seed,
                          thinking=False, use_cot_caption=False, use_cot_metas=False,
                          use_cot_language=False, inference_steps=options['steps'], guidance_scale=options['guidance'],
                          shift=options['shift'], cfg_interval_start=options['cfgStart'], cfg_interval_end=options['cfgEnd'],
                          infer_method=options['method'], sampler_mode=options['sampler'],
                          fade_in_duration=options['fadeIn'], fade_out_duration=options['fadeOut'])
config = GenerationConfig(batch_size=1, use_random_seed=False, audio_format='wav')
output = Path(args.output_dir).resolve() if args.output_dir else root / 'projects' / 'local-bgm-tests' / time.strftime('%Y%m%d-%H%M%S')
if not output.resolve().is_relative_to((root / 'projects').resolve()):
    raise ValueError('Output must stay inside projects.')
output.mkdir(parents=True, exist_ok=True)
result = generate_music(handler, None, params, config, save_dir=str(output))
if not result.success or not result.audios:
    raise RuntimeError(result.error or 'No audio returned.')
audio_path = Path(result.audios[0]['path'])
audio, rate = sf.read(audio_path)
assert np.isfinite(audio).all(), 'Audio contains invalid samples'
assert np.sqrt(np.mean(audio ** 2)) > 0.0001, 'Audio is silent'
assert abs(len(audio) / rate - args.duration) < 2, 'Unexpected duration'
report = dict(model='acestep-v15-xl-sft', settings=options, inferenceSteps=options['steps'], guidanceScale=options['guidance'], prompt=args.prompt, seed=args.seed, bpm=args.bpm,
              duration=len(audio) / rate, sampleRate=rate, channels=1 if audio.ndim == 1 else audio.shape[1],
              loadSeconds=round(loaded-started, 2), generationSeconds=round(time.monotonic()-loaded, 2),
              audio=str(audio_path), peak=float(np.max(np.abs(audio))), offline=True)
(output / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False), flush=True)
