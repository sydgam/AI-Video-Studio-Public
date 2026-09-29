# 집 PC 로컬 AI 모델 설치 가이드

AI Video Studio의 소스 코드는 GitHub로 받을 수 있지만 TTS와 BGM 모델, Python 가상환경, 생성 결과는 용량과 개인정보 문제로 Git에 포함되지 않습니다. 새 PC에서는 이 문서 순서대로 한 번만 설치합니다.

## 1. 먼저 확인할 것

- Windows 10/11
- NVIDIA GPU와 최신 드라이버
- Python 3.12
- Git
- TTS와 BGM을 모두 설치하려면 여유 공간을 최소 60GB, 다운로드 임시 파일까지 고려하면 70GB 이상 권장
- 프로젝트를 원하는 경로에 Git clone 또는 ZIP으로 설치

프로젝트 설치 자체는 `집_PC_설치_및_업데이트_가이드.md`를 따릅니다. 아래 명령은 프로젝트 폴더에서 PowerShell을 연 상태를 기준으로 합니다.

현재 설치 여부를 먼저 검사합니다.

```powershell
python tools\check-local-models.py
```

`READY`는 설치 완료, `MISSING/INCOMPLETE`는 없거나 다운로드가 끝나지 않은 상태입니다. 일부 항목이 없어 이 명령이 종료 코드 1을 반환하는 것은 정상적인 점검 결과입니다.

## 2. Qwen3-TTS 설치

### Studio가 사용하는 공식 모델

| Studio 기능 | 공식 모델 | 다운로드 페이지 |
|---|---|---|
| 기본 음성 1.7B | Qwen3-TTS-12Hz-1.7B-CustomVoice | https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice |
| 기본 음성 0.6B | Qwen3-TTS-12Hz-0.6B-CustomVoice | https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice |
| 설명으로 새 목소리 만들기 | Qwen3-TTS-12Hz-1.7B-VoiceDesign | https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign |
| 참조 음성 복제 1.7B | Qwen3-TTS-12Hz-1.7B-Base | https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base |
| 참조 음성 복제 0.6B | Qwen3-TTS-12Hz-0.6B-Base | https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base |

Qwen 공식 프로젝트와 사용법은 https://github.com/QwenLM/Qwen3-TTS 에서 확인할 수 있습니다.

### 설치 명령

```powershell
cd D:\AI-Video-Studio
py -3.12 -m venv "$env:LOCALAPPDATA\AI-Video-Studio-TTS\venv"
& "$env:LOCALAPPDATA\AI-Video-Studio-TTS\venv\Scripts\python.exe" -m pip install --upgrade pip
& "$env:LOCALAPPDATA\AI-Video-Studio-TTS\venv\Scripts\python.exe" -m pip install -r local-tts\requirements.txt
& "$env:LOCALAPPDATA\AI-Video-Studio-TTS\venv\Scripts\python.exe" tools\install-tts-models.py
```

프로젝트 경로가 다르면 첫 줄만 실제 경로로 바꿉니다. 모델은 `.runtime\tts\models`에 저장됩니다. 다운로드가 중단되면 같은 마지막 명령을 다시 실행하면 Hugging Face 캐시를 이용해 이어받습니다. `.installing` 표시가 남아 있거나 점검 결과가 불완전하면 다시 실행합니다.

기본 화자 9명의 음성 데이터는 CustomVoice 모델에 포함되므로 별도 화자 파일을 받을 필요가 없습니다.

## 3. ACE-Step BGM 설치

Studio는 ACE-Step 1.5 코드와 `XL SFT` 모델을 사용합니다. 공식 주소는 다음과 같습니다.

- 공식 코드: https://github.com/ace-step/ACE-Step-1.5
- 공식 모델 모음: https://huggingface.co/ACE-Step/models
- 현재 Studio 모델(XL SFT): https://huggingface.co/ACE-Step/acestep-v15-xl-sft
- VAE·텍스트 인코더·기본 LM 공용 구성요소: https://huggingface.co/ACE-Step/Ace-Step1.5

현재 검증한 ACE-Step 코드 버전은 `ca1e85fe9430179831e6bc6be790c332190a3866`입니다. 재현성을 위해 먼저 이 버전을 사용합니다.

### 3-1. uv 설치

PowerShell에서 확인합니다.

```powershell
uv --version
```

