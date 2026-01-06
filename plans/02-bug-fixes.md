# Phase 2: Bug Fixes - Export/Import for Large Sessions

This phase addresses the critical bug where export and import fails for sessions with 500-700+ paragraphs, causing browser reload especially on mobile devices.

## Problem Analysis

### Symptoms
- Browser reloads when attempting to export sessions with 500-700+ paragraphs
- Import of large JSON files causes browser tab crash
- Problem is worse on mobile devices (lower memory)
- No error message - just a reload

### Root Causes

After analyzing the code, the issues stem from:

1. **Memory Pressure During Export** (`sessionStorage.ts:243-294`)
   - `prepareSessionForExport()` loads ALL audio blobs into memory simultaneously
   - Each audio file is ~50-200KB
   - 500 files = 25-100MB in memory at once
   - Base64 encoding adds 33% overhead = 33-133MB
   - `JSON.stringify()` creates another copy = 66-266MB total

2. **Synchronous JSON Processing** (`sessionStorage.ts:302-327`)
   - `JSON.stringify(exportSession, null, 2)` is synchronous
   - Large object stringification blocks main thread
   - Browser watchdog kills unresponsive tabs (especially mobile)

3. **sessionStorage Limits** (`sessionStorage.ts:468-497`)
   - Browser sessionStorage limit is ~5-10MB
   - Caching 500+ audio files exceeds this limit
   - Silent failures when storage quota exceeded

4. **FileReader Synchronous-Like Behavior** (`sessionStorage.ts:335-371`)
   - `importSessionFromFile()` reads entire file into memory
   - Large JSON parsing is synchronous and blocks UI

## Solution Options

### Option A: Chunked ZIP Export (Recommended)

**Approach**: Use streaming ZIP compression with chunked processing

**Benefits**:
- Dramatically smaller file size (70-80% reduction)
- Streaming prevents memory spikes
- Can show real progress
- Standard format, easy to debug

**Implementation**:
```
Export Flow:
1. Create ZIP stream (using fflate or zip.js)
2. Add metadata.json (session info without audio)
3. For each paragraph (chunked, 10 at a time):
   a. Fetch audio blob
   b. Add to ZIP as audio_{index}.wav
   c. Update progress
   d. Yield to main thread (requestIdleCallback)
4. Finalize ZIP
5. Trigger download

Import Flow:
1. Read ZIP file header
2. Extract and validate metadata.json
3. For each audio file (chunked):
   a. Extract from ZIP
   b. Store in IndexedDB (not sessionStorage)
   c. Update progress
4. Create session with IndexedDB references
```

**Library Options**:
- `fflate` - Pure JS, streaming, small (8KB gzipped)
- `zip.js` - More features, larger
- `jszip` - Popular but not streaming (avoid)

### Option B: Chunked JSON with Streaming

**Approach**: Split large sessions into multiple smaller JSON files

**Benefits**:
- No new dependencies
- Simpler implementation

**Drawbacks**:
- Multiple files to manage
- No compression
- Still has base64 overhead

**Implementation**:
```
Export as folder structure:
session-name/
├── metadata.json       # Session info, no audio
├── audio-001.json      # Paragraphs 0-99 audio
├── audio-002.json      # Paragraphs 100-199 audio
└── audio-003.json      # etc.
```

### Option C: IndexedDB for Large Data (Complementary)

**Approach**: Replace sessionStorage with IndexedDB for audio caching

**Benefits**:
- Much larger storage limit (typically 50% of disk)
- Async API doesn't block UI
- Better for binary data

**Implementation**:
- Use `idb` library (tiny wrapper around IndexedDB)
- Store audio blobs directly (no base64 conversion needed)
- Lazy load audio on playback

## Recommended Implementation Plan

### Phase 2.1: Add IndexedDB Storage Layer

**Tasks**:
1. Install `idb` library: `pnpm add idb`
2. Create `src/services/storage/indexedDb.ts`
3. Define schema for audio storage
4. Implement CRUD for audio blobs
5. Add migration from sessionStorage

**Schema**:
```typescript
interface AudioCacheDB {
  sessions: {
    key: string; // sessionId
    value: {
      sessionId: string;
      createdAt: number;
      audioCount: number;
    };
  };
  audioBlobs: {
    key: string; // `${sessionId}_${index}`
    value: {
      sessionId: string;
      index: number;
      blob: Blob;
      createdAt: number;
    };
    indexes: { bySession: string };
  };
}
```

### Phase 2.2: Implement Chunked ZIP Export

**Tasks**:
1. Install `fflate`: `pnpm add fflate`
2. Create `src/services/export/zipExport.ts`
3. Implement streaming ZIP creation
4. Add progress callback support
5. Implement chunked processing with `requestIdleCallback`
6. Update `ExportImportManager.tsx` to use new export

