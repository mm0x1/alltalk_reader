# Phase 4: Session Improvements

This phase addresses session management issues: losing place when resuming, tracking generated paragraphs, and improving the overall session UX.

## Features

### 4.1 Resume Position (High Priority)

**Problem**: Users commonly lose their place when resuming a session. They have to scroll through paragraphs to find where they left off.

**Solution**: Persist and restore playback position.

#### Implementation

**Data Model Update**:
```typescript
interface AudioSession {
  // ... existing fields
  lastPlaybackPosition?: {
    paragraphIndex: number;
    timestamp: number;
    duration?: number;  // Optional: position within paragraph
  };
}
```

**Auto-Save Position**:
```typescript
// In useAudioPlayer or useBufferedPlayback
useEffect(() => {
  if (currentParagraph !== null && currentSession) {
    // Debounce to avoid too many saves
    const savePosition = debounce(() => {
      updateSessionPosition(currentSession.id, currentParagraph);
    }, 1000);

    savePosition();
    return () => savePosition.cancel();
  }
}, [currentParagraph, currentSession]);
```

**Restore on Load**:
```typescript
const handleLoadSession = (session: AudioSession) => {
  // ... existing load logic

  // Restore position if available
  if (session.lastPlaybackPosition) {
    const { paragraphIndex, timestamp } = session.lastPlaybackPosition;

    // Show resume prompt if position is recent (within 7 days)
    const isRecent = Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000;
    if (isRecent && paragraphIndex > 0) {
      showResumePrompt(paragraphIndex, session.paragraphs.length);
    }
  }
};
```

**Resume UI**:
```tsx
function ResumePrompt({ paragraphIndex, totalParagraphs, onResume, onStartOver }) {
  return (
    <div className="resume-prompt">
      <p>Resume from paragraph {paragraphIndex + 1} of {totalParagraphs}?</p>
      <div className="flex gap-2">
        <button onClick={() => onResume(paragraphIndex)} className="btn-primary">
          Resume
        </button>
        <button onClick={onStartOver} className="btn-secondary">
          Start Over
        </button>
      </div>
    </div>
  );
}
```

#### Visual Position Indicator

Add to ParagraphList:
```tsx
// Mark last position with a visual indicator
{session.lastPlaybackPosition?.paragraphIndex === index && !isPlaying && (
  <div className="last-position-marker">
    <BookmarkIcon />
    <span>Last position</span>
  </div>
)}
```

### 4.2 Track Generated Paragraphs (Nice to Have)

**Problem**: When regenerating a session, previously generated paragraphs are regenerated unnecessarily.

**Solution**: Track which paragraphs have been generated with which settings.

#### Implementation

**Data Model Update**:
```typescript
interface AudioSession {
  // ... existing fields
  generationStatus?: {
    [paragraphIndex: number]: {
      generated: boolean;
      audioUrl?: string;
      settings: {
        voice: string;
        speed: number;
        pitch: number;
        language: string;
      };
      timestamp: number;
    };
  };
}
```

**Track During Generation**:
```typescript
const onParagraphGenerated = (index: number, url: string, settings: TtsSettings) => {
  updateGenerationStatus(sessionId, index, {
    generated: true,
    audioUrl: url,
    settings,
    timestamp: Date.now()
  });
};
```

**Smart Regeneration**:
```typescript
const shouldRegenerate = (index: number, currentSettings: TtsSettings): boolean => {
  const status = session.generationStatus?.[index];
  if (!status?.generated) return true;

  // Check if settings changed
  return (
    status.settings.voice !== currentSettings.voice ||
    status.settings.speed !== currentSettings.speed ||
    status.settings.pitch !== currentSettings.pitch ||
    status.settings.language !== currentSettings.language
  );
};
```

**UI Indicator**:
```tsx
// Show generation status in paragraph list
<div className="paragraph-status">
  {generationStatus?.generated ? (
    <span className="text-green-500" title="Generated">
      <CheckIcon />
    </span>
  ) : (
    <span className="text-gray-400" title="Not generated">
      <ClockIcon />
    </span>
  )}
</div>
```

**Partial Regeneration Option**:
```tsx
<button onClick={regenerateChanged}>
  Regenerate Changed ({changedCount} paragraphs)
</button>
<button onClick={regenerateAll}>
  Regenerate All ({totalCount} paragraphs)
</button>
```

### 4.3 Session List Improvements

**Current Issues**:
- No search/filter
- No sorting options
- Limited metadata display
- No pagination for many sessions

#### Implementation

**Enhanced Session List**:
```tsx
function SessionList() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'progress'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredSessions = useMemo(() => {
    return sessions
      .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        // Sort logic
      });
  }, [sessions, search, sortBy, sortOrder]);

  return (
    <div>
      <div className="session-controls">
        <input
          type="search"
          placeholder="Search sessions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Date</option>
          <option value="name">Name</option>
          <option value="progress">Progress</option>
        </select>
      </div>
      <div className="session-list">
        {filteredSessions.map(session => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
}
```

