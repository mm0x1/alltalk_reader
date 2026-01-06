# Phase 3: Streaming Buffer Playback Mode

This phase implements a new playback mode that combines the best of live generation and pre-generation modes.

## Problem Statement

Current playback modes have trade-offs:

| Mode | Wait Time | Pauses | Pros | Cons |
|------|-----------|--------|------|------|
| Live | 0s | 5-10s between paragraphs | Instant start | Breaks immersion |
| Pre-Generate | 10+ minutes | None | Smooth playback | Long wait before listening |

**User Need**: Start listening quickly while maintaining smooth playback without pauses.

## Solution: Buffer Mode

A fourth playback mode that:
1. Generates a small buffer of paragraphs ahead (e.g., 3-5)
2. Starts playing as soon as the first paragraph is ready
3. Continues generating ahead while audio plays
4. Maintains buffer size throughout playback
5. Stops generation when user leaves page

### User Flow

```
1. User clicks "Buffer Play"
2. System generates paragraphs 0-4 (buffer = 5)
3. When paragraph 0 is ready (~5s), playback starts
4. While paragraph 0 plays, system generates paragraph 5
5. When paragraph 1 starts, system generates paragraph 6
6. Buffer always stays 4-5 paragraphs ahead
7. If generation catches up (buffer < 2), brief pause for buffer refill
```

## Technical Design

### State Machine

```
                    +---> [Buffering]
                    |         |
                    |         v
[Idle] --start--> [InitialBuffering] --buffer_ready--> [Playing]
                    |                                      |
                    |                                      v
                    +----------- pause/stop <---------- [Paused]

States:
- Idle: No generation, no playback
- InitialBuffering: Building initial buffer (show progress)
- Buffering: Buffer depleted, waiting for generation
- Playing: Audio playing, generation continues ahead
- Paused: Audio paused, generation paused
```

### Core Hook: `useBufferedPlayback`

```typescript
interface BufferedPlaybackState {
  status: 'idle' | 'initial-buffering' | 'buffering' | 'playing' | 'paused' | 'completed' | 'error';
  currentParagraph: number;
  bufferStatus: {
    generated: number[];      // Indices of generated paragraphs
    bufferSize: number;       // Current buffer ahead of playback
    targetBuffer: number;     // Target buffer size (configurable)
    isGenerating: boolean;    // Is generation in progress
    generatingIndex: number;  // Currently generating paragraph
  };
  error?: string;
}

interface BufferedPlaybackConfig {
  targetBufferSize: number;   // Default: 5
  minBufferSize: number;      // Default: 2 (pause if below)
  maxConcurrent: number;      // Default: 1 (AllTalk is sequential)
}

interface UseBufferedPlaybackReturn {
  state: BufferedPlaybackState;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipTo: (index: number) => void;
  updateConfig: (config: Partial<BufferedPlaybackConfig>) => void;
}
```

### Generation Controller

```typescript
class GenerationController {
  private abortController: AbortController | null = null;
  private generatedUrls: Map<number, string> = new Map();
  private pendingGeneration: number | null = null;

  // Start generating from a specific index
  async generateFrom(startIndex: number, onProgress: (index: number, url: string) => void): Promise<void>;

  // Pause generation (complete current, don't start new)
  pause(): void;

  // Resume generation
  resume(): void;

  // Stop and clean up
  stop(): void;

  // Check if paragraph is ready
  isReady(index: number): boolean;

  // Get URL for paragraph
  getUrl(index: number): string | null;
}
```

### Page Visibility Handling

