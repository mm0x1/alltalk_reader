# Phase 6: Nice-to-Have Features

This phase covers optional features that would enhance the application but are not critical for core functionality.

## Features

### 6.1 Start AllTalk Server Button

**User Request**: Ability to start AllTalk server from the app UI.

**Implementation Considerations**:

This feature requires executing a shell script on the server, which raises several concerns:

1. **Security**: Running arbitrary scripts from a web UI is risky
2. **Architecture**: Requires backend execution capability
3. **State Management**: Need to track if server is starting/running

#### Option A: Express Server Proxy (Recommended if implemented)

Add an endpoint to the Express session server:

```javascript
// server.js
const { exec } = require('child_process');
const ALLTALK_START_SCRIPT = '/home/drifter/ai/alltalk_tts_v2/start_alltalk.sh';

app.post('/api/start-alltalk', (req, res) => {
  // Security: Only allow if configured
  if (!process.env.ALLOW_ALLTALK_START) {
    return res.status(403).json({ error: 'AllTalk start not allowed' });
  }

  exec(ALLTALK_START_SCRIPT, { detached: true }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: 'Failed to start AllTalk', details: error.message });
    }
    res.json({ success: true, message: 'AllTalk start initiated' });
  });
});
```

#### Option B: External Script + Polling

1. User clicks "Start AllTalk"
2. App shows instructions to run script manually
3. App polls `/api/ready` until server responds

#### Recommended: Option B (Safer)

```tsx
function StartAllTalkGuide({ onClose }) {
  const [isPolling, setIsPolling] = useState(false);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'connected'>('idle');

  const startPolling = async () => {
    setIsPolling(true);
    setStatus('waiting');

    const pollInterval = setInterval(async () => {
      const isReady = await checkServerReady();
      if (isReady) {
        clearInterval(pollInterval);
        setStatus('connected');
        setIsPolling(false);
      }
    }, 2000);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (status === 'waiting') {
        setIsPolling(false);
        setStatus('idle');
      }
    }, 120000);
  };

  return (
    <div className="start-guide">
      <h3>Start AllTalk Server</h3>

      {status === 'idle' && (
        <>
          <p>Run this command in your terminal:</p>
          <code className="command-block">
            /home/drifter/ai/alltalk_tts_v2/start_alltalk.sh
          </code>
          <button onClick={startPolling} className="btn-primary">
            I've started it, check connection
          </button>
        </>
      )}

      {status === 'waiting' && (
        <div className="waiting-status">
          <LoadingSpinner />
          <p>Waiting for AllTalk server to start...</p>
          <p className="help-text">This may take a minute while models load.</p>
        </div>
      )}

      {status === 'connected' && (
        <div className="success-status">
          <CheckIcon className="text-green-500" />
          <p>AllTalk server is now connected!</p>
          <button onClick={onClose} className="btn-primary">
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
```

### 6.2 Delete Associated AllTalk Audio

**User Request**: When deleting a session, also delete audio files from AllTalk server.

**API Limitation**: AllTalk API does not provide endpoints for deleting generated audio files.

#### Options

1. **Not Possible via API**: AllTalk doesn't expose file deletion
2. **Server-Side Solution**: If we control the AllTalk installation:
   - Add a custom endpoint to AllTalk
   - Or use filesystem access from Express server

#### Recommended: Document Limitation + Manual Cleanup

Add to session deletion UI:
```tsx
function DeleteSessionDialog({ session, onConfirm, onCancel }) {
  return (
    <div className="delete-dialog">
      <h3>Delete Session</h3>
      <p>Are you sure you want to delete "{session.name}"?</p>
      <p className="warning-text">
        Note: Audio files on the AllTalk server will not be deleted automatically.
        To free up disk space, manually clear the AllTalk outputs folder.
      </p>
      <div className="dialog-actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} className="btn-danger">Delete</button>
      </div>
    </div>
  );
}
```

### 6.3 Text Parsing/Splitting Review

**User Request**: Review and improve parsing logic.

#### Current Issues Identified

1. **Double newline only**: Only splits on `\n\n`, missing other paragraph indicators
2. **No chapter detection**: Could auto-detect "Chapter X" patterns
3. **Dialogue handling**: Could improve handling of quoted dialogue
4. **List handling**: Numbered/bulleted lists could be handled better

#### Improvements

