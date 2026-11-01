# 谁在等我？从社区讨论找到现成的 Agent 工具

同时跑着几个编程 Agent 时，哪一个正在等人处理？我们先顺着一条讨论找现有方案，再决定是否值得做一个新看板。

## 从一条讨论出发

2026 年 10 月 7 日，[Pinrail 作者在 Hacker News 分享了项目](https://news.ycombinator.com/item?id=49995778)。作者讲到想在终端之外审核 Agent 的工作；[一位评论者](https://news.ycombinator.com/item?id=50005083)提到自己需要在不同对话和浏览器窗口之间寻找待处理事项，另一位[询问改动变化后审批是否会过期](https://news.ycombinator.com/item?id=50000716)。这些是不同的观察，不能直接算成客户数量，也不能说明现有方案都解决不了。

2026 年 11 月 1 日，我们用 GapCue 当前源码中的命令行采集了这条讨论：当时来源显示 10 条评论，工具采集到 10 条。帖子和评论之后可能变化：

```sh
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=49995778" --out ./pinrail-review
```

`--out` 要填写一个尚不存在的目录。把生成的 `review.json` 打开到[中文调研台](https://lydiatools.github.io/gapcue/?lang=zh)，就能把自己的笔记和采集时的来源放在一起。此示例需要联网和 Node 20 以上；它读取的是一条讨论，不代表这个话题下的全部声音。

## 再找现成方案

同一天，我们核对了下面这些项目的公开 README。表格描述的是维护者写明的用途；我们没有安装它们，也没有在真实工作中做并排比较。

| 项目 | 公开文档中的方向 |
| --- | --- |
| [Pinrail](https://github.com/forgeplane/pinrail) | Agent 提交待审核内容并等待决定的桌面收件箱。 |
| [Agent Lookout](https://github.com/Olanetsoft/agent-lookout) | 本地 Agent 会话看板。其支持表中，Claude Code 有“需要你处理”状态，Codex 没有。 |
| [AgentPulse](https://github.com/jstuart0/agentpulse) | 自托管看板，文档介绍了会话监控和可选的编排功能。 |
| [Claude Code Agent Monitor](https://github.com/hoangsonww/Claude-Code-Agent-Monitor) | 面向 Claude Code、Cursor 和 Codex 会话的本地优先看板；核查时 GitHub 显示 1,135 Star。 |
| [Agent Quest](https://github.com/FulAppiOS/Agent-Quest) | 将兼容的本地 Claude Code 和 Codex 会话做成可视化看板。 |

1,135 Star 属于对方项目，是当时的快照，不能算作 GapCue 的用户，也不能证明新看板会获得同样的 Star。其他工具如何处理 Codex 等待状态，仍需要实际测试。另外，[AI-DLC 的一条功能请求](https://github.com/awslabs/aidlc-workflows/issues/3331)希望让团队成员通过只读页面了解流程进度；它相关，但与监控本地多个 Agent 会话不是同一个任务。

## “等待”具体是什么意思？

我们用相同的虚构生命周期输入，测试了两个固定版本中的部分函数。对于打开的会话，Agent Lookout 的状态映射在 `task_started` 时返回 `working`，在 `task_complete` 和 `turn_aborted` 时都返回 `idle`。Agent Monitor 的生命周期处理函数在 `task_complete` 后显示 `waiting`、原因是 `stop`，在 `turn_aborted` 后也显示 `waiting`、原因是 `interrupted`。这是两个函数对输入的不同解释，不能据此证明真实会话正在等待审批。

测试调用了上游实际函数，但用内存替身替代了 Agent Monitor 的数据库；没有运行两个完整应用、Codex、真实审批、钩子或界面。OpenAI 的 [app-server 文档](https://learn.chatgpt.com/docs/app-server#track-thread-status-changes)另有已加载对话的 `waitingOnApproval` 状态；这并不能证明新启动的 app-server 能看到其他进程中的实时状态。

<details>
<summary>复现这次隔离的源码函数检查</summary>

需要 Node 22.23（本次测试版本）、Python 3 和已登录的 GitHub CLI。下面的命令把两个固定版本的 MIT 上游源码下载到新建临时目录；对照脚本加载前会核对 SHA-256，不读取 Codex 会话文件，也不启动服务。

```sh
probe_dir=$(mktemp -d)
gh api 'repos/Olanetsoft/agent-lookout/contents/src/core/mapping/codexMapping.ts?ref=7eceec6d9685496fdd64223cd1af3b08d2f65ccf' --jq .content | python3 -c 'import base64,sys;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > "$probe_dir/lookout-codexMapping.ts"
gh api 'repos/hoangsonww/Claude-Code-Agent-Monitor/contents/server/lib/codex-ingest.js?ref=3cb22ae4a4e2ca31145351e1d73e05d0ff41f2dc' --jq .content | python3 -c 'import base64,sys;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > "$probe_dir/monitor-codex-ingest.cjs"
node --experimental-strip-types examples/agent-inbox/compare.cjs "$probe_dir"
```

请在当前 GapCue 源码目录运行。脚本和本次比较晚于 v0.6.2 预览 ZIP。测试里的未识别事件是虚构对照，不代表 Codex 真实事件名称。下载的上游文件会留在临时目录供检查。

</details>

## 这次的决定

**继续调研，暂不因为这个样本再做一个通用 Agent 看板。** 已有多个工具介绍了相近的工作流程；这条讨论提供了线索，但样本不足以证明还有一个明确未满足的需求。

下一步可以用隔离测试会话，对照各项目当时的说明，检查它们如何识别“Codex 会话正在等待用户输入”。先弄清每个工具实际掌握什么状态证据。本案例没有声称它们存在故障，也没有声称已经完成这项测试。

[返回 GapCue](../README.zh-CN.md#从一条真实线索开始) · [English](case-agent-inbox-research.md)
