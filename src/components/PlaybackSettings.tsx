import React, { useSyncExternalStore } from 'react';
import { PitchShifter } from '~/core/PitchShifter';

const emptySubscribe = () => () => {};

/**
 * Whether client-side pitch shifting is available in this context.
 * Reads window/isSecureContext, so it is resolved via useSyncExternalStore
 * to stay hydration-safe: the server snapshot assumes "supported" (no
 * warning flash) and the client snapshot reports the real capability.
 */
function usePitchSupported(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => PitchShifter.isSupported(),
    () => true,
  );
}

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
  const pitchSupported = usePitchSupported();

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
        <div className={pitchSupported ? '' : 'opacity-50'}>
          <div className="flex justify-between items-center">
            <label className="block text-sm text-gray-300">
              Playback Pitch: {pitchSemitones >= 0 ? '+' : ''}{pitchSemitones.toFixed(1)} st
            </label>
            <button
              onClick={() => onPitchSemitonesChange(0)}
              disabled={!pitchSupported}
              className="text-xs text-accent-primary hover:text-accent-hover disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:text-gray-600"
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
            disabled={!pitchSupported}
            className="w-full accent-accent-primary bg-dark-400 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>-12 st</span>
            <span>0 (Normal)</span>
            <span>+12 st</span>
          </div>
          {pitchSupported ? (
            <p className="text-xs text-gray-400 mt-1">
              Shift pitch in semitones without changing speed
            </p>
          ) : (
            <p className="text-xs text-accent-warning mt-1 flex items-start gap-1">
              <svg
                className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>
                Pitch control is unavailable over an insecure connection. Open the app over
                HTTPS (or localhost) to enable it.
              </span>
            </p>
          )}
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