```typescript
// Enhanced paragraph splitting
function splitIntoParagraphs(text: string, maxLength: number): string[] {
  // Step 1: Normalize line endings
  let normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 2: Detect chapter markers and add breaks
  normalized = normalized.replace(
    /^(Chapter\s+\d+|Part\s+\d+|Section\s+\d+|CHAPTER\s+\d+)/gim,
    '\n\n$1'
  );

  // Step 3: Split on double newlines
  let paragraphs = normalized
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Step 4: Handle oversized paragraphs
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxLength) {
      result.push(paragraph);
    } else {
      // Split at sentence boundaries
      result.push(...splitTextIntoChunks(paragraph, maxLength));
    }
  }

  return result;
}

// Improved sentence splitting
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    // Find best split point
    const splitIndex = findBestSplitPoint(remaining, maxLength);
    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}

function findBestSplitPoint(text: string, maxLength: number): number {
  // Priority order: sentence end, clause break, word break
  const priorities = [
    /[.!?]["']?\s+/g,  // Sentence endings (including quotes)
    /[;:]\s+/g,         // Semicolons, colons
    /,\s+/g,            // Commas
    /\s+/g              // Any whitespace
  ];

  const searchStart = Math.floor(maxLength * 0.5);

  for (const pattern of priorities) {
    let lastMatch = -1;
    let match;

    // Reset regex state
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > maxLength) break;
      if (match.index >= searchStart) {
        lastMatch = match.index + match[0].length;
      }
    }

    if (lastMatch > 0) return lastMatch;
  }

  // Fallback: hard break at maxLength
  return maxLength;
}
```

#### Text Preview Enhancement

```tsx
function TextPreview({ text, paragraphs }) {
  return (
    <div className="text-preview">
      <h4>Paragraph Preview ({paragraphs.length} paragraphs)</h4>
      <div className="preview-stats">
        <span>Total: {text.length} characters</span>
        <span>Avg: {Math.round(text.length / paragraphs.length)} per paragraph</span>
        <span>Max: {Math.max(...paragraphs.map(p => p.length))} characters</span>
      </div>
      <div className="preview-list">
        {paragraphs.slice(0, 10).map((p, i) => (
          <div key={i} className="preview-item">
            <span className="preview-number">{i + 1}</span>
            <span className="preview-text">{p.slice(0, 100)}...</span>
            <span className="preview-length">{p.length} chars</span>
          </div>
        ))}
        {paragraphs.length > 10 && (
          <div className="preview-more">
            +{paragraphs.length - 10} more paragraphs
          </div>
        )}
      </div>
    </div>
  );
}
```

### 6.4 Missing Feature Ideas

Based on the codebase review, here are additional features that could improve UX:

#### Keyboard Shortcuts

```typescript
// src/hooks/useKeyboardShortcuts.ts
function useKeyboardShortcuts({
  onPlayPause,
  onNext,
  onPrevious,
  onSkipForward,
  onSkipBackward
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowRight':
          if (e.shiftKey) onSkipForward();
          else onNext();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) onSkipBackward();
          else onPrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, onNext, onPrevious]);
}
```

#### Audio Preloading

```typescript
// Preload next paragraph while current one plays
function useAudioPreloader(nextUrl: string | null) {
  const preloadedRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (nextUrl) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = nextUrl;
      preloadedRef.current = audio;

      return () => {
        audio.src = '';
        preloadedRef.current = null;
      };
    }
  }, [nextUrl]);

  return preloadedRef;
}
```

#### Sleep Timer

```tsx
function SleepTimer({ onSleep }) {
  const [minutes, setMinutes] = useState(30);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;

    const timeout = setTimeout(() => {
      onSleep();
      setActive(false);
    }, minutes * 60 * 1000);

    return () => clearTimeout(timeout);
  }, [active, minutes, onSleep]);

  return (
    <div className="sleep-timer">
      <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
        <option value={15}>15 minutes</option>
        <option value={30}>30 minutes</option>
        <option value={45}>45 minutes</option>
        <option value={60}>1 hour</option>
      </select>
      <button onClick={() => setActive(!active)}>
        {active ? `Stop (${minutes}m)` : 'Set Sleep Timer'}
      </button>
    </div>
  );
}
```

#### Playback Speed UI Improvement

```tsx
function PlaybackSpeedControl({ speed, onChange }) {
  const presets = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="speed-control">
      <div className="speed-presets">
        {presets.map(preset => (
          <button
            key={preset}
            className={speed === preset ? 'active' : ''}
            onClick={() => onChange(preset)}
          >
            {preset}x
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0.5}
        max={2.0}
        step={0.05}
        value={speed}
        onChange={e => onChange(Number(e.target.value))}
      />
      <span>{speed.toFixed(2)}x</span>
    </div>
  );
}
```

## Implementation Priority

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Text parsing improvements | Medium | Medium | Medium |
| Keyboard shortcuts | High | Low | High |
| Audio preloading | Medium | Low | Medium |
| Start AllTalk guide | Low | Medium | Low |
| Sleep timer | Low | Low | Medium |
| Speed control presets | Low | Low | Medium |

## Testing Checklist

- [ ] Keyboard shortcuts work (space, arrows)
- [ ] Audio preloading reduces gap between paragraphs
- [ ] Text parsing handles edge cases
- [ ] Start guide shows correct instructions
- [ ] Sleep timer stops playback at set time

## Success Criteria

- [ ] At least 2 nice-to-have features implemented
- [ ] Keyboard navigation functional
- [ ] Text parsing improved for common formats
- [ ] No regressions in core functionality

## Estimated Scope

- **New files**: 3-5
- **Modified files**: 3-5
- **Risk level**: Low
- **Dependencies**: Phase 1 (clean architecture)