**Chunking Strategy**:
```typescript
const CHUNK_SIZE = 10; // Process 10 files at a time
const YIELD_INTERVAL = 50; // Yield every 50ms

async function* processInChunks<T>(items: T[], process: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(process));
    yield { processed: Math.min(i + CHUNK_SIZE, items.length), total: items.length };

    // Yield to main thread
    await new Promise(resolve => requestIdleCallback(resolve));
  }
}
```

### Phase 2.3: Implement Chunked ZIP Import

**Tasks**:
1. Create `src/services/export/zipImport.ts`
2. Implement streaming ZIP reading
3. Store audio directly to IndexedDB
4. Validate metadata before full import
5. Add progress callback support
6. Update `ExportImportManager.tsx` to use new import

**Validation Strategy**:
```typescript
async function validateZipSession(zipFile: File): Promise<ValidationResult> {
  // 1. Read only metadata.json first (fast)
  const metadata = await readMetadataFromZip(zipFile);

  // 2. Validate structure
  if (!metadata.id || !metadata.paragraphs) {
    return { valid: false, error: 'Invalid session structure' };
  }

  // 3. Check audio file count matches
  const audioFileCount = await countZipEntries(zipFile, /^audio_\d+\.wav$/);
  if (audioFileCount !== metadata.paragraphs.length) {
    return { valid: false, error: 'Audio count mismatch' };
  }

  return { valid: true, metadata };
}
```

### Phase 2.4: Update UI Components

**Tasks**:
1. Update `ExportImportManager.tsx`:
   - Add format selection (ZIP vs legacy JSON)
   - Show detailed progress during export/import
   - Add cancel button for long operations
   - Show estimated time remaining

2. Update `BatchGenerator.tsx`:
   - Store to IndexedDB instead of sessionStorage
   - Add cache size indicator

3. Add error recovery:
   - Resume partial exports
   - Handle interrupted imports
   - Clean up failed operations

### Phase 2.5: Backwards Compatibility

**Tasks**:
1. Keep JSON import working for old exports
2. Add format detection on import
3. Migrate existing sessionStorage cache to IndexedDB
4. Add migration progress UI

## File Structure

```
src/services/storage/
├── index.ts              # Re-exports
├── indexedDb.ts          # IndexedDB wrapper
├── types.ts              # Storage types
└── migration.ts          # sessionStorage -> IndexedDB migration

src/services/export/
├── index.ts              # Re-exports
├── zipExport.ts          # ZIP export implementation
├── zipImport.ts          # ZIP import implementation
├── jsonExport.ts         # Legacy JSON export (keep for small sessions)
├── jsonImport.ts         # Legacy JSON import
├── validation.ts         # Session validation
└── types.ts              # Export/import types
```

## New Dependencies

```json
{
  "dependencies": {
    "fflate": "^0.8.2",  // Streaming ZIP compression
    "idb": "^8.0.0"       // IndexedDB wrapper
  }
}
```

**Bundle Impact**:
- `fflate`: ~8KB gzipped
- `idb`: ~2KB gzipped
- Total: ~10KB additional

## Testing Strategy

### Unit Tests (if added later)
- IndexedDB CRUD operations
- ZIP creation/extraction
- Chunked processing
- Format detection

### Manual Testing Checklist

**Export Tests**:
- [ ] Export 100 paragraph session (baseline)
- [ ] Export 500 paragraph session
- [ ] Export 1000 paragraph session
- [ ] Export 2000 paragraph session
- [ ] Export on mobile (iOS Safari)
- [ ] Export on mobile (Android Chrome)
- [ ] Cancel mid-export
- [ ] Export with network offline (cached audio)

**Import Tests**:
- [ ] Import small ZIP session
- [ ] Import 1000 paragraph ZIP session
- [ ] Import legacy JSON session (backwards compat)
- [ ] Import invalid ZIP
- [ ] Import corrupted ZIP
- [ ] Import on mobile
- [ ] Cancel mid-import

**Performance Benchmarks**:
| Paragraphs | Old Export Time | New Export Time | Old File Size | New File Size |
|------------|-----------------|-----------------|---------------|---------------|
| 100 | TBD | TBD | TBD | TBD |
| 500 | TBD (crashes) | TBD | TBD | TBD |
| 1000 | TBD (crashes) | TBD | TBD | TBD |

## Success Criteria

- [ ] Export 1000+ paragraph sessions without crash
- [ ] Import 1000+ paragraph sessions without crash
- [ ] Works on mobile Safari
- [ ] Works on mobile Chrome
- [ ] Progress indicator shows during export/import
- [ ] Cancel operation works
- [ ] Backwards compatible with old JSON exports
- [ ] File size reduced by 50%+ compared to JSON

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| IndexedDB not available | Fallback to sessionStorage for small sessions |
| ZIP library bugs | Use well-tested fflate library |
| Mobile memory limits | Process in small chunks with yields |
| Browser compatibility | Test on all target browsers |
| Interrupted exports | Add resume capability |

## Estimated Scope

- **New files**: 10-12
- **Modified files**: 5-7
- **New dependencies**: 2
- **Risk level**: Medium
