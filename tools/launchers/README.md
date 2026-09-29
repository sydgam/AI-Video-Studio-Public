# 개발 및 진단용 실행기

일반 사용자는 프로젝트 루트의 `START-STUDIO.cmd`만 실행합니다.

- `START-LEGACY-STUDIO.cmd`: Pixel Office 빌드를 생략하고 기존 서버만 실행
- `START-PIXEL-OFFICE.cmd`: Pixel Office 개발 서버만 실행
- `START-TTS.cmd`: 로컬 TTS 엔진만 강제로 재시작
- `START-LOCAL-BGM.cmd`: ACE-Step BGM을 명령행에서 단독 테스트

통합 스튜디오와 레거시 서버는 같은 8055 포트를 사용하므로 동시에 실행하지 않습니다.
