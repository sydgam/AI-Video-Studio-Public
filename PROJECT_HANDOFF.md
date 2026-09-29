# AI Video Studio 작업 인수인계

## 2026-09-09 BGM UI 개선 및 GPT Image 2.5

- BGM: 가사 창 높이 380px, 상세 설정 강조/기본 펼침. 음악 설명 옆 인스트루먼트 체크로 보컬/연주곡 전환; 연주곡에서 가사/언어 비활성화(내용 보존).
- 120초 제한 토글 추가. OFF는 목표 길이를 10~600초로 입력 가능하게 함(자동/무한 생성 아님). API와 CLI 공통 검증, UI 설정 저장. 실제 장시간 생성은 미시험.
- 언어 이름 표시와 CFG/ODE/SDE 설명 추가. 기본 자동은 unknown(언어 지정 생략).
- 워크플로우 이미지 모델에 gpt-image-2.5-flare / gpt-image-2.5-sunburst 추가. 공식 Images 생성/편집 API 이용, 기존 모델/노드 선택 보존. quality는 기존 auto 사용.
- 검증: BGM 단위 9개, UI 모의 동작 테스트, 이미지 모델 등록/15개 출력 크기 검사 통과. 유료 API 호출하지 않음. 서버 재시작 완료.

## 2026-09-09 BGM XL SFT 교체 (최신)

- 음악 기능 제한 해제: 기본 `auto`, 보컬/연주곡 선택, 가사(20,000자), 보컬 언어, 조성, 박자, 정규화 설정. 강제 no-vocals 문구 제거; 연주곡 선택 시에만 적용. 가사는 UTF-8 settings.json으로 subprocess에 전달.
- Studio의 ‘공식 전체 편집기 시작’은 `tools/run-bgm-full-ui.py`로 공식 Gradio를 localhost:7861에 실행. XL SFT/CPU offload 사용, 보조 LM은 화면에서 활성화 가능. 커버·참조·구간 수정 등 공식 옵션 제공. 종료 버튼으로 GPU 반환. Studio와 파일 잠금을 공유해 중복 실행 방지.
- 공식 편집기 로그 `.runtime/bgm/full-editor.log`, 결과 `.runtime/bgm/ACE-Step-1.5/gradio_outputs`. 모델에 따라 지원 작업이 다름; 설치되지 않은 모델의 기능을 XL SFT가 지원한다고 간주하지 말 것.

- 상세 설정 UI 추가: steps(10~100), CFG(0~15), shift(0.1~5), CFG 구간(0~1), ODE/SDE, Euler/Heun, 페이드(0~10초). `bgm_settings.py`가 API/CLI 공통 검증 담당.
- Studio는 매 생성 시 서버가 무작위 seed를 정해 job/result에 저장하고 화면에 표시. 이전 고정 seed 설정은 읽지 않음. CLI/API 명시적 seed는 재현용으로 지원.
- 결과에 실제 상세 설정 표시, 기본값 복원 버튼 제공. 관련 단위 테스트 7개 통과.

- 사용자 요청으로 기본 Turbo 가중치 삭제(약 4.79GB), ACE-Step 1.5 XL SFT(4B)로 교체. 공용 VAE/임베딩/LM은 유지.
- `tools/generate-local-bgm.py`: `acestep-v15-xl-sft`, 50 steps, CFG 7.0, CPU offload, 보조 LM 비활성. Studio BGM 탭에도 반영.
- 오프라인 20초 WAV 검증 통과: `projects/local-bgm-tests/xl-sft-verification/result.json`, 로딩 14.09초 + 생성 12.58초. 기존 생성 음악은 보존.
- 다운로드 도구는 공식 XL SFT 저장소를 사용하며 공용 구성 요소는 기존 설치를 재사용.

마지막 정리 기준일: 2026-09-04

## 2026-09-08 이동 안정화 및 에이전트 웹 검색

- 대화형 에이전트가 GPT·Claude·Gemini 서버의 기존 웹 검색 기능을 활성화하도록 연결. 현재 시각·시간대를 전달하고 최신 정보 검색 지침 추가.
- 응답에 검색 여부와 제공된 출처 링크를 저장·표시. 날씨 도구처럼 URL을 반환하지 않는 결과는 링크 미제공 표시.
- Pixel Office 경로 시작·종료 구간 및 가구 모서리 충돌 검사, 7px 탐색 격자, 지연 프레임의 2px 단위 이동 검사 적용.
- 아트룸 문과 복도의 누락된 이동 영역 연결. 가구 안쪽 목적지는 접근 가능한 주변 위치로 이동(앵커 최대 140px).
- 저장된 지도 형식이 손상되면 기본 지도로 복구하며 저장 원본은 유지. 자동 이동 테스트는 실패 집계·30초 제한·중지 처리 보완.
- 검증: `node tools/test-office-navigation.cjs` (29개 목적지와 복귀 경로, 지연 프레임, 장애물 충돌), `node tools/test-agent-web-search.cjs`, Pixel Office `npm run build`.
- 실제 서버 API에서 세 공급자의 서울 날씨 웹 검색 응답 확인. 브라우저 UI 조작은 연결 부재로 미검증. `--live` 옵션은 실제 모델 API를 호출함.
- 이후 TTS 타임아웃 점검: 이전 바탕화면 경로의 엔진이 실행 중이었고, 오디오 라이브러리의 캐시 임시 파일 생성 재시도로 import가 멈추는 현상 재현. 캐시를 `.runtime/tts/numba`로 지정하고 로컬 모델만 사용하도록 설정.
- TTS 실행기를 현재 프로젝트 재시작·로그 저장 방식으로 보완하고 중복 요청은 409로 즉시 거절. 생성 실패 시 잠금 해제 테스트 포함 3개 회귀 테스트 통과.
- D드라이브 엔진으로 교체 후 Studio `/api/tts/generate`를 통한 한국어 생성 성공: 38.6초, 24kHz, 음성 길이 2.96초. `.runtime/tts/smoke-test.wav`에서 확인 가능. TTS와 Studio 본체 실행 중.

