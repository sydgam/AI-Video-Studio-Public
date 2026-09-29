# 집 PC 설치 및 업데이트 가이드

GitHub 화면이 익숙하지 않아도 아래 순서대로 진행하면 됩니다.

## 가장 쉬운 방법: ZIP으로 처음 설치

1. GitHub 저장소의 첫 화면을 엽니다.
2. 초록색 **Code** 버튼을 누릅니다.
3. 메뉴 아래쪽의 **Download ZIP**을 누릅니다.
4. 내려받은 ZIP 파일을 원하는 폴더에 압축 해제합니다.
5. 압축을 푼 폴더에서 `START-STUDIO.cmd`를 더블클릭합니다.
6. Windows 방화벽 확인창이 나오면 사설 네트워크 사용을 허용합니다.
7. 브라우저가 열리면 `http://localhost:8055`에서 사용합니다.

처음 실행할 때 필요한 패키지를 자동 설치하므로 시간이 조금 걸릴 수 있습니다.

TTS와 BGM의 대용량 로컬 모델은 자동 설치되거나 GitHub에 포함되지 않습니다. 음성·음악 생성까지 사용하려면 프로젝트를 받은 뒤 `집_PC_로컬_AI_모델_설치_가이드.md`를 이어서 진행하세요.

## API 키 설정

API 기능을 사용하지 않을 때는 키 없이도 화면과 노드 편집 기능을 사용할 수 있습니다.

API를 사용하려면:

1. 프로젝트 폴더의 `.env.example`을 복사합니다.
2. 복사본 이름을 `.env`로 바꿉니다.
3. 메모장으로 `.env`를 열고 사용하는 서비스의 키만 입력합니다.

```text
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
APIFRAME_API_KEY=
ARK_API_KEY=
WAVESPEED_API_KEY=
```

`.env` 파일과 API 키는 GitHub에 업로드하거나 다른 사람에게 전달하지 마세요.

## ZIP 설치본을 새 버전으로 바꾸는 방법

ZIP 방식은 자동 업데이트되지 않습니다. 새 버전이 올라오면 다음처럼 진행합니다.

1. 기존 AI Video Studio에서 중요한 프로젝트를 **프로젝트 내보내기**로 백업합니다.
2. 기존 폴더의 `.env` 파일을 안전한 곳에 복사합니다.
3. GitHub에서 새 ZIP을 다시 내려받아 **새 폴더**에 압축을 풉니다.
4. 보관한 `.env`를 새 폴더에 복사합니다.
5. 새 폴더의 `START-STUDIO.cmd`를 실행합니다.
6. 필요한 프로젝트는 **프로젝트 가져오기**로 복원합니다.

기존 폴더 위에 덮어쓰는 것보다 새 폴더에 푸는 편이 안전합니다.

## 권장 방법: Git으로 설치하고 업데이트

Git이 설치되어 있다면 이 방식이 이후 업데이트에 가장 편합니다.

### 처음 한 번만 설치

명령 프롬프트(cmd)를 열고 원하는 설치 위치로 이동한 뒤 실행합니다.

```cmd
git clone https://github.com/sydgam/AI_Video_Studio.git
cd AI_Video_Studio
copy .env.example .env
START-STUDIO.cmd
```

그다음 `.env`에 본인의 API 키를 입력합니다.

### 다음 버전으로 업데이트

프로젝트 폴더에서 명령 프롬프트를 열고 실행합니다.

```cmd
git pull origin main
START-STUDIO.cmd
```

`git pull` 전에 직접 소스 코드를 수정했다면 충돌이 생길 수 있으므로 먼저 별도로 백업하세요.

## 실행 파일

프로젝트 루트의 `START-STUDIO.cmd` 하나만 사용하면 됩니다. 개발 및 진단용 개별 실행기는 `tools/launchers/`에 따로 보관되어 있습니다.

## 실행이 안 될 때

### Python 또는 npm을 찾을 수 없다는 메시지

Python과 Node.js가 설치되어 있어야 합니다. 설치 후 명령 프롬프트를 완전히 닫았다가 다시 여세요.

```cmd
python --version
node --version
npm --version
```

각 명령에서 버전 번호가 나오면 정상입니다.

### 포트 8055가 이미 사용 중이라는 메시지

기존에 실행한 AI Video Studio 명령창이 열려 있는지 확인하고 해당 창에서 `Ctrl+C`를 누른 뒤 다시 실행합니다.

### 화면이 이전 버전처럼 보일 때

브라우저에서 `Ctrl+F5`를 눌러 강력 새로고침합니다.

### 종료 방법

AI Video Studio를 실행한 검은 명령창에서 `Ctrl+C`를 누르거나 명령창을 닫습니다.

## 기억할 것

- 평소 실행: `START-STUDIO.cmd` 더블클릭
- Git 업데이트: `git pull origin main`
- 접속 주소: `http://localhost:8055`
- 개인 API 키: `.env`에만 보관
- 중요한 프로젝트: 프로젝트 내보내기로 별도 백업
