# Critical Code Paths

These are the core mechanisms that you must understand to work effectively with this codebase.

## 1. Auto-Progression Logic

**File**: `src/hooks/useAudioPlayer.ts` (lines 55-97)

**This is the core mechanism that enables continuous audiobook playback.**

### Implementation

```typescript
// 1. Audio ends, triggers this callback
audio.onended = () => handleAutoProgression(currentIndex)

// 2. Auto-progression function
const handleAutoProgression = (index: number) => {
  // Set 15s timeout guard to prevent infinite waiting
  const timeoutId = setTimeout(() => {
    console.error("Auto-progression timeout")
    // Prompt user to manually click next
  }, 15000)

  // Calculate next index
  const nextIndex = index + 1

  if (nextIndex < paragraphs.length) {
    // Recursively play next paragraph
    handlePlayParagraph(nextIndex)
      .then(() => clearTimeout(timeoutId)) // Clear guard on success
      .catch((error) => {
        clearTimeout(timeoutId)
        // Handle error gracefully
      })
  } else {
    // Reached end of audiobook
    clearTimeout(timeoutId)
    setIsPlaying(false)
  }
}
```

### Key Design Decisions

- **Timeout Guard**: Prevents infinite waiting if audio fails to load
- **Recursive Calls**: Enables continuous playback without loops
- **Error Recovery**: Graceful degradation prompts user action
- **State Management**: Updates `currentIndex` and `isPlaying` automatically

## 2. Text-to-Audio Mapping (Text Splitting Algorithm)

**File**: `src/services/api/tts.ts` (lines 119-189)

**This algorithm ensures text is intelligently split at natural boundaries.**

### splitTextIntoChunks() Algorithm

```typescript
const splitTextIntoChunks = (text: string, maxLength: number): string[] => {
  if (text.length <= maxLength) return [text]

  // Define punctuation priorities (period > semicolon > comma > space)
  const punctuationMarks = ['. ', '; ', ', ', ' ']

  // Search in latter 80% of maxLength for natural break
  const searchStartIndex = Math.floor(maxLength * 0.2)

  for (const mark of punctuationMarks) {
    // Search backwards from maxLength to searchStartIndex
    const lastIndex = text.lastIndexOf(mark, maxLength)

    if (lastIndex > searchStartIndex) {
      // Found natural break point
      const chunk = text.substring(0, lastIndex + mark.length).trim()
      const remaining = text.substring(lastIndex + mark.length).trim()

      // Recursively split remaining text
      return [chunk, ...splitTextIntoChunks(remaining, maxLength)]
    }
  }

  // No punctuation found - hard break at maxLength
  const chunk = text.substring(0, maxLength).trim()
  const remaining = text.substring(maxLength).trim()

  return [chunk, ...splitTextIntoChunks(remaining, maxLength)]
}
```

### Design Rationale

- **Readability First**: Prefers sentence boundaries over arbitrary breaks
- **Punctuation Hierarchy**: Period > semicolon > comma > space (natural reading pauses)
- **Latter Half Search**: Avoids tiny trailing chunks by searching in the last 80% of allowed space
- **Recursive**: Handles arbitrarily long text
- **Fallback**: Hard break if no punctuation (rare edge case)

### Example

```
Input (5000 chars): "This is sentence one. This is sentence two with lots of words that makes it very long and exceeds the 4096 character limit by quite a bit. This is sentence three..."

Process:
1. Text > 4096 → needs splitting
2. Search for '. ' in latter 80% (from char 819 to 4096)
3. Found '. ' at position 3850
4. Split:
   - chunk1: "This is sentence one. This is sentence two... up to period at 3850"
   - remaining: "This is sentence three..."
5. Recursively check remaining (< 4096, done)
6. Return: [chunk1, remaining]
```

## 3. Offline Audio Conversion

**File**: `src/services/sessionStorage.ts` (lines 380-403)

**This function enables offline playback by converting base64 to playable blob URLs.**

### Implementation

```typescript
const getOfflineAudioUrl = (base64String: string): string => {
  try {
    // 1. Decode base64 string to binary
    const binaryString = atob(base64String)

    // 2. Convert binary string to byte array
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 3. Create Blob with correct MIME type
    const blob = new Blob([bytes], { type: 'audio/wav' })

    // 4. Generate browser-playable object URL
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('Failed to create offline audio URL:', error)
    throw error
  }
}
```

### Why This Works

- **atob()**: Browser API for base64 decoding
- **Uint8Array**: Efficient binary data representation
- **Blob**: Browser-native file-like object
- **createObjectURL()**: Creates temporary URL valid for current session
- **MIME Type**: `audio/wav` ensures browser treats it as audio

### Memory Management Note

- Object URLs should be revoked with `URL.revokeObjectURL()` when done
- Currently not implemented (potential memory leak for long sessions)
- Consider adding cleanup on component unmount or session change

## 4. Text Processing Pipeline with AO3 Detection

**Files**: `src/routes/reader.tsx`, `src/hooks/useTextProcessor.ts`, `src/services/textProcessing/*`

### Complete Flow

