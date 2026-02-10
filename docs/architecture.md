# Architecture

## Tech Stack

- **Frontend**: React 19 with TanStack Router (SPA mode)
- **Build Tool**: Vite with TypeScript (strict mode)
- **Styling**: Tailwind CSS with dark theme (design tokens in `src/design-system/constants.ts`)
- **Backend**: Express.js session storage server (50MB JSON limit for embedded audio)
- **External API**: AllTalk TTS server integration (REST API)

## Project Structure

```
src/
├── state/                # ✨ Centralized state management (Phase 3 & 4)
│   ├── readerStore.ts    # Zustand store with 9 state slices + Redux DevTools
│   └── playbackMachine.ts # XState machine (idle → loading → ready → playing → paused)
├── core/                 # ✨ Core audio infrastructure (Phase 2)
│   ├── AudioEngine.ts    # Centralized audio playback & settings management
│   └── SafariAdapter.ts  # Safari-specific compatibility layer
├── services/             # API and storage services
│   ├── api/             # Modular AllTalk API services
│   │   ├── client.ts    # HTTP client with timeout & retry logic
│   │   ├── status.ts    # Server status checking (/api/ready, /api/currentsettings)
│   │   ├── voices.ts    # Voice management (/api/voices, /api/rvcvoices)
│   │   └── tts.ts       # TTS generation (/api/tts-generate) & text splitting logic
│   ├── textProcessing/  # Text processing & AO3 parsing
│   │   ├── textProcessor.ts # Main entry: processInput + splitIntoParagraphs
│   │   ├── ao3Parser.ts  # State machine parser for AO3 pages
│   │   └── ao3Config.ts  # Configurable AO3 markers & patterns
│   ├── generation/      # Buffered playback system
│   │   ├── controller.ts # GenerationController class
│   │   └── types.ts      # Buffer state types
│   ├── session/         # Session management
│   │   ├── api.ts       # CRUD operations
│   │   ├── export.ts    # Export logic
│   │   ├── import.ts    # Import logic
│   │   ├── cache.ts     # Browser cache management
│   │   └── offline.ts   # Base64 ↔ blob URL conversion
│   └── storage/         # IndexedDB storage
│       └── indexedDb.ts  # Persistent audio storage
├── hooks/               # Thin wrappers around Zustand store (Phase 3)
│   ├── useAudioPlayer.ts         # Live playback with XState machine (Phase 4)
│   ├── useBufferedPlayback.ts    # Buffer-ahead mode (uses AudioEngine)
│   ├── usePlaybackMachine.ts     # XState machine wrapper (Phase 4)
│   ├── useBatchAudioGeneration.ts # Sequential batch generation logic
│   ├── useSessionSaver.ts        # Auto-save after batch generation
│   ├── useTextProcessor.ts       # Text input, splitting, AO3 detection (Zustand wrapper)
│   ├── useTtsSettings.ts         # TTS settings (Zustand wrapper)
│   ├── useBatchGeneration.ts     # Pre-generated audio state (Zustand wrapper)
│   ├── usePlaybackSettings.ts    # Client-side speed/pitch (Zustand wrapper)
│   ├── useModalState.ts          # UI modal visibility (Zustand wrapper)
│   ├── useServerConnection.ts    # API connection status
│   └── useSessionManager.ts      # Session loading (Zustand wrapper)
├── components/          # UI components
│   ├── buffer/          # Buffer mode UI
│   │   ├── BufferPlayButton.tsx
│   │   ├── BufferStatusIndicator.tsx
│   │   └── BufferSettings.tsx
│   ├── BatchGenerator.tsx        # Pre-generation UI orchestrator
│   ├── ExportImportManager.tsx   # Offline export/import UI
│   ├── SessionManager.tsx        # Session modal wrapper
│   ├── SessionList.tsx           # Session browser with delete
│   ├── ParagraphList.tsx         # Paragraph display with auto-scroll
│   ├── SettingsMonitor.tsx       # AllTalk connection status & config editor
│   ├── ServerConfigModal.tsx     # Edit server URL
│   └── [other UI components]
├── routes/              # TanStack Router routes
│   └── reader.tsx       # **MAIN ROUTE** - Orchestrates entire UI (simplified in Phase 3)
├── contexts/            # React contexts
│   └── ApiStateContext.tsx       # Centralized API state
├── config/              # Configuration management
│   └── env.ts           # Environment variable handling
└── design-system/       # Design tokens & constants
    └── constants.ts     # Tailwind tokens, API endpoints, status states
```

## Data Models

### AudioSession Structure

