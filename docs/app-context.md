# AllTalk Reader - Agent Context Document

This document provides everything an agent needs to understand and work with this codebase.

---

## Executive Summary

**AllTalk Reader** is a web-based text-to-speech audiobook application. Users paste text, the app splits it into paragraphs, generates high-quality audio using a local AllTalk TTS server, and plays it back with auto-progression (like an audiobook). Sessions can be saved, exported as portable offline files, and imported on any device.

**Tech Stack**: React 19 + TanStack Router + Vite + Tailwind CSS + Express.js backend

**External Dependency**: Requires AllTalk TTS Server running locally (default port 7851)

---

## Quick Understanding

### What Users Do
1. Paste text into the app
2. Click "Process Text" to split into paragraphs
3. Play audio (generated on-demand or pre-generated)
4. Save sessions for later
5. Export sessions as offline-capable JSON files

### Four Playback Modes

| Mode | Description | Files |
|------|-------------|-------|
| **Live Generation** | Click play → generate audio → play immediately → auto-progress | `useAudioPlayer.ts` |
| **Pre-Generation** | Generate all audio upfront → instant playback | `BatchGenerator.tsx`, `useBatchAudioGeneration.ts` |
| **Buffered Playback** | Generate ahead while playing (NEW) | `useBufferedPlayback.ts`, `src/services/generation/` |
| **Offline Mode** | Export with embedded audio → import anywhere | `ExportImportManager.tsx` |

---

## Documentation Map

| Topic | File | What You'll Find |
|-------|------|------------------|
| Architecture & Structure | `docs/architecture.md` | Tech stack, project structure, data models, hooks |
| Playback Modes | `docs/playback-modes.md` | Detailed flows for all playback modes |
| Critical Code Paths | `docs/critical-paths.md` | Must-read algorithms, Safari handling, migrations |
| API Reference | `docs/api-reference.md` | AllTalk endpoints, env vars, session API |
| Development Guide | `docs/development.md` | Setup, testing, debugging, known issues |
| Main Instructions | `CLAUDE.md` | Agent-specific guidance, quick reference |

---

## Project Structure

```
src/
├── routes/
│   └── reader.tsx           # MAIN ORCHESTRATOR - All UI & state coordination
├── state/                   # ✨ NEW: Centralized state management
│   ├── readerStore.ts       # Zustand store with 9 state slices
│   └── playbackMachine.ts   # XState machine for playback (idle → loading → playing)
├── core/                    # ✨ NEW: Core audio infrastructure
│   ├── AudioEngine.ts       # Centralized audio playback & settings
│   └── SafariAdapter.ts     # Safari-specific compatibility layer
├── hooks/                   # Thin wrappers around Zustand store
│   ├── useAudioPlayer.ts    # Live playback with state machine
│   ├── useBufferedPlayback.ts # Buffer-ahead playback mode
│   ├── usePlaybackMachine.ts  # XState machine wrapper
│   ├── useTextProcessor.ts  # Text input, paragraph splitting, AO3 detection
│   ├── useTtsSettings.ts    # Voice, speed, pitch, language (Zustand wrapper)
│   ├── useBatchGeneration.ts # Pre-generated audio state (Zustand wrapper)
│   ├── useBatchAudioGeneration.ts # Batch generation logic
│   ├── useSessionManager.ts # Session loading, offline detection (Zustand wrapper)
│   ├── useSessionSaver.ts   # Auto-save after batch generation
│   ├── usePlaybackSettings.ts # Client-side speed/pitch (Zustand wrapper)
│   ├── useModalState.ts     # UI modal visibility (Zustand wrapper)
│   └── [other hooks...]
├── services/
│   ├── api/                 # Modular API services
│   │   ├── client.ts        # HTTP client with timeout
│   │   ├── tts.ts           # TTS generation & text splitting
│   │   ├── voices.ts        # Voice management
│   │   └── status.ts        # Server health checks
│   ├── textProcessing/      # Text processing & AO3 parsing
│   │   ├── textProcessor.ts # Main entry: processInput + splitIntoParagraphs
│   │   ├── ao3Parser.ts     # State machine parser for AO3 pages
│   │   └── ao3Config.ts     # Configurable AO3 markers & patterns
│   ├── generation/          # Buffered playback system
│   │   ├── controller.ts    # GenerationController class
│   │   └── types.ts         # Buffer state types
│   ├── session/             # Session management
│   │   ├── api.ts           # CRUD operations
│   │   ├── export.ts        # Export logic
│   │   ├── import.ts        # Import logic
│   │   ├── cache.ts         # Browser cache management
│   │   └── offline.ts       # Base64 ↔ blob URL conversion
│   └── storage/             # IndexedDB storage
│       └── indexedDb.ts     # Persistent audio storage
├── components/
│   ├── buffer/              # Buffer mode UI
│   │   ├── BufferPlayButton.tsx
│   │   ├── BufferStatusIndicator.tsx
│   │   └── BufferSettings.tsx
│   ├── BatchGenerator.tsx   # Pre-generation modal
│   ├── ExportImportManager.tsx # Offline export/import
│   ├── SessionManager.tsx   # Session browser modal
│   ├── SettingsMonitor.tsx  # Server status & config
│   ├── ServerConfigModal.tsx # Edit server URL
│   ├── PlaybackControls.tsx # Play/pause/skip buttons
│   └── ParagraphList.tsx    # Paragraph display
├── contexts/
│   └── ApiStateContext.tsx  # Centralized API state
└── config/
    └── env.ts               # Environment configuration
```

