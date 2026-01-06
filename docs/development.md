# Development Guide

## Getting Started

### Prerequisites

1. **AllTalk TTS Server** must be running (default: `localhost:7851`)
2. **Node.js** and **pnpm** installed
3. Write access to `data/` directory for session storage

### Initial Setup

1. Clone the repository
2. Create `.env` file from `.env.example` with correct AllTalk URL
3. Run `pnpm install` to install dependencies
4. Run `pnpm start:all` to launch both servers
5. Access app at `http://localhost:3000`

## Development Commands

### Core Scripts

- `pnpm dev` - Start Vite development server only (port 3000) - **Limited functionality**
- `pnpm build` - Build production version with TypeScript compilation (`vite build && tsc --noEmit`)
- `pnpm start` - Start production server
- `pnpm start:all` - **RECOMMENDED** - Start both session storage server (port 3001) and Vite dev server (port 3000)

### Important Notes

- The application requires **two servers** to function fully:
  - **Vite Dev Server** (port 3000) - Main React application
  - **Express Session Server** (port 3001) - Persistent session storage API
- Always use `pnpm start:all` (executes `./start.sh`) for full development functionality
- `start.sh` manages both servers and handles graceful shutdown on Ctrl+C
- TypeScript compilation is verified during build (`tsc --noEmit`)
- External dependency: **AllTalk TTS Server** must be running (configurable via environment variables)

## Server Management

### start.sh Script

```bash
#!/bin/bash

# Start Express session server in background
node server.js &
SERVER_PID=$!

# Start Vite dev server in foreground
pnpm dev

# On Ctrl+C, kill both servers
kill $SERVER_PID
```

### Manual Server Management

- Express only: `node server.js` (port 3001)
- Vite only: `pnpm dev` (port 3000)
- **Warning**: Running Vite only disables session saving/loading functionality

## Type Safety & Compilation

- **Strict TypeScript**: All code must pass `tsc --noEmit`
- **Path Aliases**: `~/` maps to `./src/` (configured in `tsconfig.json` and `vite.config.ts`)
- **Route Types**: TanStack Router auto-generates types in `src/routeTree.gen.ts`

## Common Development Tasks

### Adding a New Component

1. Create in `src/components/`
2. Use existing hooks from `src/hooks/` for state management
3. Follow Tailwind CSS patterns from `src/design-system/constants.ts`
4. Import with path alias: `import { Component } from '~/components/Component'`

### Adding a New API Call

1. Add to appropriate service file in `src/services/api/`
2. Update `ApiStateContext` if needed for shared state
3. Do NOT modify `alltalkApi.ts` (deprecated)
4. Use `createApiClient()` from `client.ts` for HTTP calls

### Adding a New Hook

1. Create in `src/hooks/`
2. Follow the single-responsibility pattern
3. Co-locate with `reader.tsx` usage
4. Export typed return values
5. Document state management patterns

### Debugging Session Issues

1. Check Express server logs (console where `node server.js` runs)
2. Inspect `data/sessions.json` file directly
3. Check browser sessionStorage (DevTools → Application → Session Storage)
4. Verify AllTalk server is reachable (SettingsMonitor status badge)

### Debugging Audio Issues

1. Check browser console for playback errors
2. Verify AllTalk server is generating audio files
3. Test audio URL directly in browser
4. Check Safari-specific issues (autoplay blocking)
5. Verify audio format is compatible (WAV recommended)

## Testing & Quality Assurance

### Manual Testing Checklist

#### Live Mode
- [ ] Text input and paragraph splitting works
- [ ] Single paragraph playback works
- [ ] Auto-progression advances to next paragraph
- [ ] Pause/resume works correctly
- [ ] Safari/iOS playback works without autoplay issues

#### Batch Mode
- [ ] Pre-generate all audio completes successfully
- [ ] Progress UI updates correctly
- [ ] Session auto-saves after generation
- [ ] Cached audio plays instantly
- [ ] Settings changes reset pre-generated status

#### Offline Mode
- [ ] Export with cached blobs works (offline)
- [ ] Export without cache downloads from server
- [ ] Exported JSON file structure is valid
- [ ] Import loads session correctly
- [ ] Offline session plays without server connection

#### Session Management
- [ ] Sessions list displays correctly
- [ ] Load session restores text, paragraphs, settings, audio
- [ ] Delete session removes from list and file
- [ ] Session search/filter works (if implemented)