## 2026-09-08 TTS 음성 방식 확장

- `.runtime/tts/models`에 CustomVoice 1.7B/0.6B, VoiceDesign 1.7B, Base 1.7B 설치. 기존 C드라이브 모델은 보존, D드라이브 우선 사용. Python 가상환경은 기존 설치 재사용.
- 기본 화자 9명 선택, 방식별 설치 모델 확인, 0.6B 스타일 지시 비활성화, 생성 경과 시간과 완료 시간 표시. 모델 교체 시 GC 수행.
- 로컬 기본 음성/디자인/참조 복제 생성 검증 성공. 모델 로딩 포함 각각 33.14초/29.11초/21.88초. `.runtime/tts/mode-test-results.json`과 WAV 참고. 유료 API 호출 없음.
- 점검 당시 ComfyUI MiniMax H3 영상 생성과 TTS가 RTX 4080 GPU를 공유했고 총 VRAM 약 15GB/16GB 사용. 느린 원인으로 자원 경쟁이 유력하나 단독 벤치마크는 미수행. ComfyUI 작업은 중단하지 않음.
- Studio는 `tools/run-studio-background.py`로 재시작하여 진행 상태 프록시 변경 적용. 기존 실행 스크립트도 계속 사용 가능.

## 현재 구조

## 2026-09-09 로컬 BGM 1단계 검증

- 후속 완료: Studio 상단 BGM 탭 추가. `src/bgm/bgm.js`, `local_bgm_service.py`, `/api/bgm/status`, `/api/bgm/generate`, `/api/bgm/audio`로 연결.
- 영어 상세 프롬프트 예시·분위기·악기·20~120초 길이·BPM·seed·최종 프롬프트 확인. 비동기 생성, 페이지 새로고침 후 기록 복원, WAV 재생/다운로드. `projects/local-bgm`에 저장. 생성 중 BGM 중복 실행은 Windows 파일 잠금으로 방지.
- 통합 검증 결과 `projects/local-bgm/20260909-094158-5224660a`: 20초 stereo 48kHz, 로딩 10.28초, 생성/저장 7.86초. API WAV HTTP 200 확인. `python tools/test-local-bgm-service.py` 4개 통과. 브라우저 제어 연결 없음으로 실제 클릭 미검증.

- ACE-Step 1.5 Turbo 코드·가상환경·약 10.1GB 모델을 `.runtime/bgm`에 설치. 공식 commit `ca1e85fe9430179831e6bc6be790c332190a3866`.
- `tools/generate-local-bgm.py`와 `tools/launchers/START-LOCAL-BGM.cmd`로 단독 실행. TTS/ComfyUI 작업 중이면 시작하지 않음, `--wait`로 대기 가능. 실행 전 확인이며 상호 배타적 통합 큐는 아직 아님.
- 20초 90 BPM 피아노/현악기 연주곡 요청, seed 42, 8 steps, 보조 LM 사용 안 함. GPU offload 활성화. 오프라인 생성 성공.
- 결과 `projects/local-bgm-tests/20260909-093038/060ecdee-1725-6b76-2bc1-2fee1bd3cdc3.wav`, 같은 폴더 `result.json`에 설정·측정 기록. 48kHz 스테레오, 20.0초, 모델 로딩 22.8초, 생성/저장/검증 13.14초. 길이·무음·유한 값 확인.
- 다음: 사용자가 샘플 청취로 음악적 품질/보컬 혼입 확인 후 Studio BGM UI/워크플로우 통합. 상세 `local-bgm/README.md`. 유료 API 호출 없음.

## 현재 구조 상세

### TTS 설정 안내·미리듣기 (2026-09-08)