**Enhanced Session Card**:
```tsx
function SessionCard({ session }: { session: AudioSession }) {
  const progress = session.lastPlaybackPosition
    ? Math.round((session.lastPlaybackPosition.paragraphIndex / session.paragraphs.length) * 100)
    : 0;

  return (
    <div className="session-card">
      <div className="session-header">
        <h3>{session.name}</h3>
        <span className="session-date">
          {formatRelativeDate(session.updatedAt)}
        </span>
      </div>
      <div className="session-meta">
        <span>{session.paragraphs.length} paragraphs</span>
        <span>{session.settings.voice}</span>
        {session.isOfflineSession && <span className="badge">Offline</span>}
      </div>
      <div className="session-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span>{progress}% complete</span>
      </div>
      <div className="session-actions">
        <button onClick={() => loadSession(session)}>
          {progress > 0 ? 'Resume' : 'Play'}
        </button>
        <button onClick={() => exportSession(session)}>Export</button>
        <button onClick={() => deleteSession(session.id)}>Delete</button>
      </div>
    </div>
  );
}
```

### 4.4 Session Naming Improvements

**Current**: Auto-generated name is "First 30 chars... (date)"

**Improvements**:
1. Allow editing session name
2. Better auto-generation (detect chapter titles, etc.)
3. Add custom session metadata (tags, notes)

```tsx
function SessionNameEditor({ session, onSave }) {
  const [name, setName] = useState(session.name);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave(session.id, name);
    setIsEditing(false);
  };

  return isEditing ? (
    <div className="name-editor">
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={handleSave}>Save</button>
      <button onClick={() => setIsEditing(false)}>Cancel</button>
    </div>
  ) : (
    <div className="name-display" onClick={() => setIsEditing(true)}>
      {session.name}
      <EditIcon />
    </div>
  );
}
```

### 4.5 Session Quick Actions

Add quick actions without opening full modal:

```tsx
function SessionQuickActions({ session }) {
  return (
    <div className="quick-actions">
      <button onClick={() => continueSession(session)} title="Continue">
        <PlayIcon />
      </button>
      <button onClick={() => exportSession(session)} title="Export">
        <DownloadIcon />
      </button>
      <button onClick={() => duplicateSession(session)} title="Duplicate">
        <CopyIcon />
      </button>
      <button onClick={() => deleteSession(session.id)} title="Delete">
        <TrashIcon />
      </button>
    </div>
  );
}
```

## Implementation Steps

### Step 4.1: Resume Position

**Tasks**:
1. Update `AudioSession` interface with `lastPlaybackPosition`
2. Add `updateSessionPosition()` to session storage service
3. Implement auto-save in `useAudioPlayer`
4. Create `ResumePrompt` component
5. Add resume logic to session loading
6. Add visual position marker in `ParagraphList`

### Step 4.2: Generation Tracking (Optional)

**Tasks**:
1. Update `AudioSession` interface with `generationStatus`
2. Track generation in batch generation hook
3. Add regeneration comparison logic
4. Add status indicators in paragraph list
5. Add partial regeneration UI

### Step 4.3: Session List Enhancements

**Tasks**:
1. Add search input
2. Add sort controls
3. Create enhanced `SessionCard` component
4. Add progress indicator
5. Improve date formatting

### Step 4.4: Session Management

**Tasks**:
1. Add session name editing
2. Add duplicate session function
3. Add session metadata (optional)
4. Improve auto-name generation

## File Structure

```
src/components/session/
├── index.ts
├── SessionList.tsx         # Enhanced list with search/sort
├── SessionCard.tsx         # Rich session card
├── SessionNameEditor.tsx   # Inline name editing
├── ResumePrompt.tsx        # Resume position prompt
└── SessionQuickActions.tsx # Quick action buttons

src/services/session/
├── position.ts             # Position tracking functions
└── metadata.ts             # Session metadata functions
```

## Testing Checklist

**Resume Position**:
- [ ] Position saved during playback
- [ ] Position restored on session load
- [ ] Resume prompt shows for recent positions
- [ ] "Start Over" works correctly
- [ ] Position marker visible in paragraph list
- [ ] Works across browser sessions

**Session List**:
- [ ] Search filters correctly
- [ ] Sort by date works
- [ ] Sort by name works
- [ ] Sort by progress works
- [ ] Progress indicator accurate
- [ ] Quick actions work

**Generation Tracking (if implemented)**:
- [ ] Generated paragraphs marked
- [ ] Settings change detected
- [ ] Partial regeneration works
- [ ] Full regeneration works

## Success Criteria

- [ ] Users can resume from last position with one click
- [ ] Position saved automatically during playback
- [ ] Session list is searchable and sortable
- [ ] Progress visible at a glance
- [ ] Session names editable

## Estimated Scope

- **New files**: 6-8
- **Modified files**: 5-7
- **Risk level**: Low
- **Dependencies**: Phase 1 (clean architecture)
