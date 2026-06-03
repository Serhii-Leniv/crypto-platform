# 0007 — Solo workflow: direct push for trivia, FF-merge for features

**Status:** Accepted
**Date:** 2026-06-03

## Context

This is a single-maintainer codebase with no external reviewers. The previous workflow required every change to land via a GitHub PR with an automated review bot (PR Agent / Gemini) commenting on each push. In practice:

- The PR Agent kept failing — the squash PR was 100k tokens, the configured model context was 32k, and the bot posted "Failed to generate code suggestions" on every push.
- Every back-and-forth with Claude Code inside a PR triggered another agent run via the `issue_comment.created` event.
- The agent's value-add (small style suggestions on a tiny pruned slice of the diff) was strictly worse than running `/code-review` or `/ultrareview` from Claude Code directly.
- The PR ceremony itself added friction for trivial changes (typos, README updates, dependency bumps).

## Decision

Adopt a two-tier workflow scaled to change size:

| Change size | Workflow |
|---|---|
| Trivial (≤2 files, no behaviour change: typos, README, dep bumps, comment-only) | Push directly to `main`. CI on `main` is the only gate. |
| Non-trivial (≥3 files OR new feature OR architectural change) | Feature branch, push, wait for CI green, fast-forward merge to `main` (`git merge --ff-only`), push. **No PR.** |
| Genuine multi-step / high-risk change | Open a PR for the structural review value (PR description as commit message; full diff visible). Still no PR Agent. |

Removed `.github/workflows/pr_agent.yml` and `.pr_agent.toml` — both no longer earn their keep.

For local review, use Claude Code's `/code-review` (single agent, fast) or `/ultrareview` (multi-agent, cloud-billed) on demand. Both are strictly better than the Gemini Flash bot for this codebase.

## Consequences

- **Less ceremony, more shipping** for the dominant case (trivia + small features).
- **Lost signal**: no automated bot commenting on every push. Trade-off: the bot was producing zero useful signal anyway.
- **CI is the only safety net** for direct-push to `main`. Branch protection requiring CI-pass before push is the obvious next step; not yet configured.
- **Discoverability of history**: commits go to `main` directly, so `git log` on `main` is the changelog. Conventional Commits become the primary navigation aid.
- **Reversibility**: if a direct push lands a regression, `git revert` is the path. No PR to close.
- **External reviewers** (future hire, contributor): would need to re-enable PR workflow. This ADR would be superseded.

## Alternatives considered

- **Keep PR Agent, fix the token limit**: bump `max_model_tokens` to 200k. Tested mentally — Gemini Flash at 200k still produces low-quality nits on this codebase. Not worth the workflow drag.
- **Switch PR Agent to Claude API**: would produce better suggestions but costs money per push and duplicates what `/code-review` already does.
- **Stay on full PR workflow for everything**: rejected on cost-benefit grounds — the friction outweighs the review value when there's no second reviewer to coordinate with.
