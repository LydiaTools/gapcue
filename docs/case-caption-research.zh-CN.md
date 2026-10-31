# 同一份字幕，三个不同的结果

一条字幕在横屏里看起来没问题，换到手机竖屏，可能就放不下了。

在 [Overtone 的 Show HN 讨论](https://news.ycombinator.com/item?id=50293115)里，有人提到给竖屏演示视频加字幕时遇到了这个问题，也有人询问语言覆盖。这些是值得追踪的线索，不代表已经统计出多少人需要新产品。

## 沿着讨论往下找

把 HN 讨论链接粘贴到 [GapCue 调研台](https://lydiatools.github.io/gapcue/?lang=zh)，也可以用命令行读取：

```sh
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=50293115" --out ./caption-discussion
```

2026-10-31 UTC 采集时，我们读取到当时报告的全部 10 条评论。评论可能继续变化，请回到原讨论核对；来源快照和下一步判断可以一起保存为评审文件。

## 用同一份字幕试工具

我们原创了一条 8 秒、47 个字符、没有空格的中文字幕，没有提供音频。2026-11-01（北京时间）分别试用三个已有工具：

| 工具 | 这一个样本的观察结果 |
| --- | --- |
| [Overtone 0.1.0](https://github.com/lonthq/overtone-captions) | `recut --language zh` 导出的竖屏字幕仍是一整条；项目文档已说明无空格文字的这一限制。另一份虚构英文对照输出了 5 条竖屏字幕，词级时间为估算。 |
| [SubtitleFlow Line Breaker](https://subtitleflow.com/tools/subtitle-line-breaker) | 设置每行 16 字后，网页显示两行分别为 23、24 字，原字幕时间不变；这个较长样本没有被压进两条 16 字以内的行。 |
| [Open WebSub](https://github.com/oToToT/OpenWebSub) | 将“Shorten subtitles”设为 16 字后，网页拆出了 4 条，最后一条只有 `。`，时长 170 毫秒；界面明确提示拆分后的时间为估算。我们核对了编辑器状态，未核验下载文件。 |

三个工具各有适用场景。这些结果仅针对一个样本和测试时的版本，不能推广到所有文件、语言、字体或视频。本次没有试听、翻译、准确率测评或外部用户采用验证。核对时 Open WebSub 的公开仓库没有找到许可证文件；如要复用代码，请先核对其当前授权。

要复现 Overtone 部分，准备 Node.js 22.12+，在新目录把下面的**虚构**内容保存为 `caption.srt`：

```srt
1
00:00:00,000 --> 00:00:08,000
当你把视频同时发布到横屏和竖屏平台时字幕应该清晰易读而且不能因为屏幕变窄就挤成一条很长的文字。
```

```sh
npx --yes overtone-captions@0.1.0 recut caption.srt --language zh --out ./result --export srt,json
```

查看 `result/caption.vertical.srt`。它使用原字幕时间，并非重新与语音对齐。把同一份输入交给另外两个工具，并把字符上限设为 16，即可继续比较；实际使用前需对照音频检查拆分后的时间。

## 目前的决定

**继续调研，暂不再做一个通用字幕编辑器。** 现有工具已经覆盖了大部分流程。更具体的问题是：中文及中英混合字幕如何避免标点单独成行，并让人方便地复核估算时间？在把它当作产品机会前，需要更多真实字幕样本和独立创作者反馈。

[返回 GapCue](../README.zh-CN.md) · [English](case-caption-research.md)