---

## Key Features & Their Locations

### 1. Text Processing & AO3 Auto-Parsing
- **User pastes text** → `reader.tsx` textarea
- **AO3 auto-detection** → `textProcessor.processInput()` detects AO3 pages
- **AO3 parsing** → `ao3Parser.ts` extracts chapter content, removes navigation/UI
- **Splits into paragraphs** → `useTextProcessor.ts` → `textProcessor.splitIntoParagraphs()`
- **Smart splitting**: Respects sentence boundaries, max 4096 chars per chunk

**AO3 Parser Details**:
- Auto-detects by matching 2+ detection patterns (Chapter links, kudos, bookmarks, etc.)
- State machine: `seeking` → `in_summary` → `in_notes` → `in_chapter` → `done`
- Configurable markers in `ao3Config.ts` for easy maintenance
- Extracts: chapter title, summary, notes, chapter text
- UI shows green notification when AO3 content detected

### 2. Live Playback (Default Mode)
- **Entry point**: Click paragraph or play button
- **Hook**: `useAudioPlayer.ts`
- **Flow**: `handlePlayParagraph()` → `tts.ts:generateTTS()` → Audio element → `onended` → auto-progress
- **Safari handling**: Reuses single Audio element (lines 38-52)

### 3. Buffered Playback (NEW)
- **Entry point**: Click buffer play button (lightning bolt icon)
- **Hook**: `useBufferedPlayback.ts`
- **Controller**: `src/services/generation/controller.ts`
- **Flow**: Start → Generate buffer ahead → Play → Generate more as playing
- **Config**: Target buffer size, min buffer before playback

### 4. Pre-Generation (Batch Mode)
- **Entry point**: "Pre-Generate All Audio" button
- **Component**: `BatchGenerator.tsx`
- **Hook**: `useBatchAudioGeneration.ts`
- **Auto-saves**: `useSessionSaver.ts` saves to Express server

### 5. Session Management
- **Storage**: Express server → `data/sessions.json`
- **Component**: `SessionManager.tsx`, `SessionList.tsx`
- **Hook**: `useSessionManager.ts`
- **API**: `src/services/session/api.ts`

### 6. Offline Export/Import
- **Component**: `ExportImportManager.tsx`
- **Export**: Converts audio to base64, embeds in JSON
- **Import**: Validates, converts base64 back to blob URLs
- **Logic**: `src/services/session/export.ts`, `import.ts`, `offline.ts`

### 7. Server Configuration
- **Component**: `SettingsMonitor.tsx` (status display)
- **Modal**: `ServerConfigModal.tsx` (edit host/port)
- **Storage**: `localStorage` overrides env vars
- **Config**: `src/config/env.ts`

---

## Important Patterns

### State Management (✨ Refactored 2025-02-09)
- **Pattern**: Zustand store with thin hook wrappers
- **Location**: `src/state/readerStore.ts` (single source of truth)
- **Hooks**: `src/hooks/*` are now thin wrappers around Zustand slices
- **Coordination**: All state consolidated in readerStore, consumed via hooks
- **DevTools**: Redux DevTools integration for state inspection
- **Example**:
  ```typescript
  // Hook wrapper (maintains API compatibility)
  const { selectedVoice, updateVoice } = useTtsSettings()

  // Backed by Zustand store
  const selectedVoice = useReaderStore(state => state.ttsSettings.selectedVoice)
  ```

### Playback State Machine (✨ New 2025-02-09)
- **Pattern**: XState state machine for explicit transitions
- **Location**: `src/state/playbackMachine.ts`
- **States**: `idle → loading → ready → playing → paused`
- **Benefits**: Invalid states impossible, race conditions eliminated
- **Integration**: Used by `useAudioPlayer.ts` via `usePlaybackMachine.ts`

### Audio Infrastructure (✨ New 2025-02-09)
- **Pattern**: Centralized AudioEngine for all playback modes
- **Location**: `src/core/AudioEngine.ts`
- **Features**:
  - Safari compatibility via `SafariAdapter`
  - Real-time playback settings (speed, preservesPitch)
  - Unified audio lifecycle management
- **Usage**: Both `useAudioPlayer` and `useBufferedPlayback` use AudioEngine
- **Example**:
  ```typescript
  const audioEngine = new AudioEngine(new SafariAdapter())
  await audioEngine.play(url, { speed: 1.5, preservesPitch: true })
  ```

### API Calls
- **Preferred**: `src/services/api/*` modules
- **Context**: `ApiStateContext` for shared API state

