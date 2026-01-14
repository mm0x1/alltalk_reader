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
