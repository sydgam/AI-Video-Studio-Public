# AI Pixel Office — Phase 1

React, TypeScript, Phaser, Vite 기반 Pixel Office 프로토타입입니다. 기존 Canvas 기반 AI Video Studio는 상위 폴더에 그대로 보존되어 있으며 이 앱과 코드를 공유하지 않습니다.

## 실행

```powershell
cd pixel-office
npm.cmd install
npm.cmd run dev
```

통합 스튜디오는 브라우저에서 `http://localhost:8055`를 엽니다. Pixel Office만 단독으로 개발할 때는 `http://localhost:8054`를 사용합니다.

프로젝트 루트의 `START-STUDIO.cmd`는 통합 스튜디오를 빌드한 뒤 `8055` 포트로 실행합니다. Pixel Office 개발 화면과 기존 Canvas 호환 앱의 개별 실행기는 `tools/launchers/`에 있습니다.

통합 스튜디오와 기존 Canvas 호환 앱은 같은 포트를 사용하므로 둘 중 하나만 실행합니다.

## 구조

```text
src/
├─ app/                    React 애플리케이션과 최소 테스트 UI
├─ components/game/        React 안에서 Phaser 생명주기를 관리하는 컴포넌트
├─ game/
│  ├─ config/              논리 해상도와 Phaser 렌더러 설정
│  ├─ scenes/              Phaser Scene
│  ├─ events/              React ↔ Phaser Typed Event Bridge
│  ├─ systems/             이후 Navigation, Animation, Interaction 시스템
│  ├─ entities/            이후 Agent와 Character 엔티티
│  ├─ objects/             이후 World Object
│  └─ managers/            이후 Task, Scene, World 관리자
├─ hooks/                  이후 React 게임 연동 Hook
├─ store/                  이후 React 애플리케이션 상태
└─ types/                  공유 이벤트와 도메인 타입
```

## 생명주기

`PhaserGame.tsx`가 mount될 때 Phaser 인스턴스를 한 번 생성하고 unmount될 때 `game.destroy(true)`로 정리합니다. React re-render나 브라우저 resize는 게임을 다시 만들지 않습니다.

## Event Bridge

- `reactToGameEvents`: React 업무 UI가 Phaser 월드에 명령을 전달합니다.
- `gameToReactEvents`: Phaser 월드가 클릭과 상태 변경을 React UI에 알립니다.

이벤트 이름과 payload는 `src/types/gameEvents.ts`에서 TypeScript 타입으로 관리합니다.

## 다음 단계 시작점

- 건물과 월드 구성: `src/game/scenes/OfficeScene.ts`
- 방 이름과 정규화 좌표: `src/game/config/officeLayout.ts`
- 월드 크기와 렌더러 설정: `src/game/config/gameConfig.ts`
- 캐릭터 모델: `src/game/entities/`
- 이동·상호작용 시스템: `src/game/systems/`
- 클릭 가능한 사무실 오브젝트: `src/game/objects/`

Scene에는 오브젝트 생성과 시스템 호출만 두고, 실제 로직은 각 전용 모듈로 분리합니다.
