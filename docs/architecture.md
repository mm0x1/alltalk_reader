# Architecture

## Tech Stack

- **Frontend**: React 19 with TanStack Router and React Query v5
- **Build Tool**: Vite with TypeScript (strict mode)
- **Styling**: Tailwind CSS with dark theme (design tokens in `src/design-system/constants.ts`)
- **Backend**: Express.js session storage server (50MB JSON limit for embedded audio)
- **External API**: AllTalk TTS server integration (REST API)

## Project Structure

```
src/
├── services/              # API and storage services
│   ├── api/              # Modular AllTalk API services (new architecture)
│   │   ├── client.ts     # HTTP client with timeout & retry logic
│   │   ├── status.ts     # Server status checking (/api/ready, /api/currentsettings)
│   │   ├── voices.ts     # Voice management (/api/voices, /api/rvcvoices)
│   │   └── tts.ts        # TTS generation (/api/tts-generate) & text splitting logic
│   ├── alltalkApi.ts     # **DEPRECATED** - Legacy compatibility wrapper (use api/* instead)
│   └── sessionStorage.ts # Session CRUD, export/import, offline audio conversion
├── hooks/                # Custom React hooks (state management)
│   ├── useAudioPlayer.ts         # Playback control, auto-progression, Safari compatibility
│   ├── useBatchAudioGeneration.ts # Sequential batch generation logic
│   ├── useSessionSaver.ts        # Auto-save after batch generation
│   ├── useTextProcessor.ts       # Text input & paragraph splitting state
│   ├── useTtsSettings.ts         # Voice, speed, pitch, language settings
│   ├── useBatchGeneration.ts     # Pre-generated audio URLs & cache status
│   ├── useModalState.ts          # UI modal visibility
│   └── useSessionManager.ts      # Session loading & offline detection
├── components/           # UI components
│   ├── BatchGenerator.tsx        # Pre-generation UI orchestrator
│   ├── ExportImportManager.tsx   # Offline export/import UI
│   ├── SessionManager.tsx        # Session modal wrapper
│   ├── SessionList.tsx           # Session browser with delete
│   ├── ParagraphList.tsx         # Paragraph display with auto-scroll
│   ├── SettingsMonitor.tsx       # AllTalk connection status & config editor
│   └── [other UI components]
├── routes/               # TanStack Router routes
│   └── reader.tsx        # **MAIN ROUTE** - Orchestrates entire UI & state
├── contexts/             # React contexts
│   └── ApiStateContext.tsx       # **NEW** - Centralized API state (replacing global LEGACY_SERVER_STATUS)
├── config/               # Configuration management
│   └── env.ts            # Environment variable handling
└── design-system/        # Design tokens & constants
    └── constants.ts      # Tailwind tokens, API endpoints, status states
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

### Legacy API Service (Deprecated)

**File**: `src/services/alltalkApi.ts`

- **Status**: **ALL FUNCTIONS MARKED DEPRECATED** with JSDoc `@deprecated` tags
- **Purpose**: Backward compatibility wrapper during migration to new architecture
- **Migration**: Components should use `ApiStateContext` and `src/services/api/*` modules
- **When to Use**: Only for legacy code that hasn't been migrated yet

## State Management Patterns

### Custom Hooks Architecture

**Philosophy**: Co-located hooks with main route, each responsible for one domain of state. No global state (except legacy code).

**All hooks used by** `src/routes/reader.tsx`:

1. **useServerConnection**: Manages AllTalk API connection status
2. **useTextProcessor**: Handles text input and paragraph splitting
3. **useTtsSettings**: Manages TTS configuration (voice, speed, pitch, language)
4. **useBatchGeneration**: Tracks pre-generated audio URLs and cache status
5. **useModalState**: Controls UI modal visibility
6. **useSessionManager**: Handles session loading and offline detection
7. **useAudioPlayer**: **Most complex** - manages playback control, auto-progression, Safari compatibility

### React Context (New Architecture)

**File**: `src/contexts/ApiStateContext.tsx`

- **Purpose**: Centralized API state management (replacing global `LEGACY_SERVER_STATUS`)
- **Provides**: Connection status, voices, current settings
- **Actions**: `checkConnection()`, `initializeApi()`, `reloadConfig()`
- **Usage**: Wrap app with `<ApiStateProvider>`, consume with `useApiState()` hook
- **Migration Status**: Partial - new components should use this, old code still uses legacy

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
**File**: `src/routes/reader.tsx` (520 lines)

**Responsibilities**:
- Orchestrates all state via 7 custom hooks
- Routes user actions to appropriate handlers
- Manages modal visibility
- Passes callbacks to child components
- Renders conditional views (input vs reader)

### Other Key Components
- **BatchGenerator**: UI for batch audio generation with progress tracking
- **ExportImportManager**: Export/import UI for offline sessions
- **SessionList**: Display saved sessions with metadata and delete functionality
- **ParagraphList**: Render paragraphs with click-to-play and visual indicators
- **SettingsMonitor**: Connection status and API configuration editing

## Browser Compatibility

### Safari/iOS Audio Constraints

**File**: `src/hooks/useAudioPlayer.ts`

**Problem**: Safari has strict autoplay policies and resource management for Audio elements

**Solution**: Reuse single Audio object instead of creating new ones

**Implementation**:
- **Non-Safari**: Create new Audio element for each paragraph
- **Safari**: Create Audio element once, update `src` property for each paragraph

**Benefits**:
- Bypasses Safari autoplay restrictions
- Better resource management
- Consistent playback behavior across browsers