```
User pastes text into textarea (reader.tsx)
  ↓
User clicks "Process Text" button
  ↓
handleProcessText() (reader.tsx)
  ↓
useTextProcessor.processText() (useTextProcessor.ts)
  ↓
textProcessor.processInput(text) (textProcessor.ts)
  ↓
AO3 Detection:
  ↓
ao3Parser.isAo3Page(text) (ao3Parser.ts)
  - Match against detectionPatterns from ao3Config.ts
  - Requires 2+ pattern matches to be considered AO3
  ↓
If AO3 detected:
  ↓
  ao3Parser.parse(text) (ao3Parser.ts)
    ↓
  State Machine Processing:
    - state = 'seeking' → look for chapter title or Summary
    - state = 'in_summary' → collect summary content
    - state = 'in_notes' → collect notes content
    - state = 'in_chapter' → collect chapter text
    - End on 'Actions' marker
    ↓
  Return: Ao3ParseResult {
    isAo3: true,
    success: true,
    text: extractedContent,
    metadata: { chapterTitle, hasSummary, hasNotes }
  }
  ↓
textProcessor.splitIntoParagraphs(processedText)
  ↓
Splits by double newlines (\n\n)
  ↓
For each paragraph:
  - If ≤ 4096 chars → keep as-is
  - If > 4096 chars → call splitTextIntoChunks(text, 4096)
  ↓
Returns array of manageable paragraphs
  ↓
State Updates:
  - useTextProcessor stores paragraphs
  - wasAo3Parsed flag set if AO3 detected
  - ao3Metadata available (chapterTitle, etc.)
  ↓
UI Update:
  - Reader switches to paragraph view
  - If AO3 detected: Shows green notification with chapter title
```

### AO3 Config Structure

The parser behavior is controlled by `ao3Config.ts`:

```typescript
// Detection patterns - need 2+ matches
detectionPatterns: [
  /Chapter \d+ of \d+/i,    // "Chapter 1 of 10"
  /Kudos:/i,                 // AO3 kudos section
  /Bookmarks:/i,             // AO3 bookmarks
  ...
]

// Content section markers
includeStartMarkers: {
  chapterTitle: /^Chapter\s+\d+(?::\s*.+)?$/im,
  summary: 'Summary:',
  notes: 'Notes:',
  chapterText: 'Chapter Text',
}

// End marker
endMarkers: { actions: 'Actions' }

// Lines to exclude
excludePatterns: [
  /^Share$/,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // Dates
  ...
]
```

## 5. State Flow: Changing Voice

Understanding how state propagates through hooks is critical for maintaining the application.

### Example: Voice Change Flow

```
User selects new voice from dropdown (reader.tsx:297)
  ↓
handleVoiceChange(newVoice) (reader.tsx:133)
  ↓
useTtsSettings.updateVoice(newVoice, resetPreGenerated) (line 134)
  ↓
Sets selectedVoice state in useTtsSettings
  ↓
Calls resetPreGenerated callback (line 135)
  ↓
useBatchGeneration.resetPreGenerated() (useBatchGeneration.ts:12)
  ↓
Clears audioUrls array, sets isPreGenerated = false
  ↓
useAudioPlayer.reset() (reader.tsx:136)
  ↓
Stops playback, clears audio element, resets currentIndex
  ↓
User must re-generate audio with new voice
```

### Why This Matters

- Voice changes invalidate pre-generated audio
- System ensures user doesn't play audio generated with old voice
- Forces regeneration to maintain consistency
- Similar patterns used for speed/pitch changes

## 6. Safari Compatibility Pattern

**File**: `src/hooks/useAudioPlayer.ts` (lines 38-52, 161-171)

### Problem

Safari has strict autoplay policies and resource management for Audio elements. Creating new Audio elements for each paragraph can trigger autoplay blocking.

### Detection

```typescript
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
```

### Solution

**Non-Safari (Standard Pattern)**:
```typescript
// Create new Audio element for each paragraph
const audio = new Audio(audioUrl)
audio.play()
```

**Safari (Optimized Pattern)**:
```typescript
// Create Audio element once on mount
const [safariAudioRef] = useState(() => new Audio())

// Reuse same element, update src
safariAudioRef.src = audioUrl
safariAudioRef.load()
safariAudioRef.play()
```

### Benefits

- Bypasses Safari autoplay restrictions
- Better resource management (no element cleanup needed)
- Consistent playback behavior across browsers
- Single Audio element means single user interaction approval

## 7. Buffered Playback Logic

**Files**: `src/hooks/useBufferedPlayback.ts`, `src/services/generation/controller.ts`

**This enables seamless playback by generating audio ahead of current position.**

### Implementation

