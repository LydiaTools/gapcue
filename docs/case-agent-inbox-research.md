# A crowded inbox: from a community discussion to existing agent tools

When several coding agents are running, which one needs you? We followed one discussion into the existing tools before deciding whether to build another dashboard.

## Start with a discussion

On 7 October 2026, [Pinrail's author shared the project on Hacker News](https://news.ycombinator.com/item?id=49995778). The author described reviewing agent work outside a terminal; [one commenter](https://news.ycombinator.com/item?id=50005083) described moving between threads and browser windows to find what needed attention. Another [asked about an approval becoming stale](https://news.ycombinator.com/item?id=50000716). These are separate observations, not a count of customers or proof that the same problem has no solution.

Using GapCue's current-source CLI on 1 November 2026, we collected that HN story and 10 comments; the source reported 10 at collection time. The discussion and its replies can change:

```sh
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=49995778" --out ./pinrail-review
```

`--out` must name a new directory. Open the generated `review.json` in the [research desk](https://lydiatools.github.io/gapcue/) to keep your own notes beside the captured source. This example needs internet access and Node 20+. It reads one thread, not every discussion on this topic.

## Look for existing approaches

On the same date we inspected these public READMEs. Descriptions are the maintainers' stated scope; we did not install or compare the products in a real workflow.

| Project | Starting point in its documentation |
| --- | --- |
| [Pinrail](https://github.com/forgeplane/pinrail) | A desktop inbox where an agent submits a review and waits for a decision. |
| [Agent Lookout](https://github.com/Olanetsoft/agent-lookout) | A local agent-session dashboard. Its support table lists “Needs you” for Claude Code, but not for Codex. |
| [AgentPulse](https://github.com/jstuart0/agentpulse) | A self-hosted dashboard describing both session monitoring and optional orchestration. |
| [Claude Code Agent Monitor](https://github.com/hoangsonww/Claude-Code-Agent-Monitor) | A local-first dashboard for Claude Code, Cursor and Codex sessions; GitHub showed 1,135 Stars at this check. |
| [Agent Quest](https://github.com/FulAppiOS/Agent-Quest) | A visual dashboard for compatible local Claude Code and Codex sessions. |

The 1,135 Stars belong to the other project; they are a snapshot, not evidence that GapCue has users or that a new dashboard would gain Stars. The other tools may cover the Codex waiting-state scenario differently; their actual behavior needs testing. Separately, an [AI-DLC feature request](https://github.com/awslabs/aidlc-workflows/issues/3331) asks for a read-only progress page for people following a team workflow. It is a related but different job from monitoring several local agent sessions.

## What does “waiting” mean?

We tested selected functions from two pinned versions with the same fictional lifecycle inputs. For an open session, Agent Lookout's status mapper returned `working` for `task_started`, and `idle` for both `task_complete` and `turn_aborted`. Agent Monitor's lifecycle handler set `waiting` with reason `stop` after `task_complete`, and `waiting` with reason `interrupted` after `turn_aborted`. These labels describe different interpretations of the input; neither result demonstrates that a real session is waiting for an approval.

The test called the actual upstream functions but replaced Agent Monitor's database with an in-memory stub. It did not run either complete application, Codex, a real approval, hooks or an interface. OpenAI's [app-server documentation](https://learn.chatgpt.com/docs/app-server#track-thread-status-changes) separately describes a `waitingOnApproval` flag for a loaded thread. That does not establish that a new app-server can see another process's live state.

<details>
<summary>Reproduce the isolated source-function check</summary>

Requires Node 22.23 (tested), Python 3 and an authenticated GitHub CLI. The commands fetch the two pinned MIT-licensed upstream source files into a new temporary directory. The comparison script verifies their SHA-256 values before loading them; it does not access Codex session files or start a server.

```sh
probe_dir=$(mktemp -d)
gh api 'repos/Olanetsoft/agent-lookout/contents/src/core/mapping/codexMapping.ts?ref=7eceec6d9685496fdd64223cd1af3b08d2f65ccf' --jq .content | python3 -c 'import base64,sys;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > "$probe_dir/lookout-codexMapping.ts"
gh api 'repos/hoangsonww/Claude-Code-Agent-Monitor/contents/server/lib/codex-ingest.js?ref=3cb22ae4a4e2ca31145351e1d73e05d0ff41f2dc' --jq .content | python3 -c 'import base64,sys;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > "$probe_dir/monitor-codex-ingest.cjs"
node --experimental-strip-types examples/agent-inbox/compare.cjs "$probe_dir"
```

Run from the current GapCue source checkout. The script and this comparison were added after the v0.6.2 preview ZIP. Its unrecognized event is a synthetic control, not a statement about a real Codex event name. The fetched upstream files remain in the temporary directory for inspection.

</details>

## Decision

**Keep researching; do not build a generic agent dashboard from this sample.** Several tools already describe overlapping workflows. The HN discussion contains useful leads, but this small sample does not establish an unmet need or a distinct product.

A useful next check would be to compare how existing tools identify a *Codex session awaiting a person's input*, using isolated test sessions and each project's current instructions. First confirm what evidence each tool actually has for that state. This case does not claim any of them is broken or that such a test has been run.

[Back to GapCue](../README.md#follow-a-real-research-trail) · [中文](case-agent-inbox-research.zh-CN.md)
