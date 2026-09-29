# AI Video Studio 캐릭터 시스템 규격

## 공통 프레임

- 논리 프레임: `96 × 128px`
- 캐릭터 비율: 2등신
- 발 기준점: 프레임의 `(50%, 94%)`
- 투명 PNG, 동일한 발 위치와 캐릭터 크기 유지
- 방향: 정면, 후면, 좌측, 우측

## 상태

`idle`, `walk`, `run`, `sitDown`, `seated`, `standUp`, `work`, `interact`, `talk`

착석과 일어서기는 중간에 다른 상태로 변경되지 않는 잠금 상태입니다. 회의나 작업 명령은 상태 큐에 순서대로 넣을 수 있습니다.

## 권장 정식 애니메이션 프레임

- 대기: 방향별 2프레임
- 걷기: 방향별 4프레임
- 달리기: 방향별 4프레임
- 앉기/일어서기: 각각 3프레임
- 앉은 대기: 2프레임
- 작업·상호작용·말하기: 각각 3프레임

현재 5프레임 캐릭터 시트에서 제공되지 않는 동작은 가장 가까운 기존 프레임으로 자동 대체합니다.

## 파일 구조 권장안

```text
assets/council/characters/{character-id}/
  manifest.json
  idle.png
  walk.png
  run.png
  sit.png
  work.png
  talk.png
```

`manifest.json`에 프레임 크기, 발 기준점, 상태별 FPS와 프레임 수를 저장하면 캐릭터를 추가할 때 렌더러 코드를 수정할 필요가 없습니다.
