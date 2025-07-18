import React from 'react';
import { getServerStatus } from '~/services/alltalkApi';

interface TtsSettingsProps {
  speed: number;
  pitch: number;
  language: string;
  onSpeedChange: (speed: number) => void;
  onPitchChange: (pitch: number) => void;
  onLanguageChange: (language: string) => void;
  className?: string;
}

export default function TtsSettings({
  speed,
  pitch,
  language,
  onSpeedChange,
  onPitchChange,
  onLanguageChange,
  className = "",
}: TtsSettingsProps) {
  const serverStatus = getServerStatus();
  const settings = serverStatus?.currentSettings;
  
  // Check if features are supported by the current TTS engine
  const speedCapable = settings?.generationspeed_capable ?? true;
  const pitchCapable = settings?.pitch_capable ?? true;
  const languageCapable = settings?.languages_capable ?? true;
  
  // Supported languages as per the AllTalk API documentation
  const languages = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'ar', name: 'Arabic' },
    { code: 'zh-cn', name: 'Chinese (Simplified)' },
    { code: 'cs', name: 'Czech' },
    { code: 'nl', name: 'Dutch' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'es', name: 'Spanish' },
    { code: 'tr', name: 'Turkish' },
  ];
  
  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2 text-gray-200">TTS Generation Settings</h3>
      
      <div className="space-y-3">
        {/* Speed setting */}
        <div className={`${!speedCapable ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between">
            <label className="block text-sm text-gray-300">Speed: {speed.toFixed(2)}x</label>
            <button 
              onClick={() => onSpeedChange(1.0)} 
              className="text-xs text-accent-primary hover:text-accent-hover"
              disabled={!speedCapable}
            >
              Reset
            </button>
          </div>
          <input
            type="range"
            min="0.25"
            max="2.0"
            step="0.05"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full accent-accent-primary bg-dark-400"
            disabled={!speedCapable}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.25x</span>
            <span>1.0x</span>
            <span>2.0x</span>
          </div>
        </div>

        {/* Pitch setting */}
        <div className={`${!pitchCapable ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between">
            <label className="block text-sm text-gray-300">Pitch: {pitch > 0 ? '+' : ''}{pitch}</label>
            <button 
              onClick={() => onPitchChange(0)} 
              className="text-xs text-accent-primary hover:text-accent-hover"
              disabled={!pitchCapable}
            >
              Reset
            </button>
          </div>
          <input
            type="range"
            min="-10"
            max="10"
            step="1"
            value={pitch}
            onChange={(e) => onPitchChange(parseInt(e.target.value))}
            className="w-full accent-accent-primary bg-dark-400"
            disabled={!pitchCapable}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>-10</span>
            <span>0</span>
            <span>+10</span>
          </div>
        </div>

        {/* Language selection */}
        <div className={`${!languageCapable ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="block text-sm mb-1 text-gray-300">Language</label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="input-field"
            disabled={!languageCapable}
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {(!speedCapable || !pitchCapable || !languageCapable) && (
        <p className="mt-2 text-xs text-accent-warning">
          Some settings are disabled because they are not supported by the current TTS engine.
        </p>
      )}
    </div>
  );
}
