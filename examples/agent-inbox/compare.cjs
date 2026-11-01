'use strict';
// Synthetic inputs only. Exercises selected functions from the pinned upstream files.
// See docs/case-agent-inbox-research.md for provenance, setup, and limits.
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const base = process.argv[2] && path.resolve(process.argv[2]);
if (!base) { console.error('Usage: node --experimental-strip-types examples/agent-inbox/compare.cjs <snapshot-dir>'); process.exit(2); }
const target = path.resolve(base, 'monitor-codex-ingest.cjs');
const required = {
  'lookout-codexMapping.ts': 'a80ceb6eea05c8eed2db278ea61af04b5c556880a2fb0ba4d130b895456566d1',
  'monitor-codex-ingest.cjs': '3def0f5c0300ee153d55b4b4fc253529f1b8037aaa7f5e53940964570a5af871',
};
for (const [name, expected] of Object.entries(required)) {
  let actual;
  try { actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, name))).digest('hex'); }
  catch { console.error(`Missing snapshot: ${name}`); process.exit(2); }
  if (actual !== expected) { console.error(`Snapshot SHA-256 does not match: ${name}`); process.exit(2); }
}
let session = { id:'synthetic-session', status:'active', ended_at:null, awaiting_input_since:null, awaiting_reason:null };
let agent = { id:'codex:synthetic-session', status:'working', ended_at:null, awaiting_input_since:null, awaiting_reason:null };
const yes = () => ({changes:1});
const stmts = {
  getSession: {get: id => id === session.id ? {...session} : undefined},
  getAgent: {get: id => id === agent.id ? {...agent} : undefined},
  reactivateSession: {run: () => {session.status='active'; session.ended_at=null; return yes();}},
  clearSessionAwaitingInput: {run: () => {session.awaiting_input_since=null; session.awaiting_reason=null; return yes();}},
  reactivateAgent: {run: () => {agent.status='working'; agent.ended_at=null; return yes();}},
  clearAgentAwaitingInput: {run: () => {agent.awaiting_input_since=null; agent.awaiting_reason=null; return yes();}},
  setSessionAwaitingInput: {run: (at, reason) => {session.awaiting_input_since=at; session.awaiting_reason=reason; return yes();}},
  setAgentAwaitingInput: {run: (at, reason) => {agent.awaiting_input_since=at; agent.awaiting_reason=reason; return yes();}},
  updateAgent: {run: (_name, status) => {agent.status=status; return yes();}},
};
const originalLoad = Module._load;
const targetRealPath = fs.realpathSync(target);
Module._load = function(request, parent, isMain) {
  if (parent?.filename === targetRealPath) {
    if (request === '../db') return {db:{}, stmts};
    if (['./codex-home', './claude-home', './codex-plan-call'].includes(request)) return {};
  }
  return originalLoad.apply(this, arguments);
};
const monitor = require(target);
Module._load = originalLoad;
const event = type => monitor.applyCodexTranscriptLifecycle(session.id, {type:'event_msg', payload:{type}});
const out = [];
function capture(label) {out.push({label, agent_status:agent.status, reason:session.awaiting_reason});}
(async () => {
  const lookout = await import(pathToFileURL(path.join(base, 'lookout-codexMapping.ts')).href);
  const lookup = lastTurn => lookout.mapCodexStatus({lastTurn, live:true});
  assert.equal(lookup('task_started'), 'working');
  assert.equal(lookup('task_complete'), 'idle');
  assert.equal(lookup('turn_aborted'), 'idle');
  assert.equal(lookup('synthetic_unrecognized_event'), 'unknown');
  event('task_started'); capture('turn started');
  assert.equal(agent.status, 'working');
  event('synthetic_unrecognized_event'); capture('unrecognized synthetic event');
  assert.equal(agent.status, 'working');
  event('task_complete'); capture('turn complete');
  assert.equal(agent.status, 'waiting'); assert.equal(session.awaiting_reason, 'stop');
  event('task_started'); capture('new turn');
  assert.equal(agent.status, 'working'); assert.equal(session.awaiting_reason, null);
  event('turn_aborted'); capture('turn aborted');
  assert.equal(agent.status, 'waiting'); assert.equal(session.awaiting_reason, 'interrupted');
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(base,file))).digest('hex');
  console.log(JSON.stringify({
    captured_at:new Date().toISOString(),
    lookout:{source_commit:'7eceec6d9685496fdd64223cd1af3b08d2f65ccf', source_sha256:hash('lookout-codexMapping.ts'), input_live:true, task_started:lookup('task_started'), task_complete:lookup('task_complete'), turn_aborted:lookup('turn_aborted'), unrecognized:lookup('synthetic_unrecognized_event')},
    monitor:{source_commit:'3cb22ae4a4e2ca31145351e1d73e05d0ff41f2dc', source_sha256:hash('monitor-codex-ingest.cjs'), sequence:out},
    limitations:'Isolated calls to upstream functions with synthetic records and in-memory database stubs. No actual Codex session, approval request, full application, hooks, real database, or UI was run. An unrecognized event is a control, not a claim about Codex event types.'
  },null,2));
})().catch(err => {console.error(err); process.exitCode=1});
