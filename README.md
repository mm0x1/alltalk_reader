# AllTalk Reader

A web-based audiobook application that converts text into high-quality speech using the AllTalk TTS API. Built with React 19, featuring multiple playback modes, session management, and offline export capabilities.

![reader thumbnail](public/thumbnails/reader.png)

## Overview

AllTalk Reader transforms any text into an audiobook experience with professional text-to-speech. Paste your text, choose a voice, and enjoy seamless auto-progression through paragraphs with intelligent playback controls. The application features a modern architecture with state machine-driven playback, centralized audio engine, and comprehensive session management.

## Key Features

### Playback Modes

- **Live Generation**: On-demand audio generation with auto-progression
- **Buffered Playback**: Generate audio ahead while playing for seamless continuous playback
- **Pre-Generation**: Batch generate all audio upfront for instant playback
- **Offline Mode**: Export sessions with embedded audio for playback without server connection

### Core Features

- **Dark Mode Interface**: Comfortable viewing for extended reading sessions
- **Multiple Voices**: Choose from various high-quality character voices
- **Customizable Settings**: Adjust playback speed, pitch, and language in real-time
- **Progress Tracking**: Visual indicators for current position and buffer status
- **Paragraph Navigation**: Click any paragraph to jump to that position
- **Smart Text Splitting**: Intelligently divides long text at natural boundaries (respects sentences, max 4096 chars)
- **AO3 Auto-Parsing**: Automatically detects and extracts chapter content from Archive of Our Own pages
- **Session Management**: Save, load, and delete audio sessions with persistent storage
- **Safari Compatible**: Optimized audio playback for Safari/iOS devices

### Advanced Features

- **State Machine Playback**: XState-powered state transitions eliminate race conditions
- **Redux DevTools Integration**: Inspect state, time-travel debugging, and action history
- **Real-Time Settings**: Playback speed and pitch changes apply immediately to playing audio
- **Buffer-Ahead Generation**: Configurable buffer sizes for smooth playback
- **Session Export/Import**: Download sessions as self-contained JSON files with base64-encoded audio
- **Dual Storage System**: Browser sessionStorage + Express server for optimal persistence

## Tech Stack

- **Frontend**: React 19, TanStack Router, Tailwind CSS
- **State Management**: Zustand with Redux DevTools integration
- **Playback Control**: XState state machine
- **Audio Engine**: Centralized AudioEngine with Safari compatibility layer
- **Backend**: Express.js session storage server
- **Build Tool**: Vite
- **External Dependency**: AllTalk TTS Server

## Requirements

- Node.js 18+ and pnpm
- AllTalk TTS server running (default: `http://localhost:7851`)
- Write access to `data/` directory for session storage

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd alltalk_reader
   pnpm install
   ```

2. **Configure AllTalk Connection**
   ```bash
   cp .env.example .env
   # Edit .env with your AllTalk server details
   ```

3. **Start the Application**
   ```bash
   pnpm start:all  # Starts both Vite (port 3000) and Express (port 3001)
   ```

4. **Access the App**
   - Open http://localhost:3000 in your browser

### Development Mode

```bash
# Full functionality (recommended)
pnpm start:all

# Vite only (limited - no session storage)
pnpm dev

# Production build
pnpm build
```

## Usage Guide

### Basic Workflow

1. **Input Text**: Paste your text into the input field
2. **Process Text**: Click "Process Text" to split into paragraphs
3. **Select Voice**: Choose from available voices in settings
4. **Play**: Click play button or any paragraph to start playback
5. **Adjust Settings**: Change speed, pitch, or language (applies in real-time)

### Playback Modes

**Live Mode (Default)**
- Click play → generates audio on-demand → plays immediately
- Auto-progresses to next paragraph when current finishes

**Buffered Mode**
- Click the lightning bolt icon to enable buffer playback
- Generates audio ahead while playing for seamless transitions
- View buffer status in the indicator

**Pre-Generation Mode**
- Click "Pre-Generate All Audio" to batch generate all paragraphs
- Auto-saves session to server for persistence
- Enables instant playback for any paragraph

**Offline Mode**
- Pre-generate audio first
- Click "Export/Import" → "Export Session"
- Download JSON file with embedded audio
- Import later on any device (no server needed)

### Session Management

- **Auto-Save**: Sessions are automatically saved when pre-generating audio
- **Load Session**: Click "Saved Sessions" to browse and load past sessions
- **Delete Session**: Remove unwanted sessions from the session manager
- **Storage**: Sessions persist in `data/sessions.json` on the Express server

### AO3 Integration

When you paste content from Archive of Our Own (AO3):
- App auto-detects AO3 pages (matches patterns like "Chapter X of Y", kudos, bookmarks)
- Automatically extracts chapter content, removing navigation and UI clutter
- Shows green notification with detected chapter title
- Configurable detection patterns in `src/services/textProcessing/ao3Config.ts`

### Server Configuration

- Default: `http://localhost:7851`
- Click edit button in Server Status section to change host/port
- Settings stored in localStorage and override environment variables
- Connection status indicator shows real-time health