### Data Persistence (3 Layers)
1. **sessionStorage**: Temporary audio cache (cleared on tab close)
2. **Express server**: `data/sessions.json` (persistent metadata)
3. **Exported JSON**: Self-contained with base64 audio

---

## Recent Architecture Refactoring (2025-02-09)

### ✨ Pragmatic Rewrite Complete (All 5 Phases)

**Major refactoring following Pragmatic Programmer principles. All phases completed in one day.**

#### Phase 1: Critical Bug Fixes
- ✅ Fixed stale audio after "New Book" (orthogonality violation)
- ✅ Fixed single-paragraph buffered playback stuck (race condition)
- ✅ Added atomic state resets

#### Phase 2: AudioEngine Extraction
- ✅ Created `core/AudioEngine.ts` - centralized audio playback
- ✅ Created `core/SafariAdapter.ts` - Safari compatibility layer
- ✅ Eliminated ~150 lines of duplicate audio code
- ✅ Both `useAudioPlayer` and `useBufferedPlayback` now use AudioEngine

#### Phase 3: State Consolidation (Zustand)
- ✅ Created `state/readerStore.ts` with 9 state slices
- ✅ Migrated all hooks to Zustand wrappers (maintains API compatibility)
- ✅ Added Redux DevTools integration
- ✅ localStorage persistence for playback settings
- ✅ Simplified reader.tsx by ~90 lines

#### Phase 4: State Machine Implementation (XState)
- ✅ Created `state/playbackMachine.ts` (idle → loading → ready → playing → paused)
- ✅ Created `hooks/usePlaybackMachine.ts` wrapper
- ✅ Migrated useAudioPlayer to state machine
- ✅ Fixed auto-progression bug (ready → playing transition)
- ✅ Eliminated 163 lines of boolean flag complexity

#### Phase 5: Bug Fixes & Polish
- ✅ Fixed dual audio playback in buffered mode (tracking issue)
- ✅ Fixed playback speed real-time updates
- ✅ Added `currentlyPlayingAudioRef` to track active audio source
- ✅ Comprehensive documentation updates

**Result**: Transformed "vibe-coded" architecture into well-structured app following DRY, orthogonality, and ETC principles.

### AO3 Auto-Parser
Automatically detects and parses Archive of Our Own (AO3) pages when pasted. Key files:
- `src/services/textProcessing/ao3Config.ts` - Configurable detection patterns & markers
- `src/services/textProcessing/ao3Parser.ts` - State machine parser
- `src/services/textProcessing/textProcessor.ts` - Main entry point

**Features**:
- Auto-detects AO3 by matching 2+ detection patterns
- Extracts chapter content, removes navigation/UI clutter
- Shows green notification with chapter title when detected

---

## Development Commands

```bash
pnpm start:all    # RECOMMENDED: Start both servers (Vite:3000, Express:3001)
pnpm dev          # Vite only (limited functionality)
pnpm build        # Production build
```

**Required**: AllTalk TTS server running on configured host:port

---

## Environment Variables

```bash
VITE_API_PROTOCOL=http://       # http:// or https://
VITE_API_HOST=localhost         # AllTalk server host
VITE_API_PORT=7851              # AllTalk server port
VITE_CONNECTION_TIMEOUT=5       # Timeout in seconds
VITE_MAX_CHARACTERS=4096        # Max chars per TTS request
```

---

## Common Tasks for Agents

### Adding a New Feature
1. Create hook in `src/hooks/` if state needed
2. Add component in `src/components/`
3. Wire up in `src/routes/reader.tsx`
4. Use `src/services/api/*` for API calls

### Debugging Playback
1. Check browser console for `[BufferedPlayback]` or `useAudioPlayer` logs
2. Verify AllTalk server is running
3. Check `SettingsMonitor` for connection status

### Modifying TTS Generation
- Text splitting: `src/services/api/tts.ts`
- Generation call: `ttsService.generateTTS()`
- Buffer mode: `src/services/generation/controller.ts`

### Working with Sessions
- CRUD: `src/services/session/api.ts`
- Export: `src/services/session/export.ts`
- Import: `src/services/session/import.ts`
- Offline audio: `src/services/session/offline.ts`

---

## File Quick Reference

| Need to... | Look at... |
|------------|------------|
| Understand main UI | `src/routes/reader.tsx` |
| Debug playback | `src/hooks/useAudioPlayer.ts`, `useBufferedPlayback.ts` |
| Modify TTS | `src/services/api/tts.ts` |
| Modify text processing | `src/services/textProcessing/textProcessor.ts` |
| Update AO3 parser markers | `src/services/textProcessing/ao3Config.ts` |
| Debug AO3 parsing | `src/services/textProcessing/ao3Parser.ts` |
| Fix session storage | `src/services/session/*.ts` |
| Add UI component | `src/components/` |
| Change API config | `src/config/env.ts` |
| Understand types | `src/services/generation/types.ts`, `src/services/session/types.ts` |
