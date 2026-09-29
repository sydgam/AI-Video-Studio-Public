# Pixel Office Navigation 편집 가이드

## 열기

1. Tiled Map Editor를 설치하고 실행합니다.
2. `public/assets/game/maps/office-navigation-v2.json`을 엽니다.
3. `Visual Background` 레이어는 좌표 기준 이미지이며 기본적으로 잠겨 있습니다.
4. 수정할 Object Layer를 선택한 뒤 Polygon 또는 Point를 편집합니다.

스튜디오는 `office-navigation-v2.json`을 직접 읽습니다. Tiled에서 저장한 뒤 브라우저를 새로고침하면 변경 사항이 적용됩니다.

## 레이어

- `Walkable` — 초록색. 캐릭터가 이동할 수 있는 바닥 Polygon입니다.
- `Collision` — 빨간색. 가구, 벽, 장비 등 통과할 수 없는 Polygon입니다.
- `Door` — 주황색. 방과 통로를 연결하는 출입구입니다.
- `InteractionAnchor` — 파란색. 책상이나 장비 앞의 업무 위치입니다.
- `Seat` — 보라색. 회의 좌석과 임원 좌석 위치입니다.
- `Spawn` — 흰색. 캐릭터가 처음 나타나는 위치입니다.
- `Waypoint` — 노란색. 장거리 이동에서 사용하는 주요 경유점입니다.

## Polygon 편집

1. 레이어 목록에서 `Walkable` 또는 `Collision`을 선택합니다.
2. 편집할 Polygon을 클릭합니다.
3. 꼭짓점을 드래그해 배경에 맞춥니다.
4. 꼭짓점을 추가하거나 삭제할 때는 Tiled의 `Edit Polygons` 도구를 사용합니다.
5. 캐릭터 폭을 고려해 벽과 가구에서 약간의 여백을 둡니다.

큰 Rectangle 하나로 방이나 가구 전체를 덮지 말고, 실제 통로와 가구 외곽을 따라 단순화된 Polygon을 사용하는 것이 좋습니다.

## Anchor 이동

Point Anchor는 작은 점으로 표시됩니다. 점을 선택해 캐릭터가 실제로 서야 할 바닥 위치로 옮깁니다.

- 가구 Collision 내부가 아니라 가구 앞쪽 바닥에 배치합니다.
- `facing` 속성은 `north`, `south`, `east`, `west` 중 하나를 사용합니다.
- `actionType`, `objectId`, `role` 속성 이름은 변경하지 않습니다.

## 주의사항

- 레이어 이름은 변경하지 않습니다.
- Object의 `name`은 Agent 설정에서 참조하므로 가급적 변경하지 않습니다.
- 맵 크기와 배경 크기는 `1920 x 1080` 기준입니다.
- 배경 레이어의 위치나 크기는 수정하지 않습니다.
- 실수했을 때는 저장하지 않고 다시 열거나 Git 변경 내역에서 JSON만 되돌릴 수 있습니다.