#### Error Handling
- [ ] Disconnected AllTalk server shows appropriate error
- [ ] Network failures during playback are handled gracefully
- [ ] Invalid imported sessions are rejected with clear errors
- [ ] Browser autoplay blocking is detected and handled

## Known Technical Debt

1. **Memory Management**: Object URLs from `getOfflineAudioUrl()` are never revoked
   - **Fix**: Add `URL.revokeObjectURL()` calls on component unmount or session change

2. **Hardcoded Default IP**: `100.105.248.88:7851` is a local network IP
   - **Fix**: Remove hardcoded default, require explicit env configuration

3. **sessionStorage Limits**: Browser sessionStorage has ~5-10MB limit
   - **Issue**: Large audio caches can exceed limit
   - **Fix**: Implement IndexedDB for larger storage or add cache size limits

4. **No Audio Preloading**: Audio elements load on play, causing slight delays
   - **Fix**: Implement `<audio preload="auto">` for next paragraph

5. **Safari Audio Element Reuse**: Current implementation works but could be cleaner
   - **Fix**: Use single Audio element pattern for all browsers (not just Safari)

## Performance Optimization Opportunities

1. **Batch Generation**: Currently sequential, could parallelize (with rate limiting)
2. **Text Splitting**: Regex-based approach could be faster than string operations
3. **Session List**: Could implement pagination for users with many sessions
4. **Audio Caching**: Could use Service Worker for better offline support

## Architecture Migration

### Active Migrations

#### 1. Global State → React Context

**Status**: In Progress

**Old Pattern**:
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

#### 2. Monolithic API Service → Modular Services

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

## Best Practices

### When Making Changes

1. Use `pnpm start:all` for full functionality (both servers required)
2. Prefer modular API services over deprecated `alltalkApi.ts`
3. Add new state via custom hooks (co-located with `reader.tsx`)
4. Follow existing Tailwind CSS patterns from `design-system/constants.ts`
5. Test all three playback modes after changes
6. Ensure TypeScript compilation passes (`tsc --noEmit`)

### Code Style

- Use TypeScript strict mode
- Follow functional React patterns (hooks, not classes)
- Prefer composition over inheritance
- Keep components focused and single-purpose
- Document complex logic with inline comments

### State Management

- Use custom hooks for domain-specific state
- Avoid global state (use React Context for truly global needs)
- Co-locate hooks with their primary consumer
- Expose clear, typed interfaces from hooks

### Error Handling

- Always handle network failures gracefully
- Provide user-friendly error messages
- Log detailed errors to console for debugging
- Implement timeout guards for async operations
- Validate external data (imported sessions, API responses)

## File Reference (Critical Paths)

### Core Services
- `src/services/alltalkApi.ts` - **DEPRECATED** legacy API wrapper
- `src/services/api/client.ts` - HTTP client with timeout & retry
- `src/services/api/status.ts` - Server health checks
- `src/services/api/voices.ts` - Voice management
- `src/services/api/tts.ts` - **CRITICAL** TTS generation & text splitting
- `src/services/sessionStorage.ts` - Session CRUD, export/import, offline audio

### State Management
- `src/hooks/useAudioPlayer.ts` - **CRITICAL** Playback logic & auto-progression
- `src/hooks/useBatchAudioGeneration.ts` - Batch generation orchestration
- `src/hooks/useSessionSaver.ts` - Auto-save after batch
- `src/hooks/useTextProcessor.ts` - Text input & splitting
- `src/hooks/useTtsSettings.ts` - TTS configuration
- `src/hooks/useBatchGeneration.ts` - Pre-generated audio state
- `src/hooks/useModalState.ts` - UI modal visibility
- `src/hooks/useSessionManager.ts` - Session loading

### UI Components
- `src/routes/reader.tsx` - **MAIN ROUTE** UI orchestrator (520 lines)
- `src/components/BatchGenerator.tsx` - Pre-generation UI
- `src/components/ExportImportManager.tsx` - Export/import UI
- `src/components/SessionManager.tsx` - Session modal wrapper
- `src/components/SessionList.tsx` - Session browser
- `src/components/ParagraphList.tsx` - Paragraph display
- `src/components/SettingsMonitor.tsx` - Connection status & config

### Configuration & Server
- `src/config/env.ts` - Environment variable handling
- `src/design-system/constants.ts` - Design tokens & API endpoints
- `src/contexts/ApiStateContext.tsx` - New centralized API state
- `server.js` - Express session storage server (port 3001)
- `start.sh` - Dual server startup script

### Build & Config
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `package.json` - Dependencies & scripts