```typescript
// Hook manages playback state and coordinates with controller
const useBufferedPlayback = (paragraphs, settings) => {
  const [bufferState, setBufferState] = useState<BufferState>({
    generatedIndices: new Set(),
    currentIndex: 0,
    isGenerating: false,
    audioUrls: {},
  })

  // Controller handles generation logic
  const controller = useMemo(() => new GenerationController(...), [])

  const startBufferedPlayback = async (startIndex = 0) => {
    // 1. Start generating from startIndex
    controller.start(startIndex)

    // 2. Wait for minimum buffer to be ready
    await waitForMinBuffer()

    // 3. Start playback
    playBuffered(startIndex)
  }

  const playBuffered = (index) => {
    // Get pre-generated audio URL
    const url = bufferState.audioUrls[index]

    // Play audio
    audioRef.current.src = url
    audioRef.current.play()

    // On ended, play next
    audioRef.current.onended = () => {
      if (index + 1 < paragraphs.length) {
        playBuffered(index + 1)
      }
    }
  }
}
```

### Key Design Decisions

- **Ref-based Callbacks**: Uses `handleAudioEndedRef` to avoid stale closures
- **GenerationController**: Separate class manages generation queue
- **Buffer Size Config**: Target and minimum buffer sizes are configurable
- **Integration**: Calls `resetAudio()` from useAudioPlayer when buffer mode starts

### Flow Diagram

```
User clicks buffer play
  ↓
useBufferedPlayback.startBufferedPlayback(0)
  ↓
GenerationController.start()
  ↓
Generate paragraphs 0, 1, 2... (up to target buffer)
  ↓
Wait for minBuffer paragraphs ready
  ↓
Start playing paragraph 0
  ↓
Audio ends → handleAudioEndedRef.current()
  ↓
Play next buffered paragraph
  ↓
Controller continues generating ahead
  ↓
Repeat until all paragraphs complete
```

## 8. Error Handling Patterns

### Connection Errors

**File**: `src/components/SettingsMonitor.tsx`

- **Periodic Health Checks**: Every 30 seconds
- **Visual Feedback**: Status badge changes color
- **Graceful Degradation**: Disable features when offline
- **User Control**: Manual configuration editing via ServerConfigModal

### Audio Playback Errors

**File**: `src/hooks/useAudioPlayer.ts`

- **Autoplay Blocking**: Detect browser autoplay policy violations
- **Network Failures**: Timeout guards and retry logic
- **Missing Audio**: Graceful fallback for offline sessions
- **Auto-Progression Timeout**: 15-second guard to prevent infinite waiting

### Session Validation

**File**: `src/services/sessionStorage.ts`

**Import Validation**:

1. Check required fields: id, name, text, paragraphs, settings
2. Validate audio data: must have either `audioUrls` OR `audioBlobData`
3. Count matching: paragraphs.length === audioUrls.length
4. Settings structure: voice, speed, pitch, language

**Error Messages**:
- "Session must have id, name, text, paragraphs, and settings"
- "Session must have audioUrls or audioBlobData"
- "Number of paragraphs does not match number of audio files"

## 9. Active Migrations (Important Context)

### Global State → React Context

**Status**: In Progress

**Old Pattern** (deprecated):
```typescript
// src/services/alltalkApi.ts
export const LEGACY_SERVER_STATUS = {
  isConnected: false,
  voices: [],
  // ... global state
}
```

**New Pattern**:
```typescript
// src/contexts/ApiStateContext.tsx
<ApiStateProvider>
  <App />
</ApiStateProvider>

// In components
const { isConnected, voices } = useApiState()
```

**Migration Guide**:
- Replace `LEGACY_SERVER_STATUS` imports with `useApiState()` hook
- Remove direct state mutations
- Use context actions: `checkConnection()`, `initializeApi()`

### Monolithic API Service → Modular Services

**Status**: Partial

**Deprecated**: `src/services/alltalkApi.ts` (all functions have `@deprecated` JSDoc)

**Preferred**: `src/services/api/*` modular services
- `client.ts`: HTTP client
- `status.ts`: Health checks
- `voices.ts`: Voice management
- `tts.ts`: TTS generation & text splitting

**Migration Priority**:
1. Replace `generateTTS()` calls → use `tts.generateTTS()`
2. Replace `getAvailableVoices()` → use `voices.getAvailableVoices()`
3. Replace `checkReady()` → use `status.checkReady()`

### SSR/React Query Removal (Completed)

**Status**: Complete

**Problem**: ReadableStream serialization errors on page refresh caused by `routerWithQueryClient` trying to dehydrate data during SSR.

**Resolution**:
- Removed React Query integration (app doesn't use queries)
- Changed from `createRootRouteWithContext<{ queryClient: QueryClient }>()` to `createRootRoute()`
- Removed `routerWithQueryClient` wrapper
- Added `ssr: false` to reader route as safeguard

**Files Changed**:
- `src/router.tsx` - Removed React Query wrapper
- `src/routes/__root.tsx` - Simplified root route
- `src/routes/reader.tsx` - Added `ssr: false`

### Text Processing Centralization (Completed)

**Status**: Complete

**Change**: Text processing logic moved to dedicated service.

**New Structure**: `src/services/textProcessing/`
- `textProcessor.ts` - Main entry point
- `ao3Parser.ts` - AO3 page detection and parsing
- `ao3Config.ts` - Configurable markers (update when AO3 changes)

**Hook Integration**: `useTextProcessor.ts` now uses `textProcessor.processInput()` which auto-detects and parses AO3 content.