명령을 찾지 못하면 uv 공식 설치 안내 https://docs.astral.sh/uv/getting-started/installation/ 에서 Windows 설치 명령을 사용하고 PowerShell을 다시 엽니다.

### 3-2. ACE-Step 코드와 가상환경 설치

```powershell
cd D:\AI-Video-Studio
New-Item -ItemType Directory -Force .runtime\bgm | Out-Null
git clone https://github.com/ace-step/ACE-Step-1.5.git .runtime\bgm\ACE-Step-1.5
cd .runtime\bgm\ACE-Step-1.5
git checkout ca1e85fe9430179831e6bc6be790c332190a3866
uv sync --python 3.12
cd ..\..\..
```

이미 ACE-Step 폴더가 있다면 `git clone`을 반복하지 말고 점검 명령으로 상태를 먼저 확인합니다.

### 3-3. XL SFT와 공용 모델 설치

```powershell
& ".\.runtime\bgm\ACE-Step-1.5\.venv\Scripts\python.exe" tools\download-bgm-model.py
```

이 도구는 다음 네 디렉터리를 `.runtime\bgm\ACE-Step-1.5\checkpoints`에 준비합니다.

- `acestep-v15-xl-sft`: 현재 Studio의 고품질 음악 생성 모델
- `vae`: 오디오 인코딩과 디코딩
- `Qwen3-Embedding-0.6B`: 음악 설명과 가사 텍스트 인코더
- `acestep-5Hz-lm-1.7B`: ACE-Step 기본 보조 언어 모델

다운로드가 중단되면 같은 명령을 다시 실행합니다. 파일을 처음부터 모두 다시 받지 않고 캐시와 완료된 파일을 재사용합니다.

## 4. 설치 완료 확인

프로젝트 루트에서 다시 실행합니다.

```powershell
python tools\check-local-models.py
```

모든 항목이 `READY`이고 마지막에 `All local TTS and BGM models required by Studio are ready.`가 나오면 설치가 끝난 것입니다.

그다음 `START-STUDIO.cmd`를 더블클릭합니다.

- Studio: http://localhost:8055
- TTS 상태: TTS 탭에 `로컬 엔진 준비됨`
- BGM: 첫 생성 요청 때 로컬 서비스가 자동 시작

처음 실행은 모델 로딩 때문에 다음 생성보다 오래 걸립니다. TTS, BGM, ComfyUI가 같은 GPU를 동시에 사용하면 VRAM 부족이나 큰 지연이 생길 수 있으므로 실제 생성 테스트는 하나씩 진행합니다.

## 5. 기존 PC에서 복사하는 방법

인터넷으로 다시 받는 대신 기존 PC의 아래 폴더를 같은 상대 경로에 복사할 수도 있습니다.

- `.runtime\tts\models`
- `.runtime\bgm\ACE-Step-1.5\checkpoints`

모델만 복사한 경우에도 새 PC에서 TTS 가상환경 설치와 ACE-Step `uv sync`는 실행해야 합니다. Python 가상환경은 PC 경로에 묶인 파일이 있어 통째로 복사하지 않는 편이 안전합니다. 복사 후 반드시 `python tools\check-local-models.py`로 검사합니다.

## 6. Git에 포함되지 않는 항목

`.gitignore`가 다음 항목을 제외합니다.

- `.runtime\`: 로컬 모델, 가상환경, 캐시
- `.env`: 개인 API 키
- `projects\`: 개인 프로젝트와 생성 결과

따라서 GitHub에는 설치 방법과 다운로드 도구만 올라가며 모델 원본, API 키, 개인 결과물은 올라가지 않습니다.

## 7. 문제가 생겼을 때

- Hugging Face 다운로드 오류: 인터넷 연결과 디스크 여유 공간을 확인한 뒤 같은 명령 재실행
- Python 3.12를 찾지 못함: `py -0p`로 설치된 Python 목록 확인
- `uv`를 찾지 못함: uv 설치 후 PowerShell을 완전히 닫았다가 다시 열기
- CUDA 또는 GPU 오류: NVIDIA 드라이버 업데이트 후 재부팅
- BGM만 누락: ACE-Step 가상환경의 Python으로 `tools\download-bgm-model.py` 재실행
- TTS 모델만 누락: TTS 가상환경의 Python으로 `tools\install-tts-models.py` 재실행

모델 제공자가 파일 구조나 설치 방법을 바꿀 수 있으므로 문제가 계속되면 위 공식 페이지와 이 저장소의 최신 가이드를 함께 확인합니다.
