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

## Type Safety & Compilation

- **Strict TypeScript**: All code must pass `tsc --noEmit`
- **Path Aliases**: `~/` maps to `./src/` (configured in `tsconfig.json` and `vite.config.ts`)
- **Route Types**: TanStack Router auto-generates types in `src/routeTree.gen.ts`

## Debugging Tools (✨ New 2025-02-09)

### Redux DevTools (Zustand Integration)

**Access**: Install Redux DevTools browser extension

**Features**:
- Full state tree inspection
- Time-travel debugging
- State diff viewer
- Action history

**Usage**:
```typescript
// State automatically tracked in Redux DevTools
const selectedVoice = useReaderStore(state => state.ttsSettings.selectedVoice)

// In DevTools, you'll see:
// - State slices: ttsSettings, playbackSettings, textState, etc.
// - Actions: updateVoice, updatePlaybackSpeed, resetAll, etc.
// - State changes over time
```

### XState Inspector (State Machine Visualization)

**Status**: Available but not enabled by default

**To Enable**:
```typescript
// src/hooks/usePlaybackMachine.ts
import { useInterpret } from '@xstate/react'
import { inspect } from '@xstate/inspect'

// Add in development only
if (import.meta.env.DEV) {
  inspect({ iframe: false })
}
```

**Features**:
- Visual state diagram
- Current state highlighting
- Event history
- Transition visualization

**States to Watch**:
- `idle` → `loading` → `ready` → `playing` → `paused`
- Guards: `hasMoreParagraphs`, `isValidParagraphIndex`
- Actions: `incrementParagraph`, `assignAudioData`

### Browser Console Logging

**Pattern**: All logs prefixed by component/feature

**Examples**:
- `[AudioPlayer]` - Live playback mode logs
- `[BufferedPlayback]` - Buffered mode logs
- `[State Machine]` - XState transitions
- `[AudioEngine]` - Audio infrastructure logs

**Usage**: Filter console by prefix to focus on specific feature

## Common Development Tasks

### Adding a New Component

1. Create in `src/components/`
2. Use existing hooks from `src/hooks/` for state management
3. Follow Tailwind CSS patterns from `src/design-system/constants.ts`
4. Import with path alias: `import { Component } from '~/components/Component'`

### Adding State to Zustand Store

1. Add state slice to `src/state/readerStore.ts`
2. Create hook wrapper in `src/hooks/` if needed
3. Use Redux DevTools to verify state updates
4. Example:
   ```typescript
   // In readerStore.ts
   interface ReaderStore {
     myFeature: MyFeatureState
     updateMyFeature: (value: string) => void
   }

   // Hook wrapper (optional)
   export function useMyFeature() {
     const myFeature = useReaderStore(state => state.myFeature)
     const updateMyFeature = useReaderStore(state => state.updateMyFeature)
     return { myFeature, updateMyFeature }
   }
   ```

### Adding a New API Call

1. Add to appropriate service file in `src/services/api/`
2. Update `ApiStateContext` if needed for shared state
3. Use `createApiClient()` from `client.ts` for HTTP calls
4. Example:
   ```typescript
   // In src/services/api/myFeature.ts
   import { createApiClient } from './client'

   export async function myApiCall(data: Data) {
     const client = createApiClient()
     return await client.fetchJson('/api/my-endpoint', {
       method: 'POST',
       body: JSON.stringify(data)
     })
   }
   ```

### Debugging State Issues

1. **Check Redux DevTools**: Inspect state tree and action history
2. **Check Console**: Look for `[AudioPlayer]`, `[BufferedPlayback]`, `[State Machine]` logs
3. **XState Inspector**: If playback issue, enable inspector to see state transitions
4. **AudioEngine**: Check `[AudioEngine]` logs for audio playback issues
