"""Report whether the local TTS and BGM models required by Studio are ready."""

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TTS_ROOT = PROJECT_ROOT / ".runtime" / "tts" / "models"
BGM_ROOT = PROJECT_ROOT / ".runtime" / "bgm" / "ACE-Step-1.5"
BGM_CHECKPOINTS = BGM_ROOT / "checkpoints"

TTS_MODELS = [
    "Qwen3-TTS-12Hz-1.7B-CustomVoice",
    "Qwen3-TTS-12Hz-0.6B-CustomVoice",
    "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    "Qwen3-TTS-12Hz-1.7B-Base",
    "Qwen3-TTS-12Hz-0.6B-Base",
]
TTS_REQUIRED_FILES = [
    Path("config.json"),
    Path("model.safetensors"),
    Path("speech_tokenizer/model.safetensors"),
]
BGM_MODELS = [
    "acestep-v15-xl-sft",
    "vae",
    "Qwen3-Embedding-0.6B",
    "acestep-5Hz-lm-1.7B",
]


def directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def format_size(size: int) -> str:
    return f"{size / (1024 ** 3):.2f} GB"


def main() -> int:
    missing = []
    print(f"TTS model root: {TTS_ROOT}")
    for name in TTS_MODELS:
        model_dir = TTS_ROOT / name
        absent = [str(item) for item in TTS_REQUIRED_FILES if not (model_dir / item).is_file()]
        ready = not absent and not (model_dir / ".installing").exists()
        state = "READY" if ready else "MISSING/INCOMPLETE"
        print(f"  [{state}] {name} ({format_size(directory_size(model_dir))})")
        if not ready:
            missing.append(f"TTS/{name}")

    print(f"\nBGM code root: {BGM_ROOT}")
    code_ready = (BGM_ROOT / "pyproject.toml").is_file()
    venv_ready = (BGM_ROOT / ".venv" / "Scripts" / "python.exe").is_file()
    print(f"  [{'READY' if code_ready else 'MISSING'}] ACE-Step source")
    print(f"  [{'READY' if venv_ready else 'MISSING'}] ACE-Step Python environment")
    if not code_ready:
        missing.append("BGM/ACE-Step source")
    if not venv_ready:
        missing.append("BGM/Python environment")

    print(f"BGM checkpoints: {BGM_CHECKPOINTS}")
    for name in BGM_MODELS:
        model_dir = BGM_CHECKPOINTS / name
        ready = any(model_dir.rglob("*.safetensors")) if model_dir.exists() else False
        state = "READY" if ready else "MISSING/INCOMPLETE"
        print(f"  [{state}] {name} ({format_size(directory_size(model_dir))})")
        if not ready:
            missing.append(f"BGM/{name}")

    print()
    if missing:
        print("Missing items:")
        for item in missing:
            print(f"  - {item}")
        print("See the local AI model installation guide linked from README.md.")
        return 1

    print("All local TTS and BGM models required by Studio are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
