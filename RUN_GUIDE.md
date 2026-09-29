# AI Video Studio 실행 가이드

## 로컬 TTS

`START-STUDIO.cmd`를 실행하면 설치된 로컬 TTS 엔진도 백그라운드에서 자동으로 시작합니다. TTS 탭의 상태가 `로컬 엔진 준비됨`으로 표시되면 사용할 수 있습니다.

- TTS 엔진 주소: `http://127.0.0.1:8060`
- 전용 실행 환경: `%LOCALAPPDATA%\AI-Video-Studio-TTS\venv`
- 로컬 모델: `%LOCALAPPDATA%\AI-Video-Studio-TTS\models`
- 엔진만 직접 확인하는 개발용 실행기는 `tools/launchers/START-TTS.cmd`에 있습니다.

ComfyUI와 TTS는 같은 GPU를 사용합니다. VRAM이 부족하면 ComfyUI 생성을 끝내고 모델을 언로드하거나 ComfyUI를 종료한 뒤 TTS를 실행하세요.

## 처음 받은 PC에서 실행

필요한 프로그램:

- Git
- Python 3
- Node.js와 npm

저장소를 받은 뒤 프로젝트 폴더에서 `START-STUDIO.cmd`를 더블클릭합니다.

이 스크립트는 다음 작업을 자동으로 처리합니다.

1. Pixel Office 의존성이 없으면 `npm install` 실행
2. Pixel Office 프로덕션 빌드
3. AI Video Studio 로컬 서버 실행
4. `http://localhost:8055` 열기

CMD에서 직접 실행하려면 다음과 같이 입력합니다.

```bat
cd /d "저장소를 받은 경로\AI-Video-Studio"
START-STUDIO.cmd
```

## API 키 설정

프로젝트 루트의 `.env.example`을 `.env`로 복사하고 본인이 사용할 키만 입력합니다.

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
APIFRAME_API_KEY=
ARK_API_KEY=
WAVESPEED_API_KEY=
```

`.env`는 저장소에 업로드되지 않습니다. 회사 PC의 `.env`를 공유하거나 복사하지 말고 각 PC에서 직접 작성합니다.

비공개 GitHub Release 업데이트를 사용하려면 읽기 권한만 가진 토큰도 설정합니다.

```env
GITHUB_UPDATE_REPOSITORY=sydgam/AI_Video_Studio
GITHUB_UPDATE_TOKEN=
```

## 실행 파일

프로젝트 루트의 `START-STUDIO.cmd` 하나만 사용하면 됩니다. 이 파일은 로컬 TTS를 백그라운드에서 시작하고, Pixel Office를 빌드한 뒤, 통합 AI Video Studio를 `8055`에서 실행합니다. 로컬 BGM은 스튜디오에서 생성 요청을 보낼 때 자동으로 실행되므로 별도 실행이 필요하지 않습니다.

레거시 서버, Pixel Office 개발 서버, TTS 단독 실행, BGM 단독 테스트용 실행기는 `tools/launchers/`에 보관합니다. 일반 사용 중에는 실행하지 않아도 됩니다.

## 회사 PC의 프로젝트를 집 PC로 옮기기

Git에는 API 키, 로컬 프로젝트, 생성 이미지가 포함되지 않습니다. 스튜디오 사이드바의 `프로젝트 내보내기`로 `.aivstudio.json` 파일을 만든 뒤 집 PC에서 `프로젝트 가져오기`를 사용합니다.

## 종료과 문제 해결

- 서버 종료: 실행 중인 검은 창에서 `Ctrl+C`
- 화면이 이전 상태로 보일 때: 브라우저에서 `Ctrl+F5`
- `포트가 이미 사용 중` 오류: 먼저 열려 있는 AI Video Studio 서버 창을 종료
- API 연결 오류: `http://localhost:8055/api/health`에서 설정 상태 확인
