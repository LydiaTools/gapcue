# A worktree can look merged while its files are still elsewhere

A coding agent finishes a task. Its worktree and `main` point to the same commit, so it reports that the work is already merged. But the edited files are still sitting in the agent's worktree, uncommitted.

This is the situation reported in [oh-my-openagent issue #5911](https://github.com/code-yeongyu/oh-my-openagent/issues/5911). As checked on 2026-10-31, the issue is open; a bot-labeled maintainer comment describes the reported false positive. That is one report, not evidence that all coding agents have the same defect or that a new product is needed.

To follow the same trail, open the [research desk](https://lydiatools.github.io/gapcue/), paste the issue URL, and select **Read discussion**. Compare the sampled comments with the original thread, then save your own decision. We also collected this issue with GapCue's Python collector; the source check completed with three requests and no reported failures.

## What we checked

In a disposable local Git repository, we created a second worktree at the same commit, modified a tracked file there, and added an untracked file. The source commit was an ancestor of the target commit, yet neither file change was in the target directory. The source worktree's status showed both changes.

An ancestry check answers a question about **commits**. It does not inspect uncommitted files, establish that tests pass, or prove that the intended task is complete. Squashed or rebased changes can also be present without the original source commit being an ancestor.

## Check your own handoff

Replace both paths with the actual source and destination worktree directories of the **same repository**. These commands inspect state; they do not transfer files or remove worktrees.

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

The first status column describes the index and the second describes the working tree; `??` marks an untracked path. The two `diff --stat` commands show tracked unstaged and staged changes separately; untracked files appear in status, not in those diffs. Inspect the actual diffs and relevant untracked files before deciding what to transfer. A clean status alone does not establish that committed changes reached the destination.

To check whether the exact source commit is an ancestor of the destination commit:

```sh
if SOURCE_HEAD=$(git -C "$SOURCE" rev-parse --verify HEAD); then
  git -C "$TARGET" merge-base --is-ancestor "$SOURCE_HEAD" HEAD
  printf 'exit status: %s\n' "$?"
else
  printf 'Could not read the source HEAD.\n' >&2
fi
```

Exit `0` means the source commit is an ancestor; `1` means it is not; another status indicates an error. Compare the intended changes and run the appropriate tests in the destination before calling the handoff complete. Ignored files, submodules, running processes, and work in other directories need separate attention before any cleanup; these checks are not a deletion-safety verdict.

## Before removing a worktree: check ignored files too

Even an apparently clean worktree can contain files you need. In a disposable local repository on macOS with Git 2.50.1 (Apple Git-155), we made three separate worktrees and tried a plain `git worktree remove` on each:

| What the worktree contained | Ordinary `git status --short` | Removal result in this test |
| --- | --- | --- |
| Only a file under an ignored directory | No output | Exit 0; the directory and ignored test file were removed |
| An untracked, non-ignored file | `?? note.txt` | Exit 128; Git refused and the directory remained |
| A modified tracked file | ` M tracked.txt` | Exit 128; Git refused and the directory remained |

This is a small Git behavior check, not a test of any particular agent. It does not mean all ignored files are valuable or that the checks below cover every possible loss. [VS Code's worktree guide](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees) also says removing a worktree removes ignored files in its folder.

Before deciding what to preserve, inspect the **actual worktree**, including ignored paths:

```sh
git -C "$SOURCE" status --short --untracked-files=all
git -C "$SOURCE" status --short --ignored --untracked-files=all
```

`!!` marks ignored paths in the second output. It may list many dependencies and file names that are private to your project; review locally. Save anything needed in an appropriate location before cleanup. This is an inventory to review, not a command that proves removal is safe: also check committed work, submodules, processes and files outside the worktree. These commands do not remove anything.

Other developers have reported related failures. [chroxy #5244](https://github.com/blamechris/chroxy/issues/5244) described ignored files being removed during cleanup; its linked [PR #5249](https://github.com/blamechris/chroxy/pull/5249) merged on 2026-06-06. [cursor/plugins #449](https://github.com/cursor/plugins/issues/449) describes a separate cleanup workflow and was open when checked on 2026-11-01; its linked [PR #459](https://github.com/cursor/plugins/pull/459) was also open. We have not reproduced either project-specific report or tested their fixes. A closed issue or merged PR alone does not establish which released version contains a change.

## What already exists

[VS Code's worktree guide](https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees) documents file comparison and migration of uncommitted changes, including untracked files; committed work needs separate integration. [Worktree Diff Viewer](https://github.com/hannanel100/worktree-diff-viewer) describes a separate local view of committed and uncommitted work. We have not independently benchmarked either tool here.

**Our decision:** use this as a research and handoff checklist, not proof of a new opportunity. A next investigation would compare those workflows against the specific handoff people still cannot complete. [Return to GapCue](../README.md).
