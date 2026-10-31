# 下载一个模型之后，磁盘空间去哪了？

本地 AI 工具让试用模型变得简单，但下载后的文件占了多少空间、哪些文件还在被使用，不一定容易看清。

在 [Hob 的 Hacker News 讨论](https://news.ycombinator.com/item?id=50246238)中，有人提到试用后不容易移除下载的模型；另一个人说，选择本地模型和运行方式本身就很费精力。这是个体经历，不能直接推算有多少人遇到同样的问题。

## 顺着线索看下去

1. **先弄清问题。** 把磁盘清理和选择模型当作两个不同的问题。我们在 2026-10-31 UTC 查看时，这条讨论有 177 分、43 条评论；数字会变化。
2. **找到具体情境。** [Ollama issue #19414](https://github.com/ollama/ollama/issues/19414) 报告了一种情况：上传文件校验失败后，文件仍可能留在磁盘。我们用 GapCue 打开公开 issue，保存了继续跟进的判断。这只是特定上传路径，不代表所有模型占空间的问题。核查时 Ollama 项目有 185,474 个 GitHub Star；这是上游项目的数字，不代表新工具的需求。
3. **看看是否已经有人解决。** 另行搜索 GitHub 时发现 [PR #19421](https://github.com/ollama/ollama/pull/19421) 提出了修改上传保存时机的方案；核查时仍在审阅、尚未合并。Issue 正文提到了四个其他 issue，GapCue 本次核对其中两个，另两个标记为未核对。这个 PR 来自另一次搜索，并非从采样引用中自动推断。
4. **对照已有办法。** [Hugging Face 缓存文档](https://github.com/huggingface/huggingface_hub/blob/main/docs/source/en/guides/manage-cache.md)介绍了如何查看和管理自身缓存；[hf-hub-utilities](https://github.com/StephenGenusa/hf-hub-utilities)介绍了跨 Hugging Face、LM Studio 和 Ollama 共享模型的方式；[OllamaCleanup](https://github.com/jamesburton/OllamaCleanup)介绍了 Ollama 存储检查功能。它们的适用范围不同，文档描述不能代替在自己机器上的验证。

## 这次的决定

**先继续研究，再考虑做工具。** 讨论说明这个问题值得了解；现有工具和修复提案也提醒我们，现在还不能断言必须做一个新产品。我们没有复现该 Ollama 报告、运行上述工具或验证修复是否随版本发布。

你也可以试一次：[打开 GapCue](https://lydiatools.github.io/gapcue/?lang=zh)，粘贴 issue 链接，查看采样来源与引用状态，保存自己的跟进笔记；再去上游仓库搜索新的 issue 和 PR。引用检查有数量限制，可能漏掉相关工作。

[← 返回项目介绍](../README.zh-CN.md) · [English](case-model-storage-research.md)
