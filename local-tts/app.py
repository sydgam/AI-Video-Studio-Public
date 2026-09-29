from __future__ import annotations

import base64
import io
import os
import threading
import logging
import time
import gc
from pathlib import Path
from typing import Any

import soundfile as sf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Keep JIT caches out of the Python installation. On Windows a denied cache
# write can spend minutes retrying temporary filenames during librosa import.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("NUMBA_CACHE_DIR", str(PROJECT_ROOT / ".runtime" / "tts" / "numba"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="AI Video Studio Local TTS", version="0.1.0")
model_lock = threading.Lock()
loaded_model: Any | None = None
loaded_model_id = ""
stage = "idle"
started_at = 0.0
last_result: dict[str, Any] = {}


MODEL_IDS = {
    ("preset", "1.7b"): "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    ("preset", "0.6b"): "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    ("design", "1.7b"): "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    ("clone", "1.7b"): "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    ("clone", "0.6b"): "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
}


def model_root() -> str:
    configured = os.environ.get("QWEN_TTS_MODEL_ROOT", "").strip()
    if configured:
        return configured
    return str(PROJECT_ROOT / ".runtime" / "tts" / "models")


def model_path(model_id: str) -> Path:
    name = model_id.rsplit("/", 1)[-1]
    target = Path(model_root()) / name
    legacy = Path(os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))) / "AI-Video-Studio-TTS" / "models" / name
    return target if target.is_dir() else legacy


def model_complete(path: Path) -> bool:
    return all((path / name).is_file() for name in (
        "config.json", "model.safetensors", "tokenizer_config.json",
        "speech_tokenizer/config.json", "speech_tokenizer/model.safetensors")) and not (path / ".installing").exists()


def installed_models() -> list[str]:
    return [model_id for model_id in sorted(set(MODEL_IDS.values())) if model_complete(model_path(model_id))]


class GenerateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    mode: str = "preset"
    model_size: str = "1.7b"
    language: str = "Korean"
    speaker: str = "Sohee"
    instruct: str = ""
    reference_audio_base64: str = ""
    reference_text: str = ""


def get_model(model_id: str) -> Any:
    global loaded_model, loaded_model_id
    import torch
    from qwen_tts import Qwen3TTSModel
    if loaded_model is not None and loaded_model_id == model_id:
        return loaded_model

    loaded_model = None
    loaded_model_id = ""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    model_source = str(model_path(model_id))
    if not model_complete(Path(model_source)):
        raise FileNotFoundError(f"설치되지 않은 TTS 모델입니다: {model_id.rsplit('/', 1)[-1]}")
    loaded_model = Qwen3TTSModel.from_pretrained(
        model_source,
        device_map="cuda:0" if torch.cuda.is_available() else "cpu",
        dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        attn_implementation="sdpa",
        local_files_only=True,
    )
    loaded_model_id = model_id
    return loaded_model


def audio_data_url(waveform: Any, sample_rate: int) -> str:
    buffer = io.BytesIO()
    sf.write(buffer, waveform, sample_rate, format="WAV", subtype="PCM_16")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:audio/wav;base64,{encoded}"


def normalize_reference_audio(audio: Any) -> Any:
    """Work around qwen-tts mutating its immutable (waveform, sample-rate) tuple."""
    if getattr(audio, "ndim", 0) > 1:
        return audio.mean(axis=-1).astype("float32")
    return audio


@app.get("/health")
def health() -> dict[str, Any]:
    available = installed_models()
    return {
        "ok": True,
        "ready": bool(available),
        "engine": "Qwen3-TTS",
        "modelLoaded": loaded_model is not None,
        "model": loaded_model_id or None,
        "stage": stage,
        "busy": model_lock.locked(),
        "elapsedSeconds": round(time.monotonic() - started_at, 1) if model_lock.locked() and started_at else 0,
        "lastResult": last_result,
        "projectRoot": str(PROJECT_ROOT),
        "processId": os.getpid(),
        "availableModels": available,
        "capabilities": {
            "preset": any("CustomVoice" in item for item in available),
            "design": any("VoiceDesign" in item for item in available),
            "clone": any(item.endswith("Base") for item in available),
        },
    }


@app.post("/generate")
def generate(request: GenerateRequest) -> dict[str, Any]:
    global stage, started_at, last_result
    mode = request.mode if request.mode in {"preset", "design", "clone"} else "preset"
    size = request.model_size if request.model_size in {"1.7b", "0.6b"} else "1.7b"
    if mode == "design" and size == "0.6b":
        raise HTTPException(400, "음성 디자인은 1.7B 모델에서만 지원합니다.")
    model_id = MODEL_IDS.get((mode, size))
    if not model_id:
        raise HTTPException(400, "지원하지 않는 TTS 설정입니다.")

    if not model_lock.acquire(blocking=False):
        raise HTTPException(409, "이미 음성을 생성하거나 모델을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.")
    try:
        started_at = time.monotonic()
        stage = "loading"
        logger.info("TTS loading model: %s", model_id)
        model = get_model(model_id)
        stage = "generating"
        logger.info("TTS generating %d characters", len(request.text))
        if mode == "clone":
            if not request.reference_audio_base64:
                raise HTTPException(400, "참조 음성을 추가해 주세요.")
            raw = request.reference_audio_base64.split(",", 1)[-1]
            audio_bytes = base64.b64decode(raw, validate=True)
            audio, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32")
            audio = normalize_reference_audio(audio)
            waveforms, output_rate = model.generate_voice_clone(
                text=request.text,
                language=request.language,
                ref_audio=(audio, sample_rate),
                ref_text=request.reference_text or None,
                x_vector_only_mode=not bool(request.reference_text.strip()),
            )
        elif mode == "design":
            waveforms, output_rate = model.generate_voice_design(
                text=request.text,
                language=request.language,
                instruct=request.instruct or "Natural, clear narration.",
            )
        else:
            waveforms, output_rate = model.generate_custom_voice(
                text=request.text,
                language=request.language,
                speaker=request.speaker,
                instruct=request.instruct,
            )
        last_result = {"seconds": round(time.monotonic() - started_at, 2), "audioSeconds": round(len(waveforms[0]) / output_rate, 2)}
        logger.info("TTS completed: %s", last_result)
        return {
            "ok": True,
            "audio": audio_data_url(waveforms[0], output_rate),
            "sampleRate": output_rate,
            "model": model_id,
            **last_result,
        }
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("TTS generation failed")
        raise HTTPException(500, f"음성 생성 실패: {error}") from error
    finally:
        stage = "idle"
        model_lock.release()
