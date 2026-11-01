# Backlog

The upgrade from "AllTalk Reader" to **Readhouse**, a Motherhouse app. Nothing here is started
unless marked.

**Deadline:** AO3 is down until about **2026-11-13**. The app is presented when it comes back,
so the [demo-critical path](#demo-critical-path) comes first; everything else can follow.

**How the app is used:** it runs on a computer (next to the AllTalk server) and is opened on a
phone over the LAN or Tailscale. Mobile is the primary target, desktop has to be good too, and
every decision below assumes the page is served from another machine, often over plain http.

## How we work (read first, every session)

- **Work through this backlog** in the demo-critical-path order. Only stop to ask the user
  when an answer is genuinely theirs to give; otherwise use best judgement and note the
  decision here.
- **Track progress here.** Tick items when done and verified; mark started items with
  *(in progress)* and a short note of where things stand. The [Progress log](#progress-log)
  at the bottom gets one line per work session.
- **Verify every change.** Run the check gate (types, lint, unit, e2e) and look the diff over
  before committing. Never claim something works without having run it.
- **After every change, review security and performance.** Ask: what input does this trust?
  what does it expose on the network? what does it cost on a mid-range phone (bundle size,
  main-thread work, memory, battery, requests)? Both are first-class requirements, not
  polish. See the Security and Performance sections.
- **Commit and push periodically** to the `readhouse` branch, in small, reviewed commits.
- **Modern web platform, but only what modern devices support.** Prefer native platform
  features (View Transitions, popover, `<dialog>`, container queries, `:has()`, anchor
  positioning, `content-visibility`, scroll-driven animations, Media Session, OPFS) when they
  work in current iOS Safari *and* Android Chrome, with graceful fallback otherwise.
  Experimental APIs (e.g. HTML-in-canvas, still behind a flag/origin trial and absent from
  Safari) are out until they ship broadly.
- **UI design options as artifacts.** For any UI design decision, make side-by-side artifact
  variants for the user to compare before building it into the app.
- **Core before UI design.** Rewrite the app's core (server, storage, parsing, AllTalk
  pipeline, tests) first; the visual design waits, because the user keeps adding inspiration
  to `design-inspo.md`.
- **Design inspiration lives in `design-inspo.md`** (repo root, plus images in
  `design-inspo/`), excluded via `.git/info/exclude` and never committed. Re-read it before
  any UI design work; it changes between sessions.
- **UI work method** (from the inspiration notes): present interfaces at the noun/verb level
  (book, chapter, passage, voice; read, listen, resume, import) and justify every container
  before drawing it; try to break what we build (worst-case data); model states explicitly
  (loading, success, error, offline, empty); make before/after screenshots; offer variants.

## Decisions

- [x] **Name: Readhouse.** Joins Ditherhouse in the Motherhouse suite. Rename everywhere:
  wordmark, `package.json` name (still `tanstack-start-example-basic-react-query`), page
  titles, PWA manifest, README, docs, GitHub repo (`alltalk_reader` → `readhouse`). Check
  domain/handle availability.
- [x] **Stack: SvelteKit full-stack (Svelte 5, TypeScript).** Chosen from scratch as the best
  fit for this app on its own: one language, one project, one test toolchain, types shared
  between UI and server without codegen, and the strongest library ecosystem for EPUB/HTML
  work. Replaces TanStack Start + React + Zustand + XState and the separate Express server.
  - *One origin, one port.* The SvelteKit server (`adapter-node`, Node LTS pinned in
    `mise.toml`) serves the UI, stores the library and proxies AllTalk, so there's no CORS or
    mixed content, and `tailscale serve` (HTTPS) is a one-liner.
  - *Client-rendered reader.* SSR off (or prerendered shell) for the app routes; it's a
    personal tool behind the network, not a public site.
  - *Storage:* SQLite (books, chapters, progress, settings) with generated audio as files on
    disk next to it; no base64 in JSON.
  - *Offline:* SvelteKit service worker + installable PWA.
  - *Layout:* server-only logic in `$lib/server`, shared logic in `$lib` as plain TS modules
    tested with Vitest; routes stay thin.
  - Rewrite onto the new design system rather than port the old components; carry over the
    logic worth keeping (text processing, AO3 parser, Safari audio handling, export format).
- [x] **Dithering: yes, as an accent.** A few dithered touches give Readhouse its
  Motherhouse character; the text and controls stay clean. Rules:
  - *Restraint.* At most one dithered element per screen, and never behind body text or
    over controls. Reading comfort beats style.
  - *Ahead of time, committed.* Assets are made with Ditherhouse (app or `crates/cli`) and
    committed to the repo as static files; no runtime dithering and no wasm. Keep the source
    images and the Ditherhouse settings next to the outputs so assets can be regenerated
    when tokens change.
  - *Where it fits:* the wordmark/splash, cover placeholders for books without a cover,
    empty states (empty library, no chapter selected), and possibly the playback progress
    track. Not on the reading surface.
  - Light on phones (small PNG/WebP, lossless so the pattern isn't smeared) and right in
    every theme (one asset per theme where needed).
  Whether dithering becomes a suite-wide house style is still open.
- [x] **AllTalk is third-party (user, 2026-10-31).** Users install and configure it
  themselves; Readhouse gives no support for AllTalk's own setup (ports, interfaces, exposure)
  and only documents which values to enter in Readhouse (`ALLTALK_URL`).
- [x] **AllTalk: v2, the `alltalkbeta` branch.**
  (https://github.com/erew123/alltalk_tts/tree/alltalkbeta), not `main` (v1, last updated
  2025-03). `../alltalk_tts` is already on `alltalkbeta` and up to date with the remote
  (last commit 2026-01-09), with uncommitted local edits to `atsetup.sh` and
  `confignew.json`. **Decided (2026-10-31): keep the local edits** in `../alltalk_tts`.
- [x] **Visual direction: A, Engraved.** Picked from https://claude.ai/artifact/M9ED11TvLfXVz5XKGhX32P.
  Ink-blue on pale paper, bone on navy in dark, a sepia engraving as the third theme;
  EB Garamond throughout (self-hosted); a ruled double frame around every page; drop caps;
  one dithered band per chapter opening with its roman numeral in a cartouche (Bayer 8×8
  crosshatch at 1×, the user's preference over blue-noise stipple; Floyd–Steinberg is the
  alternative); the sentence
  being spoken in reverse ink. Decided while building it: prose is ragged right (with
  hyphenation) on phones and justified only from 40rem up, since a ~35-character justified
  line opens rivers; a paused passage is tinted, reverse ink only while the voice reads.

## Demo-critical path

Order of work for the 2026-11-13 presentation:

1. Scaffold the SvelteKit app (tooling, check gate, SQLite, AllTalk proxy).
2. Design system foundation (tokens + core components).
3. New reading UI on mobile, then desktop.
4. EPUB/TXT import with chapter picker.
5. Feature audit fixes and trims, so everything still on screen works.
6. Stability tests over the core flows.
7. Security basics for LAN/Tailscale exposure.

## Design system

- [ ] **One design system, always used.** Every color, font, size, spacing step, radius,
  shadow, duration and z-index is a token; every UI element is a design-system component. No
  ad-hoc components, values or one-off Tailwind classes, so a change in one place reaches the
  whole app. Today there's a start (`src/design-system/`: Button, Icon, Loading, Modal,
  Progress) but only 12 imports of it, while the code has ~200 raw palette classes
  (`bg-gray-*`, `text-blue-*`, …) and arbitrary values.
- [ ] **Token layer.** CSS custom properties as the single source (light/dark/sepia themes
  switch by swapping values), mapped into Tailwind (or the chosen styling) so only tokens are
  expressible. Remove Tailwind's default palette from the config so raw colors don't compile.
  *(in progress)* Engraved values in `src/lib/design/tokens.css` (light, dark, sepia; text colours checked for WCAG AA). Remaining: the Tailwind side is moot (no Tailwind), so this closes with the component inventory.
- [x] **Enforce it.** Lint rules that fail the build on raw colors, arbitrary values
  (`p-[13px]`), inline styles and HTML controls used outside the design system. Part of the
  check gate, not a guideline.
  *Done:* Stylelint (`stylelint.config.js`) fails the build on raw colours, sizes, spacing, type, radii, shadows, z-index and durations outside `tokens.css`. ESLint (`svelte/no-restricted-html-elements`) fails the build on raw `<button>`, `<input>`, `<select>` and `<textarea>` outside `src/lib/ui/`.
- [ ] **Component inventory.** Button, IconButton, Slider (dithered track if it passes the restraint rule), Toggle,
  Select, Sheet (mobile bottom sheet), Dialog, Popover, Tabs/Segmented, List/ListItem, Toast,
  Progress, Spinner, EmptyState, Field/Label, Badge. Each with states (hover, focus-visible,
  active, disabled, loading) and touch targets ≥ 44 px.
  *(in progress)* Button (primary, quiet, outline, danger, text; also renders links), Icon,
  Sheet, and in style **B, Plate** (picked from https://claude.ai/artifact/M3AtEFvzbkEYY2rC6BhEeA):
  Field, Select, TextField, Checkbox (ballot box), Radio, Slider, FilePicker, ListRow (dot
  leaders), Badge, and from the feedback canvas (user's picks, 2026-10-31): **Confirm**
  (Sheet in `alert` mode: full-width buttons, the filled `danger-solid` answer on top, focus
  on "Keep it"; replaces both `confirm()` calls), **Toast** (reverse-ink slug above the player,
  the mini player or the foot of the page; problems stay and are announced at once; used when a
  chapter saves or fails), **Progress** (hairline rule under the saving row), **Spinner** (a
  printer's flower turning once every 4 s beside the words that say what is happening: the
  player, Add a book, Settings; still under reduced motion, where endless animations now stop
  after their one instant run), **EmptyState** (the empty shelf, and a new error page: a
  missing book or link says so plainly with a way back to the shelf, instead of SvelteKit's
  bare default). The inventory is complete for what the app uses; a dithered empty-state
  picture stays an option for later (it would need variants first). Variants were published for a pick (2026-10-31):
  https://claude.ai/artifact/Dvyyv4k4ZwhK7nzkq61yeF (Dialog for removing a book: centred
  plate, bottom sheet, or no question with Undo; loading: breathing ellipsis, engraved rule,
  turning fleuron; toast: slip above the player, reverse-ink slug, notice under the header;
  chapter-saving progress: rule under the row, filling leader, one line atop Contents).
  Popover and Tabs/Segmented are left out: nothing in the app needs them yet (the sleep timer
  is a sheet, the theme is a radio group).
- [ ] **Living reference page.** A dev-only route (or Storybook/Histoire) showing every token
  and component in every theme; also the target for visual regression tests.
- [ ] **Share with the suite.** If a suite-wide house style is adopted, publish the tokens (and,
  with a shared framework, the components) as a package Ditherhouse can use too.

## UI rework

- [x] **Book-themed visual identity.** Direction A, Engraved (see Decisions).
  *Done:* tokens, EB Garamond, frame, icon and manifest colours, dithered bands
  (`scripts/dither-assets.sh` with Ditherhouse's CLI), library (continue plate, shelf), reader
  (band, drop cap, reverse-ink sentence), player bar, mini player, Button, Sheet. Screenshots
  reviewed on iPhone, Pixel and desktop in all three themes, with simulated safe-area insets.
  Settings, Add a book, Unlock and Contents use the Plate controls.
  Originally: Replace the generic look with one that has personality
  and evokes books: paper and ink palette, a proper reading serif for body text (e.g.
  Literata, Source Serif, Newsreader) with a contrasting UI face, restrained ornament,
  page-like surfaces. Light, dark and sepia themes. Readhouse wordmark.
- [ ] **Made for reading.** Comfortable measure (~60–75 characters), generous line height,
  adjustable font size/face/line spacing/theme, the currently spoken paragraph highlighted
  without jumping, auto-scroll that follows playback but stops while the user scrolls, and a
  "jump back to current" button.
- [ ] **Rework layout and placement of controls.** Today settings, server config, batch,
  export, cache status and playback all compete on one page (`reader.tsx`, 800+ lines). New
  structure:
  - *Library*: books/sessions, import (EPUB, TXT, paste, AO3), resume where you left off.
  - *Reader*: text first; a compact player docked at the bottom (thumb reach on phones) with
    play/pause, skip ±paragraph, speed, sleep timer.
  - *Settings*: voice, TTS options, appearance, server; rarely used items behind
    "Advanced".
- [ ] **Mobile first.** Designed at 360–430 px wide before desktop. Bottom sheets instead of
  modals, safe-area insets (notch, home bar), no horizontal scroll, no hover-only UI, `dvh`
  units so the browser bar doesn't hide the player, works in iOS Safari and Android Chrome.
- [ ] **Good on desktop.** *(in progress)* Layout **A, Folio** picked from
  https://claude.ai/artifact/CRE9N4gB9Wv3iH78j427no and built for the reader: from 64rem a
  ruled sidebar (book, contents with save buttons, back to the shelf) and the player docked
  under the text column; CSS-only switch, so the server-rendered page is right on first load.
  The library is layout **C, Printed index** (user's pick from
  https://claude.ai/artifact/LBYFHjcubQh5NempCXNpTc, without the roman numerals, Settings
  keeps its label): from 64rem one centred column, the continue plate as a ruled band, each
  book a title over author with dot leaders to its place. Still to do: `/`
  to search once there is search. A layout that uses the width (library/chapter sidebar + reading
  column + player), keyboard shortcuts (space, arrows, `/` to search), not just a stretched
  phone UI.
- [x] **Installable PWA.** Manifest, icons, home-screen install, Media Session API (lock-screen
  controls, title/chapter, artwork) so playback can be controlled with the screen off.
  *Done:* Manifest, interim icons, Media Session (lock screen, next/previous), offline service worker.
- [ ] **Pleasant details.** Calm transitions (respecting `prefers-reduced-motion`), clear
  loading and error states, empty states that say what to do next, helpful copy, no
  developer jargon in the UI ("buffered mode", "session server").
- [ ] **Accessibility.** WCAG AA contrast in every theme, focus-visible styles, labelled
  controls, screen-reader announcements for playback state, respects system font size.
  *Type sizes raised (2026-10-31, user asked for accessible font sizes):* EB Garamond has a
  small x-height, so the floor is now 14 px for spaced capitals (`--text-xs`), 16 px for
  secondary text (`--text-s`) and 18 px for UI text (`--text-m`); reading text stays 20 px.
  All in rem, so the system font size scales them. Settings has a visible label, not only an
  icon.

## Books: EPUB and TXT

- [x] **Load EPUB files.** Parse in the browser (zip via the existing `fflate` + OPF/NCX/nav),
  get title, author, cover, chapter list in spine order. Turn chapter XHTML into
  paragraphs. Sanitize all EPUB HTML (it is untrusted; never inject it as HTML).
  *Done:* On the server (fflate + htmlparser2): spine, nav/NCX titles incl. anchor-split chapters, covers, Gutenberg cleanup; tested on real Gutenberg books.
- [x] **"Stave" chapter headings.** Gutenberg's *A Christmas Carol* uses "STAVE ONE"; TXT
  chapter detection doesn't know it yet, so the book imports as one chapter. Also consider
  smart quotes for TXT with straight ASCII quotes (display only; speech is unaffected).
  *Done:* "Stave" is a chapter label; the real Gutenberg text (#46) now imports as Preface and
  five staves. Smart quotes left out for now: display-only curling must keep the spoken
  segments and the sentence highlight in step, and narrator mode splits on straight quotes, so
  it isn't worth the risk before the demo.
- [x] **Load TXT files.** Detect encoding (UTF-8/UTF-16/Latin-1), detect chapters by common
  headings ("Chapter 1", "CHAPTER ONE", "Part II", `***`), fall back to one chapter.
  *Done:* BOM/UTF-8/Windows-1252, Gutenberg header/footer, chapter headings, contents lists and subtitles.
- [x] **Chapter picker.** A table of contents sheet/sidebar: chapters with progress per chapter,
  tap to read from there, select a range to pre-generate audio, resume where you stopped.
  Long books stay fast (virtualized list, chapters loaded on demand).
  *Done:* Contents sheet with current chapter, word counts, tap to jump, save for offline per chapter. Range selection dropped: saving per chapter covers it.
- [x] **Library.** Imported books are kept on the server in SQLite, so the phone and the
  computer share them, with cover, progress and last read; the service worker caches what's
  needed offline. Delete and re-import.
  *Done:* Server-side SQLite, shared by all devices; cover, progress, last opened; delete.
- [x] **Open from anywhere.** File picker, drag and drop on desktop, Share-to/Open-with on
  mobile via PWA share target if feasible.
  *Done:* File picker, desktop drag and drop, and an Android share target (installed PWA):
  the service worker receives the POST on the device and the library offers the file or text
  in Add a book; it is never added without a tap, since any website can POST to `/share`.
  Shared links get an explanation (Readhouse never fetches URLs). A share to a locked device
  waits through unlocking (e2e-tested on all three profiles); the gap noted earlier was the
  Secure-cookie bug below. Not on iOS (no share target).
- [ ] **AO3 still first-class.** Keep the AO3 parser (paste/HTML download) and give AO3 works
  the same chapter UI as EPUB; AO3's own EPUB downloads should import cleanly. Test with AO3
  downloads before 2026-11-13.

## AllTalk integration

- [ ] **Pin the AllTalk version.** Keep `../alltalk_tts` on the latest `alltalkbeta`; decide
  whether the local `atsetup.sh` / `confignew.json` edits are kept or discarded. Record the tested AllTalk version in the docs and show a warning
  in the app when the server reports something older.
  *(in progress)* Built and tested against `alltalkbeta` at f16117e (2026-01-09). AllTalk has no version endpoint, so no in-app warning. Local edits in `../alltalk_tts` kept (see Decisions).
  *Verified live (2026-10-31)* against f16117e with XTTS `xttsv2_2.0.3` on CPU (Python 3.11.9,
  torch 2.2.1, coqui-tts 0.24.3, gradio 6.3.0 with huggingface-hub < 1.0; the installer's
  unpinned `gradio>=4.50` pulls a huggingface-hub that breaks transformers 4.46). Readhouse
  read engine, model, capabilities and 19 voices; a 120-character passage took 4.2 s to
  generate and came back as 6.7 s of AAC; the repeat came from the cache in 20 ms; WebKit
  (iPhone profile) played it and advanced to the next passage by itself. Run notes:
  `../alltalk_tts/READHOUSE-RUN.md`.
- [x] **Re-read the API and use it fully.** Endpoints in `docs/alltalk-api-full.md`: `ready`,
  `voices`, `rvcvoices`, `currentsettings`, `reload`, `tts-generate`,
  `tts-generate-streaming`, `stop-generation`, `openai-voicemap`, `deepspeed`,
  `lowvramsetting`, `reload_config`. Not used today: `stop-generation` (wire it to
  pause/skip/cancel so the GPU isn't busy with paragraphs nobody will hear), and the
  engine-capability fields in `currentsettings` should drive which controls are shown.
  *Done:* Verified against `tts_server.py` on `alltalkbeta`. Used: `ready`, `currentsettings` (engine, model, capabilities drive which settings show and key the audio cache), `voices`, `rvcvoices`, `tts-generate` (voice, narrator, unquoted text, language, temperature, repetition penalty, RVC), `/audio/<file>`, `stop-generation`. Not used on purpose: `reload`/`deepspeed`/`lowvramsetting` (server administration belongs in AllTalk's own UI), OpenAI endpoint (no gain).
- [x] **Narrator mode for fiction.** AllTalk v2 can voice narration and quoted dialogue with
  different voices. `services/api/tts.ts` already sends `narrator_enabled` /
  `narrator_voice_gen`, but no UI sets them. Expose narrator/character voice choice; it suits
  novels and fanfic well.
  *Done:* Narrator on/off, narrator voice, and who reads unquoted text, in Settings.
  Off by default and marked Experimental, with a warning that it often doesn't work well yet
  (user's call, 2026-10-31).
- [x] **Streaming for faster first audio.** Use `tts-generate-streaming` where the engine
  supports it so playback starts sooner, with fallback to `tts-generate`.
  *Decided: not now.* The streaming endpoint ignores narrator, RVC and temperature, can't go through the cache, and Safari plays progressive WAV poorly. Start-up time is handled by short segments (`SEGMENT_MAX_CHARS`) and prefetching. Revisit if real-device latency is a problem.
- [x] **Generation pipeline.** One queue/controller for live, buffered and batch generation
  (today three paths: `useAudioPlayer`, `useBufferedPlayback`, batch). Cancel on seek,
  prefetch N paragraphs ahead, retries with backoff, clear errors when AllTalk is down.
  *Done:* One server queue (now before prefetch, dedupe, cancel abandoned), reader prefetches 3 passages ahead and warms the cache; "save chapter" replaces batch generation.
- [x] **Proxy AllTalk through the app server.** The phone talks only to the app's origin; the
  server forwards to AllTalk on localhost. AllTalk no longer needs to listen on the LAN, and
  audio URLs stop breaking when the host's address differs between LAN and Tailscale.
  *Done:* The browser only talks to Readhouse; audio is cached and served by hash.

## Stability testing

- [x] **Test tooling and a check gate.** Vitest for units, Playwright for end-to-end; one
  `check` command (types, lint incl. design-system rules, unit, e2e) run by a pre-push hook
  and CI (GitHub Actions), like Ditherhouse's `mise run check`.
  *Done:* `mise run check` (types, prettier, eslint, stylelint, vitest, prod audit, gitleaks, Playwright on iPhone/Android/desktop), pre-push hook, GitHub Actions.
- [x] **Fake AllTalk server.** A test double that serves the API with short fixed WAVs, slow
  responses and errors on demand, so tests are fast and deterministic without a GPU.
  *Done:* `tests/fake-alltalk.ts`, also runnable standalone for UI work.
- [x] **Unit tests for the core.** Text processing and paragraph splitting, AO3 parser, EPUB
  and TXT parsing (with real sample books, including malformed ones), chapter detection,
  the playback state machine, session (de)serialization, import/export round trips.
  *Done:* For text, import, library, settings, AllTalk client, speech and access (74 tests).
- [x] **End-to-end flows** on a phone viewport (iPhone + Android profiles, WebKit and Chromium)
  and desktop: import a book → pick a chapter → play → auto-advance → pause/resume →
  reload and resume position; settings persist; AllTalk offline shows the right state;
  offline session plays without AllTalk.
  *Done:* `tests/e2e/ui.spec.ts` on WebKit iPhone, Chromium Android and desktop: import, play, auto-advance across chapters, tap to read, contents, mini player, settings, theme, no sideways scroll, offline playback of a saved chapter.
- [x] **Visual regression.** Screenshot the design-system reference page and key screens in
  every theme; the build fails on unreviewed visual changes.
  *Done:* `tests/e2e/visual.spec.ts`: library (empty, and stocked with a worst-case AO3 title),
  Add a book, reader, reader while playing, Contents, Settings (top and end), Unlock, in light,
  dark and sepia on iPhone, Pixel and desktop (66 baselines, ~4 MB, committed in
  `tests/visual/`). Its own server and fake AllTalk (one-minute passages, so the playing state
  holds still). Local and pre-push only: CI skips it (`CI` set), since Mac baselines don't match
  Linux font rendering; a pinned Linux container in CI is the later option. Refresh with
  `mise run visual:update` after reviewing. Add the reference page once it exists. It caught
  two real bugs at once: the library overflowed the frame on phones (grid track sized by an
  unwrapped detail line) and the author separator lost its space.
- [ ] **Manual device checklist.** *(in progress)* Written: `docs/device-checklist.md` (first
  run, lock screen and background, audio routes, offline, installed app and share target,
  accessibility with large text and screen readers, AO3, passcode, plain http, a results
  table). Still to do: run it on a real iPhone and Android phone with the real AllTalk
  before 2026-11-13. Include: playback continues across passages with the screen
  locked; headphones unplugged pauses; lock-screen next/previous; offline chapter after toggling
  airplane mode; first real AllTalk run on a phone (verified on desktop WebKit, 2026-10-31).
  Originally: A short script to run on a real iPhone (Safari autoplay,
  lock screen, background playback) before each release; those can't be fully automated.

## Code quality

- [x] **Rewrite, don't port.** The React code isn't carried over as-is. Lessons from it for
  the Svelte version: no 800-line route files (`reader.tsx` 814, `readerStore.ts` 849,
  `useBufferedPlayback.ts` 788); routes and components stay thin, logic lives in plain TS
  modules that are tested without the UI; Svelte 5 runes for state instead of
  Zustand + XState side by side (keep an explicit state machine for playback only if it
  pays for itself).
  *Done:* Done; the React app is gone from this branch (still on `main`).
- [x] **One way to do each thing.** Today there are duplicates: live, buffered and batch
  generation paths; JSON export *and* zip export; server sessions *and* IndexedDB (with a
  migration banner); `ServerConfigModal` *and* `SessionStorageConfig`. The new app has one
  of each (see Feature audit).
  *Done:* One queue, one storage backend (server SQLite + device cache for offline), one export path still to decide (see Feature audit).
- [x] **Logic outside components.** Text processing, AO3/EPUB/TXT parsing, the generation
  queue, the AllTalk client and the library schema live in `$lib` / `$lib/server` modules,
  tested directly; components only render and dispatch.
  *Done:* Text, import, positions, player and offline logic are plain TS modules; components render and dispatch.
- [x] **Clean dependency list.** Start from zero; today's list carries unused packages
  (`cheerio`, `lowdb`, `redaxios`, `@tanstack/react-query`, `body-parser`) and TanStack
  starter remnants. Every dependency in the new app is justified.
  *Done:* Runtime deps are valibot, htmlparser2, fflate. Drizzle dropped (stable has no node:sqlite driver).
- [ ] **Rewrite `README.md` and `CLAUDE.md` for Readhouse.** Both describe AllTalk Reader's
  React/Express app. README: what Readhouse is, screenshots (phone and desktop), setup with
  AllTalk `alltalkbeta`, running it on a computer and opening it from a phone over LAN or
  Tailscale (`tailscale serve` for HTTPS), importing EPUB/TXT/AO3. `CLAUDE.md`: the
  SvelteKit layout, commands (`mise` tasks, the check gate), design-system rules (no ad-hoc
  values or components), testing expectations. `CLAUDE.md` is currently gitignored; decide
  whether to commit it so every session gets the same rules. Update the rest of `docs/`
  (architecture, API reference) at the same time and delete what no longer applies.
  *(in progress)* README rewritten (setup, Tailscale, config, running as a service, security). CLAUDE.md rewritten and committed; refresh after the design phase.
  README screenshots (phone light and dark reader, phone library, desktop reader; plus desktop
  library and sepia Contents in `docs/screenshots/`) are made by `mise run screenshots` from
  `tests/e2e/readme.spec.ts`, at 2x, with public-domain books. README now has "Connecting to
  AllTalk": only what to put in `ALLTALK_URL` and how to check it in Settings.
- [x] **Tooling.** ESLint + Prettier (or Biome), strict TypeScript, pin Node and pnpm in
  `mise.toml` (pnpm is unpinned, so the `pnpm` shim fails), `pnpm approve-builds` for
  esbuild, commit conventions, one up-to-date architecture doc.
  *Done:* Prettier, ESLint (svelte plugin, typed routes), stylelint, strict TS, Node/pnpm/gitleaks pinned in `mise.toml`.
- [x] **Config in one place.** All settings validated at startup (`src/config/`), no
  hard-coded hosts; the old `localhost:7851` / LAN IP defaults live only in `.env`.
  *Done:* `src/env.ts` validates everything at startup.

## Security

The app is reachable from other devices by design, so treat the network as untrusted.

- [x] **Lock down the server.** Today's `server.js` allows any origin (`cors()`), binds
  `0.0.0.0`, has no authentication, accepts 50 MB JSON and stores `req.body` unvalidated.
  The SvelteKit server is same-origin only; every endpoint validates its input with a schema
  (e.g. zod/valibot) and has size limits; uploads are streamed with a cap; rate limits on
  write and AllTalk endpoints; SQLite transactions instead of rewriting a JSON file.
  *Done:* See Security checklist; API tests cover cross-site, validation and size limits.
- [x] **Access control for LAN/Tailscale.** At minimum an optional passcode/token; recommend
  serving over Tailscale (`tailscale serve` gives HTTPS and limits access to the tailnet)
  and document it. Bind to localhost when only Tailscale serve is used.
  *Done:* Passcode, signed cookies, rate limit; README covers Tailscale.
  *Fixed (2026-10-31):* over plain http the session cookie was sent `Secure`, because
  adapter-node takes every request for https unless `ORIGIN` or `PROTOCOL_HEADER` is set;
  Safari (and Chrome on a LAN address) dropped it, so a passcode never unlocked. `Secure` now
  follows the browser's Origin header. Chromium's e2e runs missed it: 127.0.0.1 counts as
  secure there.
- [x] **HTTPS story.** Plain http over LAN isn't a secure context: pitch shift (AudioWorklet)
  is disabled, and PWA install, service workers and some media APIs won't work. Make
  `tailscale serve` (or a local cert via mkcert/Caddy) the documented default.
  *Done:* README recommends `tailscale serve`; offline and lock-screen features explain themselves when on plain http.
- [x] **Untrusted input.** EPUB/HTML/AO3 content sanitized (DOMPurify or text-only
  rendering), size and entry limits on zip/EPUB import (zip bombs), session import
  validated, Content-Security-Policy header.
  *Done:* Book HTML reduced to text, covers sniffed and sandboxed, zip limits counted while inflating.
- [x] **Dependencies.** `pnpm audit` clean and part of the check gate; Dependabot/Renovate.
  *Done:* `pnpm audit --prod` and gitleaks in the gate. Dev-only advisories (eslint minimatch, vite-plugin deepmerge, no fix yet) reported by `mise run audit`. Dependabot (`.github/dependabot.yml`): weekly grouped npm updates, monthly Actions.
- [ ] **Secrets and data.** Nothing sensitive in the repo or bundle; `data/` stays gitignored;
  no IPs or hostnames committed.
- [ ] **Security checklist, applied to every change.** The items from the wider industry
  list that apply to a self-hosted, single-user app with SQLite:
  - *Injection:* parameterized SQL only (no string-built queries); no shell calls with user
    input; path traversal (uploaded and stored file names never become paths; files are
    stored by generated id).
  - *Browser:* XSS (book HTML is sanitized or rendered as text; no `{@html}` on untrusted
    input), CSRF (SvelteKit origin check stays on; state changes only via POST/PUT/DELETE),
    CORS (none: same origin), clickjacking (`frame-ancestors 'none'`), Content Security
    Policy (SvelteKit `csp` with nonces/hashes), security headers (`X-Content-Type-Options`,
    `Referrer-Policy`, `Permissions-Policy`), HSTS only when served over HTTPS.
  - *Server:* input validation with schemas at every endpoint, mass assignment (whitelist
    fields; never spread request bodies into rows), IDOR-safe ids (random, not sequential;
    still checked), SSRF (the AllTalk proxy forwards only to the configured AllTalk origin
    and an allow-list of paths; user-supplied URLs are never fetched server side), request
    size limits, file upload validation (type sniffing, size, zip-bomb limits), brute-force
    protection and timing-safe comparison for the access passcode, least privilege (runs as
    a normal user; writes only to its data dir).
  - *Supply chain:* lockfile committed, `pnpm audit` in the gate, minimal dependencies,
    pnpm build-script allow-list, secret scanning (gitleaks) in the gate.
  - *Data:* SQLite transactions, foreign keys on, unique constraints, migrations (forward
    and tested), backups of the data dir documented and restore tested once.
  *(in progress)* Applied so far to the server; CSP and headers in place.

## Performance

A phone on Wi-Fi or Tailscale is the target device; budgets are checked in the gate.

- [ ] **Budgets.** Initial JS for the reader ≤ 100 KB gzipped; LCP < 1.5 s and INP < 100 ms on
  a mid-range phone over LAN; no layout shift while audio advances; 60 fps scrolling with a
  1,000-paragraph chapter. Bundle size checked in CI.
- [x] **Rendering.** Long chapters render with `content-visibility: auto` (and
  `contain-intrinsic-size`) instead of a JS virtualizer; highlight changes touch two
  elements, not the list; no layout reads in scroll handlers.
  *Done:* `content-visibility: auto` with intrinsic size on every block; highlight is an attribute flip.
- [ ] **Network.** Audio cached by content hash (same text + voice + settings → same file)
  so nothing is generated twice; `Cache-Control`/`ETag` on audio and immutable hashed
  assets; compression (brotli/gzip) for text; HTTP keep-alive to AllTalk; prefetch only a
  few paragraphs ahead (backpressure; no retry storms: retries with jittered backoff).
  *(in progress)* Content-hash audio cache, immutable caching, ranges and ETags done; compression pending.
  *(in progress)* Compression of text responses: adapter-node does not compress; JSON is small and audio is already compressed (AAC), so left as is unless measurements say otherwise.
- [ ] **Server.** Prepared statements, indexes for every lookup, no N+1 queries when
  listing a library, streaming uploads and audio (never whole files in memory), graceful
  shutdown.
  *(in progress)* Prepared statements, indexes, no N+1 in the library list, streaming audio, chapter LRU.
- [ ] **Battery and memory.** No polling loops (event-driven status), audio elements reused,
  object URLs revoked, wake lock only while playing.
- [x] **Fonts and assets.** Self-hosted, subset WOFF2, `font-display: swap` with metric-matched
  fallbacks; dithered PNG/WebP assets kept small.
  *Done:* EB Garamond variable via fontsource (Latin face preloaded, ~44 KB), Georgia fallback
  with metric overrides; the service worker precaches only Latin and Latin Extended faces
  (other scripts load on demand; all of them would be ~0.5 MB per phone). Bands are 1-bit
  PNGs of ~1.3 KB.

## Feature audit

Verify each works on phone and desktop; fix, or trim if it isn't worth keeping.

- [x] **Live playback** (generate on demand, auto-advance). Keep.
  *Done:* Kept; reworked on the new player.
- [x] **Buffered playback** and **batch pre-generation.** Merge into one "prefetch ahead / download
  chapter" behaviour in the new pipeline.
  *Done:* Merged: prefetch ahead + save chapter for offline.
- [x] **Sessions** (save/resume). Keep, renamed as the library; one storage backend.
  *Done:* Now the library (server) with per-book progress.
- [x] **Export/import** (JSON with base64 audio, zip). Keep zip only (smaller; base64 JSON
  inflates audio by a third and hits the 50 MB limit); read old JSON exports once for
  migration.
  *Trimmed:* the library lives on the server and devices save chapters for offline use, so exporting sessions has no job left. Backups are a copy of `DATA_DIR` (README).
- [x] **Offline sessions.** Keep; verify playback without AllTalk after the storage change.
  *Done:* Replaced by saved chapters on the device; tested end to end with the network cut.
- [x] **Audio cache status / clear cache.** Fold into Settings → Storage.
  *Done:* Settings → Offline listening (usage, remove copies); server cache is bounded by `AUDIO_CACHE_MAX_MB`.
- [x] **Settings monitor / server status.** Replace with a small connection indicator and a
  clear error state.
  *Done:* Settings shows AllTalk connection and model; the player explains when AllTalk is unreachable.
- [x] **Pitch shift.** Keep only if HTTPS becomes the default; otherwise hide over http instead
  of showing a disabled control.
  *Done:* Dropped: playback speed keeps pitch natively (`preservesPitch`), and AllTalk pitch isn't supported by XTTS.
- [x] **RVC voices and advanced TTS settings.** Keep behind "Advanced"; show only when
  `currentsettings` says the engine supports them.
  *Done:* Behind Advanced, shown only when the engine supports them.
- [x] **AO3 parser.** Keep (core use case); add tests.
  *Done:* Kept and tested; pasted AO3 pages become books.
- [x] **Safari/iOS audio handling** (`SafariAdapter`). Keep; cover with the device checklist.
  *Done:* One audio element unlocked on first tap; byte-range audio for Safari. Device checklist still to run on a real iPhone.

## Bugs

- [x] **`pnpm` doesn't run in this repo.** `mise.toml` pins only Node; add pnpm.
  *Done:* Node 26 and pnpm 12.16.1 pinned.
- [x] **esbuild build script blocked under pnpm 12.** `pnpm install` exits with
  `ERR_PNPM_IGNORED_BUILDS`; approve it in config.
  *Done:* `allowBuilds` in `pnpm-workspace.yaml`.

## Progress log

One line per work session: date, what was done, what's next.

- 2026-10-31: Backlog, decisions and working rules written; `design-inspo.md` set up
  (local only). Next: scaffold the SvelteKit app.
- 2026-10-31: SvelteKit 3 scaffold; text core and EPUB/TXT/AO3 import; SQLite library;
  AllTalk client, speech cache and queue; JSON API with CSP, cross-site checks, passcode;
  74 unit + 13 API e2e tests. Decided: no ORM (node:sqlite direct), server-side import.
  Next: reader client (player, prefetch, Media Session), interim UI on tokens.
- 2026-10-31: Reader client (player, prefetch, Media Session, mini player), library, settings,
  unlock; offline chapters via service worker; AAC compression; PWA manifest; README; stylelint
  token enforcement; gate in CI and pre-push. 80 unit + 31 e2e tests. Next: design phase
  (artifacts for comparison), then sentence-level highlight, sleep timer, desktop layout.
- 2026-10-31: Sentence-level highlight, sleep timer (minutes or end of chapter, fade-out),
  desktop keyboard shortcuts. Found and fixed a real WebKit bug: media played from service-worker
  responses got a stray pause on the second passage; media range requests now go to the network
  while online. 80 unit + 38 e2e tests. Visual directions artifact published; waiting on a pick.
- 2026-10-31: Engraved (direction A) built: tokens, EB Garamond, ruled frame (now above header
  and player, paper masked outside it), dithered chapter bands, drop caps, restyled library,
  reader, player and mini player. Screenshot review fixed: drop cap invisible in the spoken
  sentence, unreadable current chapter in Contents, justified rivers on phones, settings touching
  the frame. Service worker no longer precaches non-Latin font subsets. Kept AllTalk's local
  edits. 81 unit + 38 e2e tests. Next: Select/Field/Toggle/list rows and the lint rule against
  raw controls, then desktop layout.
- 2026-10-31: User picked control style B (Plate). Built Field, Select, TextField, Checkbox,
  Radio, Slider, FilePicker, ListRow (table-of-contents leaders), Badge, Button `text`;
  replaced every raw control; ESLint now forbids raw controls outside `src/lib/ui/`. Narrator
  marked Experimental with a warning, off by default. Next: desktop layout (variants first).
- 2026-10-31: Desktop layout variants published for a pick. Android share target with a
  confirm step (CSRF-safe), e2e-tested on all three profiles. Next: desktop layout once picked;
  visual regression screenshots; README screenshots; device checklist.
- 2026-10-31: Folio desktop reader built (sidebar contents shared with the phone sheet via a
  snippet; e2e helpers find Contents in either). Chapter bands now Bayer 8×8 (~200 bytes each).
  Next: visual regression screenshots, README screenshots, device checklist.
- 2026-10-31: Visual regression suite (66 baselines, local + pre-push, CI skips). Fixed the
  phone library overflowing its frame and the missing space after the author; book details
  now wrap instead of truncating. AllTalk v2 installed and running locally (XTTS v2.0.3, CPU;
  a subagent did the install, notes in `../alltalk_tts/READHOUSE-RUN.md`) and verified live
  through Readhouse. Desktop library built as the printed index (user's pick); type sizes
  raised for accessibility; every baseline reviewed again. README screenshots and a
  "Connecting to AllTalk" section. Fixed a lost-place bug the e2e suite caught intermittently:
  jumping to a chapter saved only after the chapter loaded, so leaving at once kept the old
  place; saves now go out at once and in order, and the library refreshes when the last one
  lands. Device checklist written (needs a run on real phones). Next: remaining components.
- 2026-10-31: Variants for Dialog, loading, toast and progress published for a pick. TXT import
  knows "Stave" headings (A Christmas Carol: five staves). Fixed a real passcode bug: over plain
  http the session cookie was `Secure` (adapter-node assumes https), so Safari never stayed
  unlocked; this was also the "locked share" gap, now e2e-tested. Next: build the picked
  components, then the living reference page.
