"""Run the unrestricted official ACE-Step editor locally using installed models."""
import os
import sys
import msvcrt
from pathlib import Path

root = Path(__file__).resolve().parents[1]
runtime = root / '.runtime/bgm'
repo = runtime / 'ACE-Step-1.5'
for key, path in {'HF_HOME': runtime / 'hf-cache', 'HF_MODULES_CACHE': runtime / 'hf-modules',
                  'NUMBA_CACHE_DIR': runtime / 'numba', 'MPLCONFIGDIR': runtime / 'matplotlib',
                  'GRADIO_TEMP_DIR': runtime / 'gradio-temp', 'ACESTEP_CHECKPOINTS_DIR': repo / 'checkpoints'}.items():
    os.environ[key] = str(path)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['GRADIO_ANALYTICS_ENABLED'] = 'False'
lock = open(runtime / 'generation.lock', 'a+b')
lock.seek(0)
msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
sys.argv = ['acestep', '--port', '7861', '--server-name', '127.0.0.1',
            '--config_path', 'acestep-v15-xl-sft', '--init_service', 'true',
            '--init_llm', 'false', '--lm_model_path', 'acestep-5Hz-lm-1.7B',
            '--backend', 'pt', '--offload_to_cpu', 'true', '--offload_dit_to_cpu', 'true',
            '--use_flash_attention', 'false', '--quantization', 'none', '--batch_size', '1']
from acestep.acestep_v15_pipeline import main
main()
