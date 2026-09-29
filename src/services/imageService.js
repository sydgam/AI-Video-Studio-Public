import { loadAsset, saveAsset } from '../core/assetStore.js';
import { createId } from '../utils/id.js';

function base64ToBlob(encoded, mimeType) {
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('참조 이미지를 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

export async function saveReferenceImage(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('이미지 파일만 참조 이미지로 사용할 수 있습니다.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('참조 이미지는 파일당 30MB 이하여야 합니다.');
  }
  const metadata = {
    id: createId('asset'),
    name: file.name || 'reference-image',
    type: file.type,
    size: file.size,
    source: 'workflow-reference-image',
    createdAt: new Date().toISOString()
  };
  await saveAsset({ ...metadata, blob: file });
  return metadata;
}

export async function generateImage(options) {
  const referenceImages = [];
  for (const asset of options.referenceAssets || []) {
    const stored = await loadAsset(asset.id);
    if (!stored?.blob) {
      throw new Error(`참조 이미지 파일을 찾지 못했습니다: ${asset.name || asset.id}`);
    }
    referenceImages.push({
      name: asset.name || stored.name || 'reference-image',
      dataUrl: await blobToDataUrl(stored.blob)
    });
  }
  let response;
  try {
    response = await fetch('/api/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...options, referenceAssets: undefined, referenceImages })
    });
  } catch (error) {
    throw new Error(
      '이미지 생성 서버에 연결하지 못했습니다. 실행 중인 서버 창을 닫고 START-STUDIO.cmd를 다시 실행한 뒤, 열린 통합 스튜디오 화면에서 생성해 주세요.'
    );
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 404 &&
      result.error === 'API 경로를 찾을 수 없습니다.'
    ) {
      throw new Error(
        '이전 버전 서버가 실행 중입니다. 서버 창을 닫고 START-STUDIO.cmd를 다시 실행해 주세요.'
      );
    }
    throw new Error(result.error || `이미지 생성 요청 실패 (${response.status})`);
  }
  if (!result.imageBase64) {
    throw new Error('생성된 이미지 데이터가 비어 있습니다.');
  }

  const extension = result.outputFormat === 'jpeg' ? 'jpg' : result.outputFormat;
  const mimeType = result.outputFormat === 'jpeg' ? 'image/jpeg' : `image/${result.outputFormat}`;
  const id = createId('asset');
  const blob = base64ToBlob(result.imageBase64, mimeType);
  const metadata = {
    id,
    name: `ai-image-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
    type: mimeType,
    size: blob.size,
    source: 'ai-image-generation',
    provider: result.provider,
    model: result.model,
    aspectRatio: result.aspectRatio,
    resolution: result.resolution,
    createdAt: new Date().toISOString()
  };
  await saveAsset({ ...metadata, blob });
  return { asset: metadata, usage: result.usage || null };
}
