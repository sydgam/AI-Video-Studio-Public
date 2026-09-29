import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const nodes = new Map();
class Element {
  value = ''; hidden = false; disabled = false; dataset = {}; handlers = {}; options = []; textContent = '';
  addEventListener(type, fn) { this.handlers[type] = fn; }
  async fire(type, event = {}) { return this.handlers[type]?.(event); }
  querySelector() { return this; }
  get selectedOptions() { return this.options.filter(o => o.value === this.value); }
  focus() {} pause() {} removeAttribute(name) { delete this[name]; }
}
for (const [, id] of html.matchAll(/id="(tts[^"]+)"/g)) nodes.set(id, new Element());
for (const [, id, body] of html.matchAll(/<select id="(tts[^"]+)"[^>]*>(.*?)<\/select>/gs)) {
  const el = nodes.get(id);
  el.options = [...body.matchAll(/<option value="([^"]*)"[^>]*>(.*?)<\/option>/gs)].map(([, value, textContent]) => ({ value, textContent }));
  el.value = el.options[0].value;
}
const panels = ['preset', 'design', 'clone'].map(mode => Object.assign(new Element(), { dataset: { ttsModePanel: mode } }));
globalThis.document = { getElementById: id => nodes.get(id), querySelectorAll: () => panels };
const get = id => nodes.get('tts' + id);
let posted;
globalThis.fetch = async (url, options) => {
  if (url.startsWith('data:')) return { blob: async () => new Blob(['audio'], { type: 'audio/wav' }) };
  if (options?.method === 'POST') {
    posted = JSON.parse(options.body);
    return { ok: true, json: async () => ({ audio: 'data:audio/wav;base64,YQ==' }) };
  }
  return { ok: true, json: async () => ({ ready: true, busy: false, capabilities: { preset: true, design: true, clone: true }, availableModels: ['Qwen/1.7B-CustomVoice', 'Qwen/0.6B-CustomVoice', 'Qwen/1.7B-VoiceDesign', 'Qwen/1.7B-Base'] }) };
};
const source = fs.readFileSync('src/tts/tts.js', 'utf8');
const { init } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
init();
await new Promise(resolve => setImmediate(resolve));
get('Speaker').value = 'Ryan'; await get('Speaker').fire('change');
assert.equal(get('SpeakerSample').src, '/assets/tts/speakers/ryan.wav');
get('Mode').value = 'design'; await get('Mode').fire('change');
get('Script').value = '실제로 읽을 대사';
await get('GenerateButton').fire('click');
assert.equal(posted, undefined, 'Design must require a description');
get('Instruction').value = '차분한 중년 남성';
await get('GenerateButton').fire('click');
assert.equal(posted.text, '실제로 읽을 대사');
assert.equal(posted.instruct, '차분한 중년 남성');
assert.equal(Object.hasOwn(posted, 'speaker'), false, 'Design must not send a preset speaker');
get('Pace').value = 'slightly_fast';
get('Emotion').value = 'lament';
get('EndingEmotion').value = 'confident';
await get('Pace').fire('change');
const preview = get('PromptPreview').textContent;
await get('GenerateButton').fire('click');
assert.equal(posted.instruct, preview, 'The preview must match the actual request');
assert.ok(posted.instruct.startsWith('차분한 중년 남성\n'));
assert.match(posted.instruct, /약간 빠르게/);
assert.match(posted.instruct, /한탄과 아쉬움/);
assert.match(posted.instruct, /마지막 문장에서만 자신감 있고 의기양양한/);
assert.equal(get('Instruction').value, '차분한 중년 남성', 'Controls must not alter the user text');
get('Script').value = '새로 편집한 대사';
await get('UseAsReference').fire('click');
assert.equal(get('Mode').value, 'clone');
assert.equal(get('ReferenceText').value, '실제로 읽을 대사', 'Reference transcript must use the generated text, not the edited script');
assert.equal(get('Script').value, '새로 편집한 대사');
assert.equal(get('InstructionField').hidden, true);
assert.equal(get('Pace').disabled, true);
assert.match(get('PromptPreview').textContent, /보내지 않습니다/);
assert.equal(get('ReferencePlayer').hidden, false);
await get('ReferenceClear').fire('click');
assert.equal(get('ReferenceText').value, '');
assert.equal(get('ReferencePlayer').hidden, true);
get('Mode').value = 'preset'; await get('Mode').fire('change');
get('Model').value = 'qwen3-tts-0.6b'; await get('Model').fire('change');
assert.equal(get('Instruction').disabled, true);
assert.equal(get('Emotion').disabled, true);
await get('GenerateButton').fire('click');
assert.equal(posted.instruct, '');
get('Mode').value = 'design'; await get('Mode').fire('change');
assert.equal(get('Model').value, 'qwen3-tts-1.7b');
assert.equal(get('Instruction').value, '차분한 중년 남성');
assert.equal(get('Pace').disabled, false);
for (const suffix of ['Pace', 'Emotion', 'EndingEmotion']) get(suffix).value = '';
await get('Pace').fire('change');
assert.equal(get('PromptPreview').textContent, '차분한 중년 남성');
assert.match(fs.readFileSync('styles/tts.css', 'utf8'), /\[hidden\].*display: none !important/);
console.log('TTS UI behavior checks passed (mock DOM; no browser or GPU generation).');
