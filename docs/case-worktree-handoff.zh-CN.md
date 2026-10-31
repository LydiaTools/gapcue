# 工作区看起来已经合并，文件却还留在原处

编程 Agent 做完任务，它的工作区和 `main` 指向同一个提交，于是说“已经合并”。但修改过的文件还留在 Agent 的工作区，没有提交，也没有进入目标目录。

[oh-my-openagent 的问题 #5911](https://github.com/code-yeongyu/oh-my-openagent/issues/5911) 报告了这样的情况。截至 2026-10-31，该问题仍为 Open；一条标注为机器人的维护者评论讨论了这个误判。这是一份报告，不能据此认定所有 Agent 都有同样的问题，也不能证明一定需要开发新产品。

想自己跟着看，可以打开[中文调研台](https://lydiatools.github.io/gapcue/?lang=zh)，粘贴这条 Issue 链接并点击“读取讨论”，将评论样本与原帖对照，再保存自己的判断。我们也用 GapCue 的 Python 采集器读取了这条问题：本次共 3 次请求，未报告来源失败。

## 我们做了什么核对

我们新建临时 Git 仓库和第二个工作区，让两者指向相同提交，再在第二个工作区修改一个已跟踪文件、新建一个未跟踪文件。结果：来源提交确实是目标提交的祖先，但这两项文件变化都不在目标目录；来源工作区的状态能显示它们。

提交之间的祖先关系只回答**提交**的问题，不会检查未提交文件，也不能证明测试通过或任务完成。反过来，经过 squash 或 rebase 的变更也可能已经存在，但原来源提交不是目标提交的祖先。

## 检查自己的交接

将两个路径替换为**同一个仓库**的来源和目标工作区。这些命令只查看状态，不搬动文件，也不删除工作区。

```sh
SOURCE=/path/to/agent-worktree
TARGET=/path/to/main-worktree

git -C "$SOURCE" rev-parse --show-toplevel
git -C "$TARGET" rev-parse --show-toplevel
git -C "$SOURCE" status --short --untracked-files=all
git -C "$TARGET" status --short --untracked-files=all
git -C "$SOURCE" diff --stat
git -C "$SOURCE" diff --cached --stat
```

状态的第一列表示暂存区，第二列表示工作区；`??` 表示未跟踪文件。两条 `diff --stat` 分别概览已跟踪文件中未暂存和已暂存的修改；未跟踪文件显示在 status 中，不包含在这两份 diff 里。决定如何转移之前，要查看具体差异和需要的未跟踪文件。状态干净本身也不能证明已提交的内容到达了目标。

如需检查来源的**具体提交**是否为目标提交的祖先：

```sh
if SOURCE_HEAD=$(git -C "$SOURCE" rev-parse --verify HEAD); then
  git -C "$TARGET" merge-base --is-ancestor "$SOURCE_HEAD" HEAD
  printf 'exit status: %s\n' "$?"
else
  printf 'Could not read the source HEAD.\n' >&2
fi
```

退出状态 `0` 表示是祖先，`1` 表示不是，其他值表示出错。确认交接完成之前，仍要在目标目录核对实际变更并运行相应测试。忽略文件、子模块、运行中的进程和其他目录中的工作都需要另行检查；上述命令不能作为安全删除工作区的结论。

## 删除工作区之前，也要看看被忽略的文件

工作区看起来干净，并不代表里面没有需要保留的文件。我们在 macOS 的临时仓库中，用 Git 2.50.1（Apple Git-155）分别创建三个工作区，对每个工作区执行普通的 `git worktree remove`：

| 工作区里有什么 | 普通 `git status --short` | 本次移除结果 |
| --- | --- | --- |
| 只有忽略目录下的一个文件 | 无输出 | 退出码 0；目录和忽略的测试文件被移除 |
| 一个未跟踪、未忽略的文件 | `?? note.txt` | 退出码 128；Git 拒绝移除，目录保留 |
| 一个已跟踪文件的修改 | ` M tracked.txt` | 退出码 128；Git 拒绝移除，目录保留 |

这是一次对 Git 行为的小范围验证，不是对某款 Agent 的实测。它不表示所有被忽略的文件都有价值，也不表示下面的检查能覆盖所有丢失场景。[VS Code 工作区文档](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees)也说明，移除工作区会一并移除其中被忽略的文件。

决定保留什么之前，先检查**实际要处理的工作区**，包括忽略路径：

```sh
git -C "$SOURCE" status --short --untracked-files=all
git -C "$SOURCE" status --short --ignored --untracked-files=all
```

第二条输出中的 `!!` 表示被忽略的路径。结果可能包含大量依赖和属于项目私有信息的文件名，请在本地查看；清理之前，将需要的内容保存到合适的位置。这只是供人核对的清单，并不是可以安全删除的证明：已提交的工作、子模块、进程和工作区外的文件也需要检查。上面两条命令不会删除文件。

其他开发者也报告过相关问题：[chroxy #5244](https://github.com/blamechris/chroxy/issues/5244)描述了清理时忽略文件被删除的情况，其关联的 [PR #5249](https://github.com/blamechris/chroxy/pull/5249) 于 2026-06-06 合并；[cursor/plugins #449](https://github.com/cursor/plugins/issues/449)描述了另一套清理流程，2026-11-01 核查时仍为 Open，关联的 [PR #459](https://github.com/cursor/plugins/pull/459) 也仍为 Open。我们没有独立复现这两个项目的问题或测试其修复；问题关闭或 PR 合并也不能单独证明修复已包含在哪个发布版本中。

## 已有方案

[VS Code 工作区文档](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees)介绍了文件对比，以及包含未跟踪文件的未提交修改迁移；已提交内容需要另行整合。[Worktree Diff Viewer](https://github.com/hannanel100/worktree-diff-viewer)介绍了本地查看已提交和未提交变更的方式。这里没有对这两个工具做独立效果对比。

**目前的判断：**把这次发现作为调研与交接检查清单，而不是当成新产品机会已经成立。下一步可以核对现有方案是否真正解决了具体用户的交接问题。[返回 GapCue](../README.zh-CN.md)。
