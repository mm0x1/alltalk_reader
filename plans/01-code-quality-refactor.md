# Phase 1: Code Quality Refactor (COMPLETE)

This phase establishes a clean foundation for all subsequent work. Complete this phase first before tackling bugs or features.

## Objectives

1. Complete active migrations (deprecated API removal, global state elimination)
2. Improve TypeScript type safety
3. Split large files into focused modules
4. Extract duplicate code into shared utilities
5. Improve naming and formatting consistency
6. Add proper error boundaries and loading states

## Priority Order

### 1.1 Complete API Migration (Critical)

**Current State**: `src/services/alltalkApi.ts` is deprecated but still imported by 6 files.

**Files Using Deprecated API**:

- `src/hooks/useAudioPlayer.ts` - imports `generateTTS`
- `src/hooks/useBatchAudioGeneration.ts` - imports `generateTTS`
- `src/hooks/useTextProcessor.ts` - imports text splitting functions
- `src/hooks/useServerConnection.ts` - imports server status functions
- `src/components/TtsSettings.tsx` - imports settings functions
- `src/components/VoiceSelector.tsx` - imports voice functions

**Tasks**:

1. Update `useAudioPlayer.ts` to use `src/services/api/tts.ts`
2. Update `useBatchAudioGeneration.ts` to use `src/services/api/tts.ts`
3. Update `useTextProcessor.ts` to use `src/services/api/tts.ts`
4. Update `useServerConnection.ts` to use `src/services/api/status.ts`
5. Update `TtsSettings.tsx` to use `ApiStateContext`
6. Update `VoiceSelector.tsx` to use `ApiStateContext` or `src/services/api/voices.ts`
7. Delete `src/services/alltalkApi.ts` after all migrations complete
8. Remove `LEGACY_SERVER_STATUS` global variable usage

**Success Criteria**:

- [ ] Zero imports from `alltalkApi.ts`
- [ ] `alltalkApi.ts` deleted
- [ ] All components using `useApiState()` for shared state
- [ ] TypeScript compiles without errors

### 1.2 Split Large Files

**Files Exceeding 300 Lines**:

| File                | Lines | Action                   |
| ------------------- | ----- | ------------------------ |
| `sessionStorage.ts` | 677   | Split into modules       |
| `reader.tsx`        | 523   | Extract sub-components   |
| `useAudioPlayer.ts` | 315   | Consider splitting logic |

#### 1.2.1 Split `sessionStorage.ts` (677 lines)

**Proposed Structure**:

```
src/services/session/
├── index.ts              # Re-exports all
├── types.ts              # AudioSession interface, config types
├── api.ts                # CRUD operations (getAllSessions, saveSession, deleteSession)
├── export.ts             # Export functions (prepareSessionForExport, downloadSessionAsFile)
├── import.ts             # Import functions (importSessionFromFile, validation)
├── cache.ts              # Cache functions (cacheAudioBlobsForSession, getCachedAudioBlobs, clearCache)
├── offline.ts            # Offline audio (getOfflineAudioUrl, getAudioUrlForPlayback)
└── utils.ts              # Helpers (generateSessionId, generateSessionName, blobToBase64)
```

**Migration Strategy**:

1. Create new folder structure
2. Move types first
3. Move utilities
4. Move each function group
5. Update all imports
6. Delete old file

#### 1.2.2 Refactor `reader.tsx` (523 lines)

**Issues**:

- Contains inline modals that should be components
- Import modal (lines 197-254) duplicates ExportImportManager
- JSX is deeply nested and hard to follow

**Proposed Extractions**:

```
src/components/reader/
├── TextInputView.tsx     # Text input view (lines 256-354)
├── ReaderView.tsx        # Reader view with paragraphs (lines 355-519)
├── ImportModal.tsx       # Initial import modal (lines 197-254)
├── ReaderHeader.tsx      # Header with session button (lines 164-178)
└── index.tsx             # Main orchestrator (imports views, manages state)
```

**Target**: Reduce `reader.tsx` to ~200 lines (orchestration only)

#### 1.2.3 Review `useAudioPlayer.ts` (315 lines)

**Current Structure**:

- Safari detection (lines 38-52)
- Auto-progression logic (lines 54-97)
- Play paragraph logic (lines 99-260)
- Toggle/reset (lines 262-303)

**Potential Extractions**:

- Safari detection to a utility hook `useSafariDetection()`
- Audio element management to `useAudioElement()`

**Decision**: Review after other refactors - may be acceptable at 315 lines if well-organized.

### 1.3 Type Safety Improvements

**Current `any` Usage** (25 occurrences):

**Priority Fixes**:

1. `reader.tsx:83` - `handleLoadSession(session: any)` - should use `AudioSession`
2. Event handlers using `any` - should use proper event types
3. API response types - should be properly typed

**Tasks**:

1. Create comprehensive type definitions in `src/types/` folder
2. Add strict return types to all functions
3. Replace `any` with proper types or `unknown`
4. Add discriminated unions for state machine states

**New Type Definitions**:

```typescript
// src/types/playback.ts
type PlaybackState =
  | { status: "idle" }
  | { status: "loading"; paragraphIndex: number }
  | { status: "playing"; paragraphIndex: number }
  | { status: "paused"; paragraphIndex: number }
  | { status: "error"; paragraphIndex: number; message: string };

// src/types/generation.ts
type GenerationState =
  | { status: "idle" }
  | { status: "generating"; current: number; total: number }
  | { status: "completed"; audioUrls: string[] }
  | { status: "error"; message: string };
```

### 1.4 Extract Duplicate Code

**Identified Duplications**:

1. **Base64 conversion** - Used in multiple places in `sessionStorage.ts`
   - Extract to `src/utils/encoding.ts`

2. **Modal wrapper pattern** - Repeated across modals
   - Create `src/components/common/ModalWrapper.tsx`

3. **SVG icons** - Inline SVGs repeated throughout
   - Create `src/components/icons/` folder with icon components

4. **Loading spinner** - Same SVG animation in multiple files
   - Create `src/components/common/LoadingSpinner.tsx`

5. **Button patterns** - Similar button styling repeated
   - Already have design system, ensure consistent usage

### 1.5 Naming and Formatting

**Naming Issues**:

- `handlePlayParagraph` vs `handleAutoProgression` - inconsistent handler naming
- `preGeneratedAudio` vs `audioUrls` - referring to same concept differently
- `isOfflineSession` flag on session vs separate state

**Fixes**:

1. Establish naming convention document
2. Rename for consistency:
   - All event handlers: `handle{Event}{Entity}`
   - All boolean states: `is{State}` or `has{Thing}`
   - All arrays: plural nouns
3. Add JSDoc comments to public APIs

### 1.6 Error Boundaries and Loading States

**Current Issues**:

- No React error boundaries
- Loading states inconsistent
- Some operations fail silently

**Tasks**:

1. Add `ErrorBoundary` component wrapping main routes
2. Create consistent loading skeleton components
3. Add toast/notification system for operations
4. Ensure all async operations have loading states

### 1.7 Performance Foundation

**Quick Wins**:

1. Add `React.memo()` to pure list item components
2. Use `useMemo()` for expensive computations
3. Use `useCallback()` for handlers passed to children
4. Lazy load modals and heavy components

**Memory Leak Fixes**:

1. Revoke object URLs when components unmount
2. Clean up event listeners
3. Cancel pending requests on unmount

## File Changes Summary

| Action | Files                                         |
| ------ | --------------------------------------------- |
| Delete | `src/services/alltalkApi.ts`                  |
| Create | `src/services/session/*` (7 files)            |
| Create | `src/components/reader/*` (5 files)           |
| Create | `src/types/*` (3-4 files)                     |
| Create | `src/components/common/*` (3-4 files)         |
| Create | `src/components/icons/*` (5-10 files)         |
| Modify | All files importing `alltalkApi.ts` (6 files) |
| Modify | `src/routes/reader.tsx` (major refactor)      |

## Testing Checklist

After Phase 1 completion:

- [ ] App starts without errors
- [ ] TypeScript compiles (`pnpm build`)
- [ ] Live playback mode works
- [ ] Pre-generation mode works
- [ ] Export/import works
- [ ] Session save/load works
- [ ] Safari/iOS playback works
- [ ] All settings persist correctly
- [ ] No console errors during normal operation

## Estimated Scope

- **Files affected**: ~30+
- **New files created**: ~20
- **Files deleted**: 1 (alltalkApi.ts)
- **Risk level**: Medium (breaking existing functionality possible)
- **Mitigation**: Test each module after migration before proceeding
