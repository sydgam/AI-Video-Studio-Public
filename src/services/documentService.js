import { saveAsset } from '../core/assetStore.js';
import { createId } from '../utils/id.js';

const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'pptx', 'rtf', 'odt', 'txt', 'md', 'json', 'html', 'xml'
]);

const DOCUMENT_MIME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  html: 'text/html',
  xml: 'application/xml'
};

function extensionOf(name = '') {
  return name.toLowerCase().split('.').pop();
}

function documentMimeType(file, extension) {
  const browserType = String(file?.type || '').trim().toLowerCase();
  return DOCUMENT_MIME_TYPES[extension] || browserType || 'application/octet-stream';
}

export async function extractPresentationText(name, dataUrl) {
  const response = await fetch('/api/documents/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataUrl })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '문서를 읽지 못했습니다.');
  return payload.text || '';
}

export async function saveDocumentFile(file, imageOnly = false) {
  if (file && !file.size) throw new Error('비어 있는 파일은 업로드할 수 없습니다.');
  if (!file) throw new Error('파일을 선택해 주세요.');
  if (file.size > MAX_DOCUMENT_SIZE) throw new Error('파일은 50MB 이하여야 합니다.');
  if (imageOnly && !file.type.startsWith('image/')) {
    throw new Error('텍스트 이미지 노드에는 이미지 파일만 올릴 수 있습니다.');
  }
  const extension = extensionOf(file.name);
  if (!imageOnly && !DOCUMENT_EXTENSIONS.has(extension)) {
    throw new Error('PDF, Word, RTF, ODT 또는 텍스트 문서를 선택해 주세요.');
  }
  const asset = {
    id: createId(imageOnly ? 'ocr' : 'document'),
    name: file.name || (imageOnly ? 'text-image' : 'document'),
    type: imageOnly ? (file.type || 'application/octet-stream') : documentMimeType(file, extension),
    size: file.size,
    source: imageOnly ? 'ocr-image' : 'document-input',
    createdAt: new Date().toISOString()
  };
  await saveAsset({ ...asset, blob: file });
  return asset;
}