**Critical Requirement**: Stop generation when user leaves page

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Pause generation when tab is hidden
      generationController.pause();
    } else {
      // Resume generation when tab is visible
      if (state.status === 'playing') {
        generationController.resume();
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [state.status]);

// Also handle beforeunload
useEffect(() => {
  const handleBeforeUnload = () => {
    generationController.stop();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, []);
```

### Buffer Replenishment Logic

```typescript
const replenishBuffer = async () => {
  const currentIndex = state.currentParagraph;
  const generated = state.bufferStatus.generated;
  const targetBuffer = config.targetBufferSize;

  // Find next paragraph to generate
  for (let i = currentIndex; i < currentIndex + targetBuffer + 1; i++) {
    if (i >= paragraphs.length) break;

    if (!generated.includes(i)) {
      // Generate this paragraph
      await generateParagraph(i);
      break; // One at a time (AllTalk limitation)
    }
  }

  // Check if buffer is sufficient
  const bufferAhead = generated.filter(i => i > currentIndex).length;
  if (bufferAhead < config.minBufferSize && currentIndex < paragraphs.length - 1) {
    // Buffer is low, pause playback briefly
    pauseForBuffering();
  }
};
```

## UI Components

### Buffer Mode Button

Add to playback controls:
```tsx
<button
  onClick={startBufferedPlayback}
  disabled={!isServerConnected || paragraphs.length === 0}
  className="btn-primary"
>
  <PlayIcon /> Buffer Play
</button>
```

### Buffer Status Indicator

New component showing:
- Current buffer size (visual bar)
- Paragraphs generated vs remaining
- Generation status (generating paragraph X)
- Estimated time until buffer full

```tsx
interface BufferStatusIndicatorProps {
  currentParagraph: number;
  totalParagraphs: number;
  generatedCount: number;
  bufferSize: number;
  targetBuffer: number;
  isGenerating: boolean;
}

function BufferStatusIndicator({
  currentParagraph,
  totalParagraphs,
  generatedCount,
  bufferSize,
  targetBuffer,
  isGenerating
}: BufferStatusIndicatorProps) {
  return (
    <div className="buffer-status">
      <div className="buffer-bar">
        <div className="buffer-fill" style={{ width: `${(bufferSize / targetBuffer) * 100}%` }} />
      </div>
      <div className="buffer-text">
        {isGenerating ? (
          <span>Buffering: {bufferSize}/{targetBuffer} ahead</span>
        ) : (
          <span>Buffer: {bufferSize} paragraphs ready</span>
        )}
      </div>
    </div>
  );
}
```

### Settings for Buffer Mode

Add to TTS settings:
```tsx
<div className="buffer-settings">
  <label>Buffer Size</label>
  <input
    type="range"
    min={2}
    max={10}
    value={bufferSize}
    onChange={(e) => setBufferSize(Number(e.target.value))}
  />
  <span>{bufferSize} paragraphs</span>
</div>
```

## Integration Points

### With Existing Modes

The buffer mode should coexist with existing modes:

| User Action | Result |
|-------------|--------|
| Click play (no pre-gen) | Use buffer mode |
| Click play (pre-gen complete) | Use pre-generated audio |
| Click "Pre-Generate All" | Use existing batch mode |
| Click "Buffer Play" | Explicitly use buffer mode |

### With Session Storage

- Generated audio should be cached to IndexedDB (from Phase 2)
- If user pauses and returns, cached audio is available
- Progress should be saved to session

### With Offline Mode

- Buffer mode requires server connection
- If connection lost, switch to cached audio only
- Show warning when buffer can't be replenished

## Implementation Steps

### Step 3.1: Create Core Hook

**File**: `src/hooks/useBufferedPlayback.ts`

**Tasks**:
1. Define state interface
2. Implement state machine
3. Add generation controller
4. Handle audio playback
5. Implement buffer replenishment
6. Add visibility handling

### Step 3.2: Create Generation Controller

**File**: `src/services/generation/controller.ts`

**Tasks**:
1. Implement AbortController pattern
2. Add URL caching
3. Handle generation queue
4. Add pause/resume capability
5. Integrate with IndexedDB storage

### Step 3.3: Create UI Components

**Files**:
- `src/components/buffer/BufferStatusIndicator.tsx`
- `src/components/buffer/BufferPlayButton.tsx`
- `src/components/buffer/BufferSettings.tsx`

### Step 3.4: Integrate with Reader

**File**: `src/routes/reader.tsx` (or `src/components/reader/ReaderView.tsx` after Phase 1)

**Tasks**:
1. Add buffer mode state
2. Connect buffer play button
3. Show buffer status indicator
4. Handle mode switching

### Step 3.5: Add Settings

**Tasks**:
1. Add buffer size preference
2. Persist to localStorage
3. Add to settings panel

## Edge Cases

### Handling Slow Generation

If generation is slower than playback:
1. Monitor buffer depletion rate
2. If buffer < minBuffer, pause playback
3. Show "Buffering..." indicator
4. Resume when buffer >= minBuffer

### Handling Skip Ahead

If user clicks ahead:
1. Pause playback
2. Clear generation queue
3. Generate new buffer starting from new position
4. Resume when initial buffer ready

### Handling Network Errors

If generation fails:
1. Retry with exponential backoff (3 attempts)
2. If still failing, pause and show error
3. Allow user to retry or continue with live mode

### Handling Page Unload

Before page closes:
1. Stop all generation
2. Cancel pending requests
3. Save progress to session
4. Clean up resources

## Testing Checklist

- [ ] Buffer mode starts and generates initial buffer
- [ ] Playback starts when first paragraph ready
- [ ] Buffer replenishes during playback
- [ ] Pause stops generation
- [ ] Resume continues generation
- [ ] Skip ahead generates new buffer
- [ ] Page hide pauses generation
- [ ] Page show resumes generation
- [ ] Page unload stops generation
- [ ] Network error handled gracefully
- [ ] Buffer depletion triggers pause
- [ ] Works on mobile browsers
- [ ] Integrates with existing modes

## Success Criteria

- [ ] Playback starts within 10 seconds (vs 10+ minutes for pre-gen)
- [ ] No pauses during normal playback (buffer maintained)
- [ ] Generation stops when page hidden/closed
- [ ] Smooth transition between paragraphs
- [ ] Clear UI feedback on buffer status
- [ ] Works reliably on mobile

## File Structure

```
src/hooks/
└── useBufferedPlayback.ts

src/services/generation/
├── index.ts
├── controller.ts
└── types.ts

src/components/buffer/
├── index.ts
├── BufferStatusIndicator.tsx
├── BufferPlayButton.tsx
└── BufferSettings.tsx
```

## Estimated Scope

- **New files**: 7-8
- **Modified files**: 3-5
- **Risk level**: Medium-High (new complex feature)
- **Dependencies**: Phase 2 (IndexedDB storage)
