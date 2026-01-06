# AllTalk API Reference

## API Endpoints

**Defined in**: `src/design-system/constants.ts`

```typescript
export const API_ENDPOINTS = {
  READY: '/api/ready',                  // Server health check
  CURRENT_SETTINGS: '/api/currentsettings', // Get current TTS config
  VOICES: '/api/voices',                // List available voices
  RVC_VOICES: '/api/rvcvoices',         // List RVC (voice cloning) voices
  RELOAD_CONFIG: '/api/reload_config',  // Reload server configuration
  TTS_GENERATE: '/api/tts-generate'     // Generate TTS audio
}
```

## TTS Generation

### Endpoint

`POST /api/tts-generate`

### Request Format

**Content-Type**: `multipart/form-data`

```typescript
{
  text_input: string,      // Text to convert (max 4096 chars)
  text_filtering: string,  // "standard" or "none"
  character_voice_gen: string, // Voice filename (e.g., "female_01.wav")
  language: string,        // Language code (e.g., "en")
  output_file_name: string, // Output filename
  output_file_timestamp: string, // "true" or "false"
  autoplay: string,        // "true" or "false"
  autoplay_volume: string, // "0.8" (default)
  speed: number,           // 0.5 - 2.0
  pitch: number            // -10 to 10
}
```

### Response Format

**Content-Type**: `application/json`

```typescript
{
  output_file_url: string,  // Relative path (e.g., "outputs/audio_123.wav")
  status: string            // "generate-success" or error
}
```

### Full Audio URL Construction

```typescript
const fullAudioUrl = `${API_CONFIG.protocol}${API_CONFIG.host}:${API_CONFIG.port}/${output_file_url}`
// Example: "http://localhost:7851/outputs/audio_123.wav"
```

## Server Status

### Health Check

**Endpoint**: `GET /api/ready`

**Response**: Status indicating server readiness

### Current Settings

**Endpoint**: `GET /api/currentsettings`

**Response**:
```typescript
{
  current_voice: string,
  current_language: string,
  current_speed: number,
  current_pitch: number,
  // ... other AllTalk settings
}
```

### Reload Configuration

**Endpoint**: `POST /api/reload_config`

**Purpose**: Triggers server to reload its configuration file

## Voice Management

### Available Voices

**Endpoint**: `GET /api/voices`

**Response**:
```typescript
{
  voices: string[]  // Array of voice filenames (e.g., ["female_01.wav", "male_01.wav"])
}
```

### RVC Voices

**Endpoint**: `GET /api/rvcvoices`

**Response**: Similar to `/api/voices`, returns RVC (Real-Time Voice Cloning) voices

## Configuration

### Environment Variables

**File**: `.env` (create from `.env.example`)

```bash
# AllTalk Server Configuration
VITE_API_PROTOCOL=http://       # Protocol (http:// or https://)
VITE_API_HOST=localhost         # Hostname or IP address
VITE_API_PORT=7851              # Port number

# Connection Settings
VITE_CONNECTION_TIMEOUT=5       # Timeout in seconds for health checks

# TTS Limits
VITE_MAX_CHARACTERS=4096        # Maximum characters per TTS request
```

### Fallback Defaults

If environment variables are not set, the application uses:
- Hardcoded in `src/services/alltalkApi.ts`: `http://100.105.248.88:7851`
- **Note**: This is a local network IP and should be overridden for most environments

### Runtime Configuration

**File**: `src/config/env.ts`

```typescript
export const API_CONFIG = {
  protocol: import.meta.env.VITE_API_PROTOCOL || 'http://',
  host: import.meta.env.VITE_API_HOST || 'localhost',
  port: import.meta.env.VITE_API_PORT || '7851',
  connectionTimeout: Number(import.meta.env.VITE_CONNECTION_TIMEOUT) || 5,
  maxCharacters: Number(import.meta.env.VITE_MAX_CHARACTERS) || 4096
}
```

### User Editable Configuration

The `SettingsMonitor` component allows runtime editing of connection settings, which are stored in browser localStorage. Users can modify:
- Protocol (http:// or https://)
- Host (IP or hostname)
- Port
- Connection timeout

## External Documentation

**File**: `alltalk_api_doc_combined.md` (large file - 20,000+ lines)

**Usage**: Search for specific topics rather than reading in full
- Use Grep tool to search for endpoint names, parameter names, or features
- Example searches: "tts-generate", "output_file_url", "voice", "speed", "pitch"

## Internal Session Storage API

The application also runs an Express server that provides session storage functionality.

### Express Routes

**Server**: `http://localhost:3001` (configurable)

- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get specific session
- `POST /api/sessions` - Create/update session
- `DELETE /api/sessions/:id` - Delete session

### Session Storage Location

**File**: `data/sessions.json`

**Structure**:
```json
[
  {
    "id": "uuid-123",
    "name": "Session Name - 2025-01-06",
    "createdAt": 1736172000000,
    "updatedAt": 1736172000000,
    "text": "Full text content...",
    "paragraphs": ["Paragraph 1", "Paragraph 2"],
    "audioUrls": ["outputs/audio_1.wav", "outputs/audio_2.wav"],
    "settings": {
      "voice": "female_01.wav",
      "speed": 1.0,
      "pitch": 0,
      "language": "en"
    }
  }
]
```

**Characteristics**:
- Survives server restarts (file-based)
- Does NOT store audio blobs (only references to AllTalk server URLs)
- Requires AllTalk server to be running for audio playback
- Managed by Express API in `server.js`
