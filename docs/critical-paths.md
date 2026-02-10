# Critical Code Paths

These are the core mechanisms that you must understand to work effectively with this codebase.

## 1. Auto-Progression Logic (✨ Refactored with State Machine - Phase 4)

**Files**: `src/state/playbackMachine.ts`, `src/hooks/useAudioPlayer.ts`

**This is the core mechanism that enables continuous audiobook playback.**

### Implementation (XState Machine)

```typescript
// State machine handles transitions
playing: {
  on: {
    AUDIO_ENDED: [
      {
        target: 'loading',
        guard: 'hasMoreParagraphs',  // Check if next paragraph exists
        actions: ['incrementParagraph']
      },
      {
        target: 'idle',  // No more paragraphs, playback complete
      }
    ]
  }
}
```

### Integration with AudioEngine

```typescript
// useAudioPlayer.ts - Syncs AudioEngine with state machine
useEffect(() => {
  if (state.matches('ready')) {
    audioEngine.play(audioUrl, {
      onEnded: () => {
        // Trigger state machine transition
        send({ type: 'AUDIO_ENDED' })
      }
    }).then((success) => {
      if (success) {
        // Transition to playing state
        send({ type: 'PLAY' })
      }
    })
  }
}, [state, audioUrl])
```

### Key Design Decisions

