# AI Video Studio Local TTS

AI Video Studio와 분리된 Qwen3-TTS 로컬 추론 서비스입니다. Python 3.12 전용 가상환경 사용을 권장합니다.

기본 주소는 `http://127.0.0.1:8060`이며 AI Video Studio는 이 주소의 `/health`와 `/generate`를 사용합니다.

모델은 프로젝트 `.runtime/tts/models`의 설치된 파일을 우선 사용하고, 없는 모델만 기존 `%LOCALAPPDATA%\AI-Video-Studio-TTS\models`에서 찾습니다. `QWEN_TTS_MODEL_ROOT`로 우선 위치를 바꿀 수 있습니다. 실행 중 모델 다운로드는 하지 않습니다. Python 가상환경은 기존 설치를 재사용합니다.

2026-09-08: D드라이브에 CustomVoice 1.7B/0.6B, VoiceDesign 1.7B, Base 1.7B 설치. 기본 화자 9명은 CustomVoice에 포함됩니다. 0.6B 기본 음성은 스타일 지시를 지원하지 않아 입력을 비활성화합니다. 새 PC용 `tools/install-tts-models.py`는 Studio가 지원하는 5개 모델(CustomVoice 1.7B/0.6B, VoiceDesign 1.7B, Base 1.7B/0.6B)을 순차 설치하며 미완료 모델은 목록에서 제외합니다.

로컬 검증: `tools/test-tts-modes.py`에서 한국어 기본 음성·디자인·복제 WAV 생성 성공. 모델 로딩 포함 33.14 / 29.11 / 21.88초이며 음성 길이는 3.68 / 2.56 / 2.80초입니다. 서로 다른 음성/모델의 단일 측정이므로 속도 비교 벤치마크는 아닙니다. 당시 ComfyUI 영상 작업도 GPU에서 실행 중이었습니다. 테스트 파일은 `.runtime/tts/test-*.wav`입니다.

`tools/launchers/START-TTS.cmd`는 기존 TTS 프로세스를 확인한 뒤 현재 프로젝트에서 다시 시작합니다. 캐시는 `.runtime/tts/numba`, 로그는 `.runtime/tts/stdout.log`와 `stderr.log`에 저장됩니다. `START-STUDIO.cmd`는 이미 실행 중인 엔진의 프로젝트가 다르면 경고합니다.

동시에 하나의 생성만 허용하며 중복 요청은 대기열에 쌓지 않고 409로 반환합니다. `/health`의 `stage`, `busy`, `projectRoot`로 진행 상태와 실행 경로를 확인할 수 있습니다.

진단: `python tools/test-local-tts.py`는 실행 중인 Studio API로 짧은 한국어 음성을 만들고 WAV 길이와 음량을 검증합니다. 결과는 `.runtime/tts/smoke-test.wav`에 저장됩니다.
