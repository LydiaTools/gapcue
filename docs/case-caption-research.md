# One subtitle, three different outcomes

One caption file looks fine on a wide screen. On a phone, the same line may not fit.

In [Overtone's Show HN discussion](https://news.ycombinator.com/item?id=50293115), a participant described that problem while captioning a portrait demo. Another asked about language coverage. Those comments are a reason to investigate, not a count of people who need a new product.

## Follow the conversation

Paste the HN URL into the [GapCue research desk](https://lydiatools.github.io/gapcue/) or collect it with the CLI:

```sh
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=50293115" --out ./caption-discussion
```

On 2026-10-31 UTC, our collection read all 10 comments reported at that moment. Counts and replies can change; check the original discussion. The source snapshot and the next-step decision can be saved together in a review file.

## Try the actual workflow

We made an original SRT cue, eight seconds long, containing a 47-character Chinese sentence without spaces. No audio was supplied. On 2026-11-01 Asia/Shanghai we tried three existing tools:

| Tool | What we observed on this one input |
| --- | --- |
| [Overtone 0.1.0](https://github.com/lonthq/overtone-captions) | `recut --language zh` exported one unchanged vertical cue. Its documentation already notes the limitation for scripts without spaces. An English synthetic control produced five vertical cues with estimated word times. |
| [SubtitleFlow Line Breaker](https://subtitleflow.com/tools/subtitle-line-breaker) | With a 16-character setting, the browser output displayed two lines of 23 and 24 characters, keeping the original cue timing. The setting did not fit this longer cue into two lines of 16. |
| [Open WebSub](https://github.com/oToToT/OpenWebSub) | **Shorten subtitles** at 16 characters produced four cues in the browser. The final cue contained only `。` and lasted 170 ms; the app explicitly marked split timing as estimated. We inspected the editor state, not a downloaded export. |

All three are useful in different situations. These observations do not establish their behavior for other files, languages, versions, fonts or videos. No listening test, translation, accuracy benchmark or end-user adoption was performed. The public Open WebSub repository did not expose a license file when checked; inspect its current license before reusing code.

To reproduce the Overtone part with Node.js 22.12+, save this **fictional** cue as `caption.srt` in a new directory:

```srt
1
00:00:00,000 --> 00:00:08,000
当你把视频同时发布到横屏和竖屏平台时字幕应该清晰易读而且不能因为屏幕变窄就挤成一条很长的文字。
```

```sh
npx --yes overtone-captions@0.1.0 recut caption.srt --language zh --out ./result --export srt,json
```

Inspect `result/caption.vertical.srt`. This uses the existing subtitle times, not speech alignment. Use the same input in the other editors, setting the character limit to 16. Recheck split timing against actual audio before using captions.

## Decision

**Follow up, rather than launch another general subtitle editor.** Existing tools already handle much of the workflow. The next question is narrower: can Chinese and mixed-language captions avoid isolated punctuation and provide a practical way to review estimated timing? We need more than one synthetic example and independent creator feedback before treating that as a product opportunity.

[Back to GapCue](../README.md) · [中文](case-caption-research.zh-CN.md)
