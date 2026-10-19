const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../app/core.js');
const source = fs.readFileSync(path.join(__dirname,'../examples/sample-report.json'),'utf8');
const sample = () => JSON.parse(source);

test('fictional sample preserves coverage gap and collected PR state as separate facts', async () => {
  const loaded = await core.parse(source);
  assert.equal(loaded.report.synthetic, true);
  const issue = loaded.report.issues[0];
  assert.equal(issue.state, 'open');
  assert.equal(issue.comments.reported_total, 11);
  assert.equal(issue.comments.entries.length, 5);
  assert.equal(issue.references[0].state, 'merged');
  assert.equal(loaded.sha256, require('node:crypto').createHash('sha256').update(source).digest('hex'));
});

test('review download/reopen keeps exact original source bytes, all notes and choices', async () => {
  const loaded = await core.parse(source);
  const key = loaded.report.issues[0].key;
  const decisions = {[key]:{verdict:'followup',notes:'Check the current release. 核对导出。',updated_at:'2026-10-01T11:00:00Z'}};
  const bundle = core.review(loaded,decisions);
  const reopened = await core.parse(JSON.stringify(bundle));
  assert.equal(reopened.source, source);
  assert.deepEqual(reopened.decisions[key], decisions[key]);
  assert.equal(reopened.sha256, loaded.sha256);
});

test('changed bundled source is detected rather than presented with the old hash', async () => {
  const bundle = core.review(await core.parse(source), {});
  bundle.source_text += ' ';
  await assert.rejects(core.parse(JSON.stringify(bundle)), /SHA-256/);
});

test('foreign review decisions and invalid verdicts cannot be restored', async () => {
  const loaded = await core.parse(source);
  const bundle = core.review(loaded, {});
  bundle.decisions['other/project#9'] = {verdict:'prototype',notes:'x',updated_at:'2026-10-01'};
  await assert.rejects(core.parse(JSON.stringify(bundle)), /absent/);
  bundle.decisions = {[loaded.report.issues[0].key]:{verdict:'automatic winner',notes:'',updated_at:'2026-10-01'}};
  await assert.rejects(core.parse(JSON.stringify(bundle)), /decision/);
});

test('duplicate issue keys do not inflate the issue list', () => {
  const report = sample();
  report.issues[1] = {...report.issues[0],key:report.issues[0].key.toUpperCase()};
  assert.throws(()=>core.validate(report),/Duplicate/);
});

test('source URLs reject script schemes, misleading hostnames and userinfo', () => {
  assert.equal(core.github('javascript:alert(1)'), null);
  assert.equal(core.github('https://github.com.evil.invalid/a/b'), null);
  assert.equal(core.github('https://user:pass@github.com/a/b'), null);
  assert.equal(core.github('https://github.com/a/b/issues/1'), 'https://github.com/a/b/issues/1');
  const report = sample();report.issues[0].url='https://evil.invalid/';
  assert.throws(()=>core.validate(report),/URL/);
});

test('shortened Unicode source excerpts use codepoint counts compatible with Python', () => {
  const report = sample();report.issues[0].body={text:'园🌱',characters:2,truncated:false};
  assert.equal(core.validate(report).issues[0].body.text,'园🌱');
});

test('missing sources cannot be labelled complete and duplicate comment IDs are rejected', () => {
  const report = sample();report.failures=['comments:unavailable'];
  assert.throws(()=>core.validate(report),/partial/);
  const second = sample();second.issues[0].comments.entries[1].id=second.issues[0].comments.entries[0].id;
  assert.throws(()=>core.validate(second),/comment/);
});
