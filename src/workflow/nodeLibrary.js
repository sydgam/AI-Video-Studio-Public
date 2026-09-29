export const NODE_CATEGORIES = [
  {
    id: 'input',
    label: '입력',
    nodes: [
      { type: 'project-overview', label: '프로젝트 개요', description: '현재 프로젝트의 기획 정보를 불러옵니다.', icon: 'IN' },
      { type: 'text-input', label: '텍스트 입력', description: '직접 작성한 텍스트를 전달합니다.', icon: 'T' },
      { type: 'document-input', label: '문서 입력', description: 'PDF, Word, PowerPoint와 텍스트 문서를 LLM에 전달합니다.', icon: 'DOC' },
      { type: 'ocr-image', label: '텍스트 이미지', description: '문자나 표가 포함된 이미지를 GPT가 읽도록 전달합니다.', icon: 'OCR' },
      { type: 'google-docs', label: 'Google Docs', description: 'Google 계정의 공유 문서를 읽기 전용으로 불러옵니다.', icon: 'GD' },
      { type: 'storyboard-input', label: '스토리보드', description: '컷 정보와 프롬프트를 불러옵니다.', icon: 'SB' },
      { type: 'global-style', label: '글로벌 스타일', description: '톤앤매너·색감·무드 참조 이미지를 최대 6장 전달합니다.', icon: 'STYLE' }
    ]
  },
  {
    id: 'language',
    label: '텍스트 AI',
    nodes: [
      { type: 'conversational-agent', label: '대화형 에이전트', description: '대화를 이어가며 확정한 답변을 워크플로우로 전달합니다.', icon: 'AG' },
      { type: 'openai-chat', label: 'GPT', description: 'OpenAI 언어 모델을 사용합니다.', icon: 'GPT' },
      { type: 'anthropic-chat', label: 'Claude', description: 'Anthropic 언어 모델을 사용합니다.', icon: 'CL' },
      { type: 'google-chat', label: 'Gemini', description: 'Google 언어 모델을 사용합니다.', icon: 'GM' }
    ]
  },
  {
    id: 'image',
    label: '이미지 AI',
    nodes: [
      { type: 'image-generator', label: '이미지 생성', description: '서비스와 이미지 모델을 선택합니다.', icon: 'IMG' },
      { type: 'reference-image', label: '참조 이미지', description: '에셋 이미지를 AI 입력으로 전달합니다.', icon: 'REF' }
    ]
  },
  {
    id: 'audio',
    label: '오디오 AI',
    nodes: [
      { type: 'suno-bgm', label: 'Suno BGM 생성', description: '승인된 프롬프트로 배경음악 두 곡을 생성합니다.', icon: 'BGM' }
    ]
  },
  {
    id: 'video',
    label: '영상 AI',
    nodes: [
      { type: 'video-generator', label: '영상 생성', description: 'WaveSpeedAI의 Seedance 모델로 이미지를 영상으로 만듭니다.', icon: 'VID' }
    ]
  },
  {
    id: 'human',
    label: '사람 개입',
    nodes: [
      { type: 'human-review', label: '검토 및 수정', description: '결과를 사람이 수정하고 승인합니다.', icon: 'OK' }
    ]
  },
  {
    id: 'utility',
    label: '메모',
    nodes: [
      { type: 'note', label: '노트', description: '워크플로우 위에 자유롭게 배치하는 메모지입니다.', icon: 'NOTE' }
    ]
  },
  {
    id: 'output',
    label: '출력',
    nodes: [
      { type: 'storyboard-output', label: '스토리보드 반영', description: '승인 결과를 프로젝트에 적용합니다.', icon: 'OUT' }
    ]
  }
];

export function getNodeDefinition(nodeType) {
  for (const category of NODE_CATEGORIES) {
    const definition = category.nodes.find((node) => node.type === nodeType);
    if (definition) {
      return { ...definition, category: category.label };
    }
  }
  return null;
}
