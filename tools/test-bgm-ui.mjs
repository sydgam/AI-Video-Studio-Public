import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const nodes = new Map();
class Element {
  value = ''; checked = false; disabled = false; handlers = {}; classList = {contains: () => false};
  addEventListener(type, handler) { this.handlers[type] = handler; }
  checkValidity() { return this.disabled || ((!this.required || this.value !== '') && (this.max === undefined || this.value === '' || Number(this.value) <= Number(this.max))); }
  reportValidity() { return this.checkValidity(); }
  closest() { return null; }
}
for (const [, id] of html.matchAll(/id="(bgm[^"]+)"/g)) nodes.set(id, new Element());
for (const [, id, tail] of html.matchAll(/<input id="(bgm[^"]+)"([^>]*)>/g)) {
  nodes.get(id).value = tail.match(/value="([^"]*)"/)?.[1] || '';
  nodes.get(id).checked = tail.includes('checked');
  nodes.get(id).required = tail.includes('required');
}
for (const [, id, content] of html.matchAll(/<select id="(bgm[^"]+)"[^>]*>(.*?)<\/select>/gs)) nodes.get(id).value = content.match(/value="([^"]*)"/)?.[1] || '';
const el = name => nodes.get('bgm' + name);
globalThis.document = {getElementById: id => nodes.get(id)};
globalThis.localStorage = {getItem: () => JSON.stringify({Mode: 'auto', Seed: '42'}), setItem() {}};
globalThis.setInterval = () => 0;
const requests = [];
globalThis.fetch = async (url, options) => {
  if (options) requests.push(JSON.parse(options.body));
  return {ok: true, json: async () => options ? {} : {ready: true, busy: false, jobs: []}};
};
const {init} = await import('../src/bgm/bgm.js');
init();
el('Prompt').value = 'A pop song';
assert.equal(el('Instrumental').checked, false);
assert.equal(el('Lyrics').disabled, false);
el('Instrumental').checked = true;
el('Instrumental').handlers.change();
assert.equal(el('Lyrics').disabled, true);
assert.equal(el('Language').disabled, true);
el('LimitDuration').checked = false;
el('LimitDuration').handlers.change();
assert.equal(el('Duration').max, '600');
el('Duration').value = '180';
await el('Generate').handlers.click();
assert.equal(requests[0].mode, 'instrumental');
assert.equal(requests[0].limitDuration, false);
assert.equal(requests[0].duration, 180);
assert.equal('seed' in requests[0], false);
el('Instrumental').checked = false;
el('Instrumental').handlers.change();
assert.equal(el('Lyrics').disabled, false);
assert.ok(!el('Preview').textContent.includes('No vocals'));
console.log('BGM UI: mode, lyrics, duration cap and random seed request passed.');
