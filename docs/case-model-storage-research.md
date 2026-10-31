# A model download, a disappearing drive, and the next question

A local AI app can make it easy to try a model. The files it leaves behind can be much harder to understand.

In a [Hacker News discussion about Hob](https://news.ycombinator.com/item?id=50246238), one commenter described difficulty removing downloaded models after trying the app. Another described the effort of choosing a local model and runtime. These are individual experiences, not a measurement of how many people have the same problem.

## Follow the trail

1. **Start with the experience.** Read the discussion and separate storage cleanup from the different problem of choosing a model. At our 2026-10-31 UTC check, the post showed 177 points and 43 comments; those counts can change.
2. **Inspect a specific failure.** [Ollama issue #19414](https://github.com/ollama/ollama/issues/19414) reports rejected blob uploads that can leave files on disk. We opened the public issue in GapCue and saved a follow-up review. The report identifies a particular upload path, not every cause of model storage use. Ollama had 185,474 GitHub Stars at our API check; that is the upstream project's count, not evidence of demand for a new tool.
3. **Look for work already underway.** A separate GitHub search found [PR #19421](https://github.com/ollama/ollama/pull/19421), which proposes changing when the upload is stored. It was open and unmerged at our check. The issue's sampled text linked four other issues; GapCue checked two, with two marked not checked. The PR was found by a separate search, not inferred from those links.
4. **Compare existing approaches.** [Hugging Face's cache guide](https://github.com/huggingface/huggingface_hub/blob/main/docs/source/en/guides/manage-cache.md) documents inspecting and managing its cache. [hf-hub-utilities](https://github.com/StephenGenusa/hf-hub-utilities) describes sharing Hub models with LM Studio and Ollama, while [OllamaCleanup](https://github.com/jamesburton/OllamaCleanup) describes inspecting Ollama storage. These are different scopes; their descriptions do not establish how they perform on your machine.

## The decision

**Keep researching before building.** The discussion suggests a problem worth understanding, while the existing tools and proposed fix make it premature to claim a new product is needed. We did not reproduce the Ollama report, run the alternatives, or verify a released fix.

Try the same research: [open GapCue](https://lydiatools.github.io/gapcue/), paste the issue URL, read the sampled source and reference states, and save your own follow-up note. Then search the upstream repository for newer issues and pull requests; the linked-reference sample is bounded and may miss relevant work.

[← Project overview](../README.md) · [中文](case-model-storage-research.zh-CN.md)
