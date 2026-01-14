/**
 * RVC Voice Selector Component
 *
 * Allows selection of Real-Time Voice Conversion (RVC) voices for voice cloning.
 * Only visible when VITE_ADVANCED_API_SETTINGS is enabled and RVC voices are available.
 */

import React from 'react';
import { useApiState } from '~/contexts/ApiStateContext';
import { useCapabilities } from '~/hooks/useCapabilities';

interface RvcVoiceSelectorProps {
  selectedRvcVoice: string | null;
  rvcPitch: number;
  onRvcVoiceChange: (voice: string | null) => void;
  onRvcPitchChange: (pitch: number) => void;
  defaultPitch: number;
  className?: string;
}

export default function RvcVoiceSelector({
  selectedRvcVoice,
  rvcPitch,
  onRvcVoiceChange,
  onRvcPitchChange,
  defaultPitch,
  className = '',
}: RvcVoiceSelectorProps) {
  const { state } = useApiState();
  const capabilities = useCapabilities();
  const rvcVoices = state.availableRvcVoices || [];

  // Don't render if RVC is not available or no RVC voices
  if (!capabilities.rvc || rvcVoices.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-medium mb-2 text-gray-200">Voice Cloning (RVC)</h3>
      <p className="text-xs text-gray-400 mb-3">
        Apply Real-Time Voice Conversion to clone voices.
      </p>

      <div className="space-y-3">
        {/* RVC Voice selection */}
        <div>
          <label className="block text-sm mb-1 text-gray-300">RVC Voice</label>
          <select
            value={selectedRvcVoice || ''}
            onChange={(e) => onRvcVoiceChange(e.target.value || null)}
            className="input-field"
          >
            <option value="">None (use base voice)</option>
            {rvcVoices.map((voice) => (
              <option key={voice} value={voice}>
                {voice.replace('.pth', '').replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Select an RVC model to transform the base voice.
          </p>
        </div>

        {/* RVC Pitch adjustment (only show if RVC voice is selected) */}
        {selectedRvcVoice && (
          <div>
            <div className="flex justify-between">
              <label className="block text-sm text-gray-300">
                RVC Pitch: {rvcPitch > 0 ? '+' : ''}{rvcPitch}
              </label>
              <button
                onClick={() => onRvcPitchChange(defaultPitch)}
                className="text-xs text-accent-primary hover:text-accent-hover"
              >
                Reset
              </button>
            </div>
            <input
              type="range"
              min="-24"
              max="24"
              step="1"
              value={rvcPitch}
              onChange={(e) => onRvcPitchChange(parseInt(e.target.value))}
              className="w-full accent-accent-primary bg-dark-400"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-24 (Lower)</span>
              <span>0</span>
              <span>+24 (Higher)</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Adjust pitch for gender conversion or voice matching.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
