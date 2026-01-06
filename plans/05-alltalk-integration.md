# Phase 5: AllTalk API Integration

This phase expands AllTalk API integration to expose more features and improve the user experience.

## Current API Usage

Currently used endpoints:
- `GET /api/ready` - Server health check
- `GET /api/currentsettings` - Get current configuration
- `GET /api/voices` - List available voices
- `GET /api/rvcvoices` - List RVC voices
- `POST /api/reload_config` - Reload configuration
- `POST /api/tts-generate` - Generate TTS audio

## Available But Unused Features

Based on the AllTalk API documentation:

### Configuration Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reload` | POST | Switch TTS models |
| `/api/deepspeed` | POST | Toggle DeepSpeed acceleration |
| `/api/lowvramsetting` | POST | Toggle Low VRAM mode |
| `/api/openai-voicemap` | PUT | Remap OpenAI voices |

### Advanced TTS Parameters
| Parameter | Range | Description |
|-----------|-------|-------------|
| `temperature` | 0.1 - 1.0 | Generation temperature |
| `repetition_penalty` | 1.0 - 20.0 | Repetition penalty |
| `narrator_enabled` | boolean | Enable narrator mode |
| `narrator_voice_gen` | string | Narrator voice |
| `text_not_inside` | string | Handle text outside quotes |