- 속도 5단계·전체 감정·마지막 문장 감정을 사용자 설명 뒤에 합성하는 설정 추가. 기본값은 설명 따르기(지시 추가 없음). 1.7B CustomVoice/VoiceDesign만 지원, 0.6B/clone에서는 비활성화하고 전송 instruct는 비움.
- ‘실제로 전달할 목소리 지침 확인’은 실제 요청과 같은 합성 함수를 사용. 사용자 원문은 변경하지 않음. 선택값은 상대적 자연어 지시이며 정확한 배속·감정 구현 보장은 없음. `tools/test-tts-ui.mjs`에서 미리보기/요청 일치, 원문 보존, 모드 제약과 설정 해제 검증. 이 변경에서 추가 GPU 음성 생성은 하지 않음.

- 음성 방식별 단계 안내, ‘새로 읽을 대본’과 ‘녹음에 들어 있는 말·받아쓰기’ 구분. 디자인 설명 필수, 복제에서는 적용되지 않는 연기 지침 숨김. hidden 속성을 CSS가 덮어쓰지 않도록 수정.
- `assets/tts/speakers`에 9명 모두 같은 한국어 문장의 1.7B WAV 샘플 저장. 선택 후 오디오 컨트롤로 즉시 재생하며 추가 GPU 추론 없음. 9개 WAV와 HTTP 200 확인.
- ‘이 목소리로 다른 대사 만들기’는 생성 WAV와 당시 대본을 참조로 옮김. 이후 편집한 대본을 받아쓰기로 잘못 복사하지 않음. 녹음 변경 시 이전 받아쓰기 초기화.
- `node tools/test-tts-ui.mjs` 통과: 모드 전환, 설명 필수, 샘플 주소, 결과 재사용, 0.6B 제약. 브라우저 연결이 없어 실제 화면 검증은 미수행.
- 공식 CustomVoice는 9명. 추가 공식 화자 팩은 확인되지 않음. 목소리 확장은 VoiceDesign → Base 복제 또는 참조 녹음 사용. 출처: https://github.com/QwenLM/Qwen3-TTS#custom-voice-generation

- 루트 웹 앱: 프로젝트, 개요, 스토리보드, 워크플로우, 파일, 설정, 임원진 회의실
- 로컬 API 서버: `server.py`
- Pixel Office: `pixel-office/`의 React + TypeScript + Phaser + Vite 앱
- 통합 실행 주소: `http://localhost:8055`
- Pixel Office 단독 개발 주소: `http://localhost:8054`

## 주요 구현 상태

- GPT, Claude, Gemini 임원진 회의와 직원 관리
- 임원진 안건 이미지·PDF·DOCX·PPTX·ODT·RTF·텍스트 첨부 및 파일 단독 회의 시작
- GPT·Claude·Gemini 전환형 에이전트 채팅 노드와 모델별 대화 표시·파일 첨부·Undo 복원
- 직원 성격·시스템 지침·사용자 프롬프트 및 상태 패널
- 회의 안건 이미지·문서 첨부
- Polygon 기반 Pixel Office 내비게이션과 내장 편집·자동 테스트
- 이미지 생성, 참조 이미지, 글로벌 스타일, 문서, LLM, 검토·승인, 스토리보드 반영 노드
- 빈 참조 이미지 노드 자동 bypass
- 스토리보드 JSON 변환 시 이미지·영상 프롬프트 세부 정보 보존
- WaveSpeed Seedance/Kling 영상 생성과 생성 히스토리
- APIFRAME Suno BGM 생성
- GitHub Release 업데이트 확인·다운로드 준비 기능
- Gemini 3.8 Flash와 Nano Banana 2 `0.5K` 최신 API 표기 반영

## 중요한 데이터 위치

- API 키: 로컬 `.env` — Git 제외
- 프로젝트 디스크 산출물: `projects/` — Git 제외
- 브라우저 프로젝트 상태: localStorage
- 이미지·영상 에셋: IndexedDB 및 프로젝트 내보내기 파일
- Pixel Office 원본: `pixel-office/src`, `pixel-office/public`
- Pixel Office 빌드 결과: `pixel-office/dist` — Git 제외, 실행 시 재생성

## 알려진 주의사항

- Pixel Office 경로 데이터는 정밀 Polygon 기반이지만 일부 좁은 가구 통로는 추후 좌표 보정 가능
- 게임 번들은 Phaser 포함으로 약 1.6MB이며 빌드 시 청크 크기 권고가 나오지만 기능 오류는 아님
- 비공개 GitHub Release 확인에는 각 PC의 `.env`에 읽기 전용 `GITHUB_UPDATE_TOKEN` 필요
- Git 저장소만 받아서는 회사 PC의 프로젝트와 생성 이미지가 복원되지 않으므로 프로젝트 내보내기 파일을 별도로 옮겨야 함

## 새 Codex 대화에서 작업을 이어갈 때

새 대화에서 다음과 같이 요청하면 된다.

> 현재 폴더의 `PROJECT_HANDOFF.md`, `RUN_GUIDE.md`, `README.md`와 Git 상태를 먼저 확인하고 AI Video Studio 작업을 이어가 줘. 기존 사용자 데이터와 `.env`는 건드리지 마.

대화 기록 자체는 Git에 포함되지 않으므로 이 문서와 현재 코드를 기준으로 맥락을 복원한다.