- **State Machine**: Invalid states impossible (can't be "playing" without loaded audio)
- **Explicit Transitions**: `loading → ready → playing → (AUDIO_ENDED) → loading (next paragraph)`
- **Guards**: Type-safe checks for "hasMoreParagraphs"
- **Actions**: Atomic state updates (increment paragraph, clear errors)
- **No Timeout Guards Needed**: State machine prevents infinite waiting by design
- **Race Condition Eliminated**: Audio can only end when in "playing" state

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

## 6. Safari Compatibility Pattern (✨ Centralized in AudioEngine - Phase 2)

**Files**: `src/core/AudioEngine.ts`, `src/core/SafariAdapter.ts`

### Problem

Safari has strict autoplay policies and resource management for Audio elements. Creating new Audio elements for each paragraph can trigger autoplay blocking.

### Solution (Centralized)

**AudioEngine with SafariAdapter**:
```typescript
// SafariAdapter.ts
export class SafariAdapter {
  private isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  async prime(audio: HTMLAudioElement): Promise<void> {
    if (!this.isSafari) return // No-op for non-Safari

    audio.load() // Prime for autoplay
    // Safari-specific priming logic
  }
}

// AudioEngine.ts
export class AudioEngine {
  private audio: HTMLAudioElement

  constructor(private safariAdapter: SafariAdapter) {
    this.audio = new Audio() // Single audio element (Safari optimization)
  }

  async play(url: string, callbacks: AudioCallbacks): Promise<boolean> {
    this.audio.src = url
    await this.safariAdapter.prime(this.audio) // Safari handling
    await this.audio.play()
    return true
  }
}

// Usage in hooks
const audioEngine = new AudioEngine(new SafariAdapter())
await audioEngine.play(url, { onEnded: () => {...} })
```

### Benefits

- ✅ Safari compatibility centralized (not duplicated)
- ✅ Single Audio element reused (Safari optimization)
- ✅ Automatic Safari detection
- ✅ Graceful no-op for non-Safari browsers
- ✅ Used by both `useAudioPlayer` and `useBufferedPlayback`
- ✅ Easy to update Safari logic in one place

## 7. Buffered Playback Logic (✨ Enhanced Phase 5)

**Files**: `src/hooks/useBufferedPlayback.ts`, `src/services/generation/controller.ts`, `src/core/AudioEngine.ts`

**This enables seamless playback by generating audio ahead of current position.**

### Implementation (with Phase 5 fixes)

```typescript
const useBufferedPlayback = (paragraphs, settings) => {
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const preloadedAudioRef = useRef<{ index: number; audio: HTMLAudioElement } | null>(null)
  const currentlyPlayingAudioRef = useRef<HTMLAudioElement | null>(null) // ✨ Phase 5

  // AudioEngine integration (Phase 2)
  if (!audioEngineRef.current) {
    audioEngineRef.current = new AudioEngine(new SafariAdapter())
  }

  // Real-time playback settings updates (Phase 5 fix)
  useEffect(() => {
    audioEngineRef.current?.updateSettings({ speed: playbackSpeed, preservesPitch })

    // Also update currently playing audio (for preloaded audio)
    if (currentlyPlayingAudioRef.current) {
      currentlyPlayingAudioRef.current.playbackRate = playbackSpeed
      currentlyPlayingAudioRef.current.preservesPitch = preservesPitch
    }
  }, [playbackSpeed, preservesPitch])

  // Pause/Resume (Phase 5 fix - only control active audio source)
  const pause = () => {
    if (currentlyPlayingAudioRef.current) {
      currentlyPlayingAudioRef.current.pause() // Preloaded audio
    } else {
      audioEngineRef.current?.pause() // AudioEngine
    }
  }

  const resume = () => {
    if (currentlyPlayingAudioRef.current) {
      currentlyPlayingAudioRef.current.play() // Preloaded audio
    } else {
      audioEngineRef.current?.resume() // AudioEngine
    }
  }
}
```

### Key Design Decisions (Updated)

- **currentlyPlayingAudioRef** (Phase 5): Tracks which audio system is active (AudioEngine vs preloaded)
- **Real-time Settings**: Playback speed changes apply immediately to playing audio
- **Dual Audio Prevention**: pause/resume only control the active audio source
- **Ref-based Callbacks**: Uses `handleAudioEndedRef` to avoid stale closures
- **AudioEngine Integration** (Phase 2): Uses centralized audio infrastructure
- **GenerationController**: Separate class manages generation queue
- **Buffer Size Config**: Target and minimum buffer sizes are configurable

### Critical Bugs Fixed (Phase 5)

1. **Dual Audio Playback**: Fixed by tracking `currentlyPlayingAudioRef` (only resume active source)
2. **Playback Speed Delayed**: Fixed by updating `currentlyPlayingAudioRef.playbackRate` in real-time

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
Start playing paragraph 0 (via AudioEngine)
  ↓
Preload paragraph 1 while playing
  ↓
Audio ends → handleAudioEndedRef.current()
  ↓
Play next buffered paragraph (via preloaded audio)
  ↓
Track as currentlyPlayingAudioRef ✨
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

## 9. Completed Refactoring (2025-02-09)

### Pragmatic Rewrite (All 5 Phases Complete)

All architectural migrations have been completed. See `docs/architecture-analysis.md` for full details.

**Major Changes**:

1. **Zustand State Management** (Phase 3)
   - ✅ Centralized state in `state/readerStore.ts`
   - ✅ Hooks are now thin wrappers around Zustand
   - ✅ Redux DevTools integration
   - ✅ localStorage persistence

2. **XState Playback Machine** (Phase 4)
   - ✅ Explicit state transitions (idle → loading → ready → playing)
   - ✅ Race conditions eliminated by design
   - ✅ Used by `useAudioPlayer` via `usePlaybackMachine`

3. **AudioEngine Extraction** (Phase 2)
   - ✅ Centralized audio in `core/AudioEngine.ts`
   - ✅ Safari compatibility in `core/SafariAdapter.ts`
   - ✅ Eliminated ~150 lines of duplicate code
   - ✅ Used by both `useAudioPlayer` and `useBufferedPlayback`

4. **Critical Bug Fixes** (Phases 1, 4, 5)
   - ✅ Stale audio after "New Book" (orthogonality violation fixed)
   - ✅ Single-paragraph stuck (race condition eliminated by state machine)
   - ✅ Dual audio playback (currentlyPlayingAudioRef tracking added)
   - ✅ Playback speed delayed (real-time updates implemented)
   - ✅ Auto-progression (state machine transition fixed)

**No Active Migrations**: All refactoring complete, codebase is production-ready.