### Streaming Endpoint
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tts-generate-streaming` | POST | Streaming TTS (limited support) |

### Server Capabilities
The `/api/currentsettings` response includes capability flags:
- `streaming_capable`
- `multivoice_capable`
- `deepspeed_available`
- `lowvram_capable`
- `pitch_capable`
- `temperature_capable`

## Feature Implementations

### 5.1 Expose AllTalk Configuration in UI

**Goal**: Allow users to view and modify AllTalk settings without leaving the app.

#### Current Settings Display

Expand `SettingsMonitor` to show:
```tsx
function AllTalkSettings({ settings }: { settings: CurrentSettings }) {
  return (
    <div className="alltalk-settings">
      <h3>AllTalk Configuration</h3>

      <div className="settings-grid">
        <div className="setting-item">
          <label>Current Engine</label>
          <span>{settings.current_engine_loaded}</span>
        </div>

        <div className="setting-item">
          <label>Current Model</label>
          <span>{settings.current_model_loaded}</span>
        </div>

        <div className="setting-item">
          <label>DeepSpeed</label>
          <span className={settings.deepspeed_enabled ? 'text-green-500' : 'text-gray-500'}>
            {settings.deepspeed_enabled ? 'Enabled' : 'Disabled'}
          </span>
          {settings.deepspeed_available && (
            <button onClick={() => toggleDeepSpeed(!settings.deepspeed_enabled)}>
              Toggle
            </button>
          )}
        </div>

        <div className="setting-item">
          <label>Low VRAM Mode</label>
          <span className={settings.lowvram_enabled ? 'text-green-500' : 'text-gray-500'}>
            {settings.lowvram_enabled ? 'Enabled' : 'Disabled'}
          </span>
          {settings.lowvram_capable && (
            <button onClick={() => toggleLowVram(!settings.lowvram_enabled)}>
              Toggle
            </button>
          )}
        </div>

        <div className="setting-item">
          <label>Audio Format</label>
          <span>{settings.audio_format}</span>
        </div>

        <div className="setting-item">
          <label>Streaming</label>
          <span>{settings.streaming_capable ? 'Available' : 'Not Available'}</span>
        </div>
      </div>
    </div>
  );
}
```

#### Model Switching

```tsx
function ModelSelector({ models, currentModel, onModelChange }) {
  return (
    <div className="model-selector">
      <label>TTS Model</label>
      <select
        value={currentModel}
        onChange={(e) => onModelChange(e.target.value)}
      >
        {models.map(model => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
      <p className="help-text">
        Changing models will reload the TTS engine. This may take a moment.
      </p>
    </div>
  );
}
```

### 5.2 Advanced TTS Parameters

**Goal**: Expose temperature and repetition penalty for users who want fine-tuned control.

#### Update TTS Settings

```tsx
function AdvancedTtsSettings({
  temperature,
  repetitionPenalty,
  onTemperatureChange,
  onRepetitionPenaltyChange,
  capabilities
}) {
  return (
    <div className="advanced-settings">
      <h4>Advanced Settings</h4>

      {capabilities.temperature_capable && (
        <div className="setting-row">
          <label>Temperature</label>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.1}
            value={temperature}
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
          />
          <span>{temperature}</span>
          <p className="help-text">
            Higher values produce more varied output. Lower values are more consistent.
          </p>
        </div>
      )}

      <div className="setting-row">
        <label>Repetition Penalty</label>
        <input
          type="range"
          min={1.0}
          max={20.0}
          step={0.5}
          value={repetitionPenalty}
          onChange={(e) => onRepetitionPenaltyChange(Number(e.target.value))}
        />
        <span>{repetitionPenalty}</span>
        <p className="help-text">
          Higher values reduce repetitive speech patterns.
        </p>
      </div>
    </div>
  );
}
```

#### Update TTS Generation

```typescript
// src/services/api/tts.ts
interface TtsOptions {
  characterVoice: string;
  language: string;
  outputFileName: string;
  speed: number;
  pitch: number;
  temperature?: number;         // New
  repetitionPenalty?: number;   // New
}

async function generateTTS(text: string, options: TtsOptions) {
  const formData = new FormData();
  formData.append('text_input', text);
  formData.append('character_voice_gen', options.characterVoice);
  formData.append('language', options.language);
  formData.append('output_file_name', options.outputFileName);
  formData.append('speed', String(options.speed));
  formData.append('pitch', String(options.pitch));

  if (options.temperature !== undefined) {
    formData.append('temperature', String(options.temperature));
  }
  if (options.repetitionPenalty !== undefined) {
    formData.append('repetition_penalty', String(options.repetitionPenalty));
  }

  // ... rest of implementation
}
```

### 5.3 Narrator Mode (Future Enhancement)

**Goal**: Support dual-voice narration for audiobooks with dialogue.

**AllTalk Narrator Feature**:
- Text in `*asterisks*` = narrator voice
- Text in `"quotes"` = character voice
- `text_not_inside` controls text outside both

#### Implementation Considerations

This is a significant feature that would require:
1. UI for selecting narrator voice separately
2. Text parsing preview to show what will be narrated
3. Settings for `text_not_inside` behavior

**Recommended**: Mark as future enhancement, not Phase 5.

### 5.4 RVC Voice Support

**Goal**: Enable Real-Time Voice Conversion for voice cloning.

#### RVC Voice Selector

```tsx
function RvcVoiceSelector({
  rvcVoices,
  selectedRvcVoice,
  onRvcVoiceChange,
  rvcPitch,
  onRvcPitchChange
}) {
  return (
    <div className="rvc-settings">
      <div className="setting-row">
        <label>RVC Voice</label>
        <select
          value={selectedRvcVoice || ''}
          onChange={(e) => onRvcVoiceChange(e.target.value || null)}
        >
          <option value="">None (use base voice)</option>
          {rvcVoices.map(voice => (
            <option key={voice} value={voice}>{voice}</option>
          ))}
        </select>
      </div>

      {selectedRvcVoice && (
        <div className="setting-row">
          <label>RVC Pitch Adjustment</label>
          <input
            type="range"
            min={-24}
            max={24}
            value={rvcPitch}
            onChange={(e) => onRvcPitchChange(Number(e.target.value))}
          />
          <span>{rvcPitch}</span>
        </div>
      )}
    </div>
  );
}
```

### 5.5 Capability-Aware UI

**Goal**: Only show features that AllTalk supports.

#### Capability Context

```typescript
// src/contexts/CapabilitiesContext.tsx
interface AllTalkCapabilities {
  streaming: boolean;
  multivoice: boolean;
  deepspeed: boolean;
  lowvram: boolean;
  pitch: boolean;
  temperature: boolean;
  rvc: boolean;
  narrator: boolean;
}

const CapabilitiesContext = createContext<AllTalkCapabilities | null>(null);

export function CapabilitiesProvider({ children }) {
  const [capabilities, setCapabilities] = useState<AllTalkCapabilities | null>(null);

  useEffect(() => {
    async function loadCapabilities() {
      const settings = await getCurrentSettings();
      setCapabilities({
        streaming: settings.streaming_capable,
        multivoice: settings.multivoice_capable,
        deepspeed: settings.deepspeed_available,
        lowvram: settings.lowvram_capable,
        pitch: settings.pitch_capable,
        temperature: settings.temperature_capable,
        rvc: settings.rvc_capable ?? false,
        narrator: settings.multivoice_capable
      });
    }
    loadCapabilities();
  }, []);

  return (
    <CapabilitiesContext.Provider value={capabilities}>
      {children}
    </CapabilitiesContext.Provider>
  );
}

export function useCapabilities() {
  return useContext(CapabilitiesContext);
}
```

#### Conditional Feature Rendering

```tsx
function TtsSettings() {
  const capabilities = useCapabilities();

  return (
    <div className="tts-settings">
      {/* Always show */}
      <VoiceSelector />
      <SpeedControl />

      {/* Capability-dependent */}
      {capabilities?.pitch && <PitchControl />}
      {capabilities?.temperature && <TemperatureControl />}
      {capabilities?.rvc && <RvcVoiceSelector />}
      {capabilities?.deepspeed && <DeepSpeedToggle />}
    </div>
  );
}
```

### 5.6 Streaming TTS (Experimental)

**Note**: AllTalk streaming has limitations:
- No narrator support
- No RVC support
- Browser compatibility issues (Firefox)

**Implementation**: Consider for buffer mode as optimization.

```typescript
// Only use if capabilities.streaming is true
async function generateTTSStreaming(text: string, options: TtsOptions): Promise<string> {
  const params = new URLSearchParams({
    text: text,
    voice: options.characterVoice,
    language: options.language,
    output_file: options.outputFileName
  });

  // Returns a URL that streams audio
  return `${getApiBaseUrl()}/api/tts-generate-streaming?${params}`;
}
```

## Implementation Steps

### Step 5.1: Expand API Services

**Tasks**:
1. Add `switchModel()` to `src/services/api/status.ts`
2. Add `toggleDeepSpeed()` to `src/services/api/status.ts`
3. Add `toggleLowVram()` to `src/services/api/status.ts`
4. Add streaming generation to `src/services/api/tts.ts`
5. Update types for all new parameters

### Step 5.2: Create Capabilities Context

**Tasks**:
1. Create `src/contexts/CapabilitiesContext.tsx`
2. Parse capabilities from `/api/currentsettings`
3. Provide hook `useCapabilities()`
4. Wrap app with provider

### Step 5.3: Update Settings UI

**Tasks**:
1. Expand `SettingsMonitor` with AllTalk settings
2. Add model selector (if multiple models available)
3. Add DeepSpeed/LowVRAM toggles
4. Add advanced TTS parameters

### Step 5.4: Update TTS Settings

**Tasks**:
1. Add temperature control (if capable)
2. Add repetition penalty control
3. Add RVC voice selector (if available)
4. Update generation to include new params

### Step 5.5: Capability-Aware Rendering

**Tasks**:
1. Wrap feature sections in capability checks
2. Add loading state while capabilities load
3. Add graceful degradation for missing features

## File Structure

```
src/services/api/
├── status.ts       # Add toggleDeepSpeed, toggleLowVram, switchModel
└── tts.ts          # Add streaming, update params

src/contexts/
└── CapabilitiesContext.tsx

src/components/settings/
├── AllTalkSettings.tsx
├── ModelSelector.tsx
├── AdvancedTtsSettings.tsx
└── RvcVoiceSelector.tsx
```

## Testing Checklist

- [ ] Capabilities load from server
- [ ] Settings display correctly
- [ ] DeepSpeed toggle works (if available)
- [ ] Low VRAM toggle works (if available)
- [ ] Model switching works
- [ ] Advanced params sent in generation
- [ ] RVC voices selectable (if available)
- [ ] Features hidden when not capable
- [ ] Graceful handling of API errors

## Success Criteria

- [ ] AllTalk configuration visible in UI
- [ ] Users can toggle DeepSpeed/LowVRAM
- [ ] Users can switch models
- [ ] Advanced TTS params available
- [ ] UI adapts to server capabilities

## Estimated Scope

- **New files**: 5-7
- **Modified files**: 5-8
- **Risk level**: Low-Medium
- **Dependencies**: Phase 1 (clean API layer)