```typescript
interface AudioSession {
  id: string                              // Unique session ID (UUID)
  name: string                            // Auto-generated: first 50 chars of text + date
  createdAt: number                       // Unix timestamp
  updatedAt: number                       // Unix timestamp
  text: string                            // Original full text input
  paragraphs: string[]                    // Split paragraphs array
  audioUrls: string[]                     // Generated audio URLs (AllTalk server paths)
  audioBlobData?: Record<string, string>  // Base64 encoded audio (offline mode only)
  settings: {
    voice: string                         // e.g., "female_01.wav"
    speed: number                         // 0.5 - 2.0
    pitch: number                         // -10 to 10
    language: string                      // e.g., "en"
  }
  isOfflineSession?: boolean              // Flag for imported offline sessions
  hasLocalAudio?: boolean                 // Cache indicator (sessionStorage)
}
```

### TTS Configuration

- **Max Characters Per Request**: 4096 (configurable via `VITE_MAX_CHARACTERS`)
- **Connection Timeout**: 5 seconds (configurable via `VITE_CONNECTION_TIMEOUT`)
- **Server Configuration**: Environment-based (see Configuration section)
- **Endpoints**: Defined in `src/design-system/constants.ts` (`API_ENDPOINTS` object)

## Service Layer Architecture

### New Modular API Services (Preferred)

**Location**: `src/services/api/`

**Philosophy**: Separation of concerns with focused, single-responsibility modules. Replace legacy global state with React context patterns.

#### Base Client (`src/services/api/client.ts`)
- **Purpose**: Centralized HTTP client for all AllTalk API requests
- **Features**:
  - Configurable timeout (default 10s)
  - AbortController for request cancellation
  - Custom error classes: `ApiError`, `ConnectionError`
  - Base URL construction from environment config
- **Key Functions**:
  - `createApiClient(config)`: Factory for configured client
  - `fetchJson<T>(endpoint, options)`: Generic JSON fetcher with timeout

#### Status Service (`src/services/api/status.ts`)
- **Purpose**: AllTalk server status checking and configuration
- **Key Functions**:
  - `checkReady()`: Polls `/api/ready` with retry logic
  - `getCurrentSettings()`: Fetches `/api/currentsettings`
  - `reloadConfig()`: Triggers `/api/reload_config`

#### Voice Service (`src/services/api/voices.ts`)
- **Purpose**: Voice management and formatting
- **Key Functions**:
  - `getAvailableVoices()`: Fetches `/api/voices`
  - `getAvailableRvcVoices()`: Fetches `/api/rvcvoices`
  - `formatVoiceOptions(voices)`: Converts to UI dropdown format

#### TTS Service (`src/services/api/tts.ts`)
- **Purpose**: TTS generation and intelligent text splitting
- **Key Functions**:
  - `generateTTS(text, options)`: POST to `/api/tts-generate`
  - `splitTextIntoChunks(text, maxLength)`: Smart text splitting with punctuation detection
  - `splitIntoParagraphs(text, maxLength)`: Main paragraph splitter

### Text Processing Service

**Location**: `src/services/textProcessing/`

**Purpose**: Text preprocessing, AO3 page detection and parsing, paragraph splitting

#### Main Entry (`src/services/textProcessing/textProcessor.ts`)
- **Purpose**: Orchestrates text processing pipeline
- **Key Functions**:
  - `processInput(text)`: Auto-detects AO3 and parses if detected
  - `splitIntoParagraphs(text)`: Split text respecting character limits

#### AO3 Parser (`src/services/textProcessing/ao3Parser.ts`)
- **Purpose**: Extract chapter content from AO3 page text
- **Implementation**: State machine with states: `seeking` → `in_summary` → `in_notes` → `in_chapter` → `done`
- **Key Functions**:
  - `isAo3Page(text)`: Detect if text is from AO3 (requires 2+ pattern matches)
  - `parse(text)`: Extract chapter content, removing navigation/UI elements

#### AO3 Config (`src/services/textProcessing/ao3Config.ts`)
- **Purpose**: Centralized configuration for AO3 markers
- **Contains**:
  - `detectionPatterns`: RegExps to identify AO3 pages
  - `includeStartMarkers`: Markers for content sections (Summary, Notes, Chapter Text)
  - `endMarkers`: Markers indicating end of content (Actions)
  - `excludePatterns`: Lines to filter out (navigation, timestamps, etc.)
- **Maintenance**: Update this file when AO3 changes their page structure

### Session Storage Service

**File**: `src/services/sessionStorage.ts`

**Purpose**: Session CRUD operations, export/import, and offline audio conversion

#### CRUD Operations
- `getAllSessions()`: GET from Express server
- `getSessionById(id)`: GET specific session
- `saveSession(session)`: POST to Express server
- `deleteSession(id)`: DELETE from Express server

