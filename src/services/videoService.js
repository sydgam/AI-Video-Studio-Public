import { loadAsset } from '../core/assetStore.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('영상의 시작 이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

export async function generateVideo(options) {
  const isGoogleModel = options.model === 'gemini-omni-1.1-flash' || options.model?.startsWith('veo-');
  const images = [];
  for (const asset of options.sourceAssets || []) {
    const stored = await loadAsset(asset?.id);
    if (!stored?.blob) throw new Error(`영상 참조 이미지를 찾지 못했습니다: ${asset?.name || asset?.id}`);
    images.push({
      name: asset.name || stored.name || `reference-${images.length + 1}.png`,
      dataUrl: await blobToDataUrl(stored.blob)
    });
  }
  if (!images.length && !isGoogleModel) throw new Error('영상으로 만들 이미지가 연결되지 않았습니다.');
  let response;
  try {
    response = await fetch(isGoogleModel ? '/api/google/videos/generations' : '/api/wavespeed/videos/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        prompt: options.prompt,
        resolution: options.resolution,
        duration: options.duration,
        generateAudio: options.generateAudio,
        enableSafetyChecker: options.enableSafetyChecker,
        aspectRatio: options.aspectRatio,
        referenceMode: options.referenceMode,
        images
      })
    });
  } catch (error) {
    throw new Error('로컬 API 서버에 연결하지 못했습니다. 서버 창을 닫고 START-STUDIO.cmd로 다시 실행한 뒤, 열린 통합 스튜디오 화면에서 다시 시도해 주세요.');
  }
  const submitted = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(submitted.error || `영상 생성 요청 실패 (${response.status})`);
  if (!submitted.id) throw new Error('영상 생성 응답에 작업 ID가 없습니다.');
  if (submitted.status === 'completed' && submitted.videoUrl) {
    return {
      id: submitted.id,
      videoUrl: submitted.videoUrl,
      status: submitted,
      mode: submitted.mode,
      effectiveModel: submitted.effectiveModel,
      imageCount: submitted.imageCount
    };
  }
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, Math.min(10000, 2500 + attempt * 100)));
    const statusPath = isGoogleModel
      ? `/api/google/videos/operations?id=${encodeURIComponent(submitted.id)}`
      : `/api/wavespeed/predictions?id=${encodeURIComponent(submitted.id)}`;
    const statusResponse = await fetch(statusPath, { cache: 'no-store' });
    const status = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) throw new Error(status.error || `영상 작업 조회 실패 (${statusResponse.status})`);
    const state = String(status.status || '').toLowerCase();
    if (state === 'completed') {
      const videoUrl = status.outputs?.[0];
      if (!videoUrl) throw new Error('완료된 작업에 영상 URL이 없습니다.');
      return {
        id: submitted.id,
        videoUrl,
        status,
        mode: submitted.mode,
        effectiveModel: submitted.effectiveModel,
        imageCount: submitted.imageCount
      };
    }
    if (['failed', 'cancelled', 'timeout'].includes(state)) {
      throw new Error(status.error || status.message || `WaveSpeedAI 영상 생성이 ${state} 상태로 종료되었습니다.`);
    }
  }
  throw new Error('영상 생성 대기 시간이 초과되었습니다. 작업은 WaveSpeedAI에서 계속 진행 중일 수 있습니다.');
}

export function init() {
  console.info('videoService 준비됨');
}
