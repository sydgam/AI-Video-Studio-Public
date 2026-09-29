export type OfficeRoomId =
  | 'strategy'
  | 'narrative'
  | 'shot-design'
  | 'frame-art'
  | 'motion'
  | 'quality'
  | 'commons'
  | 'boardroom';

export type NormalizedRoomBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OfficeRoomDefinition = {
  id: OfficeRoomId;
  name: string;
  labelX: number;
  labelY: number;
  bounds: NormalizedRoomBounds;
};

export const OFFICE_ROOMS: readonly OfficeRoomDefinition[] = [
  { id: 'strategy', name: '콘셉트 전략실', labelX: .13, labelY: .055, bounds: { x: .02, y: .03, width: .23, height: .29 } },
  { id: 'narrative', name: '내러티브 작가실', labelX: .335, labelY: .055, bounds: { x: .25, y: .03, width: .17, height: .29 } },
  { id: 'shot-design', name: '컷 설계실', labelX: .655, labelY: .055, bounds: { x: .59, y: .03, width: .18, height: .29 } },
  { id: 'frame-art', name: '프레임 미술실', labelX: .875, labelY: .055, bounds: { x: .77, y: .03, width: .21, height: .29 } },
  { id: 'motion', name: '모션 제작실', labelX: .15, labelY: .39, bounds: { x: .02, y: .35, width: .26, height: .31 } },
  { id: 'quality', name: '최종 검수실', labelX: .85, labelY: .39, bounds: { x: .72, y: .35, width: .26, height: .31 } },
  { id: 'commons', name: '중앙 공용 공간', labelX: .50, labelY: .055, bounds: { x: .28, y: .03, width: .44, height: .55 } },
  { id: 'boardroom', name: '임원진 회의실', labelX: .50, labelY: .625, bounds: { x: .13, y: .57, width: .74, height: .39 } }
] as const;