#### Export/Import Functions
- `prepareSessionForExport(session, onProgress)`: Download audio + convert to base64
- `prepareSessionForExportFromCache(session)`: Use cached sessionStorage blobs (offline-capable)
- `downloadSessionAsFile(session)`: Trigger JSON download
- `importSessionFromFile(fileContent)`: Parse and validate imported session

#### Offline Audio Functions
- `getOfflineAudioUrl(base64String)`: Convert base64 → blob URL
- `getAudioUrlForPlayback(session, index)`: Smart URL resolver (offline data > cache > URL)

#### Cache Management
- `cacheAudioBlobsForSession(sessionId, audioUrls)`: Store blobs in sessionStorage
- `getCachedAudioBlobsForSession(sessionId, audioCount)`: Retrieve blobs
- `clearAllCachedAudioBlobs()`: Cleanup all cache
- `getCacheSize()`: Calculate storage usage

### AudioEngine (Phase 2)

**File**: `src/core/AudioEngine.ts`

**Purpose**: Centralized audio playback infrastructure used by all playback modes.

**Features**:
- ✅ Unified audio element management
- ✅ Real-time playback settings (speed, preservesPitch)
- ✅ Safari compatibility via SafariAdapter
- ✅ Lifecycle management (play, pause, resume, stop, dispose)
- ✅ Event handling (onCanPlay, onEnded, onError)

**Usage**:
```typescript
const audioEngine = new AudioEngine(new SafariAdapter())

// Update settings in real-time (applies immediately to playing audio)
audioEngine.updateSettings({ speed: 1.5, preservesPitch: true })

// Play audio with callbacks
await audioEngine.play(url, {
  onCanPlay: () => console.log('Audio ready'),
  onEnded: () => console.log('Audio finished'),
  onError: (err) => console.error('Playback error', err)
})
```

**Used By**:
- `useAudioPlayer` (live playback mode)
- `useBufferedPlayback` (buffered playback mode)

### SafariAdapter (Phase 2)

**File**: `src/core/SafariAdapter.ts`

**Purpose**: Safari-specific compatibility layer.

**Features**:
- Browser detection (Safari vs others)
- Audio element priming for autoplay bypass
- Graceful no-op for non-Safari browsers

**Integration**: AudioEngine uses SafariAdapter internally, components don't interact with it directly.

## State Management Patterns (✨ Refactored 2025-02-09)

### Zustand Store (Phase 3)

**File**: `src/state/readerStore.ts`

**Philosophy**: Single source of truth with modular state slices. Replaces scattered useState hooks with centralized store.

**Architecture**:
```typescript
interface ReaderStore {
  // State slices (9 total)
  ttsSettings: TtsSettings           // Voice, speed, pitch, language
  playbackSettings: PlaybackSettings // Client-side speed, preservesPitch
  textState: TextState               // Input text, paragraphs, AO3 metadata
  sessionState: SessionState         // Current session, offline flag
  batchGeneration: BatchGenerationState // Pre-generated audio URLs
  modalState: ModalState             // UI modal visibility
  resumeState: ResumeState           // Resume prompts
  importExportState: ImportExportState // Import/export UI state
  smartSplitState: SmartSplitState   // Smart splitting preferences

  // Actions (consolidated)
  resetAll: () => void               // Atomic reset (orthogonality)
  // ... slice-specific actions
}
```

**Features**:
- ✅ Redux DevTools integration for state inspection
- ✅ localStorage persistence for playback settings
- ✅ Atomic state resets (no partial resets)
- ✅ Type-safe selectors

**Usage**:
```typescript
// Direct store access
const selectedVoice = useReaderStore(state => state.ttsSettings.selectedVoice)
const updateVoice = useReaderStore(state => state.updateVoice)

// Via hook wrapper (preferred - maintains API compatibility)
const { selectedVoice, updateVoice } = useTtsSettings()
```

### XState Playback Machine (Phase 4)

**File**: `src/state/playbackMachine.ts`

**Purpose**: Explicit state transitions for audio playback. Eliminates race conditions by making invalid states impossible.

**States**:
```
idle → loading → ready → playing → paused → (error)
                    ↓
                  idle (on STOP/NEW_BOOK)
```

**Benefits**:
- ✅ Can't play without loading first (eliminates race conditions)
- ✅ Explicit state transitions (no boolean flag confusion)
- ✅ Type-safe events
- ✅ Visualizable with XState Inspector
- ✅ Auto-progression handled by state machine

**Integration**:
```typescript
// Used by useAudioPlayer via usePlaybackMachine wrapper
const { state, send, isPlaying, currentParagraph } = usePlaybackMachine({
  paragraphs,
  voice,
  speed,
  // ...
})

// State machine coordinates with AudioEngine
if (state.matches('ready')) {
  audioEngine.play(audioUrl, {
    onEnded: () => send({ type: 'AUDIO_ENDED' })
  })
}
```

