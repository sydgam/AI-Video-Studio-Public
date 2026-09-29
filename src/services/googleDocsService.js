async function readJson(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Google Docs 요청 실패 (${response.status})`);
  return result;
}

export async function getGoogleDocsStatus() {
  return readJson(await fetch('/api/google/status', { cache: 'no-store' }));
}

export function connectGoogleAccount() {
  window.open('/api/google/oauth/start', 'google-docs-oauth', 'width=620,height=760');
}

export async function loadGoogleDocument(documentUrl) {
  return readJson(await fetch('/api/google/docs/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentUrl })
  }));
}