## Advanced Features

### Debugging with Redux DevTools

1. Install Redux DevTools browser extension
2. Open DevTools while app is running
3. View state tree, action history, and state diffs
4. Time-travel through state changes

### Buffer Configuration

Customize buffer settings in the Buffer Settings panel:
- **Target Buffer Size**: Number of paragraphs to generate ahead (default: 3)
- **Minimum Buffer**: Paragraphs required before playback starts (default: 2)

### Text Processing

- **Smart Splitting**: Prefers sentence boundaries (period > semicolon > comma > space)
- **Max Chunk Size**: 4096 characters per TTS request
- **AO3 Parsing**: State machine parser extracts summary, notes, and chapter text

## Architecture Highlights

Built following **The Pragmatic Programmer** principles (DRY, Orthogonality, ETC):

- **Centralized State**: Zustand store with 9 state slices (single source of truth)
- **State Machine**: XState machine for playback (idle → loading → ready → playing → paused)
- **Audio Infrastructure**: AudioEngine with SafariAdapter for cross-browser compatibility
- **Modular API Services**: Separated concerns (TTS generation, voices, status checking)
- **Type Safety**: Strict TypeScript with path aliases (`~/` → `src/`)

## Tips for Best Results

- **Text Formatting**: Use properly formatted text with paragraph breaks
- **Long Texts**: Pre-generate audio to avoid waiting during playback
- **Offline Use**: Export sessions to play without internet connection
- **Safari/iOS**: App uses optimized audio handling for Apple devices
- **Buffer Mode**: Ideal for uninterrupted listening of long content
- **Speed Changes**: Adjust playback speed in real-time without restarting audio

## Troubleshooting

**Server Connection Issues**
- Verify AllTalk TTS server is running
- Check host/port configuration in Server Status
- Ensure firewall allows connections to AllTalk port

**Audio Playback Problems**
- Check browser audio permissions
- Verify selected voice exists on AllTalk server
- Try Safari-compatible mode if on iOS

**Session Storage Issues**
- Ensure Express server (port 3001) is running with `pnpm start:all`
- Verify `data/` directory exists and is writable
- Check `data/sessions.json` for valid JSON

**Buffered Playback**
- Reduce buffer size if experiencing memory issues
- Increase minimum buffer if playback starts too early

**Export/Import**
- Pre-generate audio before exporting
- Ensure browser allows file downloads
- Import validation requires matching paragraph and audio counts

## Development

### Project Structure

```
src/
├── state/              # Zustand store + XState machine
├── core/               # AudioEngine + SafariAdapter
├── hooks/              # React hooks (thin wrappers around state)
├── services/           # API services, text processing, session management
├── components/         # UI components
├── routes/             # TanStack Router routes
└── config/             # Environment configuration
```

### Documentation

For developers and AI agents, comprehensive documentation is available in `/docs`:
- `app-context.md` - Application overview and context
- `architecture.md` - Technical architecture and structure
- `critical-paths.md` - Core algorithms and patterns
- `playback-modes.md` - Detailed playback mode flows
- `development.md` - Development workflow and debugging
- `CLAUDE.md` - AI assistant guidelines

### Commands

```bash
pnpm start:all    # Start both servers (development)
pnpm dev          # Vite only (limited functionality)
pnpm build        # Production build with TypeScript check
```

## Environment Variables

```bash
VITE_API_PROTOCOL=http://       # http:// or https://
VITE_API_HOST=localhost         # AllTalk server host
VITE_API_PORT=7851              # AllTalk server port
VITE_CONNECTION_TIMEOUT=5       # Timeout in seconds
VITE_MAX_CHARACTERS=4096        # Max chars per TTS request
```

## License

Created for personal use. Feel free to adapt for your own needs.

## Acknowledgments

- Built with [AllTalk TTS](https://github.com/erew123/alltalk_tts)
- Architecture inspired by *The Pragmatic Programmer* (Hunt & Thomas)
- State machine implementation using [XState](https://xstate.js.org/)

---

*Last Updated: 2025-02-09*