### Hook Wrappers Pattern

**Philosophy**: Thin wrappers around Zustand store. Maintains backward compatibility while benefiting from centralized state.

**Examples**:

All hooks in `src/hooks/` now follow this pattern:
- **useTtsSettings**: Wraps `readerStore.ttsSettings` slice
- **usePlaybackSettings**: Wraps `readerStore.playbackSettings` slice
- **useSessionManager**: Wraps `readerStore.sessionState` slice
- **useModalState**: Wraps `readerStore.modalState` slice
- **useTextProcessor**: Wraps `readerStore.textState` slice
- **useBatchGeneration**: Wraps `readerStore.batchGeneration` slice

**Benefits**:
- ✅ Maintains existing component API (no migration needed)
- ✅ Centralized state inspection via Redux DevTools
- ✅ Easy to refactor further if needed

### React Context (API State)

**File**: `src/contexts/ApiStateContext.tsx`

- **Purpose**: Centralized API state management
- **Provides**: Connection status, voices, current settings
- **Actions**: `checkConnection()`, `initializeApi()`, `reloadConfig()`
- **Usage**: Wrap app with `<ApiStateProvider>`, consume with `useApiState()` hook

## Data Persistence (Three-Layer Architecture)

### Layer 1: Browser sessionStorage (Temporary Cache)
**Purpose**: Fast access to audio blobs during session

**Storage Format**: `audio_cache_{sessionId}_{audio_0}` → base64 encoded audio blob

**Characteristics**:
- Cleared on tab close (not persistent across browser restarts)
- Enables offline export without re-downloading from server
- ~5-10MB limit (browser dependent)

### Layer 2: Express Server File Database (Persistent)
**Purpose**: Long-term session storage with metadata

**Storage Location**: `data/sessions.json`

**Characteristics**:
- Survives server restarts (file-based)
- Does NOT store audio blobs (only references)
- Requires AllTalk server for audio playback

**Express Routes** (`server.js`):
- `GET /api/sessions` - List all
- `GET /api/sessions/:id` - Get one
- `POST /api/sessions` - Create/update
- `DELETE /api/sessions/:id` - Delete

### Layer 3: Exported JSON Files (Portable Offline)
**Purpose**: Self-contained audiobooks for offline/portable use

**Characteristics**:
- Completely self-contained (no server dependency)
- Audio embedded as base64 in `audioBlobData` field
- Can be imported on any AllTalk Reader instance
- Portable between devices/users
- Larger file size (base64 encoding overhead)

## Key Components

### Main Reader Route
**File**: `src/routes/reader.tsx`

**Responsibilities**:
- Orchestrates all state via 10 custom hooks
- Routes user actions to appropriate handlers
- Manages modal visibility
- Passes callbacks to child components
- Renders conditional views (input vs reader)
- Shows AO3 parsing feedback when detected

### Other Key Components
- **BatchGenerator**: UI for batch audio generation with progress tracking
- **ExportImportManager**: Export/import UI for offline sessions
- **SessionList**: Display saved sessions with metadata and delete functionality
- **ParagraphList**: Render paragraphs with click-to-play and visual indicators
- **SettingsMonitor**: Connection status and API configuration editing
- **ServerConfigModal**: Edit server host/port configuration
- **buffer/BufferPlayButton**: Start buffered playback mode
- **buffer/BufferStatusIndicator**: Shows buffer progress and status
- **buffer/BufferSettings**: Configure buffer parameters

## Browser Compatibility

### Safari/iOS Audio Constraints (✨ Centralized in Phase 2)

**Files**: `src/core/AudioEngine.ts`, `src/core/SafariAdapter.ts`

**Problem**: Safari has strict autoplay policies and resource management for Audio elements

**Solution**: Centralized Safari handling via SafariAdapter + AudioEngine

**Implementation**:
```typescript
// SafariAdapter.ts
export class SafariAdapter {
  private isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  async prime(audio: HTMLAudioElement): Promise<void> {
    if (!this.isSafari) return // No-op for non-Safari

    // Prime audio element for autoplay
    audio.load()
    // ... Safari-specific priming logic
  }
}

// AudioEngine.ts
export class AudioEngine {
  constructor(private safariAdapter: SafariAdapter) {
    this.audio = new Audio() // Single audio element (Safari optimization)
  }

  async play(url: string, callbacks: AudioCallbacks) {
    this.audio.src = url
    await this.safariAdapter.prime(this.audio) // Safari priming
    await this.audio.play()
  }
}
```

**Benefits**:
- ✅ Safari compatibility centralized (not duplicated across hooks)
- ✅ Single Audio element reused (Safari optimization)
- ✅ Automatic Safari detection
- ✅ Graceful no-op for non-Safari browsers
- ✅ Easy to update Safari logic in one place
