# 热门讨论背后，这个方向已经有人在做了

浏览器 Agent 可以说“功能完成了”，开发者还需要看清屏幕上到底发生了什么。

[ProofShot 的 Hacker News 讨论](https://news.ycombinator.com/item?id=47499672)围绕这个问题展开。2026 年 10 月 31 日查看时，帖子有 161 分、106 条评论。一些参与者询问原生桌面或移动端应用；作者当时介绍了浏览器支持，并提到模拟器或无障碍接口等可能方向。讨论热烈，说明这个话题有人关注，但不能直接推断今天有多少人需要新产品。

## 用 GapCue 顺着线索往下看

打开[中文调研台](https://lydiatools.github.io/gapcue/?lang=zh)，粘贴 HN 帖子地址，选择“读取讨论”。也可以在源码目录运行 Node 命令：

```sh
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=47499672" --out ./proofshot-review
```

输出目录需要是新的。2026 年 10 月 31 日，我们匿名采集了索引中最早与最新的页面，得到 106 条已报告评论中的 16 条，请求没有失败。**中间大量讨论未被采集。** 下结论前仍需回到原帖；帖子内容和数字会变化。`complete` 表示本轮计划的读取请求完成，不代表讨论已全部读完。

这 16 条里有 7 条回复，其上文不在样本中。在网页中点击回复旁的“在这里看上文”，GapCue 会展示样本里已有的上文，或按需读取这一条公开评论。实时读取的上文只临时展示，不会加入保存的评审文件；需要以后核对时，可保留原文链接或记入自己的笔记。

## 再看看现在有什么

原帖发表于 2026 年 3 月。在把移动端请求视为今天的空白之前，我们于 10 月 31 日核对了相关项目的介绍：

- [ProofShot](https://github.com/AmElmo/proofshot) 介绍了包含截图、视频和日志的浏览器证据包；其[开放中的 Windows 问题 #50](https://github.com/AmElmo/proofshot/issues/50) 是另一个项目报告的故障，不代表我们的项目存在相同问题。
- [sim-use](https://github.com/lycorp-jp/sim-use) 介绍了对 iOS 模拟器、Android 模拟器或设备的 Agent 操作，包括截图与基于无障碍信息的交互；各平台支持的操作并不完全相同。
- [simframe](https://github.com/lvlrSajjad/simframe) 介绍了模拟器画面采集，以及等待画面变化后再等待稳定的模式。这是项目文档所述能力，不是我们的性能实测。

我们还发现了[较新的 Reddit 讨论](https://www.reddit.com/r/iOSProgramming/comments/1x7avhq/anyone_letting_agents_drive_their_app_in_the/)，其中有参与者提到自绘控件和动画过渡期间读取界面的困难，其他回复也讨论了现有工具和替代办法。这是值得继续核实的线索，不能据此认定整个领域尚未解决。

## 这次的决定

**继续调研，暂不做一个通用模拟器控制工具的复制品。** 已有项目介绍了相当多的重叠功能。更有价值的下一步，是选一个具体流程，实际比较现有工具，并记录用户究竟在哪里遇到困难。本次没有独立实测上述竞品，也没有证明市场规模、用户采用或某个修复已经成立。

[返回 GapCue](../README.zh-CN.md) · [English](case-mobile-ui-research.md)
