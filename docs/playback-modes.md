# Playback Modes

The application supports three distinct playback modes, each with different characteristics and use cases.

## Mode 1: Live Generation (Default)

**User Flow**: User clicks play → on-demand TTS → immediate playback → auto-progress to next paragraph

### Implementation Details

- **Hook**: `src/hooks/useAudioPlayer.ts` (lines 100-260)
- **Key Method**: `handlePlayParagraph(index)` at line 100

### Process Flow

1. User clicks play button or clicks a paragraph
2. Calls `generateTTS(text, settings)` from AllTalk API (line 141)
3. Receives `{output_file_url, status}` response
4. Creates HTML5 Audio element with returned URL (line 156)
5. On `canplaythrough` event → `audio.play()` (line 175)
6. On `ended` event → `handleAutoProgression(index)` (line 210)
7. Recursively calls `handlePlayParagraph(nextIndex)` (line 79)

### Key Features

- **Safari Compatibility**: Reuses single Audio object instead of creating new ones (lines 38-52, 161-171) to avoid autoplay restrictions
- **No Persistence**: Audio URLs are temporary, sessions are not saved
- **Auto-Progression**: 15-second timeout guard (line 70) to prevent infinite waiting
- **Error Handling**: Network failures, autoplay blocking, missing audio (lines 196-254)

### Files
- `src/hooks/useAudioPlayer.ts:100-260`
- `src/services/api/tts.ts:23-117` (generateTTS)

### Flow Diagram
```
User clicks paragraph
  ↓
useAudioPlayer.handlePlayParagraph(index)  [useAudioPlayer.ts:100]
  ↓
generateTTS(text, {voice, speed, pitch, language})  [tts.ts:23]
  ↓
POST /api/tts-generate (AllTalk API)
  ↓
Response: {output_file_url: "outputs/audio_123.wav", status: "generate-success"}
  ↓
Construct fullAudioUrl = baseUrl + output_file_url  [useAudioPlayer.ts:151]
  ↓
Create Audio element with fullAudioUrl  [line 156 or 167 for Safari]
  ↓
Audio.oncanplaythrough → audio.play()  [line 175]
  ↓
Audio.onended → handleAutoProgression(index)  [line 210]
  ↓
setTimeout 15s guard + handlePlayParagraph(index + 1)  [line 79]
  ↓
Repeat for next paragraph...
```

## Mode 2: Pre-Generation (Cached Playback)

**User Flow**: User clicks "Pre-Generate All Audio" → batch generation with progress UI → auto-save session → instant playback

### Implementation Details

- **Component**: `src/components/BatchGenerator.tsx`
- **Hook**: `src/hooks/useBatchAudioGeneration.ts`

### Process Flow

1. User clicks "Pre-Generate All Audio" button (`reader.tsx:373`)
2. `BatchGenerator` modal opens with progress UI
3. `useBatchAudioGeneration` generates audio sequentially for all paragraphs:
   - Calls `generateTTS()` for each paragraph (line 43)
   - Stores URL in `audioUrls` array (line 53)
   - Fetches audio blob from URL (lines 74-82)
   - Caches blob to browser sessionStorage (line 78)
   - Updates progress state (line 60)
4. On completion:
   - Calls `useSessionSaver.saveAudioSession()` (BatchGenerator.tsx:40)
   - Auto-saves to Express server → `data/sessions.json`
   - Caches blobs via `cacheAudioBlobsForSession()` (sessionStorage.ts:468)
   - Sets `isPreGenerated = true` (useBatchGeneration.ts:17)
5. User can now play any paragraph instantly without generation delays

### Storage Layers

1. **Browser sessionStorage**: Audio blobs as base64 (temporary, cleared on tab close)
   - Key format: `audio_cache_{sessionId}_{audio_0}`
   - Enables offline export capability
2. **Express Server**: Session metadata + audio URLs (persistent)
   - File: `data/sessions.json`
   - No audio blobs stored (references only)

### Files
- `src/components/BatchGenerator.tsx`
- `src/hooks/useBatchAudioGeneration.ts`
- `src/hooks/useSessionSaver.ts`
- `src/services/sessionStorage.ts:118-148` (saveSession)
- `src/services/sessionStorage.ts:468-503` (cacheAudioBlobsForSession)

### Flow Diagram
```
User clicks "Pre-Generate All Audio"  [reader.tsx:373]
  ↓
BatchGenerator modal opens  [reader.tsx:412]
  ↓
useBatchAudioGeneration.startGeneration()  [useBatchAudioGeneration.ts:19]
  ↓
For each paragraph (sequential):
  1. generateTTS(paragraph, settings)  [line 43]
  2. Receive audio URL from AllTalk
  3. Fetch audio blob from URL  [lines 74-82]
  4. Store URL in audioUrls array  [line 53]
  5. Cache blob to sessionStorage  [line 78]
  6. Update progress UI  [line 60]
  ↓
On completion (all paragraphs done):
  1. useSessionSaver.saveAudioSession()  [BatchGenerator.tsx:40]
  2. Create session object with metadata  [useSessionSaver.ts:46]
  3. POST to Express server /api/sessions  [sessionStorage.ts:123]
  4. Server writes to data/sessions.json  [server.js:93]
  5. cacheAudioBlobsForSession()  [useSessionSaver.ts:65]
  6. Stores blobs in sessionStorage  [sessionStorage.ts:468]
  7. Set isPreGenerated = true  [useBatchGeneration.ts:17]
  8. Close modal  [BatchGenerator.tsx:42]
```

