"""Manage one local BGM subprocess and persistent generation history."""
import json
import secrets
import subprocess
import threading
import time
import bgm_settings
import bgm_full_editor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PYTHON = ROOT / '.runtime/bgm/ACE-Step-1.5/.venv/Scripts/python.exe'
JOBS = ROOT / 'projects/local-bgm'
LOCK = threading.Lock()
active = None


def read_job(folder):
    """Return saved job metadata, including the resulting audio URL."""
    info = json.loads((folder / 'job.json').read_text(encoding='utf-8'))
    result_file = folder / 'result.json'
    if result_file.exists():
        result = json.loads(result_file.read_text(encoding='utf-8'))
        audio = Path(result['audio']).resolve()
        if audio.is_relative_to(folder.resolve()) and audio.is_file():
            info.update(status='completed', audio='/api/bgm/audio?id=' + info['id'], result=result)
    elif info['status'] in ('queued', 'running'):
        if active and active['id'] == info['id']:
            info['elapsedSeconds'] = round(time.time() - info['created'])
            log = folder / 'generation.log'
            tail = log.read_text(encoding='utf-8', errors='replace')[-3000:] if log.exists() else ''
            info['status'] = 'waiting' if 'Waiting for existing' in tail and 'Loading ACE-Step' not in tail else 'running'
        else:
            info.update(status='interrupted', error='서버가 재시작되어 상태를 확인할 수 없습니다. 결과가 저장되면 다시 표시됩니다.')
    return info


def status():
    """Return readiness, active task, and recent results."""
    history = []
    if JOBS.exists():
        for folder in sorted(JOBS.iterdir(), reverse=True)[:30]:
            try:
                history.append(read_job(folder))
            except (OSError, ValueError, KeyError):
                continue
    return {'ready': PYTHON.is_file(), 'busy': active is not None or bgm_full_editor.running(), 'editorRunning': bgm_full_editor.running(), 'jobs': history}


def audio_file(job_id):
    """Resolve only a completed job's WAV, never an arbitrary client path."""
    import re
    if not re.fullmatch(r'\d{8}-\d{6}-[a-f0-9]{8}', job_id):
        raise ValueError('잘못된 음악 ID입니다.')
    folder = JOBS / job_id
    result = json.loads((folder / 'result.json').read_text(encoding='utf-8'))
    audio = Path(result['audio']).resolve()
    if not audio.is_relative_to(folder.resolve()) or audio.suffix != '.wav':
        raise ValueError('음악 파일 경로가 올바르지 않습니다.')
    return audio


def generate(data):
    """Validate options and start an isolated, shell-free generation worker."""
    global active
    if not isinstance(data, dict):
        raise ValueError('설정 형식이 올바르지 않습니다.')
    prompt = str(data.get('prompt', '')).strip()
    limited = data.get('limitDuration', True)
    duration = bgm_settings.duration(data.get('duration', 30), limited)
    bpm = int(data.get('bpm', 90))
    seed = bgm_settings.seed(data.get('seed'))
    options = bgm_settings.settings(data)
    if not prompt or len(prompt) > 4000:
        raise ValueError('음악 설명을 1~4000자로 입력하세요.')
    if not 30 <= bpm <= 240 or not 0 <= seed <= 2147483647:
        raise ValueError('길이 10~120초, BPM 30~240, 시드 0~2147483647 범위를 확인하세요.')
    if not PYTHON.is_file():
        raise FileNotFoundError('로컬 BGM 엔진이 설치되지 않았습니다.')
    with LOCK:
        if active or bgm_full_editor.running():
            raise RuntimeError('이미 BGM을 생성 중입니다. 완료 후 다시 시도하세요.')
        job_id = time.strftime('%Y%m%d-%H%M%S') + '-' + secrets.token_hex(4)
        folder = JOBS / job_id
        folder.mkdir(parents=True)
        job = dict(id=job_id, status='queued', created=time.time(), prompt=prompt,
                   duration=duration, limitDuration=limited, bpm=bpm, seed=seed, **options)
        (folder / 'job.json').write_text(json.dumps(job, ensure_ascii=False), encoding='utf-8')
        active = job
        threading.Thread(target=_run, args=(job, folder), daemon=True).start()
    return job


def _run(job, folder):
    """Run the local model with a time limit and preserve errors for the UI."""
    global active
    try:
        command = [str(PYTHON), '-u', str(ROOT / 'tools/generate-local-bgm.py'),
                   '--prompt', job['prompt'], '--duration', str(job['duration']),
                   '--bpm', str(job['bpm']), '--seed', str(job['seed']),
                   '--wait', '900', '--output-dir', str(folder)]
        for key in (*bgm_settings.SPECS, 'method', 'sampler'):
            command.extend(['--' + key, str(job[key])])
        settings_file = folder / 'settings.json'
        settings_file.write_text(json.dumps(bgm_settings.settings(job), ensure_ascii=False), encoding='utf-8')
        command.extend(['--settings-file', str(settings_file)])
        with (folder / 'generation.log').open('w', encoding='utf-8') as log:
            result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=log, timeout=1800,
                                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode or not (folder / 'result.json').exists():
            raise RuntimeError('음악 생성에 실패했습니다. 해당 결과 폴더의 generation.log를 확인하세요.')
        job['status'] = 'completed'
    except Exception as error:
        job.update(status='failed', error=str(error))
    finally:
        (folder / 'job.json').write_text(json.dumps(job, ensure_ascii=False), encoding='utf-8')
        with LOCK:
            active = None
