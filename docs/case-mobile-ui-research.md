# When a popular discussion points to an already crowded idea

A browser agent can say a feature is done. A developer still needs to see what happened on screen.

That problem drew attention in [ProofShot's Show HN discussion](https://news.ycombinator.com/item?id=47499672). On 31 October 2026, the thread showed 161 points and 106 comments. Some participants asked about native desktop or mobile apps; the creator described browser support at the time and suggested simulator or accessibility-based approaches for other platforms. A lively thread tells us what people discussed, not how many need a new product today.

## Follow the trail with GapCue

Open the [research desk](https://lydiatools.github.io/gapcue/), paste the HN discussion URL, and select **Read discussion**. Or collect it with the Node CLI:

```sh
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=47499672" --out ./proofshot-review
```

Use a new output directory. Our anonymous collection on 31 October 2026 fetched 16 of 106 reported comments from the earliest and latest indexed pages, with no request failures. **The middle of the discussion was not collected.** Read the original thread before drawing conclusions; its content and counts may change. `complete` describes the requested reads, not a complete conversation.

## Check what exists now

The HN discussion is from March 2026. Before treating its mobile requests as a current gap, we checked project descriptions on 31 October 2026:

- [ProofShot](https://github.com/AmElmo/proofshot) describes a browser evidence bundle with screenshots, video, and logs. Its [open Windows issue #50](https://github.com/AmElmo/proofshot/issues/50) is a separate reported failure, not evidence about our projects.
- [sim-use](https://github.com/lycorp-jp/sim-use) describes agent control for iOS simulators and Android emulators/devices, including screenshots and accessibility-based interaction; support differs by platform and operation.
- [simframe](https://github.com/lvlrSajjad/simframe) describes simulator frame capture and a settle mode that waits for a screen change and stillness. Its README is a claim about its design, not our benchmark.

We also found a [later Reddit discussion](https://www.reddit.com/r/iOSProgramming/comments/1x7avhq/anyone_letting_agents_drive_their_app_in_the/) in which a participant describes difficulty with custom-drawn controls and screens read during transitions. Other replies discuss existing tools and workarounds. This is a lead to investigate, not proof that an entire category is unsolved.

## Our decision

**Follow up; don't build a general simulator-control clone yet.** Existing projects already describe substantial overlap. A useful next step is to choose one concrete workflow, test the current tools on it, and record where an actual user still gets stuck. We have not independently tested those competitors here or established adoption, a market size, or a reason to promise a fix.

[Back to GapCue](../README.md) · [中文版](case-mobile-ui-research.zh-CN.md)