## Mode 3: Offline Mode (Export/Import)

**User Flow**: Export pre-generated session → download JSON with embedded audio → import later (no server needed)

### Export Implementation

**File**: `src/components/ExportImportManager.tsx:25-76`

1. User clicks "Export Session" (must be pre-generated first)
2. System checks for cached audio blobs in sessionStorage (line 42)
3. **Two export paths**:
   - **Cached blobs available**: Uses `prepareSessionForExportFromCache()` (line 49)
     - Works **completely offline** (no network requests)
     - Retrieves blobs from sessionStorage
   - **No cache**: Uses `prepareSessionForExport()` (line 52)
     - Downloads audio files from AllTalk server URLs
     - Requires network connection
4. Converts audio blobs to base64 (sessionStorage.ts:278)
5. Creates session object with `audioBlobData` field (base64 strings)
6. Downloads as JSON file via `downloadSessionAsFile()` (line 56)

### Import Implementation

**File**: `src/components/ExportImportManager.tsx:79-100`

1. User clicks "Import Session" → file input dialog opens
2. User selects exported JSON file
3. `handleImport()` reads file (line 84)
4. Calls `importSessionFromFile(fileContent)` (sessionStorage.ts:335)
5. Validation (lines 348-365):
   - Required fields: id, name, text, paragraphs, settings
   - Audio data: must have either `audioUrls` OR `audioBlobData`
   - Paragraph count must match audio count
6. Sets `isOfflineSession: true` flag (line 358)
7. Loads session into reader (line 93)
8. Session ready for offline playback (no server needed)

### Offline Playback

**File**: `src/hooks/useAudioPlayer.ts:130-136`

When playing paragraph from offline session:

1. `handlePlayParagraph()` detects `currentSession.isOfflineSession === true`
2. Calls `getAudioUrlForPlayback(currentSession, index)` (sessionStorage.ts:632)
3. Priority logic (lines 637-663):
   - **First**: Check `audioBlobData[audio_${index}]` (offline base64 data)
   - **Second**: Check cached sessionStorage blobs
   - **Third**: Fallback to original URL (requires server)
4. If offline data exists:
   - Calls `getOfflineAudioUrl(base64String)` (line 380)
   - Decodes base64 → Uint8Array (lines 388-393)
   - Creates Blob with `audio/wav` MIME type (line 395)
   - Returns `URL.createObjectURL(blob)` (line 396)
5. Audio element plays from blob URL (no network request)

### Files
- `src/components/ExportImportManager.tsx:25-100`
- `src/services/sessionStorage.ts:237-403` (export/import logic)
- `src/services/sessionStorage.ts:632-663` (getAudioUrlForPlayback)
- `src/hooks/useAudioPlayer.ts:130-136` (offline detection)

### Exported Session Structure

```json
{
  "id": "uuid-123",
  "name": "Session Name - 2025-01-06",
  "createdAt": 1736172000000,
  "updatedAt": 1736172000000,
  "text": "Full text content...",
  "paragraphs": ["Paragraph 1", "Paragraph 2"],
  "audioUrls": ["outputs/audio_1.wav", "outputs/audio_2.wav"],
  "audioBlobData": {
    "audio_0": "base64EncodedAudioData...",
    "audio_1": "base64EncodedAudioData..."
  },
  "settings": {
    "voice": "female_01.wav",
    "speed": 1.0,
    "pitch": 0,
    "language": "en"
  },
  "isOfflineSession": true
}
```

## Mode Transitions & Detection

- **Live → Pre-Generation**: Click "Pre-Generate All Audio" button
- **Pre-Generation → Offline**: Click "Export/Import" → "Export Session"
- **Import Offline**: Click "Export/Import" → "Import Session" → select JSON file

### Mode Detection Logic
- `isPreGenerated` flag: Indicates batch generation completed (useBatchGeneration.ts)
- `currentSession.isOfflineSession` flag: Indicates imported offline session
- `hasLocalAudio`: Indicates cached blobs in sessionStorage

## Session Management

### Loading Saved Sessions

**Files**: `src/components/SessionManager.tsx`, `src/components/SessionList.tsx`, `src/hooks/useSessionManager.ts`

1. User clicks "Saved Sessions" button → `SessionManager` modal opens
2. `SessionList` fetches all sessions via `getAllSessions()` (SessionList.tsx:20)
3. Displays list with metadata: paragraph count, voice, creation date
4. User selects session → calls `useSessionManager.loadSession(session)` (line 19)
5. Detects offline mode via `isOfflineSession` flag (line 25)
6. Returns session data to reader (line 33)
7. Reader loads:
   - Full text (reader.tsx:87)
   - Paragraphs array (line 88)
   - TTS settings (voice, speed, pitch, language) (lines 89-92)
   - Pre-generated audio URLs (line 93)
   - Sets isPreGenerated flag (line 94)
8. Audio player ready for instant playback (uses cached or offline audio)

### Deleting Sessions

1. User clicks delete icon in `SessionList` (SessionList.tsx:42)
2. Confirmation prompt (line 43)
3. Calls `deleteSession(sessionId)` (line 47)
4. DELETE request to Express server (sessionStorage.ts:149)
5. Server removes from `data/sessions.json` (server.js:114)
6. UI refreshes session list (SessionList.tsx:48)
