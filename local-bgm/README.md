# 로컬 BGM · 1단계

ACE-Step 1.5 XL SFT(4B)를 Studio와 분리된 Python 3.12 환경에서 사용합니다.
Studio 상단 **BGM** 탭에서 설명·분위기·악기·길이·BPM·변형 번호를 설정하고 생성할 수 있습니다.
최종 프롬프트 미리보기, 비동기 생성 상태, 생성 기록, 재생·WAV 다운로드를 제공합니다.
Studio 결과는 `projects/local-bgm/`에 저장되며, 독립 실행기의 테스트 결과 경로와 구분됩니다.
Studio 기본 생성은 XL SFT 직접 생성 경로를 사용합니다. 설명/가사 따르기·보컬곡·연주곡을 선택할 수 있고, 가사·언어·조성·박자·음량 정규화를 지정할 수 있습니다. 보컬 금지는 연주곡을 선택한 경우에만 적용합니다.
‘공식 전체 편집기 시작’으로 localhost:7861에서 참조 오디오·커버·구간 수정·보조 LM 등 공식 기능에 접근합니다. 보조 LM은 공식 화면에서 초기화해 사용합니다. 현재 모델이 지원하는 작업만 가능하며 Base 전용 작업에는 해당 모델이 필요합니다.
전체 편집기는 Studio 생성과 동시 실행하지 않도록 파일 잠금을 공유합니다. 사용 후 Studio의 종료 버튼으로 메모리를 반환합니다. 공식 결과는 `.runtime/bgm/ACE-Step-1.5/gradio_outputs`에 따로 저장됩니다.

상세 생성 설정에서 단계 수, CFG 강도/적용 구간, Shift, ODE/SDE, Euler/Heun, 페이드 인/아웃을 조절합니다.
Studio 시드는 매번 서버에서 무작위 선택하며 결과에 실제 시드와 설정을 표시합니다. 상세 설정은 브라우저에 저장되고 기본값 복원도 가능합니다.
CLI는 `--steps 30 --guidance 5.5 --shift 1.2 --cfgStart 0.1 --cfgEnd 0.9 --method sde --sampler heun --fadeIn 0.5 --fadeOut 2`처럼 지정합니다. `--seed`를 생략하면 무작위입니다.

## 설치 위치

- 공식 코드 및 가상환경: `.runtime/bgm/ACE-Step-1.5`, 그 안의 `.venv`
- 모델: `.runtime/bgm/ACE-Step-1.5/checkpoints` (XL SFT와 공용 구성 요소)
- 설치 버전: `ca1e85fe9430179831e6bc6be790c332190a3866`
- CUDA: PyTorch `2.7.1+cu128` / RTX 4080, Python 3.12.10
- TTS Python 환경 및 ComfyUI 설치는 수정하지 않았습니다.
- 공식 문서: https://github.com/ace-step/ACE-Step-1.5
- 새 PC 전체 설치 순서와 공식 모델 주소: `집_PC_로컬_AI_모델_설치_가이드.md`

## 실행

`tools/launchers/START-LOCAL-BGM.cmd`를 실행하면 기본 20초, 90 BPM, 피아노·현악기 연주곡을 생성합니다. 일반 사용자는 통합 스튜디오의 BGM 탭을 사용하면 됩니다.
결과 WAV와 설정·측정 기록은 `projects/local-bgm-tests/날짜-시간/`에 저장됩니다.

PowerShell에서 설정을 지정할 수도 있습니다.

```powershell
.\.runtime\bgm\ACE-Step-1.5\.venv\Scripts\python.exe tools/generate-local-bgm.py --duration 20 --bpm 90 --seed 42 --prompt "Instrumental cinematic music, gentle piano and warm strings, hopeful and calm, no vocals."
```

`--wait 900`을 추가하면 기존 TTS/ComfyUI 작업이 끝나기를 최대 15분 기다립니다.
이는 실행 전 상태 확인으로, ComfyUI나 TTS에서 나중에 시작하는 작업까지 차단하는 통합 스케줄러는 아닙니다.
안정적인 측정 중에는 다른 GPU 생성을 시작하지 않는 것이 좋습니다.

## 첫 검증 설정

- 현재: 4B XL SFT, 50 steps, CFG 7.0, 1곡, 보컬 없는 연주곡, 고정 seed 42
- 보조 LM 추론 비활성화. 직접 작성한 영어 곡 설명과 BPM·길이 사용
- SDPA, 컴파일·양자화 비활성화, CPU offload 사용
- 실행 시 다운로드 차단. 생성 프로세스 종료 시 GPU 메모리 반환
- WAV의 길이, 유한 샘플, 무음 여부 자동 확인. 음악적 품질·보컬 유무는 청취로 별도 확인 필요

## 이전 Turbo 검증 기록

현재 XL SFT 교체 검증: 20초/48kHz 스테레오, 50단계/CFG 7.0, 로딩 14.09초 + 생성 12.58초.
결과: `projects/local-bgm-tests/xl-sft-verification/result.json`. 기본 Turbo 가중치는 삭제했으며 공용 모델과 기존 결과는 유지했습니다.

2026-09-09 첫 실제 생성 성공: `projects/local-bgm-tests/20260909-093038/060ecdee-1725-6b76-2bc1-2fee1bd3cdc3.wav`.
20.0초, 48kHz 스테레오, peak 0.8913. 로딩 22.80초, 생성·저장·검증 13.14초.
오프라인 추론으로 WAV 길이·유한 값·무음 검사를 통과했습니다. 종료 후 GPU 메모리는 약 1.5GB로 돌아왔습니다.
음악적 품질과 보컬 혼입 여부는 사용자 청취 확인 전입니다.

2026-09-09 Studio 연결 검증: 20초 음악, 로딩 10.28초, 생성/저장 7.86초.
`/api/bgm/generate` → 상태 조회 → WAV 다운로드 성공. 단위 테스트 4개 통과.
브라우저 제어 연결 부재로 실제 화면 클릭 검증은 미수행.
중복 BGM 실행은 프로세스 파일 잠금으로 방지하며 TTS/ComfyUI는 시작 전 대기 확인을 사용합니다.
설치 중 torchao의 선택적 C++ 확장 버전 경고가 있었으나 CUDA 및 ACE-Step import 검증은 통과했습니다.
