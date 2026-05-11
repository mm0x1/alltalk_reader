import React from 'react';

interface PlaybackSettingsProps {
  speed: number;
  preservesPitch: boolean;
  pitchSemitones: number;
  onSpeedChange: (speed: number) => void;
  onPreservesPitchChange: (enabled: boolean) => void;
  onPitchSemitonesChange: (semitones: number) => void;
  className?: string;
}

export default function PlaybackSettings({
  speed,
  preservesPitch,
  pitchSemitones,
  onSpeedChange,
  onPreservesPitchChange,
  onPitchSemitonesChange,
  className = "",
}: PlaybackSettingsProps) {
  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2 text-gray-200">Playback Settings</h3>

      <div className="space-y-3">
        {/* Playback Speed */}
        <div>
          <div className="flex justify-between items-center">
            <label className="block text-sm text-gray-300">
              Playback Speed: {speed.toFixed(2)}x
            </label>
            <button
              onClick={() => onSpeedChange(1.0)}
              className="text-xs text-accent-primary hover:text-accent-hover"
            >
              Reset
            </button>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full accent-accent-primary bg-dark-400"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.5x</span>
            <span>1.0x (Normal)</span>
            <span>2.5x</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Adjust playback speed without regenerating audio
          </p>
        </div>

        {/* Playback Pitch */}
        <div>
          <div className="flex justify-between items-center">
            <label className="block text-sm text-gray-300">
              Playback Pitch: {pitchSemitones >= 0 ? '+' : ''}{pitchSemitones.toFixed(1)} st
            </label>
            <button
              onClick={() => onPitchSemitonesChange(0)}
              className="text-xs text-accent-primary hover:text-accent-hover"
            >
              Reset
            </button>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={pitchSemitones}
            onChange={(e) => onPitchSemitonesChange(parseFloat(e.target.value))}
            className="w-full accent-accent-primary bg-dark-400"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>-12 st</span>
            <span>0 (Normal)</span>
            <span>+12 st</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Shift pitch in semitones without changing speed
          </p>
        </div>

        {/* Preserve Pitch Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm text-gray-300">
              Preserve Pitch
            </label>
            <p className="text-xs text-gray-400 mt-0.5">
              {preservesPitch
                ? 'Voice pitch remains natural at all speeds'
                : 'Voice pitch changes with speed (faster = higher pitch)'}
            </p>
          </div>
          <button
            onClick={() => onPreservesPitchChange(!preservesPitch)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              preservesPitch ? 'bg-accent-primary' : 'bg-dark-400'
            }`}
            aria-label="Toggle preserve pitch"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preservesPitch ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
