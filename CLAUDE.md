# CLAUDE.md

Readhouse (Motherhouse): a reading room that reads books aloud with AllTalk TTS. It runs on
a computer next to AllTalk and is opened on a phone over LAN or Tailscale. Mobile first.

## Start here, every session

1. Read `docs/backlog.md`, especially **How we work**. It is the plan, the working rules
   and the progress log. Keep it up to date as you work.
2. Before any UI design work, read `design-inspo.md` (local only, never commit it).

## Stack

- SvelteKit 3 full-stack (Svelte 5 runes, TypeScript), `adapter-node`, one origin and one
  port: the server serves the UI, stores the library and proxies AllTalk.
- SQLite via Node's built-in `node:sqlite` (`src/lib/server/db.ts`): prepared statements only,
  plain SQL migrations tracked with `PRAGMA user_version`. No ORM.
- Validation with valibot; zip via fflate; HTML parsing via htmlparser2 (text only, never
  rendered).
- Node and pnpm are pinned in `mise.toml`; run tools through `mise x -- pnpm ...`.
- SvelteKit 3 specifics: config lives in `vite.config.ts` (no `svelte.config.js`), env vars
  are declared in `src/env.ts` and read from `$app/env/private`, the lib alias is `#lib` and
  imports need an extension: `import { x } from '#lib/text/segments.js'`.

## Layout

- `src/lib/book.ts`, `library.ts`, `settings.ts`: shared types and schemas.
- `src/lib/text/`: pure text processing (normalize, paragraphs, chapters, segments, AO3).
- `src/lib/server/`: database, library repository, importers (`import/`), AllTalk client.
- `src/routes/`: pages and `api/` endpoints. Keep routes thin; logic lives in `#lib`.
- `docs/alltalk-api.md`: AllTalk v2 API reference (we target the `alltalkbeta` branch).

## Design system

- Every value is a token in `src/lib/design/tokens.css` (light, dark, sepia); stylelint fails
  the build on raw colours, sizes, spacing and durations elsewhere.
- Every control is a component in `src/lib/ui/` (Button, Sheet, Confirm, Toaster/`toasts`,
  Progress, Spinner, EmptyState, the Plate form controls, ListRow, Badge, Icon); ESLint forbids
  raw `<button>`, `<input>`, `<select>`, `<textarea>` outside it. Ask with `Confirm`, report
  with `toasts.show()`, never `confirm()`/`alert()`.
- `/reference` shows every token and component (dev, or `REFERENCE_PAGE=1`); add new
  components to it. The visual suite photographs it and the key screens; after reviewing a
  change, refresh baselines with `mise run visual:update`.
- New visual choices go on a side-by-side canvas artifact for the user before they are built.
- Type floor for accessibility: 14 px spaced capitals, 16 px secondary, 18 px UI, 20 px reading.

## Commands

```bash
mise x -- pnpm dev          # dev server
mise x -- pnpm check        # types (svelte-check)
mise x -- pnpm lint         # prettier + eslint
mise x -- pnpm exec vitest run
mise x -- pnpm gate         # everything, run before committing
```

## Rules

- Security and performance are reviewed after every change (see the backlog checklists).
- No `{@html}` on anything from a book or a request. Book text is plain text.
- Every endpoint validates input with a schema and has size limits.
- Non-ASCII characters in `.ts` source are written as `\uXXXX` escapes.
- Commit small, verified changes to the `readhouse` branch and push periodically.
