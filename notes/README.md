# Notes

A running scratchpad for project ideas, separate from `docs/` (which holds
finished design docs for shipped or in-progress features).

- **`project-ideas.md`** — the main log. Each idea is a dated entry with a
  status. When you bring up an idea in conversation, it gets appended here
  and pushed to this repo. Pull the branch locally whenever you're ready to
  pick one up.

## Status values

- `idea` — captured, not yet scoped
- `scoped` — fleshed out enough to start
- `in progress` — actively being built (should also have a tracking issue/PR)
- `done` — shipped, entry kept for history
- `dropped` — decided against, entry kept for context

## Workflow

1. You describe an idea in chat.
2. Claude appends an entry to `project-ideas.md`, commits, and pushes.
3. `git pull` locally whenever you want to review or start one.
4. When work starts, update the entry's status and link the issue/PR/branch.
