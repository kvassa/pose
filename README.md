# Pose Match

Mobile AR app that takes a reference photo (Pinterest pose, etc.) and overlays it onto a live camera feed, guiding subject and photographer into the matching shot.

## Project docs

- [`architecture.md`](./architecture.md) — full system architecture
- [`tasks.md`](./tasks.md) — sequential MVP build plan, one atomic task at a time

## Working with Cursor

This repo has `.cursor/rules/` configured so any Cursor agent opening it automatically loads:

- **`project-context.mdc`** — project overview, tech stack, non-negotiables
- **`workflow.mdc`** — the one-task-at-a-time discipline tied to `tasks.md`
- **`coding-style.mdc`** — TS conventions, state tier discipline, naming

You don't need to share a chat between collaborators. Both of you get the same agent behavior because both Cursor instances read the same rules from the repo.

### Starting work in Cursor

Open a new chat. Say one of:

- `do the next task in tasks.md` — agent picks up from the next unchecked task
- `do task 7.3` — agent does that specific task
- `what's the next task?` — agent reports without starting

The agent will state the task, execute it, run the test, and stop. You verify, then ask for the next one.

### Collaboration model

- Both collaborators have access to the repo.
- Claim tasks in `tasks.md` by tagging your name (e.g., `### 7.3 [@om]`).
- Commit after each task so the other person's agent picks up the latest state.
- For hand-offs of tricky work, share a Cursor transcript link in chat — the other person starts a fresh agent chat referencing it.

## Repo structure (target after build)

```
pose-match/
├── apps/mobile/             # React Native app (Expo bare workflow)
├── services/pose-worker/    # Python keypoint extraction service
├── packages/
│   ├── pose-math/           # Pure TS comparison logic
│   └── shared-types/        # Shared TS types
└── supabase/
    ├── migrations/          # Postgres schema + RLS
    └── functions/           # Edge functions (Deno/TS)
```

See [`architecture.md`](./architecture.md) for the full breakdown.

## Status

Pre-MVP. Building per [`tasks.md`](./tasks.md), starting at Phase 0.
