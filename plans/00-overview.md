# AllTalk Reader - Implementation Plan Overview

This document provides a high-level roadmap for all planned changes to the AllTalk Reader application. Changes are organized into phases based on dependencies and logical groupings.

## Summary of Changes

### From changes.txt

**Bugs:**
- Export/import fails with 500-700+ paragraphs (browser reload on mobile)

**Features:**
- Robust session/parsing/generation for very long texts (1000-5000 paragraphs)
- New "streaming buffer" playback mode (generate ahead while playing)
- Track previously generated paragraphs (nice to have)
- Solution for losing place when resuming sessions
- Delete associated AllTalk audio when deleting session (nice to have - API limitation)
- More AllTalk config options in UI
- Review and improve parsing/generation logic
- Button to start AllTalk server (nice to have)
- Use additional AllTalk API features

**Code Quality:**
- Full refactor for React/TypeScript best practices
- Small, focused, typed files
- Extract duplicate code
- Performance optimization
- Appropriate UI feedback

## Phase Breakdown

| Phase | Focus | Priority | Est. Files Changed |
|-------|-------|----------|-------------------|
| 1 | Code Quality Refactor | Critical | 30+ |
| 2 | Bug Fixes (Export/Import) | Critical | 5-8 |
| 3 | Streaming Buffer Mode | High | 8-12 |
| 4 | Session Improvements | Medium | 6-10 |
| 5 | AllTalk Integration | Medium | 5-8 |
| 6 | Nice-to-Have Features | Low | 3-6 |

## Phase Dependencies

```
Phase 1 (Code Quality)
    |
    +---> Phase 2 (Bug Fixes) ---> Phase 3 (Streaming Buffer)
    |
    +---> Phase 4 (Session Improvements)
    |
    +---> Phase 5 (AllTalk Integration)
    |
    +---> Phase 6 (Nice-to-Haves)
```

**Why Phase 1 First:**
- Clean, well-structured code makes all subsequent changes easier
- Performance improvements in Phase 1 directly help Phase 2 bug fixes
- Completing active migrations removes technical debt
- Better type safety catches bugs earlier

## Detailed Plan Documents

1. **[Phase 1: Code Quality Refactor](01-code-quality-refactor.md)** - Foundation work
2. **[Phase 2: Bug Fixes](02-bug-fixes.md)** - Export/import for large sessions
3. **[Phase 3: Streaming Buffer Mode](03-streaming-buffer-mode.md)** - New playback mode
4. **[Phase 4: Session Improvements](04-session-improvements.md)** - Resume position, tracking
5. **[Phase 5: AllTalk Integration](05-alltalk-integration.md)** - API features, config UI
6. **[Phase 6: Nice-to-Haves](06-nice-to-haves.md)** - Optional features

## Key Technical Decisions

### Export/Import Fix Strategy

After analysis, the export/import failure for large sessions is caused by:
1. **Memory pressure**: Base64 encoding of 500+ audio files (each ~50-200KB) creates massive JSON strings
2. **Synchronous operations**: Single-threaded JSON stringification blocks the browser
3. **sessionStorage limits**: ~5-10MB browser limit exceeded

**Proposed Solution**: Chunked export with ZIP format using streaming compression.

### Streaming Buffer Mode Design

A new fourth playback mode that:
1. Pre-generates a configurable buffer (e.g., 5 paragraphs ahead)
2. Starts playing immediately after first paragraph is ready
3. Continues generating while audio plays
4. Stops generation when user leaves page (abort controllers)
5. Maintains buffer size throughout playback

### AllTalk API Limitations Discovered

- **No audio cleanup API**: Cannot delete generated files via API
- **No queue/batch API**: Must handle sequentially client-side
- **Streaming endpoint exists** but limited (no narrator, no RVC)
- **Configuration API** provides capability detection

## Success Criteria

### Phase 1
- [ ] All deprecated `alltalkApi.ts` usage removed
- [ ] Global state migrated to React Context
- [ ] No TypeScript `any` types except where unavoidable
- [ ] All files under 300 lines
- [ ] Clear separation of concerns

### Phase 2
- [ ] Export works for 1000+ paragraph sessions
- [ ] Import works for 1000+ paragraph sessions
- [ ] Mobile browser support maintained
- [ ] Progress feedback during export/import

### Phase 3
- [ ] Buffer mode generates ahead of playback
- [ ] Playback starts within 5-10 seconds
- [ ] Generation stops on page leave
- [ ] Smooth transition between paragraphs

### Phase 4
- [x] Resume position saved per session
- [x] Visual indicator of current position
- [ ] Optional paragraph generation tracking (deferred - nice to have)

### Phase 5
- [ ] AllTalk config options visible in UI
- [ ] Capability-aware feature toggles
- [ ] Streaming TTS option (where supported)

### Phase 6
- [ ] Start AllTalk button (if feasible)
- [ ] Any other discovered improvements

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large refactor breaks functionality | High | Comprehensive manual testing checklist |
| Mobile memory limits | Medium | Chunked processing, streaming |
| AllTalk API changes | Low | Version detection, graceful degradation |
| Browser compatibility | Medium | Test Safari, Firefox, Chrome |

## Testing Strategy

Each phase includes a testing checklist. Key areas:
1. **Live playback mode** - Basic functionality
2. **Pre-generation mode** - Batch processing
3. **Offline mode** - Export/import cycle
4. **Mobile browsers** - Memory and performance
5. **Safari/iOS** - Autoplay and audio handling
